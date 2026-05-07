import { describe, expect, it } from "vitest";
import {
  CAPABILITY_CATALOG,
  getCatalogDefinition,
  isCatalogPilotCapability,
  projectBrowserCapability,
  projectJobCapability,
  projectMcpExportIntent,
  projectPresentationDescriptor,
  projectPromptHint,
} from "./catalog";

describe("capability-catalog", () => {
  describe("catalog integrity", () => {
    it("contains all 69 tool capabilities", () => {
      const names = Object.keys(CAPABILITY_CATALOG);
      expect(names.length).toBe(69);
      // Verify pilot entries still present
      expect(names).toContain("draft_content");
      expect(names).toContain("publish_content");
      expect(names).toContain("compose_media");
      expect(names).toContain("admin_web_search");
      // Verify Sprint 10 expansion entries
      expect(names).toContain("calculator");
      expect(names).toContain("search_corpus");
      expect(names).toContain("list_journal_posts");
      expect(names).toContain("produce_blog_article");
      expect(names).toContain("list_conversation_media_assets");
      // Verify appliance backup self-service entries
      expect(names).toContain("create_appliance_backup");
      expect(names).toContain("configure_backup_policy");
      expect(names).toContain("execute_appliance_restore");
    });

    it("every entry has core.name matching its key", () => {
      for (const [key, def] of Object.entries(CAPABILITY_CATALOG)) {
        expect(def.core.name).toBe(key);
      }
    });

    it("isCatalogPilotCapability returns true for catalog tools", () => {
      expect(isCatalogPilotCapability("draft_content")).toBe(true);
      expect(isCatalogPilotCapability("compose_media")).toBe(true);
      expect(isCatalogPilotCapability("calculator")).toBe(true);
      expect(isCatalogPilotCapability("search_corpus")).toBe(true);
      expect(isCatalogPilotCapability("not_a_real_tool")).toBe(false);
    });

    it("getCatalogDefinition returns definitions for all catalog tools", () => {
      expect(getCatalogDefinition("draft_content")).toBeDefined();
      expect(getCatalogDefinition("calculator")).toBeDefined();
      expect(getCatalogDefinition("search_corpus")).toBeDefined();
      expect(getCatalogDefinition("not_a_real_tool")).toBeUndefined();
    });
  });

  describe("presentation projection", () => {
    it("projects draft_content presentation correctly", () => {
      const result = projectPresentationDescriptor(CAPABILITY_CATALOG.draft_content);
      expect(result.toolName).toBe("draft_content");
      expect(result.family).toBe("editorial");
      expect(result.cardKind).toBe("editorial_workflow");
      expect(result.executionMode).toBe("deferred");
      expect(result.label).toBe("Draft Content");
      expect(result.progressMode).toBe("single"); // default for deferred
      expect(result.historyMode).toBe("payload_snapshot"); // default
      expect(result.supportsRetry).toBe("whole_job"); // default for deferred
    });

    it("projects publish_content presentation correctly", () => {
      const result = projectPresentationDescriptor(CAPABILITY_CATALOG.publish_content);
      expect(result.toolName).toBe("publish_content");
      expect(result.family).toBe("editorial");
      expect(result.executionMode).toBe("deferred");
    });

    it("projects compose_media presentation with explicit overrides", () => {
      const result = projectPresentationDescriptor(CAPABILITY_CATALOG.compose_media);
      expect(result.toolName).toBe("compose_media");
      expect(result.family).toBe("artifact");
      expect(result.cardKind).toBe("media_render");
      expect(result.executionMode).toBe("hybrid");
      expect(result.progressMode).toBe("single");
      expect(result.artifactKinds).toEqual(["video", "audio"]);
      expect(result.supportsRetry).toBe("whole_job");
    });

    it("exposes Phase 2 clip lineage and kind rules in the compose_media planner schema", () => {
      const schema = CAPABILITY_CATALOG.compose_media.schema.inputSchema;
      const plan = (schema.properties as Record<string, unknown>).plan as {
        properties: Record<string, unknown>;
      };
      const visualClips = plan.properties.visualClips as {
        items: { properties: Record<string, unknown> };
      };
      const audioClips = plan.properties.audioClips as {
        items: { properties: Record<string, unknown> };
      };

      expect(visualClips.items.properties).toHaveProperty("sourceAssetId");
      expect(audioClips.items.properties).toHaveProperty("sourceAssetId");
      expect((visualClips.items.properties.kind as { enum: string[] }).enum).toEqual([
        "image",
        "video",
        "chart",
        "graph",
      ]);
      expect((audioClips.items.properties.kind as { enum: string[] }).enum).toEqual([
        "audio",
      ]);
    });

    it("projects admin_web_search presentation as deferred", () => {
      const result = projectPresentationDescriptor(CAPABILITY_CATALOG.admin_web_search);
      expect(result.toolName).toBe("admin_web_search");
      expect(result.family).toBe("search");
      expect(result.cardKind).toBe("search_result");
      expect(result.executionMode).toBe("deferred");
      expect(result.progressMode).toBe("single");
      expect(result.supportsRetry).toBe("whole_job");
    });
  });

  describe("job projection", () => {
    it("projects draft_content job capability", () => {
      const result = projectJobCapability(CAPABILITY_CATALOG.draft_content);
      expect(result).not.toBeNull();
      expect(result!.toolName).toBe("draft_content");
      expect(result!.family).toBe("editorial");
      expect(result!.label).toBe("Draft Content");
      expect(result!.retryPolicy.mode).toBe("automatic");
      expect(result!.retryPolicy.maxAttempts).toBe(3);
      expect(result!.artifactPolicy.mode).toBe("open_artifact");
      expect(result!.defaultSurface).toBe("global");
    });

    it("projects publish_content job capability", () => {
      const result = projectJobCapability(CAPABILITY_CATALOG.publish_content);
      expect(result).not.toBeNull();
      expect(result!.toolName).toBe("publish_content");
      expect(result!.retryPolicy.mode).toBe("automatic");
    });

    it("projects produce_blog_article as a manual-only orchestration job", () => {
      const result = projectJobCapability(CAPABILITY_CATALOG.produce_blog_article);
      expect(result).not.toBeNull();
      expect(result!.toolName).toBe("produce_blog_article");
      expect(result!.retryPolicy).toEqual({ mode: "manual_only" });
      expect(result!.artifactPolicy.mode).toBe("open_artifact");
    });

    it("projects compose_media job capability with media-specific policy", () => {
      const result = projectJobCapability(CAPABILITY_CATALOG.compose_media);
      expect(result).not.toBeNull();
      expect(result!.toolName).toBe("compose_media");
      expect(result!.family).toBe("media");
      expect(result!.retryPolicy.maxAttempts).toBe(10);
      expect(result!.retryPolicy.baseDelayMs).toBe(3_000);
      expect(result!.defaultSurface).toBe("self");
      expect(result!.initiatorRoles).toContain("AUTHENTICATED");
    });

    it("projects admin_web_search job capability", () => {
      const result = projectJobCapability(CAPABILITY_CATALOG.admin_web_search);
      expect(result).not.toBeNull();
      expect(result!.toolName).toBe("admin_web_search");
      expect(result!.family).toBe("system");
      expect(result!.retryPolicy).toMatchObject({
        mode: "automatic",
        maxAttempts: 2,
      });
      expect(result!.defaultSurface).toBe("global");
      expect(result!.initiatorRoles).toEqual(["ADMIN"]);
    });
  });

  describe("browser projection", () => {
    it("uses explicit collision resolutions for shared media tool keys", () => {
      expect(CAPABILITY_CATALOG.generate_audio.presentation.executionMode).toBe("deferred");
      expect(projectBrowserCapability(CAPABILITY_CATALOG.generate_audio)).toBeNull();
      expect(CAPABILITY_CATALOG.generate_chart.presentation.executionMode).toBe("browser");
      expect(CAPABILITY_CATALOG.generate_graph.presentation.executionMode).toBe("browser");
    });

    it("projects compose_media browser capability", () => {
      const result = projectBrowserCapability(CAPABILITY_CATALOG.compose_media);
      expect(result).not.toBeNull();
      expect(result!.capabilityId).toBe("compose_media");
      expect(result!.runtimeKind).toBe("wasm_worker");
      expect(result!.moduleId).toBe("ffmpeg-browser-executor");
      expect(result!.fallbackPolicy).toBe("server");
      expect(result!.recoveryPolicy).toBe("fallback_to_server");
      expect(result!.maxConcurrentExecutions).toBe(1);
      expect(result!.requiresCrossOriginIsolation).toBe(true);
      expect(result!.supportedAssetKinds).toEqual([
        "video", "audio", "image", "subtitle", "waveform",
      ]);
    });

    it("returns null for draft_content (no browser facet)", () => {
      expect(projectBrowserCapability(CAPABILITY_CATALOG.draft_content)).toBeNull();
    });

    it("returns null for admin_web_search (no browser facet)", () => {
      expect(projectBrowserCapability(CAPABILITY_CATALOG.admin_web_search)).toBeNull();
    });
  });

  describe("prompt hint projection", () => {
    it("returns compose_media ADMIN directive lines", () => {
      const lines = projectPromptHint(CAPABILITY_CATALOG.compose_media, "ADMIN");
      expect(lines).not.toBeNull();
      expect(lines!.length).toBeGreaterThan(0);
      expect(lines![0]).toContain("MEDIA COMPOSITION");
      expect(lines![0]).toContain("canonical job execution");
    });

    it("returns compose_media AUTHENTICATED directive lines without hybrid mention", () => {
      const lines = projectPromptHint(CAPABILITY_CATALOG.compose_media, "AUTHENTICATED");
      expect(lines).not.toBeNull();
      expect(lines![0]).toContain("MEDIA COMPOSITION");
      expect(lines![0]).not.toContain("hybrid");
    });

    it("returns null for compose_media ANONYMOUS (no special directive)", () => {
      expect(projectPromptHint(CAPABILITY_CATALOG.compose_media, "ANONYMOUS")).toBeNull();
    });

    it("returns admin_web_search ADMIN directive lines", () => {
      const lines = projectPromptHint(CAPABILITY_CATALOG.admin_web_search, "ADMIN");
      expect(lines).not.toBeNull();
      expect(lines![0]).toContain("Web Search");
    });

    it("returns null for admin_web_search non-ADMIN roles", () => {
      expect(projectPromptHint(CAPABILITY_CATALOG.admin_web_search, "AUTHENTICATED")).toBeNull();
    });

    it("returns null for draft_content (no prompt hint facet)", () => {
      expect(projectPromptHint(CAPABILITY_CATALOG.draft_content, "ADMIN")).toBeNull();
    });
  });

  describe("MCP export projection", () => {
    it("returns export intent for admin_web_search", () => {
      const result = projectMcpExportIntent(CAPABILITY_CATALOG.admin_web_search);
      expect(result).not.toBeNull();
      expect(result!.exportable).toBe(true);
      expect(result!.sharedModule).toBe("src/lib/capabilities/shared/web-search-tool");
    });

    it("returns null for draft_content (no MCP export facet)", () => {
      expect(projectMcpExportIntent(CAPABILITY_CATALOG.draft_content)).toBeNull();
    });

    it("returns null for compose_media (no MCP export facet)", () => {
      expect(projectMcpExportIntent(CAPABILITY_CATALOG.compose_media)).toBeNull();
    });
  });

  describe("facet absence correctness", () => {
    it("admin_web_search has job and MCP export facets, but no browser facet", () => {
      const def = getCatalogDefinition("admin_web_search")!;
      expect(def.job).toBeDefined();
      expect(def.browser).toBeUndefined();
      expect(def.mcpExport).toBeDefined();
    });

    it("Sprint 23 migrated tools declare executor and validation bindings", () => {
      const migratedToolNames = [
        "admin_web_search",
        "compose_media",
        "draft_content",
        "publish_content",
        "search_corpus",
      ] as const;

      for (const toolName of migratedToolNames) {
        const def = getCatalogDefinition(toolName)!;
        expect(def.executorBinding, `${toolName} missing executorBinding`).toBeDefined();
        expect(def.validationBinding, `${toolName} missing validationBinding`).toBeDefined();
      }
    });

    it("draft_content has job, no browser, no MCP export, no prompt hint", () => {
      const def = getCatalogDefinition("draft_content")!;
      expect(def.job).toBeDefined();
      expect(def.browser).toBeUndefined();
      expect(def.mcpExport).toBeUndefined();
      expect(def.promptHint).toBeUndefined();
    });

    it("compose_media has all facets except MCP export", () => {
      const def = getCatalogDefinition("compose_media")!;
      expect(def.job).toBeDefined();
      expect(def.browser).toBeDefined();
      expect(def.promptHint).toBeDefined();
      expect(def.schema).toBeDefined();
      expect(def.mcpExport).toBeUndefined();
    });
  });
});
