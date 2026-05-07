import { CAPABILITY_CATALOG } from "@/core/capability-catalog/catalog";
import { buildCatalogBoundToolDescriptor } from "@/core/capability-catalog/runtime-tool-projection";
import {
  emitProviderEvent,
  classifyProviderError,
} from "@/lib/chat/provider-policy";
import { ProviderClientFactory } from "@/lib/ai/providers/provider-client-factory";
import { ProviderConfigService } from "@/lib/ai/providers/provider-config-service";
import {
  sanitizeAdminWebSearchInput,
  toAdminWebSearchPayload,
  DEFAULT_ADMIN_WEB_SEARCH_MODEL,
  type AdminWebSearchPayload,
  type WebSearchInput,
} from "@/lib/web-search/admin-web-search-payload";
import {
  adminWebSearch,
  validateAdminWebSearchArgs,
  type WebSearchError,
  type WebSearchToolDeps,
} from "@/lib/capabilities/shared/web-search-tool";
import { assertProviderBackedToolAvailable } from "@/lib/tools/tool-provider-capability-policy";

export function createAdminWebSearchDeps(): WebSearchToolDeps {
  return {
    openai: ProviderClientFactory.createOpenAiClient(
      ProviderConfigService.resolveOpenAiApiKey().value,
    ),
  };
}

function resolveAdminWebSearchModel(input: WebSearchInput): string {
  return input.model?.trim()
    || ProviderConfigService.resolveCapabilityProviderConfig("web_search").model.value
    || DEFAULT_ADMIN_WEB_SEARCH_MODEL;
}

function toWebSearchError(error: unknown): WebSearchError {
  if (error && typeof error === "object") {
    const message =
      "message" in error && typeof error.message === "string"
        ? error.message
        : "Unknown error";
    const code =
      "status" in error && typeof error.status === "number"
        ? error.status
        : undefined;

    return code === undefined
      ? { error: message }
      : { error: message, code };
  }

  return {
    error: error instanceof Error ? error.message : "Unknown error",
  };
}

export async function executeAdminWebSearch(
  input: WebSearchInput,
  depsFactory: () => WebSearchToolDeps = createAdminWebSearchDeps,
): Promise<AdminWebSearchPayload> {
  const validationError = validateAdminWebSearchArgs(input);
  if (validationError) {
    return toAdminWebSearchPayload(input, validationError);
  }

  const model = resolveAdminWebSearchModel(input);
  const effectiveInput = input.model?.trim() ? input : { ...input, model };
  const startTime = Date.now();

  emitProviderEvent({
    kind: "attempt_start",
    provider: "openai",
    surface: "web_search",
    model,
    attempt: 1,
  });

  try {
    assertProviderBackedToolAvailable("admin_web_search");
    const result = await adminWebSearch(depsFactory(), effectiveInput);

    emitProviderEvent({
      kind: "attempt_success",
      provider: "openai",
      surface: "web_search",
      model,
      attempt: 1,
      durationMs: Date.now() - startTime,
    });

    return toAdminWebSearchPayload(effectiveInput, result);
  } catch (error) {
    emitProviderEvent({
      kind: "attempt_failure",
      provider: "openai",
      surface: "web_search",
      model,
      attempt: 1,
      durationMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
      errorClassification: classifyProviderError(error),
    });

    return toAdminWebSearchPayload(effectiveInput, toWebSearchError(error));
  }
}

export function createAdminWebSearchTool(
  depsFactory: () => WebSearchToolDeps = createAdminWebSearchDeps,
) {
  return buildCatalogBoundToolDescriptor(CAPABILITY_CATALOG.admin_web_search, {
    parse: sanitizeAdminWebSearchInput,
    execute: (input) => executeAdminWebSearch(input, depsFactory),
  });
}
