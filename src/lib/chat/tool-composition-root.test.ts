import { describe, expect, it } from "vitest";

import { projectCapabilityRuntimeNamesForBundle } from "@/core/platform/capability-runtime/CapabilityRuntime";
import { _resetToolComposition, getToolComposition } from "./tool-composition-root";
import {
  getRuntimeToolCountsByRole,
  getRuntimeToolManifestForRole,
  RUNTIME_MANIFEST_ROLE_ORDER,
} from "./runtime-manifest";

import { TOOL_BUNDLE_REGISTRY } from "./tool-composition-root";

describe("tool composition root", () => {
  it("keeps bundle descriptors aligned with capability runtime bundle projection", () => {
    for (const bundle of TOOL_BUNDLE_REGISTRY) {
      expect(bundle.toolNames).toEqual(projectCapabilityRuntimeNamesForBundle(bundle.id));
    }
  });
});

describe("tool composition runtime manifest", () => {
  const { registry } = getToolComposition();

  it("removes the legacy navigate tool from model-visible role manifests", () => {
    for (const role of RUNTIME_MANIFEST_ROLE_ORDER) {
      const names = getRuntimeToolManifestForRole(registry, role).map((entry) => entry.name);
      expect(names).not.toContain("navigate");
    }
  });

  it("exposes validated navigation and runtime inspection tools for all roles", () => {
    for (const role of RUNTIME_MANIFEST_ROLE_ORDER) {
      const names = getRuntimeToolManifestForRole(registry, role).map((entry) => entry.name);
      expect(names).toContain("get_current_page");
      expect(names).toContain("inspect_runtime_context");
      expect(names).toContain("list_available_pages");
      expect(names).toContain("navigate_to_page");
    }
  });

  it("keeps role tool counts stable", () => {
    expect(getRuntimeToolCountsByRole(registry)).toEqual({
      ANONYMOUS: 16,
      AUTHENTICATED: 28,
      APPRENTICE: 28,
      STAFF: 28,
      ADMIN: 59,
    });
  });

  it("keeps model-visible manifests alphabetically ordered for every role", () => {
    for (const role of RUNTIME_MANIFEST_ROLE_ORDER) {
      const names = getRuntimeToolManifestForRole(registry, role).map((entry) => entry.name);
      expect(names).toEqual([...names].sort((left, right) => left.localeCompare(right)));
    }
  });

  it("keeps manifest ordering stable across fresh composition-root construction", () => {
    const firstManifests = Object.fromEntries(
      RUNTIME_MANIFEST_ROLE_ORDER.map((role) => [
        role,
        getRuntimeToolManifestForRole(registry, role).map((entry) => entry.name),
      ]),
    );

    _resetToolComposition();
    const rebuiltRegistry = getToolComposition().registry;
    const rebuiltManifests = Object.fromEntries(
      RUNTIME_MANIFEST_ROLE_ORDER.map((role) => [
        role,
        getRuntimeToolManifestForRole(rebuiltRegistry, role).map((entry) => entry.name),
      ]),
    );

    expect(rebuiltManifests).toEqual(firstManifests);
  });

  it("supports request-scoped runtime manifest filtering without breaking alphabetical order", () => {
    const names = getRuntimeToolManifestForRole(registry, "ADMIN", {
      allowedToolNames: ["search_corpus", "navigate_to_page", "admin_search"],
    }).map((entry) => entry.name);

    expect(names).toEqual(["admin_search", "navigate_to_page", "search_corpus"]);
  });
});