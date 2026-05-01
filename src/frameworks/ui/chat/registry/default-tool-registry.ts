import type { ToolComponent } from "./types";
import type { ToolPluginRegistry } from "./ToolPluginContext";
import { getCapabilityPresentationDescriptor } from "./capability-presentation-registry";
import type { CapabilityCardKind } from "@/core/entities/capability-presentation";
import { JobStatusFallbackCard } from "../plugins/system/JobStatusFallbackCard";
import { ChartRendererCard } from "../plugins/custom/ChartRendererCard";
import { GraphRendererCard } from "../plugins/custom/GraphRendererCard";
import { AudioPlayerCard } from "../plugins/custom/AudioPlayerCard";
import { MediaRenderCard } from "../plugins/custom/MediaRenderCard";
import { RelationshipMemoryCard } from "../plugins/custom/RelationshipMemoryCard";
import { TranscriptRecallCard } from "../plugins/custom/TranscriptRecallCard";
import { WebSearchCard } from "../plugins/custom/WebSearchCard";
import { InspectThemeCard } from "../plugins/custom/InspectThemeCard";
import { ProfileCard } from "../plugins/custom/ProfileCard";
import { ReferralQrCard } from "../plugins/custom/ReferralQrCard";
import { EditorialWorkflowCard } from "../plugins/custom/EditorialWorkflowCard";
import { JournalWorkflowCard } from "../plugins/custom/JournalWorkflowCard";

/**
 * Adapter: MediaRenderCard takes { envelope } directly, but ToolComponent
 * expects ToolPluginProps. This wrapper extracts the envelope.
 */
const MediaRenderCardAdapter: ToolComponent = (props) => {
  if (!props.resultEnvelope) return null;
  return MediaRenderCard({ envelope: props.resultEnvelope });
};

const CARD_KIND_RENDERERS: Partial<Record<CapabilityCardKind, ToolComponent>> = {
  search_result: WebSearchCard,
  theme_inspection: InspectThemeCard,
  editorial_workflow: EditorialWorkflowCard,
  journal_workflow: JournalWorkflowCard,
  media_render: MediaRenderCardAdapter,
};

const TOOL_RENDERER_OVERRIDES: Record<string, ToolComponent> = {
  generate_chart: ChartRendererCard,
  generate_graph: GraphRendererCard,
  generate_audio: AudioPlayerCard,
  search_my_conversations: TranscriptRecallCard,
  search_relationship_memory: RelationshipMemoryCard,
  get_my_referral_qr: ReferralQrCard,
  get_my_profile: ProfileCard,
  update_my_profile: ProfileCard,
  set_preference: ProfileCard,
  get_my_affiliate_summary: ProfileCard,
  list_my_referral_activity: ProfileCard,
};

function resolveRenderer(toolName: string): ToolComponent {
  const descriptor = getCapabilityPresentationDescriptor(toolName);
  if (!descriptor) {
    return JobStatusFallbackCard;
  }

  return TOOL_RENDERER_OVERRIDES[toolName]
    ?? CARD_KIND_RENDERERS[descriptor.cardKind]
    ?? JobStatusFallbackCard;
}

export function createDefaultToolRegistry(): ToolPluginRegistry {
  return {
    getDescriptor(toolName: string) {
      return getCapabilityPresentationDescriptor(toolName);
    },
    getRenderer(toolName: string): ToolComponent {
      return resolveRenderer(toolName);
    },
  };
}
