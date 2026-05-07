import { getDb } from "@/lib/db";

export interface AdminSearchResult {
  entityType:
    | "user"
    | "lead"
    | "consultation"
    | "deal"
    | "training"
    | "conversation"
    | "job"
    | "prompt"
    | "journal";
  id: string;
  title: string;
  subtitle: string;
  href: string;
  matchField: string;
  updatedAt: string;
}

interface EntitySearchConfig {
  entityType: AdminSearchResult["entityType"];
  table: string;
  fields: string[];
  titleExpr: string;
  subtitleExpr: string;
  hrefPrefix: string;
  updatedAtColumn: string;
  extraWhere?: string;
}

const LIST_ALL_QUERIES = new Set([
  "*",
  "all",
  "all users",
  "list users",
  "system users",
  "users",
]);

const ENTITY_CONFIGS: EntitySearchConfig[] = [
  {
    entityType: "user",
    table: "users",
    fields: ["name", "email"],
    titleExpr: "COALESCE(name, email, id)",
    subtitleExpr: "'User — ' || COALESCE(email, '')",
    hrefPrefix: "/admin/users/",
    updatedAtColumn: "created_at",
  },
  {
    entityType: "lead",
    table: "lead_records",
    fields: ["name", "email", "organization"],
    titleExpr: "COALESCE(name, email, id)",
    subtitleExpr: "'Lead — ' || COALESCE(lane, 'unknown')",
    hrefPrefix: "/admin/leads/",
    updatedAtColumn: "updated_at",
  },
  {
    entityType: "consultation",
    table: "consultation_requests",
    fields: ["request_summary", "lane"],
    titleExpr: "COALESCE(NULLIF(request_summary, ''), id)",
    subtitleExpr: "'Consultation — ' || status",
    hrefPrefix: "/admin/leads/",
    updatedAtColumn: "updated_at",
  },
  {
    entityType: "deal",
    table: "deal_records",
    fields: ["title", "organization_name", "proposed_scope"],
    titleExpr: "COALESCE(NULLIF(title, ''), id)",
    subtitleExpr: "'Deal — ' || status",
    hrefPrefix: "/admin/leads/",
    updatedAtColumn: "updated_at",
  },
  {
    entityType: "training",
    table: "training_path_records",
    fields: ["current_role_or_background", "primary_goal"],
    titleExpr: "COALESCE(current_role_or_background, primary_goal, id)",
    subtitleExpr: "'Training — ' || recommended_path",
    hrefPrefix: "/admin/leads/",
    updatedAtColumn: "updated_at",
  },
  {
    entityType: "conversation",
    table: "conversations",
    fields: ["title", "detected_need_summary"],
    titleExpr: "COALESCE(NULLIF(title, ''), id)",
    subtitleExpr: "'Conversation — ' || COALESCE(status, 'active')",
    hrefPrefix: "/admin/conversations/",
    updatedAtColumn: "updated_at",
  },
  {
    entityType: "job",
    table: "job_requests",
    fields: ["tool_name"],
    titleExpr: "tool_name",
    subtitleExpr: "'Job — ' || status",
    hrefPrefix: "/admin/jobs/",
    updatedAtColumn: "updated_at",
  },
  {
    entityType: "prompt",
    table: "system_prompts",
    fields: ["role", "prompt_type", "content"],
    titleExpr: "role || ' / ' || prompt_type",
    subtitleExpr: "'Prompt — v' || version",
    hrefPrefix: "/admin/prompts/",
    updatedAtColumn: "created_at",
    extraWhere: "is_active = 1",
  },
  {
    entityType: "journal",
    table: "blog_posts",
    fields: ["title", "slug", "description"],
    titleExpr: "title",
    subtitleExpr: "'Journal — ' || status",
    hrefPrefix: "/admin/journal/",
    updatedAtColumn: "updated_at",
  },
];

function buildEntityQuery(
  config: EntitySearchConfig,
  patternParamName: string,
): string {
  const patternParam = `@${patternParamName}`;
  const fieldClauses = config.fields.map((f) => `${f} LIKE ${patternParam}`);
  const whereClause = [
    `(${fieldClauses.join(" OR ")})`,
    ...(config.extraWhere ? [config.extraWhere] : []),
  ].join(" AND ");

  // Build a CASE expression that returns the first matching field name
  const matchFieldExpr = config.fields
    .map((f) => `WHEN ${f} LIKE ${patternParam} THEN '${f}'`)
    .join(" ");

  const sql = `SELECT
    '${config.entityType}' AS entityType,
    id,
    ${config.titleExpr} AS title,
    ${config.subtitleExpr} AS subtitle,
    '${config.hrefPrefix}' || id AS href,
    CASE ${matchFieldExpr} ELSE '${config.fields[0]}' END AS matchField,
    ${config.updatedAtColumn} AS updatedAt
  FROM ${config.table}
  WHERE ${whereClause}`;

  return sql;
}

export async function searchAdminEntities(
  query: string,
  options?: { entityTypes?: string[]; limit?: number },
): Promise<AdminSearchResult[]> {
  const trimmed = query.trim();
  const entityTypes = options?.entityTypes;
  const isListAllQuery = LIST_ALL_QUERIES.has(trimmed.toLowerCase());
  if (trimmed.length < 2 && !isListAllQuery) return [];

  // getDb() approved: raw SQL query — see data-access-canary.test.ts (Sprint 9)
  const db = getDb();
  const limit = options?.limit ?? 20;
  const pattern = isListAllQuery ? "%" : `%${trimmed}%`;

  const activeConfigs = entityTypes?.length
    ? ENTITY_CONFIGS.filter((c) => entityTypes.includes(c.entityType))
    : ENTITY_CONFIGS;

  if (activeConfigs.length === 0) return [];

  // Build UNION ALL across all entity types, sharing a single parameter
  const unionParts: string[] = [];
  for (const config of activeConfigs) {
    const sql = buildEntityQuery(config, "pattern");
    unionParts.push(sql);
  }

  const sql = `${unionParts.join("\n  UNION ALL\n")}\n  ORDER BY updatedAt DESC\n  LIMIT @limit`;

  const rows = db.prepare(sql).all({ pattern, limit }) as AdminSearchResult[];
  return rows;
}
