export const DEFAULT_ADMIN_WEB_SEARCH_MODEL = "gpt-5";

export interface WebSearchCitation {
  url: string;
  title: string;
  start_index: number;
  end_index: number;
}

export interface WebSearchInput {
  query: string;
  allowed_domains?: string[];
  model?: string;
}

export interface WebSearchResultData {
  answer: string;
  citations: WebSearchCitation[];
  sources: string[];
  model: string;
}

export interface WebSearchErrorData {
  error: string;
  code?: number;
}

export interface AdminWebSearchSuccessPayload extends WebSearchResultData {
  action: "admin_web_search";
  query: string;
  allowed_domains?: string[];
  assetId?: string;
}

export interface AdminWebSearchErrorPayload extends WebSearchErrorData {
  action: "admin_web_search";
  query: string;
  allowed_domains?: string[];
  model: string;
  assetId?: string;
}

export type AdminWebSearchPayload = AdminWebSearchSuccessPayload | AdminWebSearchErrorPayload;

function normalizeModel(model?: string): string {
  return typeof model === "string" && model.trim().length > 0
    ? model.trim()
    : DEFAULT_ADMIN_WEB_SEARCH_MODEL;
}

function normalizeAllowedDomains(allowedDomains?: string[]): string[] | undefined {
  if (!Array.isArray(allowedDomains)) {
    return undefined;
  }

  const normalized = allowedDomains
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  return normalized.length > 0 ? normalized : undefined;
}

export function sanitizeAdminWebSearchInput(value: unknown): WebSearchInput {
  if (!value || typeof value !== "object") {
    return { query: "" };
  }

  const record = value as Record<string, unknown>;
  return {
    query: typeof record.query === "string" ? record.query : "",
    allowed_domains: normalizeAllowedDomains(
      Array.isArray(record.allowed_domains) ? record.allowed_domains as string[] : undefined,
    ),
    model: typeof record.model === "string" && record.model.trim().length > 0
      ? record.model.trim()
      : undefined,
  };
}

export function toAdminWebSearchPayload(
  input: Partial<WebSearchInput>,
  result: WebSearchErrorData,
  assetId?: string,
): AdminWebSearchErrorPayload;
export function toAdminWebSearchPayload(
  input: Partial<WebSearchInput>,
  result: WebSearchResultData,
  assetId?: string,
): AdminWebSearchSuccessPayload;
export function toAdminWebSearchPayload(
  input: Partial<WebSearchInput>,
  result: WebSearchResultData | WebSearchErrorData,
  assetId?: string,
): AdminWebSearchPayload;

export function toAdminWebSearchPayload(
  input: Partial<WebSearchInput>,
  result: WebSearchResultData | WebSearchErrorData,
  assetId?: string,
): AdminWebSearchPayload {
  const query = typeof input.query === "string" ? input.query : "";
  const allowed_domains = normalizeAllowedDomains(input.allowed_domains);
  const model = normalizeModel(input.model);

  if ("error" in result) {
    return {
      action: "admin_web_search",
      query,
      allowed_domains,
      model,
      error: result.error,
      code: result.code,
      assetId,
    };
  }

  return {
    action: "admin_web_search",
    query,
    allowed_domains,
    answer: result.answer,
    citations: result.citations,
    sources: result.sources,
    model: result.model,
    assetId,
  };
}

export function createAdminWebSearchErrorPayload(
  input: Partial<WebSearchInput>,
  error: string,
  code?: number,
): AdminWebSearchErrorPayload {
  return toAdminWebSearchPayload(input, { error, code });
}

export function isAdminWebSearchPayload(value: unknown): value is AdminWebSearchPayload {
  if (
    typeof value !== "object"
    || value === null
    || (value as { action?: unknown }).action !== "admin_web_search"
    || typeof (value as { query?: unknown }).query !== "string"
    || typeof (value as { model?: unknown }).model !== "string"
  ) {
    return false;
  }

  if (typeof (value as { error?: unknown }).error === "string") {
    return true;
  }

  return (
    typeof (value as { answer?: unknown }).answer === "string"
    && Array.isArray((value as { citations?: unknown }).citations)
    && Array.isArray((value as { sources?: unknown }).sources)
  );
}