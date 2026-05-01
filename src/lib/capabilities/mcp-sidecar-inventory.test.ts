import { describe, expect, it } from "vitest";

import {
  getCanonicalMcpSidecarInventory,
  getLocalMcpContainerTarget,
  getLocalMcpStdioTarget,
} from "./mcp-sidecar-inventory";

describe("mcp-sidecar-inventory", () => {
  it("exposes the canonical stdio target for admin_web_search", () => {
    expect(getLocalMcpStdioTarget("admin_web_search")).toEqual({
      capabilityName: "admin_web_search",
      processId: "admin-web-search",
      entrypoint: "mcp/admin-web-search-server.ts",
      toolName: "admin_web_search",
    });
  });

  it("exposes the canonical compose sidecar target for admin_web_search", () => {
    expect(getLocalMcpContainerTarget("admin_web_search")).toEqual({
      capabilityName: "admin_web_search",
      processId: "admin-web-search",
      serviceName: "admin-web-search-mcp",
      entrypoint: "mcp/admin-web-search-server.ts",
      toolName: "admin_web_search",
      healthcheckToolName: "admin_web_search",
    });
  });

  it("derives one inventory row per canonical MCP process", () => {
    expect(getCanonicalMcpSidecarInventory()).toEqual([
      {
        processId: "admin-web-search",
        serverName: "admin-web-search-mcp-server",
        entrypoint: "mcp/admin-web-search-server.ts",
        canonicalCommand: "npm run mcp:admin-web-search",
        transports: ["stdio", "container"],
        capabilityNames: ["admin_web_search"],
        containerServiceName: "admin-web-search-mcp",
        healthcheckToolName: "admin_web_search",
      },
      {
        processId: "calculator",
        serverName: "calculator-mcp-server",
        entrypoint: "mcp/calculator-server.ts",
        canonicalCommand: "npm run mcp:calculator",
        transports: ["stdio"],
        capabilityNames: [],
        containerServiceName: undefined,
        healthcheckToolName: undefined,
      },
      {
        processId: "generate-audio",
        serverName: "generate-audio-mcp-server",
        entrypoint: "mcp/generate-audio-server.ts",
        canonicalCommand: "npm run mcp:generate-audio",
        transports: ["stdio"],
        capabilityNames: ["generate_audio"],
        containerServiceName: undefined,
        healthcheckToolName: undefined,
      },
      {
        processId: "operations",
        serverName: "operations-mcp-server",
        entrypoint: "mcp/operations-server.ts",
        canonicalCommand: "npm run mcp:operations",
        transports: ["stdio"],
        capabilityNames: [
          "admin_prioritize_leads",
          "admin_prioritize_offer",
          "admin_search",
          "admin_triage_routing_risk",
          "inspect_runtime_logs",
        ],
        containerServiceName: undefined,
        healthcheckToolName: undefined,
      },
    ]);
  });
});
