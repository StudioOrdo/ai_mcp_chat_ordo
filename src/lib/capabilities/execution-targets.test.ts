import { describe, expect, it } from "vitest";

import { CAPABILITY_CATALOG } from "@/core/capability-catalog/catalog";
import { planCapabilityExecutionWithDefaults } from "@/core/capability-catalog/execution-planning-policy";

import {
  createExecutionTargetAdapterRegistry,
  dispatchExecutionPlan,
  ExecutionPlanUnavailableError,
  MissingExecutionTargetAdapterError,
  resolveExecutionTargetAdapter,
  type ExecutionTargetAdapter,
} from "./executor-dispatch";
import {
  getDefaultTargetPriority,
  planCapabilityExecution,
  projectCapabilityExecutionTargets,
} from "./execution-targets";

describe("execution-target planning", () => {
  it("keeps deferred_job as the raw planner default for admin_web_search when no pack planning context is applied", () => {
    const plan = planCapabilityExecution(CAPABILITY_CATALOG.admin_web_search);

    expect(plan.primaryTarget?.kind).toBe("deferred_job");
    expect(plan.blockReason).toBeNull();
    expect(plan.candidates.map((candidate) => [candidate.kind, candidate.readiness])).toEqual([
      ["deferred_job", "active"],
      ["host_ts", "active"],
      ["mcp_stdio", "declared"],
      ["mcp_container", "declared"],
    ]);
  });

  it("applies the pack-owned default planning context for admin_web_search", () => {
    const plan = planCapabilityExecutionWithDefaults(CAPABILITY_CATALOG.admin_web_search);

    expect(plan.primaryTarget?.kind).toBe("mcp_stdio");
    expect(plan.fallbackTargets.map((target) => target.kind)).toEqual(["host_ts"]);
    expect(plan.candidates.map((candidate) => [candidate.kind, candidate.readiness])).toEqual([
      ["mcp_stdio", "active"],
      ["host_ts", "active"],
      ["deferred_job", "declared"],
      ["mcp_container", "declared"],
    ]);
  });

  it("can prefer an MCP stdio target for admin_web_search when the runtime enables it", () => {
    const plan = planCapabilityExecution(CAPABILITY_CATALOG.admin_web_search, {
      enabledTargetKinds: ["host_ts", "mcp_stdio"],
      preferredTargetKinds: ["mcp_stdio", "host_ts"],
    });

    expect(plan.primaryTarget?.kind).toBe("mcp_stdio");
    expect(plan.fallbackTargets.map((target) => target.kind)).toEqual(["host_ts"]);
  });

  it("can declare a container-backed MCP sidecar target when planning overrides provide one", () => {
    const plan = planCapabilityExecution(CAPABILITY_CATALOG.admin_web_search, {
      enabledTargetKinds: ["host_ts", "mcp_container"],
      preferredTargetKinds: ["mcp_container", "host_ts"],
      mcpContainerTargets: {
        admin_web_search: {
          serviceName: "admin-web-search-mcp",
        },
      },
    });

    expect(plan.primaryTarget?.kind).toBe("mcp_container");
    expect(plan.candidates.map((candidate) => [candidate.kind, candidate.readiness])).toEqual([
      ["mcp_container", "active"],
      ["host_ts", "active"],
      ["deferred_job", "declared"],
      ["mcp_stdio", "declared"],
    ]);
  });

  it("defaults remote_service targets to no execution-context bridging unless explicitly enabled", () => {
    const plan = planCapabilityExecution(CAPABILITY_CATALOG.admin_web_search, {
      enabledTargetKinds: ["host_ts", "remote_service"],
      preferredTargetKinds: ["remote_service", "host_ts"],
      remoteServiceTargets: {
        admin_web_search: {
          serviceId: "remote-admin-web-search",
          endpoint: "https://example.test/admin-web-search",
        },
      },
    });

    expect(plan.primaryTarget).toMatchObject({
      kind: "remote_service",
      bridgeExecutionContext: false,
    });
  });

  it("prefers browser_wasm for compose_media and keeps deferred_job as fallback", () => {
    const plan = planCapabilityExecution(CAPABILITY_CATALOG.compose_media, {
      browserRuntimeAvailable: true,
    });

    expect(getDefaultTargetPriority(CAPABILITY_CATALOG.compose_media)).toEqual([
      "browser_wasm",
      "deferred_job",
      "host_ts",
      "mcp_stdio",
      "mcp_container",
      "native_process",
      "remote_service",
    ]);
    expect(plan.primaryTarget?.kind).toBe("browser_wasm");
    expect(plan.fallbackTargets.map((target) => target.kind)).toEqual(["deferred_job"]);
  });

  it("applies the pack-owned default planning context for compose_media", () => {
    const plan = planCapabilityExecutionWithDefaults(CAPABILITY_CATALOG.compose_media);

    expect(plan.primaryTarget?.kind).toBe("browser_wasm");
    expect(plan.fallbackTargets.map((target) => target.kind)).toEqual(["native_process", "deferred_job"]);
    expect(plan.candidates.map((candidate) => [candidate.kind, candidate.readiness])).toEqual([
      ["browser_wasm", "active"],
      ["native_process", "active"],
      ["deferred_job", "active"],
    ]);
  });

  it("falls back to deferred_job for compose_media when browser execution is unavailable", () => {
    const plan = planCapabilityExecution(CAPABILITY_CATALOG.compose_media, {
      browserRuntimeAvailable: false,
    });

    expect(plan.primaryTarget?.kind).toBe("deferred_job");
    expect(plan.candidates.map((candidate) => [candidate.kind, candidate.readiness])).toEqual([
      ["browser_wasm", "declared"],
      ["deferred_job", "active"],
      ["native_process", "declared"],
    ]);
  });

  it("blocks browser-only capabilities when browser runtime is unavailable", () => {
    const plan = planCapabilityExecution(CAPABILITY_CATALOG.generate_chart, {
      browserRuntimeAvailable: false,
    });

    expect(plan.primaryTarget).toBeNull();
    expect(plan.blockReason).toBe("no_active_targets");
    expect(projectCapabilityExecutionTargets(CAPABILITY_CATALOG.generate_chart, {
      browserRuntimeAvailable: false,
    }).map((candidate) => [candidate.kind, candidate.readiness])).toEqual([
      ["browser_wasm", "declared"],
    ]);
  });

  it("applies the pack-owned default planning context for generate_audio", () => {
    const plan = planCapabilityExecutionWithDefaults(CAPABILITY_CATALOG.generate_audio);

    expect(plan.primaryTarget?.kind).toBe("browser_wasm");
    expect(plan.fallbackTargets.map((target) => target.kind)).toEqual(["host_ts"]);
    expect(plan.candidates.map((candidate) => [candidate.kind, candidate.readiness])).toEqual([
      ["browser_wasm", "active"],
      ["host_ts", "active"],
    ]);
  });

  it("selects deferred_job for deferred editorial capabilities", () => {
    const plan = planCapabilityExecution(CAPABILITY_CATALOG.draft_content);

    expect(plan.primaryTarget?.kind).toBe("deferred_job");
    expect(plan.candidates.map((candidate) => candidate.kind)).toEqual(["deferred_job", "host_ts"]);
  });
});

describe("execution-target dispatch", () => {
  it("builds an adapter registry and dispatches through the resolved primary target", async () => {
    let observedTargetKind: string | null = null;
    let callCount = 0;
    const registry = createExecutionTargetAdapterRegistry([
      {
        kind: "deferred_job",
        invoke: async (request) => {
          callCount += 1;
          observedTargetKind = request.target.kind;
          return { ok: true };
        },
      } satisfies ExecutionTargetAdapter<"deferred_job">,
    ]);
    const plan = planCapabilityExecution(CAPABILITY_CATALOG.admin_web_search);

    const result = await dispatchExecutionPlan<{ query: string }, { ok: boolean }>({
      capability: CAPABILITY_CATALOG.admin_web_search,
      input: { query: "latest referral guidance" },
      plan,
      registry,
    });

    expect(result).toEqual({ ok: true });
    expect(callCount).toBe(1);
    expect(observedTargetKind).toBe("deferred_job");
  });

  it("throws when dispatching a plan without any active target", async () => {
    const plan = planCapabilityExecution(CAPABILITY_CATALOG.generate_chart, {
      browserRuntimeAvailable: false,
    });

    await expect(
      dispatchExecutionPlan({
        capability: CAPABILITY_CATALOG.generate_chart,
        input: { spec: {} },
        plan,
        registry: {},
      }),
    ).rejects.toBeInstanceOf(ExecutionPlanUnavailableError);
  });

  it("throws when a target adapter is missing", () => {
    const plan = planCapabilityExecution(CAPABILITY_CATALOG.admin_web_search);
    const primaryTarget = plan.primaryTarget;

    expect(primaryTarget).not.toBeNull();

    expect(() => resolveExecutionTargetAdapter(primaryTarget as NonNullable<typeof primaryTarget>, {})).toThrow(
      MissingExecutionTargetAdapterError,
    );
  });

  it("rejects duplicate adapter registrations for the same target kind", () => {
    expect(() => createExecutionTargetAdapterRegistry([
      {
        kind: "host_ts",
        invoke: async () => undefined,
      } satisfies ExecutionTargetAdapter<"host_ts">,
      {
        kind: "host_ts",
        invoke: async () => undefined,
      } satisfies ExecutionTargetAdapter<"host_ts">,
    ])).toThrow('Duplicate execution-target adapter registration for "host_ts".');
  });
});