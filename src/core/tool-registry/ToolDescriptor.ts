import type { ToolCommand } from "./ToolCommand";
import type { RoleName } from "@/core/entities/user";
import type { CapabilityPromptExposureFacet } from "@/core/capability-catalog/capability-definition";

export type ToolCategory = "content" | "ui" | "math" | "system" | (string & {});

export type AnthropicToolSchema = {
  description: string;
  input_schema: Record<string, unknown>;
};

export type ToolExecutionMode = "inline" | "deferred";

export interface DeferredExecutionConfig {
  dedupeStrategy?: "none" | "per-conversation-payload";
  retryable?: boolean;
  notificationPolicy?: "none" | "completion-and-failure" | "all-terminal";
}

export interface ToolDescriptor<TInput = unknown, TOutput = unknown> {
  /** Unique tool name — must match the Anthropic tool name exactly */
  name: string;
  /** Anthropic JSON schema for the LLM */
  schema: AnthropicToolSchema;
  /** The command that executes this tool */
  command: ToolCommand<TInput, TOutput>;
  /** Which roles can execute this tool. "ALL" = unrestricted. */
  roles: RoleName[] | "ALL";
  /** Organizational category */
  category: ToolCategory;
  /** Whether the tool runs inline with the request or through deferred job orchestration. */
  executionMode?: ToolExecutionMode;
  /** Deferred execution policy metadata for queue-backed tools. */
  deferred?: DeferredExecutionConfig;
  /** Controls whether an executable tool is visible in model prompt projections. */
  promptExposure?: CapabilityPromptExposureFacet;
}
