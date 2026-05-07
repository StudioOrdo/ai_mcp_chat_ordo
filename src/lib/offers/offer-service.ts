import type { RoleName } from "@/core/entities/user";
import {
  isOfferBillingKind,
  isOfferVisibility,
  type Offer,
  type OfferBillingKind,
  type OfferEvent,
  type OfferEventType,
  type OfferVisibility,
} from "@/core/entities/offer";
import type { OfferRepository } from "@/core/use-cases/OfferRepository";
import type { TrackedLinkRepository } from "@/core/use-cases/TrackedLinkRepository";
import {
  AuthorizationError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/core/common/errors";
import {
  getOfferRepository,
  getTrackedLinkRepository,
} from "@/adapters/RepositoryFactory";
import { createTrackedLinkService } from "@/lib/tracked-links/tracked-link-service";

const DEFAULT_CURRENCY = "USD";
const DEFAULT_CTA_LABEL = "Start a conversation";
const MAX_LONG_TEXT = 5_000;

export interface OfferActor {
  userId: string;
  role: RoleName;
}

export interface CreateOfferDraftInput {
  title: string;
  summary?: string | null;
  description?: string | null;
  audience?: string | null;
  promise?: string | null;
  priceCents?: number | null;
  currency?: string | null;
  billingKind?: OfferBillingKind | string | null;
  estimatedMinutes?: number | null;
  visibility?: OfferVisibility | string | null;
  ctaLabel?: string | null;
  createdFromConversationId?: string | null;
  createdFromMessageId?: string | null;
}

export interface UpdateOfferInput extends Partial<CreateOfferDraftInput> {
  offerId: string;
}

export interface OfferEventInput {
  offerId: string;
  eventType: OfferEventType;
  actorUserId?: string | null;
  personRef?: string | null;
  conversationId?: string | null;
  messageId?: string | null;
  trackedLinkId?: string | null;
  metadata?: Record<string, unknown>;
}

export class OfferService {
  constructor(
    private readonly repository: OfferRepository,
    private readonly trackedLinks?: TrackedLinkRepository,
  ) {}

  async createDraft(actor: OfferActor, input: CreateOfferDraftInput): Promise<Offer> {
    assertSignedInActor(actor);

    const title = requireText(input.title, "Offer title");
    const billingKind = normalizeBillingKind(input.billingKind, input.priceCents);
    const priceCents = normalizePriceCents(input.priceCents, billingKind);
    const summary = normalizeOptionalText(input.summary) || title;
    const description = normalizeLongText(input.description) || summary;
    const promise = normalizeOptionalText(input.promise) || summary;
    const audience = normalizeOptionalText(input.audience) || "People who need this outcome";
    const slug = await this.allocateSlug(title);

    const offer = await this.repository.create({
      slug,
      ownerUserId: actor.userId,
      title,
      summary,
      description,
      audience,
      promise,
      priceCents,
      currency: normalizeCurrency(input.currency),
      billingKind,
      estimatedMinutes: normalizeEstimatedMinutes(input.estimatedMinutes),
      status: "draft",
      visibility: normalizeVisibility(input.visibility),
      ctaLabel: normalizeOptionalText(input.ctaLabel) || DEFAULT_CTA_LABEL,
      createdFromConversationId: normalizeNullableId(input.createdFromConversationId),
      createdFromMessageId: normalizeNullableId(input.createdFromMessageId),
    });

    await this.repository.createEvent({
      offerId: offer.id,
      eventType: "created",
      actorUserId: actor.userId,
      conversationId: offer.createdFromConversationId,
      messageId: offer.createdFromMessageId,
      metadata: { source: offer.createdFromConversationId ? "conversation" : "ui" },
    });

    return offer;
  }

  async updateOffer(actor: OfferActor, input: UpdateOfferInput): Promise<Offer> {
    assertSignedInActor(actor);
    const existing = await this.requireOwnedOffer(actor, input.offerId);
    const nextTitle = input.title === undefined ? existing.title : requireText(input.title, "Offer title");
    const nextBillingKind = input.billingKind === undefined
      ? existing.billingKind
      : normalizeBillingKind(input.billingKind, input.priceCents ?? existing.priceCents);
    const patch = {
      ...(nextTitle !== existing.title ? { title: nextTitle, slug: await this.allocateSlug(nextTitle, existing.id) } : {}),
      ...(input.summary !== undefined ? { summary: normalizeOptionalText(input.summary) || nextTitle } : {}),
      ...(input.description !== undefined ? { description: normalizeLongText(input.description) || existing.description } : {}),
      ...(input.audience !== undefined ? { audience: normalizeOptionalText(input.audience) || existing.audience } : {}),
      ...(input.promise !== undefined ? { promise: normalizeOptionalText(input.promise) || existing.promise } : {}),
      ...(input.priceCents !== undefined || input.billingKind !== undefined
        ? { priceCents: normalizePriceCents(input.priceCents ?? existing.priceCents, nextBillingKind), billingKind: nextBillingKind }
        : {}),
      ...(input.currency !== undefined ? { currency: normalizeCurrency(input.currency) } : {}),
      ...(input.estimatedMinutes !== undefined ? { estimatedMinutes: normalizeEstimatedMinutes(input.estimatedMinutes) } : {}),
      ...(input.visibility !== undefined ? { visibility: normalizeVisibility(input.visibility) } : {}),
      ...(input.ctaLabel !== undefined ? { ctaLabel: normalizeOptionalText(input.ctaLabel) || DEFAULT_CTA_LABEL } : {}),
      status: existing.status === "published" ? "published" as const : "draft" as const,
    };

    const updated = await this.repository.update(existing.id, patch);
    if (!updated) {
      throw new NotFoundError("Offer not found.");
    }

    await this.repository.createEvent({
      offerId: updated.id,
      eventType: "updated",
      actorUserId: actor.userId,
      metadata: { updatedFields: Object.keys(patch) },
    });

    return updated;
  }

  async publishOffer(actor: OfferActor, offerId: string): Promise<Offer> {
    assertSignedInActor(actor);
    const existing = await this.requireOwnedOffer(actor, offerId);
    assertPublishable(existing);
    const now = new Date().toISOString();
    const published = await this.repository.update(existing.id, {
      status: "published",
      visibility: "public",
      publishedAt: existing.publishedAt ?? now,
      archivedAt: null,
    });

    if (!published) {
      throw new NotFoundError("Offer not found.");
    }

    await this.repository.createEvent({
      offerId: published.id,
      eventType: "published",
      actorUserId: actor.userId,
      metadata: { visibility: "public" },
    });

    return published;
  }

  async archiveOffer(actor: OfferActor, offerId: string): Promise<Offer> {
    assertSignedInActor(actor);
    const existing = await this.requireOwnedOffer(actor, offerId);
    const archived = await this.repository.update(existing.id, {
      status: "archived",
      visibility: "private",
      archivedAt: new Date().toISOString(),
    });

    if (!archived) {
      throw new NotFoundError("Offer not found.");
    }

    await this.repository.createEvent({
      offerId: archived.id,
      eventType: "archived",
      actorUserId: actor.userId,
    });

    return archived;
  }

  async recordPrivateSend(
    actor: OfferActor,
    offerId: string,
    input: Omit<OfferEventInput, "offerId" | "eventType" | "actorUserId"> = {},
  ): Promise<OfferEvent> {
    assertSignedInActor(actor);
    await this.requireOwnedOffer(actor, offerId);
    return this.repository.createEvent({
      offerId,
      eventType: "sent_private",
      actorUserId: actor.userId,
      ...input,
    });
  }

  async recordOfferChoice(input: Omit<OfferEventInput, "eventType">): Promise<OfferEvent> {
    const offer = await this.repository.findById(input.offerId);
    if (!offer || offer.status !== "published" || offer.visibility !== "public" || offer.archivedAt) {
      throw new NotFoundError("Published offer not found.");
    }

    const event = await this.repository.createEvent({
      ...input,
      eventType: "chosen",
    });

    if (input.trackedLinkId && this.trackedLinks) {
      await createTrackedLinkService(this.trackedLinks, this.repository).recordOfferOutcome({
        trackedLinkId: input.trackedLinkId,
        offerId: input.offerId,
        eventType: "offer_chosen",
        conversationId: input.conversationId,
        userId: input.actorUserId,
        personRef: input.personRef,
      });
    }

    return event;
  }

  async recordSimulatedPurchase(input: Omit<OfferEventInput, "eventType">): Promise<OfferEvent> {
    const offer = await this.repository.findById(input.offerId);
    if (!offer || offer.status !== "published" || offer.visibility !== "public" || offer.archivedAt) {
      throw new NotFoundError("Published offer not found.");
    }

    const event = await this.repository.createEvent({
      ...input,
      eventType: "purchase_simulated",
    });

    if (input.trackedLinkId && this.trackedLinks) {
      await createTrackedLinkService(this.trackedLinks, this.repository).recordOfferOutcome({
        trackedLinkId: input.trackedLinkId,
        offerId: input.offerId,
        eventType: "purchase_simulated",
        conversationId: input.conversationId,
        userId: input.actorUserId,
        personRef: input.personRef,
      });
    }

    return event;
  }

  async listOwnerOffers(actor: OfferActor): Promise<Offer[]> {
    assertSignedInActor(actor);
    return this.repository.listByOwnerUserId(actor.userId);
  }

  async listPublicOffers(): Promise<Offer[]> {
    return this.repository.listPublishedPublic();
  }

  async findPublicOfferBySlug(slug: string): Promise<Offer | null> {
    const offer = await this.repository.findBySlug(slug);
    if (!offer || offer.status !== "published" || offer.visibility !== "public" || offer.archivedAt) {
      return null;
    }

    return offer;
  }

  async listOfferEvents(actor: OfferActor, offerId: string): Promise<OfferEvent[]> {
    assertSignedInActor(actor);
    await this.requireOwnedOffer(actor, offerId);
    return this.repository.listEventsByOfferId(offerId);
  }

  private async requireOwnedOffer(actor: OfferActor, offerId: string): Promise<Offer> {
    const offer = await this.repository.findById(offerId);
    if (!offer) {
      throw new NotFoundError("Offer not found.");
    }
    if (offer.ownerUserId !== actor.userId && actor.role !== "STAFF" && actor.role !== "ADMIN") {
      throw new ForbiddenError("You cannot manage another user's offer.");
    }

    return offer;
  }

  private async allocateSlug(title: string, existingOfferId?: string): Promise<string> {
    const base = slugify(title) || "offer";
    let candidate = base;
    let suffix = 2;

    while (true) {
      const existing = await this.repository.findBySlug(candidate);
      if (!existing || existing.id === existingOfferId) {
        return candidate;
      }
      candidate = `${base}-${suffix}`;
      suffix += 1;
    }
  }
}

let cachedService: OfferService | null = null;

export function createOfferService(
  repository: OfferRepository = getOfferRepository(),
  trackedLinks: TrackedLinkRepository = getTrackedLinkRepository(),
): OfferService {
  return new OfferService(repository, trackedLinks);
}

export function getOfferService(): OfferService {
  if (!cachedService) {
    cachedService = createOfferService();
  }
  return cachedService;
}

function assertSignedInActor(actor: OfferActor): void {
  if (!actor.userId || actor.role === "ANONYMOUS") {
    throw new AuthorizationError("Authentication required to manage offers.");
  }
}

function assertPublishable(offer: Offer): void {
  if (offer.status === "archived") {
    throw new ValidationError("Archived offers cannot be published.");
  }
  if (!offer.title.trim()) {
    throw new ValidationError("Offer title is required before publishing.");
  }
  if (!offer.promise.trim() && !offer.description.trim()) {
    throw new ValidationError("Offer promise or description is required before publishing.");
  }
  if (!offer.ctaLabel.trim()) {
    throw new ValidationError("Offer CTA is required before publishing.");
  }
  if ((offer.billingKind === "fixed" || offer.billingKind === "hourly")
    && (!Number.isInteger(offer.priceCents) || (offer.priceCents ?? 0) <= 0)) {
    throw new ValidationError("Publish requires a price, free billing, or contact-for-price billing.");
  }
}

function requireText(value: string | null | undefined, label: string): string {
  const normalized = normalizeOptionalText(value);
  if (!normalized) {
    throw new ValidationError(`${label} is required.`);
  }

  return normalized;
}

function normalizeOptionalText(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/\s+/g, " ").slice(0, 240);
}

function normalizeLongText(value: string | null | undefined): string {
  return (value ?? "").trim().slice(0, MAX_LONG_TEXT);
}

function normalizeNullableId(value: string | null | undefined): string | null {
  const normalized = normalizeOptionalText(value);
  return normalized || null;
}

function normalizeBillingKind(
  value: OfferBillingKind | string | null | undefined,
  priceCents: number | null | undefined,
): OfferBillingKind {
  if (value && isOfferBillingKind(value)) {
    return value;
  }

  return typeof priceCents === "number" && priceCents > 0 ? "fixed" : "contact";
}

function normalizePriceCents(
  value: number | null | undefined,
  billingKind: OfferBillingKind,
): number | null {
  if (billingKind === "free") {
    return 0;
  }
  if (billingKind === "contact") {
    return null;
  }
  if (!Number.isInteger(value) || (value ?? 0) <= 0) {
    return null;
  }

  return value ?? null;
}

function normalizeEstimatedMinutes(value: number | null | undefined): number | null {
  if (!Number.isInteger(value) || (value ?? 0) <= 0) {
    return null;
  }

  return value ?? null;
}

function normalizeCurrency(value: string | null | undefined): string {
  const normalized = (value ?? DEFAULT_CURRENCY).trim().toUpperCase();
  return /^[A-Z]{3}$/.test(normalized) ? normalized : DEFAULT_CURRENCY;
}

function normalizeVisibility(value: OfferVisibility | string | null | undefined): OfferVisibility {
  return value && isOfferVisibility(value) ? value : "private";
}

function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72)
    .replace(/-+$/g, "");
}
