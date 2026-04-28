import type { ToolRegistry } from "@/core/tool-registry/ToolRegistry";
import { getVectorStore } from "@/adapters/RepositoryFactory";
import {
  createCatalogBoundToolBundle,
  registerCatalogBoundToolBundle,
} from "./bundle-registration";

interface ConversationToolRegistrationDeps {
  readonly vectorStore: ReturnType<typeof getVectorStore>;
}

export const CONVERSATION_BUNDLE = createCatalogBoundToolBundle(
  "conversation",
  "Conversation Tools",
);

export function registerConversationTools(registry: ToolRegistry): void {
  registerCatalogBoundToolBundle(registry, "conversation", {
    vectorStore: getVectorStore(),
  }, (_toolName, deps) => ({ vectorStore: deps.vectorStore }));
}
