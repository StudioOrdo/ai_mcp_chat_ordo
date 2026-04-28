import { describe, expect, it } from "vitest";

import { CAPABILITY_CATALOG } from "./catalog";
import {
  EXTENSION_PACK_RUNTIME_OWNERSHIP,
  EXTENSION_PACK_TOOL_NAMES,
  NEXT_PRODUCTION_WORKLOAD_AFTER_COMPOSE_MEDIA,
  NEXT_CONCRETE_EXTENSION_PACK_RUNTIME,
  STANDARD_HOST_CORE_TOOL_NAMES,
  getDefaultExecutionPlanningForCapability,
  getCapabilityOwnership,
  getExtensionPackRuntimeOwnership,
  isHostCoreCapability,
} from "./capability-ownership";
import { projectAllCapabilityRuntimeStatics } from "@/core/platform/capability-runtime/CapabilityRuntime";

describe("capability-ownership", () => {
  it("assigns every runtime capability to core or a named pack", () => {
    for (const toolName of projectAllCapabilityRuntimeStatics().map((runtime) => runtime.capabilityName)) {
      expect(getCapabilityOwnership(toolName), `Missing ownership for ${toolName}`).toBeDefined();
    }
  });

  it("runtime capability names still align with catalog keys", () => {
    expect(
      projectAllCapabilityRuntimeStatics()
        .map((runtime) => runtime.capabilityName)
        .sort(),
    ).toEqual(Object.keys(CAPABILITY_CATALOG).sort());
  });

  it("marks the standard host core explicitly", () => {
    expect(STANDARD_HOST_CORE_TOOL_NAMES).toContain("search_corpus");
    expect(STANDARD_HOST_CORE_TOOL_NAMES).toContain("get_my_profile");
    expect(isHostCoreCapability("compose_media")).toBe(false);
    expect(isHostCoreCapability("generate_audio")).toBe(false);
    expect(isHostCoreCapability("navigate_to_page")).toBe(true);
    expect(isHostCoreCapability("admin_search")).toBe(false);
  });

  it("exposes the first extension packs explicitly", () => {
    expect(EXTENSION_PACK_TOOL_NAMES.media).toContain("compose_media");
    expect(EXTENSION_PACK_TOOL_NAMES.media).toContain("generate_audio");
    expect(EXTENSION_PACK_TOOL_NAMES.media).toContain("generate_chart");
    expect(EXTENSION_PACK_TOOL_NAMES.media).toContain("generate_graph");
    expect(EXTENSION_PACK_TOOL_NAMES.media).toContain("list_conversation_media_assets");
    expect(EXTENSION_PACK_TOOL_NAMES.publishing).toContain("draft_content");
    expect(getCapabilityOwnership("admin_web_search")).toEqual({
      kind: "pack",
      packId: "admin_intelligence",
    });
    expect(getCapabilityOwnership("admin_search")).toEqual({
      kind: "pack",
      packId: "admin_intelligence",
    });
  });

  it("declares explicit runtime ownership for each extension pack", () => {
    expect(getExtensionPackRuntimeOwnership("admin_intelligence")).toEqual({
      packId: "admin_intelligence",
      defaultTargetKinds: ["host_ts", "mcp_stdio"],
      preferredTargetKinds: ["mcp_stdio", "host_ts"],
      deliveryModel: "mcp_sidecar",
      status: "current",
    });
    expect(EXTENSION_PACK_RUNTIME_OWNERSHIP.media).toEqual({
      packId: "media",
      defaultTargetKinds: ["browser_wasm", "native_process", "deferred_job", "host_ts"],
      preferredTargetKinds: ["browser_wasm", "native_process", "deferred_job", "host_ts"],
      deliveryModel: "browser_plus_worker",
      status: "next",
    });
    expect(NEXT_CONCRETE_EXTENSION_PACK_RUNTIME).toEqual(
      EXTENSION_PACK_RUNTIME_OWNERSHIP.media,
    );
    expect(NEXT_PRODUCTION_WORKLOAD_AFTER_COMPOSE_MEDIA).toEqual({
      capabilityName: "generate_audio",
      packId: "media",
      targetKind: "remote_service",
      rationale: expect.stringContaining("Audio generation already crosses provider-network boundaries"),
    });
  });

  it("declares the next extracted pack-owned workload as sidecar-first", () => {
    expect(getDefaultExecutionPlanningForCapability("admin_web_search")).toEqual({
      enabledTargetKinds: ["host_ts", "mcp_stdio"],
      preferredTargetKinds: ["mcp_stdio", "host_ts"],
    });
    expect(getDefaultExecutionPlanningForCapability("admin_prioritize_leads")).toEqual({
      enabledTargetKinds: ["host_ts", "mcp_stdio"],
      preferredTargetKinds: ["mcp_stdio", "host_ts"],
    });
    expect(getDefaultExecutionPlanningForCapability("admin_search")).toEqual({
      enabledTargetKinds: ["host_ts", "mcp_stdio"],
      preferredTargetKinds: ["mcp_stdio", "host_ts"],
    });
    expect(getDefaultExecutionPlanningForCapability("compose_media")).toEqual({
      enabledTargetKinds: ["browser_wasm", "native_process", "deferred_job", "host_ts"],
      preferredTargetKinds: ["browser_wasm", "native_process", "deferred_job", "host_ts"],
    });
    expect(getDefaultExecutionPlanningForCapability("generate_audio")).toEqual({
      enabledTargetKinds: ["browser_wasm", "native_process", "deferred_job", "host_ts"],
      preferredTargetKinds: ["browser_wasm", "native_process", "deferred_job", "host_ts"],
    });
    expect(getDefaultExecutionPlanningForCapability("search_corpus")).toBeNull();
  });
});