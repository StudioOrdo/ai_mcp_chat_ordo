import { CAPABILITY_CATALOG } from "@/core/capability-catalog/catalog";
import { buildCatalogBoundToolDescriptor } from "@/core/capability-catalog/runtime-tool-projection";
import {
  type AdminSearchResult,
  searchAdminEntities,
} from "@/lib/admin/search/admin-search";

interface AdminSearchInput {
  query: string;
  entityTypes?: string[];
}

interface AdminSearchOutput {
  results: AdminSearchResult[];
  totalCount: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function sanitizeAdminSearchInput(value: unknown): AdminSearchInput {
  if (!isRecord(value)) {
    return { query: "" };
  }

  const query = typeof value.query === "string" ? value.query.trim() : "";
  const entityTypes = Array.isArray(value.entityTypes)
    ? value.entityTypes.filter((entityType): entityType is string => typeof entityType === "string")
    : undefined;

  return entityTypes && entityTypes.length > 0
    ? { query, entityTypes }
    : { query };
}

export async function executeAdminSearch(input: AdminSearchInput): Promise<AdminSearchOutput> {
  const normalizedQuery = input.query.trim().toLowerCase();
  const isListAllQuery = ["*", "all", "all users", "list users", "system users", "users"].includes(normalizedQuery);
  if ((!input.query || input.query.trim().length < 2) && !isListAllQuery) {
    return { results: [], totalCount: 0 };
  }

  const results = await searchAdminEntities(input.query, {
    entityTypes: input.entityTypes,
  });

  return { results, totalCount: results.length };
}

export const adminSearchTool = buildCatalogBoundToolDescriptor(CAPABILITY_CATALOG.admin_search, {
  parse: sanitizeAdminSearchInput,
  execute: (input) => executeAdminSearch(input),
});
