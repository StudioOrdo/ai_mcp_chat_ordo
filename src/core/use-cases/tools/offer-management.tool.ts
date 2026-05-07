import type { Offer } from "@/core/entities/offer";
import type { ToolCommand } from "@/core/tool-registry/ToolCommand";
import type { ToolDescriptor } from "@/core/tool-registry/ToolDescriptor";
import type { ToolExecutionContext } from "@/core/tool-registry/ToolExecutionContext";
import type { OfferService } from "@/lib/offers/offer-service";
import { projectOfferToOrdoCard } from "@/lib/ordo-cards/ordo-card-projectors";

export interface CreateOfferInput {
  title: string;
  summary?: string;
  description?: string;
  audience?: string;
  promise?: string;
  price_cents?: number | null;
  currency?: string;
  billing_kind?: "fixed" | "hourly" | "free" | "contact";
  estimated_minutes?: number | null;
  visibility?: "private" | "public";
  cta_label?: string;
}

export interface CreateOfferToolResult {
  action: "create_offer";
  message: string;
  offer: {
    id: string;
    slug: string;
    title: string;
    status: Offer["status"];
    visibility: Offer["visibility"];
    billing_kind: Offer["billingKind"];
    price_cents: number | null;
    public_url: string | null;
    manage_url: "/offers";
    created_from_conversation_id: string | null;
    created_from_message_id: string | null;
  };
  card: ReturnType<typeof projectOfferToOrdoCard>;
}

class CreateOfferCommand implements ToolCommand<CreateOfferInput, CreateOfferToolResult | { error: string }> {
  constructor(private readonly offerService: OfferService) {}

  async execute(
    input: CreateOfferInput,
    context?: ToolExecutionContext,
  ): Promise<CreateOfferToolResult | { error: string }> {
    if (!context || context.role === "ANONYMOUS" || !context.userId) {
      return { error: "Authentication required to create offers." };
    }

    const offer = await this.offerService.createDraft(
      { userId: context.userId, role: context.role },
      {
        title: input.title,
        summary: input.summary,
        description: input.description,
        audience: input.audience,
        promise: input.promise,
        priceCents: input.price_cents,
        currency: input.currency,
        billingKind: input.billing_kind,
        estimatedMinutes: input.estimated_minutes,
        visibility: input.visibility,
        ctaLabel: input.cta_label,
        createdFromConversationId: context.conversationId ?? null,
        createdFromMessageId: context.userMessageId ?? context.toolInvocationId ?? null,
      },
    );

    return {
      action: "create_offer",
      message:
        "Created a draft offer. Review price, visibility, and publication state in Offers before publishing it.",
      offer: {
        id: offer.id,
        slug: offer.slug,
        title: offer.title,
        status: offer.status,
        visibility: offer.visibility,
        billing_kind: offer.billingKind,
        price_cents: offer.priceCents,
        public_url: offer.status === "published" && offer.visibility === "public"
          ? `/offers/${offer.slug}`
          : null,
        manage_url: "/offers",
        created_from_conversation_id: offer.createdFromConversationId,
        created_from_message_id: offer.createdFromMessageId,
      },
      card: projectOfferToOrdoCard(offer),
    };
  }
}

export function createCreateOfferTool(offerService: OfferService): ToolDescriptor<CreateOfferInput, CreateOfferToolResult | { error: string }> {
  return {
    name: "create_offer",
    schema: {
      description:
        "Create a durable draft offer from a conversation. Use when a signed-in owner asks to sell, package, price, or publish an offer. The tool creates a draft only; publishing is governed in the Offers UI or a later explicit action.",
      input_schema: {
        type: "object",
        properties: {
          title: { type: "string", description: "Short offer name." },
          summary: { type: "string", description: "One-sentence buyer-facing summary." },
          description: { type: "string", description: "Detailed buyer-facing description." },
          audience: { type: "string", description: "Who this offer helps." },
          promise: { type: "string", description: "The outcome the buyer can expect." },
          price_cents: { type: ["number", "null"], description: "Price in cents for fixed/hourly offers." },
          currency: { type: "string", description: "Three-letter currency code, default USD." },
          billing_kind: { type: "string", enum: ["fixed", "hourly", "free", "contact"] },
          estimated_minutes: { type: ["number", "null"], description: "Optional estimated time in minutes." },
          visibility: { type: "string", enum: ["private", "public"], description: "Draft visibility before publishing." },
          cta_label: { type: "string", description: "Public CTA label." },
        },
        required: ["title"],
      },
    },
    command: new CreateOfferCommand(offerService),
    roles: ["AUTHENTICATED", "APPRENTICE", "STAFF", "ADMIN"],
    category: "system",
  };
}
