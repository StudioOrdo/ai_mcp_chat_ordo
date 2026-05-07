import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { projectCapabilityRuntimeNamesForBundle } from "@/core/platform/capability-runtime/CapabilityRuntime";
import { _resetToolComposition, getToolComposition } from "./tool-composition-root";
import {
  getPromptVisibleRuntimeToolManifestForRole,
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
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      OPENAI_API_KEY: "sk-test",
      IMAGE_PROVIDER: "openai",
      TTS_PROVIDER: "openai",
      WEB_SEARCH_PROVIDER: "openai",
    };
    _resetToolComposition();
  });

  afterEach(() => {
    process.env = originalEnv;
    _resetToolComposition();
  });

  it("removes the legacy navigate tool from model-visible role manifests", () => {
    const { registry } = getToolComposition();
    for (const role of RUNTIME_MANIFEST_ROLE_ORDER) {
      const names = getRuntimeToolManifestForRole(registry, role).map((entry) => entry.name);
      expect(names).not.toContain("navigate");
    }
  });

  it("exposes validated navigation and runtime inspection tools for all roles", () => {
    const { registry } = getToolComposition();
    for (const role of RUNTIME_MANIFEST_ROLE_ORDER) {
      const names = getRuntimeToolManifestForRole(registry, role).map((entry) => entry.name);
      expect(names).toContain("get_current_page");
      expect(names).toContain("inspect_runtime_context");
      expect(names).toContain("list_available_pages");
      expect(names).toContain("navigate_to_page");
    }
  });

  it("keeps role tool counts stable", () => {
    const { registry } = getToolComposition();
    expect(getRuntimeToolCountsByRole(registry)).toEqual({
      ANONYMOUS: 16,
      AUTHENTICATED: 28,
      APPRENTICE: 28,
      STAFF: 29,
      ADMIN: 69,
    });
  });

  it("keeps model-visible manifests alphabetically ordered for every role", () => {
    const { registry } = getToolComposition();
    for (const role of RUNTIME_MANIFEST_ROLE_ORDER) {
      const names = getRuntimeToolManifestForRole(registry, role).map((entry) => entry.name);
      expect(names).toEqual([...names].sort((left, right) => left.localeCompare(right)));
    }
  });

  it("keeps manifest ordering stable across fresh composition-root construction", () => {
    const { registry } = getToolComposition();
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
    const { registry } = getToolComposition();
    const names = getRuntimeToolManifestForRole(registry, "ADMIN", {
      allowedToolNames: ["search_corpus", "navigate_to_page", "admin_search"],
    }).map((entry) => entry.name);

    expect(names).toEqual(["admin_search", "navigate_to_page", "search_corpus"]);
  });

  it("separates executable runtime manifests from default prompt-visible manifests", () => {
    const { registry } = getToolComposition();

    const executableNames = getRuntimeToolManifestForRole(registry, "AUTHENTICATED")
      .map((entry) => entry.name);
    const promptVisibleNames = getPromptVisibleRuntimeToolManifestForRole(
      registry,
      "AUTHENTICATED",
      { mode: "default_chat" },
    ).map((entry) => entry.name);

    expect(executableNames).toEqual(expect.arrayContaining([
      "adjust_ui",
      "get_current_page",
      "inspect_runtime_context",
      "inspect_theme",
      "list_available_pages",
      "navigate_to_page",
    ]));
    expect(promptVisibleNames).not.toEqual(expect.arrayContaining([
      "adjust_ui",
      "get_current_page",
      "inspect_runtime_context",
      "inspect_theme",
      "list_available_pages",
      "navigate_to_page",
    ]));
  });

  it("keeps operator-only tools out of default admin prompts while preserving operator chat access", () => {
    const { registry } = getToolComposition();

    const defaultAdminNames = getPromptVisibleRuntimeToolManifestForRole(
      registry,
      "ADMIN",
      { mode: "default_chat" },
    ).map((entry) => entry.name);
    const operatorAdminNames = getPromptVisibleRuntimeToolManifestForRole(
      registry,
      "ADMIN",
      { mode: "operator_chat" },
    ).map((entry) => entry.name);

    expect(defaultAdminNames).not.toContain("admin_search");
    expect(defaultAdminNames).not.toContain("admin_web_search");
    expect(operatorAdminNames).toEqual(expect.arrayContaining([
      "admin_search",
      "admin_web_search",
    ]));
  });

  it("omits provider-disabled tools from role schemas", () => {
    process.env.TTS_PROVIDER = "disabled";
    process.env.IMAGE_PROVIDER = "disabled";
    process.env.WEB_SEARCH_PROVIDER = "disabled";
    _resetToolComposition();

    const { registry } = getToolComposition();
    const names = getRuntimeToolManifestForRole(registry, "ADMIN").map((entry) => entry.name);

    expect(names).not.toContain("generate_audio");
    expect(names).not.toContain("generate_blog_image");
    expect(names).not.toContain("admin_web_search");
  });
});
