export interface McpProcessMetadata {
  id: "admin-web-search" | "calculator" | "generate-audio" | "operations";
  serverName: string;
  entrypoint: string;
  canonicalCommand: string;
  compatibilityAliases: readonly string[];
  capabilityGroups: readonly string[];
}

export const MCP_PROCESS_METADATA: readonly McpProcessMetadata[] = [
  {
    id: "admin-web-search",
    serverName: "admin-web-search-mcp-server",
    entrypoint: "mcp/admin-web-search-server.ts",
    canonicalCommand: "npm run mcp:admin-web-search",
    compatibilityAliases: [],
    capabilityGroups: ["admin", "web-search"],
  },
  {
    id: "calculator",
    serverName: "calculator-mcp-server",
    entrypoint: "mcp/calculator-server.ts",
    canonicalCommand: "npm run mcp:calculator",
    compatibilityAliases: [],
    capabilityGroups: ["math"],
  },
  {
    id: "generate-audio",
    serverName: "generate-audio-mcp-server",
    entrypoint: "mcp/generate-audio-server.ts",
    canonicalCommand: "npm run mcp:generate-audio",
    compatibilityAliases: [],
    capabilityGroups: ["media", "audio"],
  },
  {
    id: "operations",
    serverName: "operations-mcp-server",
    entrypoint: "mcp/operations-server.ts",
    canonicalCommand: "npm run mcp:operations",
    compatibilityAliases: [],
    capabilityGroups: ["embeddings", "corpus", "prompt", "analytics", "admin-intelligence"],
  },
] as const;

export const MCP_TRANSPORT_ENTRYPOINTS = MCP_PROCESS_METADATA.map((process) => process.entrypoint);

export function getMcpProcessMetadata(processId: string): McpProcessMetadata {
  const process = MCP_PROCESS_METADATA.find((candidate) => candidate.id === processId);
  if (!process) {
    throw new Error(`Missing MCP process metadata for "${processId}".`);
  }

  return process;
}