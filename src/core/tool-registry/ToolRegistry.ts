import type { RoleName } from "@/core/entities/user";
import type { ToolDescriptor } from "./ToolDescriptor";
import type { ToolBundleDescriptor } from "./ToolBundleDescriptor";
import type { ToolExecutionContext } from "./ToolExecutionContext";
import type { ToolResultFormatter } from "./ToolResultFormatter";
import { ToolAccessDeniedError, UnknownToolError } from "./errors";

export type PromptToolProjectionMode =
  | "default_chat"
  | "intent_gated"
  | "operator_chat"
  | "internal";

export interface PromptToolProjectionOptions {
  mode?: PromptToolProjectionMode;
  intentToolNames?: readonly string[];
  allowedToolNames?: readonly string[];
}

export interface AnthropicToolProjection {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export class ToolRegistry {
  private tools = new Map<string, ToolDescriptor>();
  private toolToBundle = new Map<string, ToolBundleDescriptor>();
  private bundles: readonly ToolBundleDescriptor[] = [];

  constructor(private readonly formatter?: ToolResultFormatter) {}

  register(descriptor: ToolDescriptor): void {
    if (this.tools.has(descriptor.name)) {
      throw new Error(`Tool "${descriptor.name}" is already registered`);
    }
    this.tools.set(descriptor.name, descriptor);
  }

  getSchemasForRole(role: RoleName): AnthropicToolProjection[] {
    return Array.from(this.tools.values())
      .filter((descriptor) => descriptor.roles === "ALL" || (Array.isArray(descriptor.roles) && descriptor.roles.includes(role)))
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((descriptor) => this.toAnthropicToolProjection(descriptor));
  }

  getPromptVisibleSchemasForRole(
    role: RoleName,
    options: PromptToolProjectionOptions = {},
  ): AnthropicToolProjection[] {
    const mode = options.mode ?? "default_chat";
    const intentToolNames = new Set(options.intentToolNames ?? []);
    const allowedToolNames = options.allowedToolNames
      ? new Set(options.allowedToolNames)
      : null;

    return Array.from(this.tools.values())
      .filter((descriptor) => this.canRoleExecuteDescriptor(descriptor, role))
      .filter((descriptor) => !allowedToolNames || allowedToolNames.has(descriptor.name))
      .filter((descriptor) => this.isPromptVisible(descriptor, mode, intentToolNames))
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((descriptor) => this.toAnthropicToolProjection(descriptor));
  }

  async execute(
    name: string,
    input: Record<string, unknown>,
    context: ToolExecutionContext,
  ): Promise<unknown> {
    const descriptor = this.tools.get(name);
    if (!descriptor) {
      throw new UnknownToolError(name);
    }

    if (!this.canExecute(name, context.role)) {
      throw new ToolAccessDeniedError(name, context.role);
    }

    const result = await descriptor.command.execute(input, context);
    return this.formatter
      ? this.formatter.format(name, result, context)
      : result;
  }

  unregister(name: string): void {
    this.tools.delete(name);
    this.toolToBundle.delete(name);
  }

  getDescriptor(name: string): ToolDescriptor | undefined {
    return this.tools.get(name);
  }

  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  canExecute(name: string, role: RoleName): boolean {
    const descriptor = this.tools.get(name);
    if (!descriptor) return false;
    return this.canRoleExecuteDescriptor(descriptor, role);
  }

  setBundles(descriptors: readonly ToolBundleDescriptor[]): void {
    this.bundles = descriptors;
    this.toolToBundle.clear();
    for (const bundle of descriptors) {
      for (const toolName of bundle.toolNames) {
        this.toolToBundle.set(toolName, bundle);
      }
    }
  }

  getBundleForTool(toolName: string): ToolBundleDescriptor | undefined {
    return this.toolToBundle.get(toolName);
  }

  getBundles(): readonly ToolBundleDescriptor[] {
    return this.bundles;
  }

  expandBundleRef(ref: string): readonly string[] {
    if (!ref.startsWith("bundle:")) return [ref];
    const bundleId = ref.slice(7);
    const bundle = this.bundles.find((b) => b.id === bundleId);
    return bundle ? bundle.toolNames.filter((toolName) => this.tools.has(toolName)) : [];
  }

  private canRoleExecuteDescriptor(descriptor: ToolDescriptor, role: RoleName): boolean {
    return descriptor.roles === "ALL" || (Array.isArray(descriptor.roles) && descriptor.roles.includes(role));
  }

  private isPromptVisible(
    descriptor: ToolDescriptor,
    mode: PromptToolProjectionMode,
    intentToolNames: ReadonlySet<string>,
  ): boolean {
    if (mode === "internal") {
      return true;
    }

    const exposure = descriptor.promptExposure?.exposure ?? "default_prompt";
    if (exposure === "default_prompt") {
      return true;
    }

    if (exposure === "intent_gated") {
      return mode === "intent_gated" || mode === "operator_chat" || intentToolNames.has(descriptor.name);
    }

    if (exposure === "operator_only") {
      return mode === "operator_chat";
    }

    return false;
  }

  private toAnthropicToolProjection(descriptor: ToolDescriptor): AnthropicToolProjection {
    return {
      name: descriptor.name,
      description: descriptor.schema?.description ?? "",
      input_schema: descriptor.schema?.input_schema ?? { type: "object", properties: {} },
    };
  }
}
