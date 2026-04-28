/**
 * Sprint 10 — Catalog Coverage Test
 *
 * Ensures every tool registered via ToolBundleDescriptor has a matching
 * CAPABILITY_CATALOG entry, and every catalog entry name matches a bundle tool.
 */
import { describe, it, expect } from "vitest";
import { CAPABILITY_CATALOG } from "./catalog";
import { projectAllCapabilityRuntimeStatics } from "@/core/platform/capability-runtime/CapabilityRuntime";

// Import all bundle descriptors
import { ADMIN_BUNDLE } from "@/lib/chat/tool-bundles/admin-tools";
import { AFFILIATE_BUNDLE } from "@/lib/chat/tool-bundles/affiliate-tools";
import { BLOG_BUNDLE } from "@/lib/chat/tool-bundles/blog-tools";
import { CALCULATOR_BUNDLE } from "@/lib/chat/tool-bundles/calculator-tools";
import { CONVERSATION_BUNDLE } from "@/lib/chat/tool-bundles/conversation-tools";
import { CORPUS_BUNDLE } from "@/lib/chat/tool-bundles/corpus-tools";
import { JOB_BUNDLE } from "@/lib/chat/tool-bundles/job-tools";
import { MEDIA_BUNDLE } from "@/lib/chat/tool-bundles/media-tools";
import { NAVIGATION_BUNDLE } from "@/lib/chat/tool-bundles/navigation-tools";
import { PROFILE_BUNDLE } from "@/lib/chat/tool-bundles/profile-tools";
import { THEME_BUNDLE } from "@/lib/chat/tool-bundles/theme-tools";

const ALL_BUNDLES = [
  ADMIN_BUNDLE,
  AFFILIATE_BUNDLE,
  BLOG_BUNDLE,
  CALCULATOR_BUNDLE,
  CONVERSATION_BUNDLE,
  CORPUS_BUNDLE,
  JOB_BUNDLE,
  MEDIA_BUNDLE,
  NAVIGATION_BUNDLE,
  PROFILE_BUNDLE,
  THEME_BUNDLE,
];

/** Collect all tool names from all bundles. */
function getAllBundleToolNames(): string[] {
  const names: string[] = [];
  for (const bundle of ALL_BUNDLES) {
    for (const toolName of bundle.toolNames) {
      names.push(toolName);
    }
  }
  return [...new Set(names)].sort();
}

describe("Sprint 10 — Catalog Coverage", () => {
  const catalogNames = Object.keys(CAPABILITY_CATALOG).sort();
  const runtimeNames = projectAllCapabilityRuntimeStatics()
    .map((runtime) => runtime.capabilityName)
    .sort();
  const bundleToolNames = getAllBundleToolNames();

  it("every bundle tool has a catalog entry", () => {
    const missing = bundleToolNames.filter(
      (name) => !catalogNames.includes(name),
    );
    expect(missing).toEqual([]);
  });

  it("every catalog entry has a matching bundle tool", () => {
    const orphaned = catalogNames.filter(
      (name) => !bundleToolNames.includes(name),
    );
    expect(orphaned).toEqual([]);
  });

  it("runtime-static capability names match catalog keys", () => {
    expect(runtimeNames).toEqual(catalogNames);
  });

  it("catalog has exactly the right count", () => {
    expect(catalogNames.length).toBe(bundleToolNames.length);
  });

  it("every catalog entry has core.name matching its key", () => {
    for (const [key, def] of Object.entries(CAPABILITY_CATALOG)) {
      expect(def.core.name).toBe(key);
    }
  });

  it("every catalog entry has a presentation facet", () => {
    for (const [key, def] of Object.entries(CAPABILITY_CATALOG)) {
      expect(def.presentation, `${key} missing presentation`).toBeDefined();
      expect(def.presentation.family, `${key} missing family`).toBeDefined();
      expect(def.presentation.cardKind, `${key} missing cardKind`).toBeDefined();
      expect(def.presentation.executionMode, `${key} missing executionMode`).toBeDefined();
    }
  });
});
