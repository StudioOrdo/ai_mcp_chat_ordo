/**
 * Sprint 11 — MCP Domain/Transport Separation Tests
 *
 * Validates:
 * 1. analytics-domain.ts exports pure domain functions (no MCP imports)
 * 2. analytics-tool.ts is a thin shared adapter (imports from domain)
 * 3. getAllMcpExportableTools iterates catalog dynamically
 * 4. operations-server.ts imports getAllMcpExportableTools
 * 5. admin-intelligence-tool.ts is a shared adapter for MCP-sidecar admin pack logic
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const MCP_DIR = path.resolve(__dirname, "../../../mcp");
const SHARED_DIR = path.resolve(__dirname, "../../lib/capabilities/shared");

function readMcpFile(filename: string): string {
  return fs.readFileSync(path.join(MCP_DIR, filename), "utf-8");
}

function readSharedFile(filename: string): string {
  return fs.readFileSync(path.join(SHARED_DIR, filename), "utf-8");
}

describe("Sprint 11 — MCP Domain/Transport Separation", () => {
  describe("analytics-domain.ts (domain module)", () => {
    const domainSource = readSharedFile("analytics-domain.ts");

    it("exists and is non-trivial", () => {
      const lineCount = domainSource.split("\n").length;
      expect(lineCount).toBeGreaterThan(600);
    });

    it("exports AnalyticsToolDeps type", () => {
      expect(domainSource).toContain("export interface AnalyticsToolDeps");
    });

    it("exports all report builder functions", () => {
      const builders = [
        "buildOverview",
        "buildFunnel",
        "buildEngagement",
        "buildToolUsage",
        "buildDropOff",
        "buildRoutingReview",
      ];
      for (const builder of builders) {
        expect(domainSource).toContain(`export function ${builder}`);
      }
    });

    it("exports statistical helpers", () => {
      const helpers = ["average", "median", "percentile", "standardDeviation", "round"];
      for (const helper of helpers) {
        expect(domainSource).toContain(`export function ${helper}`);
      }
    });

    it("exports cohort analysis functions", () => {
      expect(domainSource).toContain("export function getCohortRows");
      expect(domainSource).toContain("export function getCohortValues");
      expect(domainSource).toContain("export function buildStats");
    });

    it("does NOT import from MCP SDK or transport modules", () => {
      expect(domainSource).not.toContain("@modelcontextprotocol");
      expect(domainSource).not.toContain("StdioServerTransport");
    });
  });

  describe("analytics-tool.ts (shared adapter module)", () => {
    const transportSource = readSharedFile("analytics-tool.ts");

    it("is under 250 lines (thin transport)", () => {
      const lineCount = transportSource.split("\n").length;
      expect(lineCount).toBeLessThan(250);
    });

    it("imports from analytics-domain", () => {
      expect(transportSource).toContain("from \"./analytics-domain\"");
    });

    it("exports conversationAnalytics", () => {
      expect(transportSource).toContain("export async function conversationAnalytics");
    });

    it("exports conversationInspect", () => {
      expect(transportSource).toContain("export async function conversationInspect");
    });

    it("exports conversationCohort", () => {
      expect(transportSource).toContain("export async function conversationCohort");
    });

    it("re-exports AnalyticsToolDeps type", () => {
      expect(transportSource).toContain("export type { AnalyticsToolDeps }");
    });

    it("does NOT contain domain logic (statistical helpers)", () => {
      // These should only be in the domain module
      expect(transportSource).not.toContain("function average(");
      expect(transportSource).not.toContain("function median(");
      expect(transportSource).not.toContain("function standardDeviation(");
    });

    it("does NOT contain SQL query building", () => {
      // buildOverview/buildFunnel/etc should not be defined here
      expect(transportSource).not.toContain("function buildOverview(");
      expect(transportSource).not.toContain("function buildFunnel(");
    });
  });

  describe("getAllMcpExportableTools (catalog-driven)", () => {
    it("dynamically iterates catalog (no hardcoded pilot list)", () => {
      const mcpExportSource = fs.readFileSync(
        path.resolve(__dirname, "./mcp-export.ts"),
        "utf-8",
      );
      // Should NOT contain the hardcoded pilot list
      expect(mcpExportSource).not.toContain("pilotTools");
      // Should iterate the static CapabilityRuntime projection
      expect(mcpExportSource).toContain("projectAllCapabilityRuntimeStatics");
    });
  });

  describe("operations-server.ts (MCP server wiring)", () => {
    const serverSource = readMcpFile("operations-server.ts");

    it("imports getAllMcpExportableTools", () => {
      expect(serverSource).toContain("getAllMcpExportableTools");
    });

    it("calls getAllMcpExportableTools at startup", () => {
      expect(serverSource).toContain("getAllMcpExportableTools()");
    });

    it("uses the catalog MCP adapter registry for the admin pack sidecar surface", () => {
      expect(serverSource).toContain("createCatalogMcpToolEntries");
      expect(serverSource).not.toContain("getAdminIntelligenceToolSchemas");
    });
  });
});
