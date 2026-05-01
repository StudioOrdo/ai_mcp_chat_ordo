import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { corpusConfig } from "@/lib/corpus-vocabulary";

import expectedOperationsToolInventory from "./operations-tool-inventory.json";
import {
  createMcpStdioHarness,
  parseJsonTextContent,
  sortToolNames,
  type McpStdioHarness,
} from "./stdio-harness";

const TEST_TIMEOUT_MS = 30_000;

describe("operations MCP stdio transport", () => {
  let harness: McpStdioHarness | undefined;

  function getHarness(): McpStdioHarness {
    if (!harness) {
      throw new Error("MCP stdio harness was not initialized");
    }
    return harness;
  }

  beforeAll(async () => {
    harness = await createMcpStdioHarness("mcp/operations-server.ts");
  }, TEST_TIMEOUT_MS);

  afterAll(async () => {
    await harness?.close();
  }, TEST_TIMEOUT_MS);

  it("keeps the reviewed tool inventory stable at the protocol layer", async () => {
    const tools = await getHarness().listTools();

    expect(sortToolNames(tools)).toEqual(expectedOperationsToolInventory);
  }, TEST_TIMEOUT_MS);

  it("round-trips a deterministic prompt provenance read", async () => {
    const conversationId = "transport-test-missing-provenance";
    const result = await getHarness().callTool("prompt_get_provenance", {
      conversation_id: conversationId,
    });
    const payload = parseJsonTextContent<{
      error: string;
      conversation_id: string;
    }>(result);

    expect(payload).toEqual({
      error: `No provenance found for conversation ${conversationId}. Provenance is available only for recent chat turns.`,
      conversation_id: conversationId,
    });
  }, TEST_TIMEOUT_MS);

  it("round-trips index stats through the spawned operations server", async () => {
    const result = await getHarness().callTool("get_index_stats");
    const payload = parseJsonTextContent<{
      sourceType: string;
      embeddingCount: number;
      bm25DocCount: number;
      bm25AvgDocLength: number;
      bm25Stale: boolean;
      embedderReady: boolean;
      dimensions: number;
    }>(result);

    expect(payload.sourceType).toBe(corpusConfig.sourceType);
    expect(payload.embeddingCount).toBeGreaterThanOrEqual(0);
    expect(payload.bm25DocCount).toBeGreaterThanOrEqual(0);
    expect(payload.bm25AvgDocLength).toBeGreaterThanOrEqual(0);
    expect(typeof payload.bm25Stale).toBe("boolean");
    expect(typeof payload.embedderReady).toBe("boolean");
    expect(payload.dimensions).toBe(384);
  }, TEST_TIMEOUT_MS);

  it("rejects invalid payloads predictably through stdio", async () => {
    await expect(getHarness().callTool("embed_text", {})).rejects.toThrow(/embed_text requires a non-empty 'text' string\./);
  }, TEST_TIMEOUT_MS);

  it("returns an honest summary for admin intelligence tools without bridged admin context", async () => {
    const result = await getHarness().callTool("admin_prioritize_leads", {});
    const payload = parseJsonTextContent<{ summary: string; leads: unknown[] }>(result);

    expect(payload).toEqual({
      summary: "Unable to prioritize leads without admin user context.",
      leads: [],
    });
  }, TEST_TIMEOUT_MS);

  it("keeps admin_search available through the operations sidecar surface", async () => {
    const result = await getHarness().callTool("admin_search", {});
    const payload = parseJsonTextContent<{ results: unknown[]; totalCount: number }>(result);

    expect(payload).toEqual({
      results: [],
      totalCount: 0,
    });
  }, TEST_TIMEOUT_MS);

  it("routes catalog-owned admin_web_search through the operations adapter registry", async () => {
    const result = await getHarness().callTool("admin_web_search", {});
    const payload = parseJsonTextContent<{
      action: string;
      error: string;
    }>(result);

    expect(payload).toMatchObject({
      action: "admin_web_search",
      error: "query is required and must be non-empty",
    });
  }, TEST_TIMEOUT_MS);

  it("routes catalog-owned inspect_runtime_logs through the operations adapter registry", async () => {
    const result = await getHarness().callTool("inspect_runtime_logs", {
      log_file: "mcp_process",
      limit: 1,
    });
    const payload = parseJsonTextContent<{
      lines: Array<Record<string, unknown>>;
      total_scanned: number;
      matched: number;
    }>(result);

    expect(Array.isArray(payload.lines)).toBe(true);
    expect(payload.total_scanned).toBeGreaterThanOrEqual(0);
    expect(payload.matched).toBe(payload.lines.length);
    expect(payload.matched).toBeLessThanOrEqual(1);
  }, TEST_TIMEOUT_MS);
});
