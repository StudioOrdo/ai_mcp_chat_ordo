export {
  _resetToolComposition,
  applyPolicyLayers,
  createToolRegistry,
  getBookPipeline,
  getCorpusPipeline,
  getEmbeddingPipelineFactory,
  getSearchHandler,
  getToolComposition,
  TOOL_BUNDLE_REGISTRY,
} from "./tool-composition-root";

export type {
  ToolCompositionResult,
  ToolPolicy,
  ToolPolicyLayer,
  ToolPolicyPrecedence,
} from "./tool-composition-root";