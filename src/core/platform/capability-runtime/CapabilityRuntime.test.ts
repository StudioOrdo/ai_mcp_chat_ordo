import { describe, expect, it } from "vitest";

import {
  CAPABILITY_CATALOG,
  projectBrowserCapability,
  projectJobCapability,
  projectMcpExportIntent,
  projectPresentationDescriptor,
} from "@/core/capability-catalog/catalog";
import { planCapabilityExecutionWithDefaults } from "@/core/capability-catalog/execution-planning-policy";
import { projectCatalogBoundToolDescriptor } from "@/core/capability-catalog/runtime-tool-binding";
import { projectAnthropicSchema } from "@/core/capability-catalog/schema-projection";
import { explainCapabilityExecutionPlan } from "./CapabilityExecutionExplanation";

import {
  CAPABILITY_RUNTIME_NAMES,
  projectAllCapabilityRuntimeStatics,
  projectAllCapabilityRuntimes,
  projectCapabilityRuntime,
  projectCapabilityRuntimeByName,
  projectCapabilityRuntimeDefinition,
  projectCapabilityRuntimeWithPlanningDefinition,
} from "./CapabilityRuntime";

describe("CapabilityRuntime", () => {
  it("projects every catalog capability into a read-only runtime view", () => {
    const runtimes = projectAllCapabilityRuntimes();

    expect(runtimes).toHaveLength(CAPABILITY_RUNTIME_NAMES.length);
    expect(runtimes.map((runtime) => runtime.capabilityName)).toEqual(CAPABILITY_RUNTIME_NAMES);

    for (const runtime of runtimes) {
      expect(runtime.descriptor.name).toBe(runtime.capabilityName);
      expect(runtime.presentation.toolName).toBe(runtime.capabilityName);
      expect(runtime.executionPlan.capabilityName).toBe(runtime.capabilityName);
    }
  });

  it("mirrors compose_media across descriptor, projections, and planning", () => {
    const def = CAPABILITY_CATALOG.compose_media;
    const runtime = projectCapabilityRuntimeWithPlanningDefinition(def);

    expect(runtime.descriptor).toEqual({
      name: def.core.name,
      label: def.core.label,
      description: def.core.description,
      category: def.core.category,
      roles: def.core.roles,
      schema: projectAnthropicSchema(def),
      executionMode: def.runtime.executionMode,
      deferred: def.runtime.deferred,
    });
    expect(runtime.presentation).toEqual(projectPresentationDescriptor(def));
    expect(runtime.job).toEqual(projectJobCapability(def));
    expect(runtime.browser).toEqual(projectBrowserCapability(def));
    expect(runtime.mcpExport).toEqual(projectMcpExportIntent(def));
    expect(runtime.executionPlan).toEqual(planCapabilityExecutionWithDefaults(def));
    expect(runtime.executionExplanation).toEqual(
      explainCapabilityExecutionPlan(planCapabilityExecutionWithDefaults(def)),
    );
    expect(runtime.binding).toEqual({
      bundleId: def.executorBinding!.bundleId,
      executorId: def.executorBinding!.executorId,
      executionSurface: def.executorBinding!.executionSurface,
      validatorId: def.validationBinding!.validatorId,
      validationMode: def.validationBinding!.mode ?? "parse",
    });
    expect(runtime.promptHintsByRole?.ADMIN?.[0]).toContain("MEDIA COMPOSITION");
  });

  it("projects admin_web_search with deferred job and MCP export intent", () => {
    const def = CAPABILITY_CATALOG.admin_web_search;
    const runtime = projectCapabilityRuntime("admin_web_search");

    expect(runtime.presentation).toEqual(projectPresentationDescriptor(def));
    expect(runtime.job).toEqual(projectJobCapability(def));
    expect(runtime.browser).toBeNull();
    expect(runtime.mcpExport).toEqual(projectMcpExportIntent(def));
    expect(runtime.binding).toEqual({
      bundleId: def.executorBinding!.bundleId,
      executorId: def.executorBinding!.executorId,
      executionSurface: def.executorBinding!.executionSurface,
      validatorId: def.validationBinding!.validatorId,
      validationMode: def.validationBinding!.mode ?? "parse",
    });
  });

  it("matches existing catalog-bound descriptor metadata for calculator", () => {
    const def = CAPABILITY_CATALOG.calculator;
    const runtime = projectCapabilityRuntime("calculator");
    const descriptor = projectCatalogBoundToolDescriptor("calculator");

    expect(runtime.descriptor.name).toBe(descriptor.name);
    expect(runtime.descriptor.roles).toEqual(descriptor.roles);
    expect(runtime.descriptor.category).toBe(descriptor.category);
    expect(runtime.descriptor.schema).toEqual(descriptor.schema);
    expect(runtime.descriptor.executionMode).toBe(descriptor.executionMode);
    expect(runtime.descriptor.deferred).toEqual(descriptor.deferred);
    expect(runtime.binding).toEqual({
      bundleId: def.executorBinding!.bundleId,
      executorId: def.executorBinding!.executorId,
      executionSurface: def.executorBinding!.executionSurface,
      validatorId: def.validationBinding!.validatorId,
      validationMode: def.validationBinding!.mode ?? "parse",
    });
  });

  it("returns null for unknown capability names in string-based runtime lookups", () => {
    expect(projectCapabilityRuntimeByName("not_a_real_tool")).toBeNull();
  });

  it("projects static runtime facets without attaching an execution plan", () => {
    const runtime = projectCapabilityRuntimeDefinition(CAPABILITY_CATALOG.compose_media);

    expect(runtime).not.toHaveProperty("executionPlan");
    expect(runtime).not.toHaveProperty("executionExplanation");
    expect(runtime.schema).toEqual(CAPABILITY_CATALOG.compose_media.schema);
    expect(runtime.promptHintsByRole?.ADMIN?.[0]).toContain("MEDIA COMPOSITION");
  });

  it("keeps static runtime names aligned with the full runtime projection", () => {
    expect(projectAllCapabilityRuntimeStatics().map((runtime) => runtime.capabilityName)).toEqual(
      CAPABILITY_RUNTIME_NAMES,
    );
  });

  it("explains blocked execution plans from the runtime surface", () => {
    const runtime = projectCapabilityRuntime("compose_media", {
      browserRuntimeAvailable: false,
      allowDeferredJob: false,
      enabledTargetKinds: [],
    });

    expect(runtime.executionPlan.primaryTarget).toBeNull();
    expect(runtime.executionPlan.blockReason).toBe("no_active_targets");
    expect(runtime.executionExplanation).toMatchObject({
      capabilityName: "compose_media",
      status: "blocked",
      blockReason: "no_active_targets",
      primaryTargetKind: null,
      fallbackTargetKinds: [],
    });
    expect(runtime.executionExplanation.summary).toContain("none are currently active");
  });
});