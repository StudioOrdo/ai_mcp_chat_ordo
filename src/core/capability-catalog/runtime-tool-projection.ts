import type { ToolCommand } from "@/core/tool-registry/ToolCommand";
import type { ToolDescriptor } from "@/core/tool-registry/ToolDescriptor";
import type { ToolExecutionContext } from "@/core/tool-registry/ToolExecutionContext";
import { projectCapabilityRuntimeDescriptorDefinition } from "@/core/platform/capability-runtime/CapabilityRuntime";
import type { CapabilityDefinition } from "./capability-definition";

export type CatalogInputParser<TInput = unknown> = (input: unknown) => TInput;

export type CatalogExecutor<TInput = unknown, TOutput = unknown> = (
  input: TInput,
  context?: ToolExecutionContext,
) => Promise<TOutput>;

class CatalogBoundToolCommand<TInput, TOutput> implements ToolCommand<unknown, TOutput> {
  constructor(
    private readonly parse: CatalogInputParser<TInput>,
    private readonly executeInternal: CatalogExecutor<TInput, TOutput>,
  ) {}

  async execute(input: unknown, context?: ToolExecutionContext): Promise<TOutput> {
    return this.executeInternal(this.parse(input), context);
  }
}

export function buildCatalogBoundToolDescriptor<TInput, TOutput>(
  def: CapabilityDefinition,
  binding: {
    parse: CatalogInputParser<TInput>;
    execute: CatalogExecutor<TInput, TOutput>;
  },
): ToolDescriptor<unknown, TOutput> {
  const runtimeDescriptor = projectCapabilityRuntimeDescriptorDefinition(def);

  return {
    name: runtimeDescriptor.name,
    schema: runtimeDescriptor.schema,
    command: new CatalogBoundToolCommand(binding.parse, binding.execute),
    roles: runtimeDescriptor.roles,
    category: runtimeDescriptor.category,
    executionMode: runtimeDescriptor.executionMode,
    deferred: runtimeDescriptor.deferred,
  };
}