import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

import { CAPABILITY_CATALOG } from "@/core/capability-catalog/catalog";
import {
  createAdminWebSearchDeps,
  executeAdminWebSearch,
} from "@/core/use-cases/tools/admin-web-search.tool";
import {
  sanitizeAdminWebSearchInput,
  toAdminWebSearchPayload,
  type WebSearchErrorData,
  type WebSearchResultData,
} from "@/lib/web-search/admin-web-search-payload";
import { loadLocalEnv } from "../scripts/load-local-env";

const FIXTURE_ENV = "ORDO_MCP_ADMIN_WEB_SEARCH_RESULT_FIXTURE";

loadLocalEnv();

function readFixtureResult(): WebSearchResultData | WebSearchErrorData | null {
  const raw = process.env[FIXTURE_ENV];
  if (!raw) {
    return null;
  }

  return JSON.parse(raw) as WebSearchResultData | WebSearchErrorData;
}

async function executeServerAdminWebSearch(args: unknown) {
  const input = sanitizeAdminWebSearchInput(args);
  const fixture = readFixtureResult();

  if (fixture && input.query.trim().length > 0) {
    return toAdminWebSearchPayload(input, fixture);
  }

  return executeAdminWebSearch(input, createAdminWebSearchDeps);
}

const server = new Server(
  {
    name: "admin-web-search-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: CAPABILITY_CATALOG.admin_web_search.core.name,
      description:
        CAPABILITY_CATALOG.admin_web_search.mcpExport?.mcpDescription
        ?? CAPABILITY_CATALOG.admin_web_search.core.description,
      inputSchema: CAPABILITY_CATALOG.admin_web_search.schema.inputSchema,
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== CAPABILITY_CATALOG.admin_web_search.core.name) {
    throw new Error(`Unknown tool: ${request.params.name}`);
  }

  const result = await executeServerAdminWebSearch(request.params.arguments ?? {});

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(result),
      },
    ],
  };
});

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
