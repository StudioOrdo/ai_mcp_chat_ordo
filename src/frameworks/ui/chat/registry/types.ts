import type { CapabilityPresentationDescriptor } from "@/core/entities/capability-presentation";
import type { CapabilityResultEnvelope } from "@/core/entities/capability-result";
import type { JobStatusMessagePart } from "@/core/entities/message-parts";
import type { RoleName } from "@/core/entities/user";
import type { ActionLinkType, InlineNode } from "@/core/entities/rich-content";

export interface ToolCallData {
  name: string;
  args: Record<string, unknown>;
  result?: unknown;
  toolInvocationId?: string;
}

export interface ToolPluginProps {
  /** The raw job-status part from message.parts (present for job-status entries) */
  part?: JobStatusMessagePart;

  /** Paired tool call data (present for tool-call entries) */
  toolCall?: ToolCallData;

  /** Pre-computed action nodes (mainly for job-status, computed by the presenter) */
  computedActions?: InlineNode[];

  /** Capability presentation descriptor for the current tool, when known */
  descriptor?: CapabilityPresentationDescriptor;

  /** Unified capability result envelope, when the payload could be projected */
  resultEnvelope?: CapabilityResultEnvelope | null;

  /** Action handler passed down from ChatSurface */
  onActionClick?: (
    actionType: ActionLinkType,
    value: string,
    params?: Record<string, string>,
  ) => void;

  /** True while the stream for this message is still open */
  isStreaming: boolean;

  /** Role of the viewing user — used for admin-gated visibility decisions */
  viewerRole?: RoleName;
}

export type ToolComponent = React.ComponentType<ToolPluginProps>;
