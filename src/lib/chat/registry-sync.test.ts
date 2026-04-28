import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  getDb: () => ({
    prepare: () => ({ all: () => [], get: () => null, run: () => ({}) }),
    exec: () => {},
    pragma: () => {},
  }),
}));

import { ToolRegistry } from "@/core/tool-registry/ToolRegistry";
import { RoleAwareSearchFormatter } from "@/core/tool-registry/ToolResultFormatter";
import {
  CHAT_CAPABILITY_PRESENTATION_TOOL_NAMES,
  getCapabilityPresentationDescriptor,
} from "@/frameworks/ui/chat/registry/capability-presentation-registry";
import {
  BROWSER_CAPABILITY_TOOL_NAMES,
  getBrowserCapabilityDescriptor,
} from "@/lib/media/browser-runtime/browser-capability-registry";
import { TOOL_BUNDLE_COMPOSITIONS } from "./tool-bundle-composition";

/**
 * Cross-registry validation: Ensures the three registries
 * (ToolRegistry, CapabilityPresentationRegistry, BrowserCapabilityRegistry)
 * stay synchronized and don't drift after sprint changes.
 *
 * This test intentionally skips corpus tools (which need a DB connection)
 * and validates all other tool bundles.
 */

function createTestRegistry(): ToolRegistry {
  const reg = new ToolRegistry(new RoleAwareSearchFormatter());

  for (const registration of TOOL_BUNDLE_COMPOSITIONS) {
    if (registration.bundle.id === "corpus") {
      continue;
    }

    registration.register(reg, {} as never);
  }

  return reg;
}

// Tools that need a DB (corpus tools) or are stale presentation entries
const EXCLUDED_FROM_REGISTRY_CHECK = new Set([
  // Corpus tools need a DB connection to register
  "search_corpus",
  "get_section",
  "get_corpus_summary",
  "get_checklist",
  "list_practitioners",
]);

describe("Cross-registry synchronization", () => {
  const registry = createTestRegistry();
  const allToolNames = registry.getToolNames();

  it("every non-corpus tool in ToolRegistry has a CapabilityPresentationDescriptor", () => {
    const missingPresentation: string[] = [];

    for (const toolName of allToolNames) {
      const descriptor = getCapabilityPresentationDescriptor(toolName);
      if (!descriptor) {
        missingPresentation.push(toolName);
      }
    }

    // Tools that intentionally don't have presentation descriptors
    const KNOWN_EXCEPTIONS = [
      // Admin tools
      "admin_search",
      "admin_content",
      "admin_prioritize_leads",
      "admin_prioritize_offer",
      "admin_triage_routing_risk",
      // Admin affiliate tools
      "get_admin_affiliate_summary",
      "list_admin_referral_exceptions",
      // Job management tools (render through job status, not custom cards)
      "get_deferred_job_status",
      "list_deferred_jobs",
      "get_my_job_status",
      "list_my_jobs",
    ];

    const unexpected = missingPresentation.filter(
      (name) => !KNOWN_EXCEPTIONS.includes(name),
    );

    expect(
      unexpected,
      `Tools missing CapabilityPresentationDescriptor: ${unexpected.join(", ")}`,
    ).toEqual([]);
  });

  it("every CapabilityPresentationDescriptor tool name exists in ToolRegistry or is a corpus tool", () => {
    const missingInRegistry: string[] = [];

    for (const toolName of CHAT_CAPABILITY_PRESENTATION_TOOL_NAMES) {
      if (EXCLUDED_FROM_REGISTRY_CHECK.has(toolName)) continue;
      if (!allToolNames.includes(toolName)) {
        missingInRegistry.push(toolName);
      }
    }

    expect(
      missingInRegistry,
      `Presentation descriptors for non-existent tools: ${missingInRegistry.join(", ")}`,
    ).toEqual([]);
  });

  it("every BrowserCapabilityRegistry entry has a compatible presentation descriptor", () => {
    const mismatches: string[] = [];

    for (const toolName of BROWSER_CAPABILITY_TOOL_NAMES) {
      const presentation = getCapabilityPresentationDescriptor(toolName);
      if (!presentation) {
        mismatches.push(`${toolName}: missing CapabilityPresentationDescriptor`);
        continue;
      }

      if (presentation.executionMode !== "browser" && presentation.executionMode !== "hybrid") {
        mismatches.push(
          `${toolName}: BrowserCapabilityRegistry entry exists but presentation executionMode is "${presentation.executionMode}" (expected "browser" or "hybrid")`,
        );
      }
    }

    expect(
      mismatches,
      `Browser capability mismatches:\n${mismatches.join("\n")}`,
    ).toEqual([]);
  });

  it("browser capability tools exist in the ToolRegistry", () => {
    const missing: string[] = [];

    for (const toolName of BROWSER_CAPABILITY_TOOL_NAMES) {
      if (!allToolNames.includes(toolName)) {
        missing.push(toolName);
      }
    }

    expect(
      missing,
      `Browser capability tools missing from ToolRegistry: ${missing.join(", ")}`,
    ).toEqual([]);
  });

  it("compose_media execution modes are consistent across registries", () => {
    const toolDescriptor = registry.getDescriptor("compose_media");
    const presentationDescriptor = getCapabilityPresentationDescriptor("compose_media");
    const browserDescriptor = getBrowserCapabilityDescriptor("compose_media");

    expect(toolDescriptor, "compose_media missing from ToolRegistry").toBeDefined();
    expect(presentationDescriptor, "compose_media missing from CapabilityPresentationRegistry").toBeDefined();
    expect(browserDescriptor, "compose_media missing from BrowserCapabilityRegistry").toBeDefined();

    // compose_media is browser-first hybrid: inline in ToolDescriptor (no executionMode),
    // "hybrid" in presentation, "wasm_worker" in browser capability
    expect(toolDescriptor!.executionMode).toBeUndefined();
    expect(presentationDescriptor!.executionMode).toBe("hybrid");
    expect(browserDescriptor!.runtimeKind).toBe("wasm_worker");
  });

  it("pilot tool presentation descriptors are catalog-derived", () => {
    const pilotToolNames = ["draft_content", "publish_content", "compose_media", "admin_web_search"];

    for (const toolName of pilotToolNames) {
      const descriptor = getCapabilityPresentationDescriptor(toolName);
      expect(
        descriptor,
        `Pilot tool "${toolName}" is missing from CapabilityPresentationRegistry`,
      ).toBeDefined();
      expect(descriptor!.toolName).toBe(toolName);
    }

    // Verify the catalog import is the actual source by checking the
    // compose_media descriptor has the known catalog-specific values
    const composePres = getCapabilityPresentationDescriptor("compose_media")!;
    expect(composePres.family).toBe("artifact");
    expect(composePres.executionMode).toBe("hybrid");
    expect(composePres.artifactKinds).toEqual(["video", "audio"]);

    // Verify admin_web_search stays aligned with the current catalog runtime defaults.
    const searchPres = getCapabilityPresentationDescriptor("admin_web_search")!;
    expect(searchPres.family).toBe("search");
    expect(searchPres.executionMode).toBe("deferred");
    expect(searchPres.supportsRetry).toBe("whole_job");
  });
});

