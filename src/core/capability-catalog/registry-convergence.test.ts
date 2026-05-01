/**
 * Sprint 12 — Registry Convergence Tests
 *
 * Validates:
 * 1. Presentation registry derives ALL entries from catalog
 * 2. Job registry derives ALL entries from catalog
 * 3. Browser registry derives ALL entries from catalog
 * 4. No manual createDescriptor/defineEditorialCapability calls remain
 * 5. Every catalog tool has a presentation entry
 * 6. All registries match catalog metadata exactly
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

import {
  projectPresentationDescriptor,
  projectJobCapability,
  projectBrowserCapability,
} from "./catalog";
import {
  projectAllCapabilityRuntimeStatics,
  projectCapabilityRuntimeStaticByName,
} from "@/core/platform/capability-runtime/CapabilityRuntime";

import {
  CHAT_CAPABILITY_PRESENTATION_TOOL_NAMES,
  getCapabilityPresentationDescriptor,
} from "@/frameworks/ui/chat/registry/capability-presentation-registry";

import {
  JOB_CAPABILITY_REGISTRY,
  JOB_CAPABILITY_TOOL_NAMES,
  getJobCapability,
} from "@/lib/jobs/job-capability-registry";

import {
  BROWSER_CAPABILITY_TOOL_NAMES,
  getBrowserCapabilityDescriptor,
} from "@/lib/media/browser-runtime/browser-capability-registry";

const ROOT = path.resolve(__dirname, "../../..");

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf-8");
}

describe("Sprint 12 — Registry Convergence", () => {
  // ─────────────────────────────────────────────────────────────────────────
  // Presentation registry
  // ─────────────────────────────────────────────────────────────────────────
  describe("Presentation registry", () => {
    it("has NO manual createDescriptor() calls", () => {
      const source = readSource(
        "src/frameworks/ui/chat/registry/capability-presentation-registry.ts",
      );
      expect(source).not.toContain("function createDescriptor(");
      expect(source).not.toContain("createDescriptor(\"");
    });

    it("covers every catalog tool", () => {
      for (const { capabilityName } of projectAllCapabilityRuntimeStatics()) {
        const desc = getCapabilityPresentationDescriptor(capabilityName);
        expect(desc, `Missing presentation descriptor for: ${capabilityName}`).toBeDefined();
      }
    });

    it("has at least 55 entries (all catalog tools)", () => {
      expect(CHAT_CAPABILITY_PRESENTATION_TOOL_NAMES.length).toBeGreaterThanOrEqual(55);
    });

    it("matches catalog metadata for every entry", () => {
      for (const runtime of projectAllCapabilityRuntimeStatics()) {
        const expected = runtime.presentation;
        const actual = getCapabilityPresentationDescriptor(runtime.capabilityName);
        expect(actual, `Parity check failed for: ${runtime.capabilityName}`).toEqual(expected);
      }
    });

    it("includes all 10 previously-missing tools", () => {
      const previouslyMissing = [
        "admin_prioritize_leads",
        "admin_prioritize_offer",
        "admin_search",
        "admin_triage_routing_risk",
        "get_admin_affiliate_summary",
        "get_deferred_job_status",
        "get_my_job_status",
        "list_admin_referral_exceptions",
        "list_deferred_jobs",
        "list_my_jobs",
      ];
      for (const name of previouslyMissing) {
        expect(
          getCapabilityPresentationDescriptor(name),
          `Still missing: ${name}`,
        ).toBeDefined();
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Job capability registry
  // ─────────────────────────────────────────────────────────────────────────
  describe("Job capability registry", () => {
    it("has NO manual defineEditorialCapability() calls", () => {
      const source = readSource("src/lib/jobs/job-capability-registry.ts");
      expect(source).not.toContain("function defineEditorialCapability(");
      expect(source).not.toContain("defineEditorialCapability(\"");
      expect(source).not.toContain("ADMIN_ONLY_EDITORIAL_POLICY");
      expect(source).not.toContain("AUTOMATIC_EDITORIAL_RETRY_POLICY");
    });

    it("covers all 10 deferred job handler names", () => {
      for (const name of JOB_CAPABILITY_TOOL_NAMES) {
        const cap = getJobCapability(name);
        expect(cap, `Missing job capability for: ${name}`).not.toBeNull();
      }
    });

    it("derives the deferred job tool list from catalog job facets", () => {
      const catalogJobNames = projectAllCapabilityRuntimeStatics()
        .filter((runtime) => runtime.job !== null)
        .map((runtime) => runtime.capabilityName);

      expect(JOB_CAPABILITY_TOOL_NAMES).toEqual(catalogJobNames);
    });

    it("matches catalog metadata for every deferred tool", () => {
      for (const name of JOB_CAPABILITY_TOOL_NAMES) {
        const expected = projectCapabilityRuntimeStaticByName(name)?.job;
        expect(expected, `projectJobCapability returned null for: ${name}`).not.toBeNull();
        const actual = JOB_CAPABILITY_REGISTRY[name];
        expect(actual).toEqual(expected);
      }
    });

    it("has exactly 13 entries", () => {
      expect(Object.keys(JOB_CAPABILITY_REGISTRY)).toHaveLength(13);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Browser capability registry
  // ─────────────────────────────────────────────────────────────────────────
  describe("Browser capability registry", () => {
    it("has NO manual descriptor objects", () => {
      const source = readSource(
        "src/lib/media/browser-runtime/browser-capability-registry.ts",
      );
      expect(source).not.toContain("runtimeKind:");
      expect(source).not.toContain("moduleId:");
      expect(source).not.toContain("fallbackPolicy:");
    });

    it("has exactly 3 entries", () => {
      expect(BROWSER_CAPABILITY_TOOL_NAMES).toHaveLength(3);
    });

    it("derives browser entries by iterating the catalog", () => {
      const source = readSource(
        "src/lib/media/browser-runtime/browser-capability-registry.ts",
      );
      expect(source).toContain("Object.entries(CAPABILITY_CATALOG)");
      expect(source).toContain("projectBrowserCapability(definition)");
      expect(source).not.toContain("generate_audio:");
      expect(source).not.toContain("generate_chart:");
      expect(source).not.toContain("generate_graph:");
      expect(source).not.toContain("compose_media:");
    });

    it("covers generate_chart, generate_graph, compose_media", () => {
      const expected = ["generate_chart", "generate_graph", "compose_media"];
      for (const name of expected) {
        const desc = getBrowserCapabilityDescriptor(name);
        expect(desc, `Missing browser descriptor for: ${name}`).not.toBeNull();
        expect(desc!.capabilityId).toBe(name);
      }
    });

    it("matches catalog metadata for every browser-capable tool", () => {
      for (const name of BROWSER_CAPABILITY_TOOL_NAMES) {
        const expected = projectCapabilityRuntimeStaticByName(name)?.browser;
        const actual = getBrowserCapabilityDescriptor(name);
        expect(actual).toEqual(expected);
      }
    });

    it("each catalog browser entry has required fields", () => {
      for (const name of BROWSER_CAPABILITY_TOOL_NAMES) {
        const desc = getBrowserCapabilityDescriptor(name)!;
        expect(desc.capabilityId).toBeTruthy();
        expect(desc.runtimeKind).toBeTruthy();
        expect(desc.moduleId).toBeTruthy();
        expect(desc.supportedAssetKinds.length).toBeGreaterThan(0);
        expect(desc.fallbackPolicy).toBeTruthy();
        expect(desc.recoveryPolicy).toBeTruthy();
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Cross-registry consistency
  // ─────────────────────────────────────────────────────────────────────────
  describe("Cross-registry catalog parity", () => {
    it("runtime-static projection files use runtime helpers instead of raw catalog iteration", () => {
      const schemaProjectionSource = readSource("src/core/capability-catalog/schema-projection.ts");
      const mcpExportSource = readSource("src/core/capability-catalog/mcp-export.ts");
      const mcpSidecarSource = readSource("src/lib/capabilities/mcp-sidecar-inventory.ts");
      const roleDirectiveSource = readSource("src/core/entities/role-directive-assembler.ts");
      const localExternalTargetSource = readSource("src/lib/capabilities/local-external-target-inventory.ts");
      const executionTargetsSource = readSource("src/core/platform/execution/ExecutionPlanner.ts");

      expect(schemaProjectionSource).toContain("projectAllCapabilityRuntimeStatics");
      expect(schemaProjectionSource).not.toContain("Object.values(CAPABILITY_CATALOG)");
      expect(mcpExportSource).toContain("projectAllCapabilityRuntimeStatics");
      expect(mcpExportSource).not.toContain("Object.values(CAPABILITY_CATALOG)");
      expect(mcpSidecarSource).toContain("projectAllCapabilityRuntimeStatics");
      expect(mcpSidecarSource).not.toContain("Object.entries(CAPABILITY_CATALOG)");
      expect(roleDirectiveSource).toContain("projectAllCapabilityRuntimeStatics");
      expect(roleDirectiveSource).not.toContain("Object.values(CAPABILITY_CATALOG)");
      expect(localExternalTargetSource).toContain("projectAllCapabilityRuntimes");
      expect(localExternalTargetSource).not.toContain("Object.values(CAPABILITY_CATALOG)");
      expect(executionTargetsSource).toContain("projectCapabilityRuntimeDefinition");
      expect(executionTargetsSource).not.toContain("Object.values(CAPABILITY_CATALOG)");
    });

    it("no duplicate tool metadata outside the catalog", () => {
      // Presentation: no createDescriptor
      const presSource = readSource(
        "src/frameworks/ui/chat/registry/capability-presentation-registry.ts",
      );
      expect(presSource).not.toContain("function createDescriptor(");

      // Job: no defineEditorialCapability
      const jobSource = readSource("src/lib/jobs/job-capability-registry.ts");
      expect(jobSource).not.toContain("function defineEditorialCapability(");

      // Browser: no manual descriptors
      const browserSource = readSource(
        "src/lib/media/browser-runtime/browser-capability-registry.ts",
      );
      expect(browserSource).not.toContain("runtimeKind:");
    });

    it("all browser tools also have presentation entries", () => {
      for (const name of BROWSER_CAPABILITY_TOOL_NAMES) {
        expect(
          getCapabilityPresentationDescriptor(name),
          `Browser tool ${name} missing presentation entry`,
        ).toBeDefined();
      }
    });

    it("all deferred tools also have presentation entries", () => {
      for (const name of JOB_CAPABILITY_TOOL_NAMES) {
        expect(
          getCapabilityPresentationDescriptor(name),
          `Deferred tool ${name} missing presentation entry`,
        ).toBeDefined();
      }
    });
  });
});
