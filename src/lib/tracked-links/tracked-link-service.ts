import type { RoleName } from "@/core/entities/user";
import type {
  TrackedLink,
  TrackedLinkEventAppendResult,
  TrackedLinkEventType,
  TrackedLinkTargetKind,
  TrackedLinkWithPerformance,
} from "@/core/entities/tracked-link";
import type { OfferRepository } from "@/core/use-cases/OfferRepository";
import type { BlogPostRepository } from "@/core/use-cases/BlogPostRepository";
import type { TrackedLinkRepository } from "@/core/use-cases/TrackedLinkRepository";
import {
  AuthorizationError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/core/common/errors";
import {
  getOfferRepository,
  getBlogPostRepository,
  getTrackedLinkRepository,
} from "@/adapters/RepositoryFactory";
import { generateReferralCode } from "@/lib/referral/generate-code";

export interface TrackedLinkActor {
  userId: string;
  role: RoleName;
}

export interface CreateTrackedLinkForOfferInput {
  offerId: string;
  label?: string | null;
  purpose?: string | null;
  createdFromConversationId?: string | null;
}

export interface CreateTrackedLinkForContentInput {
  contentId: string;
  label?: string | null;
  purpose?: string | null;
  createdFromConversationId?: string | null;
}

export interface CreateTrackedLinkForUrlInput {
  destinationUrl: string;
  label: string;
  purpose?: string | null;
  targetKind?: TrackedLinkTargetKind;
  targetId?: string | null;
  createdFromConversationId?: string | null;
}

export interface TrackedVisitInput {
  code: string;
  anonymousVisitId: string;
  userAgent?: string | null;
  ip?: string | null;
}

export class TrackedLinkService {
  constructor(
    private readonly trackedLinks: TrackedLinkRepository,
    private readonly offers: OfferRepository,
    private readonly blogPosts: BlogPostRepository,
    private readonly codeGenerator: () => string = generateReferralCode,
  ) {}

  async createForOffer(
    actor: TrackedLinkActor,
    input: CreateTrackedLinkForOfferInput,
  ): Promise<TrackedLink> {
    assertSignedInActor(actor);
    const offer = await this.offers.findById(input.offerId);
    if (!offer) {
      throw new NotFoundError("Offer not found.");
    }
    if (offer.ownerUserId !== actor.userId && actor.role !== "STAFF" && actor.role !== "ADMIN") {
      throw new ForbiddenError("You cannot create links for another user's offer.");
    }
    if (offer.status !== "published" || offer.visibility !== "public" || offer.archivedAt) {
      throw new ValidationError("Only published public offers can receive a public tracked link.");
    }

    const code = await this.allocateCode();
    const destinationUrl = `/offers/${encodeURIComponent(offer.slug)}?tl=${encodeURIComponent(code)}`;

    return this.trackedLinks.create({
      code,
      ownerUserId: offer.ownerUserId,
      targetKind: "offer",
      targetId: offer.id,
      destinationUrl,
      label: normalizeLabel(input.label) ?? offer.title,
      purpose: normalizeLabel(input.purpose) ?? "offer",
      createdFromConversationId: normalizeNullableId(input.createdFromConversationId),
    });
  }

  async createForContentItem(
    actor: TrackedLinkActor,
    input: CreateTrackedLinkForContentInput,
  ): Promise<TrackedLink> {
    assertSignedInActor(actor);
    const post = await this.blogPosts.findById(input.contentId);
    if (!post) {
      throw new NotFoundError("Content item not found.");
    }
    if (post.createdByUserId !== actor.userId && actor.role !== "STAFF" && actor.role !== "ADMIN") {
      throw new ForbiddenError("You cannot create links for another user's content.");
    }
    if (post.status !== "published") {
      throw new ValidationError("Only published public content can receive a public tracked link.");
    }

    const code = await this.allocateCode();
    const destinationUrl = `/feed/${encodeURIComponent(post.slug)}?tl=${encodeURIComponent(code)}`;

    return this.trackedLinks.create({
      code,
      ownerUserId: post.createdByUserId,
      targetKind: "content_item",
      targetId: post.id,
      destinationUrl,
      label: normalizeLabel(input.label) ?? post.title,
      purpose: normalizeLabel(input.purpose) ?? "content",
      createdFromConversationId: normalizeNullableId(input.createdFromConversationId),
    });
  }

  async createForPublicUrl(
    actor: TrackedLinkActor,
    input: CreateTrackedLinkForUrlInput,
  ): Promise<TrackedLink> {
    assertSignedInActor(actor);
    const destinationUrl = normalizeOwnedPublicDestination(input.destinationUrl);
    const code = await this.allocateCode();

    return this.trackedLinks.create({
      code,
      ownerUserId: actor.userId,
      targetKind: input.targetKind ?? "url",
      targetId: normalizeNullableId(input.targetId) ?? destinationUrl,
      destinationUrl,
      label: requireLabel(input.label, "Tracked link label"),
      purpose: normalizeLabel(input.purpose) ?? "share",
      createdFromConversationId: normalizeNullableId(input.createdFromConversationId),
    });
  }

  async archive(actor: TrackedLinkActor, trackedLinkId: string): Promise<TrackedLink> {
    assertSignedInActor(actor);
    const link = await this.requireOwnedLink(actor, trackedLinkId);
    const archived = await this.trackedLinks.update(link.id, {
      status: "archived",
      archivedAt: new Date().toISOString(),
    });
    if (!archived) {
      throw new NotFoundError("Tracked link not found.");
    }
    return archived;
  }

  async findActiveByCode(code: string): Promise<TrackedLink | null> {
    const link = await this.trackedLinks.findByCode(code);
    if (!link || link.status !== "active" || link.archivedAt) {
      return null;
    }
    return link;
  }

  async listOwnerLinks(actor: TrackedLinkActor): Promise<TrackedLinkWithPerformance[]> {
    assertSignedInActor(actor);
    return this.trackedLinks.listWithPerformanceByOwnerUserId(actor.userId);
  }

  async recordPublicVisit(input: TrackedVisitInput): Promise<{
    link: TrackedLink | null;
    event: TrackedLinkEventAppendResult | null;
  }> {
    const link = await this.findActiveByCode(input.code);
    if (!link) {
      return { link: null, event: null };
    }

    const event = await this.appendLinkEvent({
      link,
      eventType: "visit",
      anonymousVisitId: input.anonymousVisitId,
      offerId: link.targetKind === "offer" ? link.targetId : null,
      idempotencyKey: `visit:${input.anonymousVisitId}`,
      metadata: {
        userAgent: input.userAgent ?? null,
        ip: input.ip ?? null,
      },
    });

    return { link, event };
  }

  async recordOfferViewedByCode(input: {
    code: string;
    offerId: string;
    anonymousVisitId?: string | null;
  }): Promise<TrackedLinkEventAppendResult | null> {
    const link = await this.findActiveByCode(input.code);
    if (!link || link.targetKind !== "offer" || link.targetId !== input.offerId) {
      return null;
    }

    await this.offers.createEvent({
      offerId: input.offerId,
      eventType: "viewed",
      trackedLinkId: link.id,
      metadata: { source: "tracked_link", code: link.code },
    });

    return this.appendLinkEvent({
      link,
      eventType: "offer_viewed",
      anonymousVisitId: input.anonymousVisitId,
      offerId: input.offerId,
      idempotencyKey: input.anonymousVisitId
        ? `offer_viewed:${input.offerId}:${input.anonymousVisitId}`
        : null,
    });
  }

  async recordChatStarted(input: {
    code: string;
    anonymousVisitId: string;
    conversationId: string;
    userId: string;
  }): Promise<TrackedLinkEventAppendResult | null> {
    const link = await this.findActiveByCode(input.code);
    if (!link) {
      return null;
    }

    return this.appendLinkEvent({
      link,
      eventType: "chat_started",
      anonymousVisitId: input.anonymousVisitId,
      conversationId: input.conversationId,
      userId: input.userId,
      offerId: link.targetKind === "offer" ? link.targetId : null,
      idempotencyKey: `chat_started:${input.conversationId}`,
    });
  }

  async recordSignupForConversations(input: {
    conversationIds: readonly string[];
    userId: string;
  }): Promise<void> {
    const events = await this.trackedLinks.listEventsByConversationIds(input.conversationIds);
    const trackedLinkIds = Array.from(new Set(events.map((event) => event.trackedLinkId)));

    for (const trackedLinkId of trackedLinkIds) {
      const link = await this.trackedLinks.findById(trackedLinkId);
      if (!link || link.status !== "active" || link.archivedAt) {
        continue;
      }
      const firstEvent = events.find((event) => event.trackedLinkId === trackedLinkId);
      await this.appendLinkEvent({
        link,
        eventType: "signup",
        anonymousVisitId: firstEvent?.anonymousVisitId ?? null,
        conversationId: firstEvent?.conversationId ?? null,
        userId: input.userId,
        offerId: link.targetKind === "offer" ? link.targetId : null,
        idempotencyKey: `signup:${input.userId}`,
      });
    }
  }

  async recordOfferOutcome(input: {
    trackedLinkId: string | null | undefined;
    offerId: string;
    eventType: "offer_chosen" | "purchase_simulated";
    conversationId?: string | null;
    userId?: string | null;
    personRef?: string | null;
  }): Promise<TrackedLinkEventAppendResult | null> {
    if (!input.trackedLinkId) {
      return null;
    }
    const link = await this.trackedLinks.findById(input.trackedLinkId);
    if (!link || link.status !== "active" || link.archivedAt) {
      return null;
    }
    if (link.targetKind === "offer" && link.targetId !== input.offerId) {
      return null;
    }

    const subject = input.conversationId ?? input.userId ?? input.personRef ?? "anonymous";
    return this.appendLinkEvent({
      link,
      eventType: input.eventType,
      conversationId: input.conversationId,
      userId: input.userId,
      offerId: input.offerId,
      idempotencyKey: `${input.eventType}:${input.offerId}:${subject}`,
    });
  }

  private async appendLinkEvent(input: {
    link: TrackedLink;
    eventType: TrackedLinkEventType;
    anonymousVisitId?: string | null;
    conversationId?: string | null;
    userId?: string | null;
    referralId?: string | null;
    offerId?: string | null;
    idempotencyKey?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<TrackedLinkEventAppendResult> {
    return this.trackedLinks.appendEvent({
      trackedLinkId: input.link.id,
      eventType: input.eventType,
      anonymousVisitId: input.anonymousVisitId,
      conversationId: input.conversationId,
      userId: input.userId,
      referralId: input.referralId,
      offerId: input.offerId,
      idempotencyKey: input.idempotencyKey,
      metadata: input.metadata,
    });
  }

  private async requireOwnedLink(actor: TrackedLinkActor, trackedLinkId: string): Promise<TrackedLink> {
    const link = await this.trackedLinks.findById(trackedLinkId);
    if (!link) {
      throw new NotFoundError("Tracked link not found.");
    }
    if (link.ownerUserId !== actor.userId && actor.role !== "STAFF" && actor.role !== "ADMIN") {
      throw new ForbiddenError("You cannot manage another user's tracked link.");
    }
    return link;
  }

  private async allocateCode(): Promise<string> {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const candidate = this.codeGenerator();
      if (!candidate || candidate.length > 48) {
        continue;
      }
      const existing = await this.trackedLinks.findByCode(candidate);
      if (!existing) {
        return candidate;
      }
    }

    throw new Error("Unable to allocate unique tracked link code.");
  }
}

let cachedService: TrackedLinkService | null = null;

export function createTrackedLinkService(
  trackedLinks: TrackedLinkRepository = getTrackedLinkRepository(),
  offers: OfferRepository = getOfferRepository(),
  blogPosts: BlogPostRepository = getBlogPostRepository(),
  codeGenerator?: () => string,
): TrackedLinkService {
  return new TrackedLinkService(trackedLinks, offers, blogPosts, codeGenerator);
}

export function getTrackedLinkService(): TrackedLinkService {
  if (!cachedService) {
    cachedService = createTrackedLinkService();
  }
  return cachedService;
}

function assertSignedInActor(actor: TrackedLinkActor): void {
  if (!actor.userId || actor.role === "ANONYMOUS") {
    throw new AuthorizationError("Authentication required to manage tracked links.");
  }
}

function normalizeLabel(value: string | null | undefined): string | null {
  const normalized = (value ?? "").trim().replace(/\s+/g, " ").slice(0, 160);
  return normalized || null;
}

function requireLabel(value: string | null | undefined, label: string): string {
  const normalized = normalizeLabel(value);
  if (!normalized) {
    throw new ValidationError(`${label} is required.`);
  }
  return normalized;
}

function normalizeNullableId(value: string | null | undefined): string | null {
  const normalized = normalizeLabel(value);
  return normalized || null;
}

function normalizeOwnedPublicDestination(destinationUrl: string): string {
  const trimmed = destinationUrl.trim();
  if (!trimmed.startsWith("/")) {
    throw new ValidationError("Tracked links must point to a public Ordo path.");
  }
  if (
    trimmed.startsWith("/api/")
    || trimmed.startsWith("/admin")
    || trimmed.startsWith("/jobs")
    || trimmed.startsWith("/operations")
    || trimmed.startsWith("/business")
    || trimmed.startsWith("/studio")
  ) {
    throw new ValidationError("Tracked links cannot target internal governance or diagnostic routes.");
  }
  return trimmed;
}
