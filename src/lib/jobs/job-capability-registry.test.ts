import { describe, expect, it, vi } from "vitest";
import {
  canRoleManageGlobalJob,
  canRolesManageGlobalJob,
  canRolesViewGlobalJob,
  canRoleViewGlobalJob,
  CURRENT_GLOBAL_JOB_OPERATOR_ROLES,
  CURRENT_SIGNED_IN_JOB_AUDIENCE_ROLES,
  JOB_CAPABILITY_REGISTRY,
  JOB_CAPABILITY_TOOL_NAMES,
  getJobCapabilityPresentation,
  getGlobalJobOperatorRoles,
  getJobCapability,
  getSignedInJobAudienceRoles,
  listGlobalJobCapabilitiesForRole,
  listGlobalJobCapabilitiesForRoles,
  listJobCapabilities,
  type JobCapabilityName,
} from "@/lib/jobs/job-capability-registry";
import {
  COMPOSE_MEDIA_PHASES,
  PRODUCE_BLOG_ARTICLE_PHASES,
} from "@/lib/jobs/job-progress-state";

// Mock the handler factory to avoid loading better-sqlite3 (which may be compiled
// for the wrong Node version in the test environment).
const MOCK_HANDLER_NAMES: JobCapabilityName[] = [...JOB_CAPABILITY_TOOL_NAMES];

const mockHandlers = Object.fromEntries(
  MOCK_HANDLER_NAMES.map((name) => [name, vi.fn()]),
) as Record<JobCapabilityName, ReturnType<typeof vi.fn>>;

vi.mock("@/lib/jobs/deferred-job-handlers", () => ({
  createDeferredJobHandlers: vi.fn(() => mockHandlers),
}));

import { createDeferredJobHandlers } from "@/lib/jobs/deferred-job-handlers";

describe("job capability registry", () => {
  it("covers every live deferred handler exactly once", () => {
    const liveHandlerNames = Object.keys(createDeferredJobHandlers());

    expect(JOB_CAPABILITY_TOOL_NAMES).toEqual(liveHandlerNames);
    expect(listJobCapabilities().map((capability) => capability.toolName)).toEqual(liveHandlerNames);
  });

  it("does not advertise handler names that are not actually registered", () => {
    const liveHandlerNames = Object.keys(createDeferredJobHandlers());

    for (const capability of listJobCapabilities()) {
      expect(liveHandlerNames).toContain(capability.toolName);
      expect(getJobCapability(capability.toolName)).toEqual(capability);
    }
  });

  it("keeps the current editorial handler audience and execution policy admin-only", () => {
    const editorialHandlers = Object.keys(JOB_CAPABILITY_REGISTRY).filter(
      (key) => JOB_CAPABILITY_REGISTRY[key as keyof typeof JOB_CAPABILITY_REGISTRY].family === "editorial",
    );

    for (const toolName of editorialHandlers as Array<keyof typeof JOB_CAPABILITY_REGISTRY>) {
      expect(JOB_CAPABILITY_REGISTRY[toolName]).toMatchObject({
        family: "editorial",
        executionPrincipal: "system_worker",
        executionAllowedRoles: CURRENT_GLOBAL_JOB_OPERATOR_ROLES,
        recoveryMode: "rerun",
        resultRetention: "retain",
        initiatorRoles: CURRENT_GLOBAL_JOB_OPERATOR_ROLES,
        ownerViewerRoles: CURRENT_GLOBAL_JOB_OPERATOR_ROLES,
        ownerActionRoles: CURRENT_GLOBAL_JOB_OPERATOR_ROLES,
        globalViewerRoles: CURRENT_GLOBAL_JOB_OPERATOR_ROLES,
        globalActionRoles: CURRENT_GLOBAL_JOB_OPERATOR_ROLES,
        defaultSurface: "global",
      });
    }
  });

  it("registers compose_media as a user-scoped media family job", () => {
    const cap = JOB_CAPABILITY_REGISTRY.compose_media;
    expect(cap.family).toBe("media");
    expect(cap.defaultSurface).toBe("self");
    expect(cap.initiatorRoles).toContain("AUTHENTICATED");
    expect(cap.ownerViewerRoles).toContain("AUTHENTICATED");
    expect(cap.globalViewerRoles).toEqual(CURRENT_GLOBAL_JOB_OPERATOR_ROLES);
    expect(cap.retryPolicy.mode).toBe("automatic");
    expect(cap.artifactPolicy.mode).toBe("retain");
  });

  it("projects phased job progress metadata from the catalog", () => {
    expect(JOB_CAPABILITY_REGISTRY.produce_blog_article.progressPhases).toEqual(
      PRODUCE_BLOG_ARTICLE_PHASES,
    );
    expect(JOB_CAPABILITY_REGISTRY.compose_media.progressPhases).toEqual(
      COMPOSE_MEDIA_PHASES,
    );
    expect(JOB_CAPABILITY_REGISTRY.produce_product.progressPhases?.map((phase) => phase.key)).toEqual([
      "research",
      "draft",
      "asset_generation_image_1",
      "composition",
      "qa_asset",
      "qa_page",
      "qa_resolution",
      "release",
    ]);
  });

  it("keeps automatic retry limited to the bounded safe editorial capabilities", () => {
    expect(JOB_CAPABILITY_REGISTRY.draft_content.retryPolicy).toEqual({
      mode: "automatic",
      maxAttempts: 3,
      backoffStrategy: "fixed",
      baseDelayMs: 3000,
    });
    expect(JOB_CAPABILITY_REGISTRY.publish_content.retryPolicy).toEqual({
      mode: "automatic",
      maxAttempts: 3,
      backoffStrategy: "fixed",
      baseDelayMs: 3000,
    });
    expect(JOB_CAPABILITY_REGISTRY.prepare_journal_post_for_publish.retryPolicy).toEqual({
      mode: "automatic",
      maxAttempts: 3,
      backoffStrategy: "fixed",
      baseDelayMs: 3000,
    });
    expect(JOB_CAPABILITY_REGISTRY.generate_blog_image.retryPolicy).toEqual({
      mode: "automatic",
      maxAttempts: 3,
      backoffStrategy: "fixed",
      baseDelayMs: 3000,
    });
    expect(JOB_CAPABILITY_REGISTRY.compose_blog_article.retryPolicy).toEqual({
      mode: "automatic",
      maxAttempts: 3,
      backoffStrategy: "fixed",
      baseDelayMs: 3000,
    });
    expect(JOB_CAPABILITY_REGISTRY.produce_product.retryPolicy).toEqual({ mode: "manual_only" });
    expect(JOB_CAPABILITY_REGISTRY.produce_blog_article.retryPolicy).toEqual({ mode: "manual_only" });
    expect(JOB_CAPABILITY_REGISTRY.qa_blog_article.retryPolicy).toEqual({ mode: "manual_only" });
    expect(JOB_CAPABILITY_REGISTRY.resolve_blog_article_qa.retryPolicy).toEqual({ mode: "manual_only" });
    expect(JOB_CAPABILITY_REGISTRY.generate_blog_image_prompt.retryPolicy).toEqual({ mode: "manual_only" });
  });

  it("advertises artifact-open policy only for artifact-producing editorial capabilities", () => {
    expect(JOB_CAPABILITY_REGISTRY.publish_content.artifactPolicy).toEqual({ mode: "open_artifact" });
    expect(JOB_CAPABILITY_REGISTRY.draft_content.artifactPolicy).toEqual({ mode: "open_artifact" });
    expect(JOB_CAPABILITY_REGISTRY.produce_product.artifactPolicy).toEqual({ mode: "open_artifact" });
    expect(JOB_CAPABILITY_REGISTRY.produce_blog_article.artifactPolicy).toEqual({ mode: "open_artifact" });
    expect(JOB_CAPABILITY_REGISTRY.resolve_blog_article_qa.artifactPolicy).toEqual({ mode: "open_artifact" });
    expect(JOB_CAPABILITY_REGISTRY.qa_blog_article.artifactPolicy).toEqual({ mode: "retain" });
  });

  it("preserves the current signed-in and global job audiences", () => {
    expect(CURRENT_SIGNED_IN_JOB_AUDIENCE_ROLES).toEqual([
      "AUTHENTICATED",
      "APPRENTICE",
      "STAFF",
      "ADMIN",
    ]);
    expect(CURRENT_GLOBAL_JOB_OPERATOR_ROLES).toEqual(["ADMIN"]);
    expect(getSignedInJobAudienceRoles()).toEqual(CURRENT_SIGNED_IN_JOB_AUDIENCE_ROLES);
    expect(getGlobalJobOperatorRoles()).toEqual(CURRENT_GLOBAL_JOB_OPERATOR_ROLES);
  });

  it("exposes the current global queue only to admin roles", () => {
    // All capabilities (including compose_media) have globalViewerRoles = [ADMIN]
    expect(listGlobalJobCapabilitiesForRole("ADMIN").map((capability) => capability.toolName)).toEqual(
      JOB_CAPABILITY_TOOL_NAMES,
    );
    expect(listGlobalJobCapabilitiesForRole("STAFF")).toEqual([]);
    expect(listGlobalJobCapabilitiesForRole("AUTHENTICATED")).toEqual([]);
    expect(listGlobalJobCapabilitiesForRoles(["STAFF", "ADMIN"]).map((capability) => capability.toolName)).toEqual(
      JOB_CAPABILITY_TOOL_NAMES,
    );
  });

  it("fails closed for unregistered global view and action lookups", () => {
    expect(canRoleViewGlobalJob("produce_blog_article", "ADMIN")).toBe(true);
    expect(canRoleManageGlobalJob("produce_blog_article", "ADMIN")).toBe(true);
    expect(canRoleViewGlobalJob("produce_blog_article", "STAFF")).toBe(false);
    expect(canRoleManageGlobalJob("produce_blog_article", "STAFF")).toBe(false);
    expect(canRolesViewGlobalJob("produce_blog_article", ["STAFF", "ADMIN"])).
      toBe(true);
    expect(canRolesManageGlobalJob("produce_blog_article", ["STAFF", "ADMIN"])).
      toBe(true);
    expect(canRoleViewGlobalJob("unknown_tool", "ADMIN")).toBe(false);
    expect(canRoleManageGlobalJob("unknown_tool", "ADMIN")).toBe(false);
    expect(canRolesViewGlobalJob("unknown_tool", ["ADMIN"]))
      .toBe(false);
    expect(canRolesManageGlobalJob("unknown_tool", ["ADMIN"]))
      .toBe(false);
  });

  it("returns compact presentation metadata for registered job capabilities", () => {
    expect(getJobCapabilityPresentation("publish_content")).toEqual({
      toolName: "publish_content",
      label: "Publish Content",
      family: "editorial",
      defaultSurface: "global",
    });
    expect(getJobCapabilityPresentation("unknown_tool")).toBeNull();
  });
});