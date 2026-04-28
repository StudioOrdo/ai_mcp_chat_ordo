import { describe, expect, it, vi } from "vitest";

import { AgentPlatformFacade, type AgentPlatformFacadeDeps } from "@/core/platform/facade/AgentPlatformFacade";
import type { ExecutionTimelineReader } from "@/core/platform/execution/ExecutionTimelineReader";
import type { ToolRegistry } from "@/core/tool-registry/ToolRegistry";

function createDeps(): AgentPlatformFacadeDeps {
  return {
    knowledgeAccess: {
      searchKnowledge: vi.fn(async () => ({
        query: "launch",
        retrievalQuality: "strong",
        citations: [],
        evidence: [],
        prefetchedSections: [],
        followUp: "cite_results",
      })),
    },
    executionTimelineReader: {
      readExecutionTimeline: vi.fn(async () => ({
        executionId: "job_1",
        executionKind: "job",
        supportLevel: "full",
        state: "running",
        title: "Publish Content",
        events: [],
        artifacts: [],
        checkpoints: [],
        nextActions: [],
      })),
    } as unknown as ExecutionTimelineReader,
    revisionRuntime: {
      reviseExecution: vi.fn(async () => ({
        accepted: true,
        status: "queued",
        message: "queued",
        nextExecutionId: "job_2",
      })),
    },
    executionSurfaceProvider: {
      getExecutionSurface: () => ({
        registry: {} as ToolRegistry,
        executor: vi.fn(async () => ({ ok: true })),
      }),
    },
  };
}

describe("AgentPlatformFacade", () => {
  it("discovers capabilities through the canonical runtime projection", async () => {
    const facade = new AgentPlatformFacade(createDeps());

    const result = await facade.discoverCapabilities({
      role: "ADMIN",
      query: "publish",
      maxResults: 5,
    });

    expect(result.query).toBe("publish");
    expect(result.results.length).toBeGreaterThan(0);
    expect(result.results.every((runtime) => runtime.descriptor.roles === "ALL" || runtime.descriptor.roles.includes("ADMIN"))).toBe(true);
  });

  it("delegates grounded retrieval to KnowledgeAccessService", async () => {
    const deps = createDeps();
    const facade = new AgentPlatformFacade(deps);

    const result = await facade.searchKnowledge({ query: "launch" }, { role: "AUTHENTICATED" });

    expect(deps.knowledgeAccess.searchKnowledge).toHaveBeenCalledWith({ query: "launch" }, { role: "AUTHENTICATED" });
    expect(result.retrievalQuality).toBe("strong");
  });

  it("executes capabilities through the shared execution surface", async () => {
    const deps = createDeps();
    const facade = new AgentPlatformFacade(deps);

    const result = await facade.executeCapability({
      capabilityName: "publish_content",
      input: { postId: "post_1" },
      context: { role: "ADMIN", userId: "usr_1" },
    });

    expect(result.capabilityName).toBe("publish_content");
    expect(result.result).toEqual({ ok: true });
  });

  it("delegates execution inspection and revision actions to the canonical seams", async () => {
    const deps = createDeps();
    const facade = new AgentPlatformFacade(deps);

    const timeline = await facade.inspectExecution({
      executionKind: "job",
      executionId: "job_1",
    });
    const revision = await facade.reviseExecution({
      executionKind: "job",
      executionId: "job_1",
      action: "retry",
      role: "ADMIN",
      userId: "usr_1",
    });

    expect(deps.executionTimelineReader.readExecutionTimeline).toHaveBeenCalledWith({
      executionKind: "job",
      executionId: "job_1",
    });
    expect(deps.revisionRuntime.reviseExecution).toHaveBeenCalledWith({
      executionKind: "job",
      executionId: "job_1",
      action: "retry",
      role: "ADMIN",
      userId: "usr_1",
    });
    expect(timeline?.executionId).toBe("job_1");
    expect(revision.nextExecutionId).toBe("job_2");
  });
});