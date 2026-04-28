import { beforeEach, describe, expect, it, vi } from "vitest";
import Database from "better-sqlite3";

import { FactoryDataMapper } from "@/adapters/FactoryDataMapper";
import type { Composition } from "@/core/entities/composition";
import type { Draft } from "@/core/entities/draft";
import type { FactoryAsset } from "@/core/entities/factory-asset";
import type { ProductBrief } from "@/core/entities/product-brief";
import type { QAReport } from "@/core/entities/qa-report";
import type { Release } from "@/core/entities/release";
import type { ResearchPacket } from "@/core/entities/research-packet";
import type { StageResultEntityKind } from "@/core/entities/stage-run-record";
import type { UserFile } from "@/core/entities/user-file";
import type { WorkOrder } from "@/core/entities/work-order";
import { createExecutionTimelineReader } from "@/core/platform/execution/ExecutionTimelineReader";
import { PlatformInteractionFacade } from "@/core/platform/facade/PlatformInteractionFacade";
import { ensureSchema } from "@/lib/db/schema";
import { DAGPlanner } from "@/lib/factory/dag-planner";
import { createFactoryRevisionRoot } from "@/lib/factory/factory-revision-root";

const {
  getSessionUserMock,
  getFactoryRepositoryMock,
  getUserFileDataMapperMock,
  getWorkOrderInteractionMock,
  reviseExecutionMock,
} = vi.hoisted(() => ({
  getSessionUserMock: vi.fn(),
  getFactoryRepositoryMock: vi.fn(),
  getUserFileDataMapperMock: vi.fn(),
  getWorkOrderInteractionMock: vi.fn(),
  reviseExecutionMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getSessionUser: getSessionUserMock,
}));

vi.mock("@/adapters/RepositoryFactory", async () => {
  const actual = await vi.importActual<typeof import("@/adapters/RepositoryFactory")>("@/adapters/RepositoryFactory");
  return {
    ...actual,
    getFactoryRepository: getFactoryRepositoryMock,
    getUserFileDataMapper: getUserFileDataMapperMock,
    getPlatformInteractionFacade: () => ({
      getWorkOrderInteraction: getWorkOrderInteractionMock,
    }),
  };
});

vi.mock("@/lib/platform/agent-platform-facade-root", () => ({
  getAgentPlatformFacade: () => ({
    reviseExecution: reviseExecutionMock,
  }),
}));

import { GET, POST } from "@/app/api/admin/factory/work-orders/[workOrderId]/revision/route";

function requireValue<T>(value: T | null | undefined): T {
  expect(value).toBeTruthy();
  if (value == null) {
    throw new Error("Expected value to be present.");
  }
  return value;
}

function createDb() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  ensureSchema(db);
  return db;
}

function createJobRepositoryStub() {
  return {
    createJob: vi.fn(),
    findJobById: vi.fn(),
    findLatestEventForJob: vi.fn(),
    findLatestRenderableEventForJob: vi.fn(),
    findActiveJobByDedupeKey: vi.fn(),
    listJobsByConversation: vi.fn(),
    listJobsByUser: vi.fn(),
    appendEvent: vi.fn(),
    requeueExpiredRunningJobs: vi.fn(),
    listConversationEvents: vi.fn(),
    listUserEvents: vi.fn(),
    listEventsForUserJob: vi.fn(),
    claimNextQueuedJob: vi.fn(),
    transferJobsToUser: vi.fn(),
    updateJobStatus: vi.fn(),
    cancelJob: vi.fn(),
  };
}

function seedUser(db: Database.Database, userId = "usr_factory") {
  db.prepare(
    "INSERT OR IGNORE INTO users (id, email, name) VALUES (?, ?, ?)",
  ).run(userId, `${userId}@example.com`, "Factory User");
  db.prepare(
    "INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, 'role_admin')",
  ).run(userId);
}

function seedConversation(db: Database.Database, conversationId = "conv_factory", userId = "usr_factory") {
  db.prepare(
    "INSERT OR IGNORE INTO conversations (id, user_id, title) VALUES (?, ?, 'Factory thread')",
  ).run(conversationId, userId);
}

function createBrief(overrides: Partial<ProductBrief> = {}): ProductBrief {
  return {
    id: "brief_1",
    schemaVersion: 1,
    title: "Factory launch page",
    topic: "Launching a solopreneur product",
    description: "A launch campaign for a digital product.",
    assetKinds: ["chart", "audio"],
    qaCriteria: ["accuracy", "accessibility"],
    targetChannels: ["blog"],
    executionPreferences: {
      autoRetryOnFailure: true,
      parallelizeAssets: true,
      maxAssetCount: 3,
    },
    createdAt: "2024-04-27T12:00:00.000Z",
    createdBy: "usr_factory",
    ...overrides,
  };
}

function createWorkOrder(brief: ProductBrief, overrides: Partial<WorkOrder> = {}): WorkOrder {
  const dag = new DAGPlanner().generateDAG({
    brief,
    idGenerator: () => "dag_1",
    now: () => "2024-04-27T12:00:00.000Z",
  });

  return {
    id: "wo_1",
    schemaVersion: 1,
    briefId: brief.id,
    status: "planned",
    currentDag: dag,
    stageRuns: [],
    executionLog: [],
    revision: 1,
    previousWorkOrderIds: [],
    createdAt: "2024-04-27T12:00:00.000Z",
    userId: "usr_factory",
    conversationId: "conv_factory",
    initiatedBy: "batch_automation",
    ...overrides,
  };
}

function createResearchPacket(overrides: Partial<ResearchPacket> = {}): ResearchPacket {
  return {
    id: "rp_1",
    schemaVersion: 1,
    workOrderId: "wo_1",
    queryUsed: "solopreneur launch metrics",
    searchTimestamp: "2024-04-27T12:00:00.000Z",
    summary: "Sufficient evidence was found across multiple sources.",
    confidenceScore: 0.9,
    sources: [
      {
        id: "src_1",
        title: "Launch Benchmarks",
        url: "https://example.com/benchmarks",
        retrievedAt: "2024-04-27T12:00:00.000Z",
        relevanceScore: 0.8,
      },
    ],
    claims: [
      {
        id: "claim_1",
        text: "Email remains the highest-converting owned channel.",
        supportingSourceIds: ["src_1"],
        confidence: 0.7,
      },
    ],
    searchEngine: "hybrid",
    ...overrides,
  };
}

function createDraft(overrides: Partial<Draft> = {}): Draft {
  return {
    id: "draft_1",
    schemaVersion: 1,
    workOrderId: "wo_1",
    title: "Factory launch page",
    sections: [
      { id: "section_1", kind: "heading", order: 0, text: "Launch", level: 1 },
      { id: "section_2", kind: "paragraph", order: 1, text: "Start with owned channels." },
    ],
    createdAt: "2024-04-27T12:01:00.000Z",
    revision: 1,
    sourceResearchPacketId: "rp_1",
    ...overrides,
  };
}

function createChartAsset(overrides: Partial<FactoryAsset> = {}): FactoryAsset {
  return {
    id: "asset_chart_1",
    schemaVersion: 1,
    workOrderId: "wo_1",
    kind: "chart",
    label: "Primary chart",
    uri: "/api/user-files/asset_chart_1",
    mimeType: "image/png",
    fileSizeBytes: 2048,
    generationParams: { chartType: "line" },
    generatedAt: "2024-04-27T12:02:00.000Z",
    generationDurationMs: 3000,
    provenance: { stageKey: "asset_chart_primary" },
    qaStatus: "passed",
    qaFindings: [],
    revision: 1,
    ...overrides,
  };
}

function createAudioAsset(overrides: Partial<FactoryAsset> = {}): FactoryAsset {
  return {
    id: "asset_audio_1",
    schemaVersion: 1,
    workOrderId: "wo_1",
    kind: "audio",
    label: "Primary audio",
    uri: "/api/user-files/asset_audio_1",
    mimeType: "audio/mpeg",
    fileSizeBytes: 4096,
    generationParams: { voice: "neutral" },
    generatedAt: "2024-04-27T12:02:30.000Z",
    generationDurationMs: 2200,
    provenance: { stageKey: "asset_audio_primary" },
    qaStatus: "passed",
    qaFindings: [],
    revision: 1,
    ...overrides,
  };
}

function createComposition(overrides: Partial<Composition> = {}): Composition {
  return {
    id: "composition_1",
    schemaVersion: 1,
    workOrderId: "wo_1",
    title: "Factory page",
    sections: [
      { id: "c1", kind: "heading", order: 0, text: "Launch", level: 1 },
      { id: "c2", kind: "chart", order: 1, assetId: "asset_chart_1", caption: "Primary chart" },
      { id: "c3", kind: "audio", order: 2, assetId: "asset_audio_1", caption: "Primary audio" },
    ],
    embeddedAssetIds: ["asset_chart_1", "asset_audio_1"],
    provenance: { draftId: "draft_1", assetIds: ["asset_chart_1", "asset_audio_1"] },
    metadata: { targetChannel: "blog" },
    htmlContent: "<main>launch</main>",
    createdAt: "2024-04-27T12:03:00.000Z",
    revision: 1,
    ...overrides,
  };
}

function createQAReport(id: string, overrides: Partial<QAReport> = {}): QAReport {
  return {
    id,
    schemaVersion: 1,
    workOrderId: "wo_1",
    status: "passed",
    totalFindings: 0,
    passedCriteria: ["accuracy", "accessibility"],
    failedCriteria: [],
    assetReports: [],
    pageFindings: [],
    recommendedFixes: [],
    autoResolvableCount: 0,
    requiresUserDecision: false,
    createdAt: "2024-04-27T12:04:00.000Z",
    ...overrides,
  };
}

async function persistSucceededStage<TEntity extends ResearchPacket | Draft | FactoryAsset | Composition | QAReport | Release>(
  mapper: FactoryDataMapper,
  options: {
    workOrderId: string;
    stageRunId: string;
    stageKey: string;
    entityKind: StageResultEntityKind;
    entity: TEntity;
  },
) {
  await mapper.upsertStageRun(options.workOrderId, {
    id: options.stageRunId,
    stageKey: options.stageKey,
    status: "pending",
    attemptCount: 0,
  });

  const output = await mapper.appendOutput({
    entityKind: options.entityKind,
    entity: options.entity as never,
    workOrderId: options.workOrderId,
    stageRunId: options.stageRunId,
  });

  await mapper.upsertStageRun(options.workOrderId, {
    id: options.stageRunId,
    stageKey: options.stageKey,
    status: "succeeded",
    startedAt: "2024-04-27T12:00:00.000Z",
    completedAt: "2024-04-27T12:00:30.000Z",
    attemptCount: 1,
    resultRef: {
      entityKind: options.entityKind,
      entityId: output.entityId,
    },
  });

  return output;
}

async function seedPausedReleaseFailure(mapper: FactoryDataMapper, brief: ProductBrief): Promise<void> {
  const workOrder = createWorkOrder(brief);
  await mapper.createWorkOrder(workOrder);
  await mapper.saveProductionDAG(workOrder.id, workOrder.currentDag);

  const research = await persistSucceededStage(mapper, {
    workOrderId: workOrder.id,
    stageRunId: "sr_research",
    stageKey: "research",
    entityKind: "research_packet",
    entity: createResearchPacket(),
  });
  const draft = await persistSucceededStage(mapper, {
    workOrderId: workOrder.id,
    stageRunId: "sr_draft",
    stageKey: "draft",
    entityKind: "draft",
    entity: createDraft({ sourceResearchPacketId: research.entityId }),
  });
  const chartAsset = await persistSucceededStage(mapper, {
    workOrderId: workOrder.id,
    stageRunId: "sr_asset_chart",
    stageKey: "asset_chart_primary",
    entityKind: "asset",
    entity: createChartAsset(),
  });
  const audioAsset = await persistSucceededStage(mapper, {
    workOrderId: workOrder.id,
    stageRunId: "sr_asset_audio",
    stageKey: "asset_audio_primary",
    entityKind: "asset",
    entity: createAudioAsset(),
  });
  await persistSucceededStage(mapper, {
    workOrderId: workOrder.id,
    stageRunId: "sr_composition",
    stageKey: "composition",
    entityKind: "composition",
    entity: createComposition({
      provenance: { draftId: draft.entityId, assetIds: [chartAsset.entityId, audioAsset.entityId] },
      embeddedAssetIds: [chartAsset.entityId, audioAsset.entityId],
      sections: [
        { id: "c1", kind: "heading", order: 0, text: "Launch", level: 1 },
        { id: "c2", kind: "chart", order: 1, assetId: chartAsset.entityId, caption: "Primary chart" },
        { id: "c3", kind: "audio", order: 2, assetId: audioAsset.entityId, caption: "Primary audio" },
      ],
    }),
  });
  await persistSucceededStage(mapper, {
    workOrderId: workOrder.id,
    stageRunId: "sr_qa_asset",
    stageKey: "qa_asset",
    entityKind: "qa_report",
    entity: createQAReport("qa_asset_1", {
      assetReports: [
        { assetId: chartAsset.entityId, assetKind: "chart", findings: [], status: "passed" },
        { assetId: audioAsset.entityId, assetKind: "audio", findings: [], status: "passed" },
      ],
    }),
  });
  await persistSucceededStage(mapper, {
    workOrderId: workOrder.id,
    stageRunId: "sr_qa_page",
    stageKey: "qa_page",
    entityKind: "qa_report",
    entity: createQAReport("qa_page_1"),
  });
  await persistSucceededStage(mapper, {
    workOrderId: workOrder.id,
    stageRunId: "sr_qa_resolution",
    stageKey: "qa_resolution",
    entityKind: "qa_report",
    entity: createQAReport("qa_resolution_1"),
  });

  await mapper.upsertStageRun(workOrder.id, {
    id: "sr_release",
    stageKey: "release",
    status: "failed",
    startedAt: "2024-04-27T12:06:00.000Z",
    completedAt: "2024-04-27T12:06:05.000Z",
    attemptCount: 1,
    errorCode: "stage_failed",
    errorMessage: "Publishing destination returned a terminal error.",
  });

  const stageRuns = await mapper.listStageRunsForWorkOrder(workOrder.id);
  await mapper.updateWorkOrder({
    ...workOrder,
    revision: 2,
    status: "paused",
    stageRuns,
    startedAt: "2024-04-27T12:00:00.000Z",
    pausedState: {
      pausedAt: "2024-04-27T12:06:05.000Z",
      reason: "Publishing destination returned a terminal error.",
      resumeFromStageKey: "release",
    },
  });

  await mapper.createCheckpoint({
    checkpointId: "checkpoint_release_failure",
    workOrderId: workOrder.id,
    stageRunId: "sr_release",
    pauseState: {
      pausedAt: "2024-04-27T12:06:05.000Z",
      reason: "Publishing destination returned a terminal error.",
      resumeFromStageKey: "release",
    },
    resumeFromStageKey: "release",
    createdAt: "2024-04-27T12:06:05.000Z",
  });
}

describe("/api/admin/factory/work-orders/[workOrderId]/revision", () => {
  let db: Database.Database;
  let mapper: FactoryDataMapper;

  beforeEach(() => {
    vi.clearAllMocks();
    db = createDb();
    seedUser(db);
    seedConversation(db);
    mapper = new FactoryDataMapper(db);

    getFactoryRepositoryMock.mockImplementation(() => mapper);
    const executionTimelineReader = createExecutionTimelineReader(
      createJobRepositoryStub() as never,
      mapper,
    );
    const interactionFacade = new PlatformInteractionFacade({ executionTimelineReader });
    getWorkOrderInteractionMock.mockImplementation((workOrderId: string) => interactionFacade.getWorkOrderInteraction(workOrderId));
    reviseExecutionMock.mockImplementation(async (request) => {
      const root = createFactoryRevisionRoot();

      if (request.action === "pause") {
        return {
          payload: {
            result: await root.revisionControl.pauseWorkOrder({
              workOrderId: request.executionId,
              requestedBy: request.userId,
              reason: typeof request.payload?.reason === "string" ? request.payload.reason : undefined,
            }),
          },
        };
      }

      if (request.action === "refine") {
        return {
          payload: {
            result: await root.revisionControl.refineAsset({
              workOrderId: request.executionId,
              assetId: String(request.payload?.assetId),
              mode: request.payload?.mode as "regenerate" | "replace_with_upload" | "metadata_fix",
              requestedBy: request.userId,
              ...(request.payload?.brief ? { brief: request.payload.brief as ProductBrief } : {}),
              ...(request.payload?.parameterOverrides ? { parameterOverrides: request.payload.parameterOverrides as Record<string, unknown> } : {}),
              ...(typeof request.payload?.requestedStageKey === "string"
                ? { requestedStageKey: request.payload.requestedStageKey }
                : {}),
              ...(typeof request.payload?.userFileId === "string"
                ? { userFileId: request.payload.userFileId }
                : {}),
            }),
          },
        };
      }

      return {
        payload: {
          result: await root.revisionControl.resumeWorkOrder({
            workOrderId: request.executionId,
            brief: request.payload?.brief as ProductBrief,
            ...(typeof request.payload?.requestedStageKey === "string"
              ? { requestedStageKey: request.payload.requestedStageKey }
              : {}),
          }),
        },
      };
    });
    getUserFileDataMapperMock.mockImplementation(() => ({
      findById: async (id: string) => id === "uf_chart_replacement"
        ? {
            id,
            userId: "usr_factory",
            conversationId: "conv_factory",
            status: "ready",
            contentHash: "hash_chart",
            fileType: "chart",
            fileName: "replacement-chart.svg",
            mimeType: "image/svg+xml",
            fileSize: 8192,
            metadata: { assetKind: "chart", source: "uploaded" },
            createdAt: "2024-04-27T12:10:00.000Z",
          } satisfies UserFile
        : null,
    }));
    getSessionUserMock.mockResolvedValue({
      id: "usr_factory",
      email: "factory@example.com",
      name: "Factory Admin",
      roles: ["ADMIN"],
    });
  });

  it("rejects non-admin callers", async () => {
    getSessionUserMock.mockResolvedValue({
      id: "usr_member",
      email: "member@example.com",
      name: "Member",
      roles: ["AUTHENTICATED"],
    });

    const response = await GET(new Request("https://studioordo.test/api/admin/factory/work-orders/wo_1/revision"), {
      params: Promise.resolve({ workOrderId: "wo_1" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload).toMatchObject({ error: expect.stringContaining("restricted to administrators") });
  });

  it("returns revision history for a paused work order", async () => {
    const brief = createBrief();
    await seedPausedReleaseFailure(mapper, brief);

    const response = await GET(new Request("https://studioordo.test/api/admin/factory/work-orders/wo_1/revision"), {
      params: Promise.resolve({ workOrderId: "wo_1" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.workOrder).toMatchObject({ id: "wo_1", status: "paused" });
    expect(payload.activeCheckpoint).toMatchObject({ checkpointId: "checkpoint_release_failure" });
    expect(payload.stageRuns).toEqual(expect.arrayContaining([
      expect.objectContaining({ stageKey: "release", status: "failed" }),
    ]));
    expect(payload.revision).toMatchObject({
      executionId: "wo_1",
      supportLevel: "advanced",
      state: "paused",
    });
    expect(payload.outputs).toEqual(expect.arrayContaining([
      expect.objectContaining({ entityKind: "asset", entityId: "asset_chart_1" }),
      expect.objectContaining({ entityKind: "composition" }),
    ]));
  });

  it("validates POST actions", async () => {
    const response = await POST(new Request("https://studioordo.test/api/admin/factory/work-orders/wo_1/revision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "ship_it" }),
    }), {
      params: Promise.resolve({ workOrderId: "wo_1" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({ error: "action must be one of pause, refine, or resume." });
  });

  it("pauses a planned work order through the admin route", async () => {
    const brief = createBrief();
    const workOrder = createWorkOrder(brief);
    await mapper.createWorkOrder(workOrder);
    await mapper.saveProductionDAG(workOrder.id, workOrder.currentDag);

    const response = await POST(new Request("https://studioordo.test/api/admin/factory/work-orders/wo_1/revision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "pause", reason: "Review before execution" }),
    }), {
      params: Promise.resolve({ workOrderId: "wo_1" }),
    });
    const payload = await response.json();
    const paused = requireValue(await mapper.findWorkOrderById("wo_1"));

    expect(response.status).toBe(200);
    expect(payload.result).toMatchObject({ outcome: "paused", resumeFromStageKey: "research" });
    expect(paused.status).toBe("paused");
    expect(paused.pausedState?.resumeFromStageKey).toBe("research");
  });

  it("refines a paused asset with a replacement upload", async () => {
    const brief = createBrief();
    await seedPausedReleaseFailure(mapper, brief);

    const response = await POST(new Request("https://studioordo.test/api/admin/factory/work-orders/wo_1/revision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "refine",
        mode: "replace_with_upload",
        assetId: "asset_chart_1",
        userFileId: "uf_chart_replacement",
      }),
    }), {
      params: Promise.resolve({ workOrderId: "wo_1" }),
    });
    const payload = await response.json();
    const outputs = await mapper.listOutputsForWorkOrder("wo_1", "asset");
    const replacement = requireValue(outputs.find((output) => output.entityId === payload.result.newAssetId));

    expect(response.status).toBe(200);
    expect(payload.result).toMatchObject({ previousAssetId: "asset_chart_1", resumeFromStageKey: "composition" });
    expect(replacement.supersedesEntityId).toBe("asset_chart_1");
    expect((replacement.payload as FactoryAsset).uri).toBe("/api/user-files/uf_chart_replacement");
  });

  it("requires a valid brief for regenerate requests", async () => {
    const brief = createBrief();
    await seedPausedReleaseFailure(mapper, brief);

    const response = await POST(new Request("https://studioordo.test/api/admin/factory/work-orders/wo_1/revision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "refine",
        mode: "regenerate",
        assetId: "asset_chart_1",
      }),
    }), {
      params: Promise.resolve({ workOrderId: "wo_1" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toContain("Invalid brief for regenerate");
  });

  it("regenerates an asset and resumes the work order through the admin route", async () => {
    const brief = createBrief();
    await seedPausedReleaseFailure(mapper, brief);

    const refineResponse = await POST(new Request("https://studioordo.test/api/admin/factory/work-orders/wo_1/revision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "refine",
        mode: "regenerate",
        assetId: "asset_chart_1",
        brief,
        parameterOverrides: { palette: "warm" },
      }),
    }), {
      params: Promise.resolve({ workOrderId: "wo_1" }),
    });
    const refinePayload = await refineResponse.json();

    expect(refineResponse.status).toBe(200);
    expect(refinePayload.result.resumeFromStageKey).toBe("composition");

    const resumeResponse = await POST(new Request("https://studioordo.test/api/admin/factory/work-orders/wo_1/revision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "resume",
        brief,
      }),
    }), {
      params: Promise.resolve({ workOrderId: "wo_1" }),
    });
    const resumePayload = await resumeResponse.json();
    const outputs = await mapper.listOutputsForWorkOrder("wo_1");
    const latestComposition = requireValue(outputs.filter((output) => output.entityKind === "composition").at(-1));
    const regeneratedAsset = requireValue(outputs.find((output) => output.entityId === refinePayload.result.newAssetId));

    expect(resumeResponse.status).toBe(200);
    expect(resumePayload.result).toMatchObject({ status: "succeeded" });
    expect((regeneratedAsset.payload as FactoryAsset).generationParams).toMatchObject({
      chartType: "flowchart",
      palette: "warm",
    });
    expect((latestComposition.payload as Composition).embeddedAssetIds).toContain(refinePayload.result.newAssetId);
  });
});