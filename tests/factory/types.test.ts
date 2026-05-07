import { describe, expect, it } from "vitest";

import { listCompositionValidationErrors } from "@/core/entities/composition";
import { listDraftValidationErrors } from "@/core/entities/draft";
import type { ProductBrief } from "@/core/entities/product-brief";
import { listProductBriefValidationErrors } from "@/core/entities/product-brief";
import type { ProductionDAG } from "@/core/entities/production-dag";
import { listProductionDAGValidationErrors } from "@/core/entities/production-dag";
import type { FactoryAsset } from "@/core/entities/factory-asset";
import { hasBlockingQAFindings, listFactoryAssetValidationErrors } from "@/core/entities/factory-asset";
import type { Outcome } from "@/core/entities/outcome";
import { listOutcomeValidationErrors } from "@/core/entities/outcome";
import type { QAReport } from "@/core/entities/qa-report";
import { listQAReportValidationErrors } from "@/core/entities/qa-report";
import type { Release } from "@/core/entities/release";
import { listReleaseValidationErrors } from "@/core/entities/release";
import type { ResearchPacket } from "@/core/entities/research-packet";
import { listResearchPacketValidationErrors } from "@/core/entities/research-packet";
import type { StageRunRecord } from "@/core/entities/stage-run-record";
import { listStageRunRecordValidationErrors } from "@/core/entities/stage-run-record";
import type { WorkOrder } from "@/core/entities/work-order";
import { deriveWorkOrderProgress, listWorkOrderValidationErrors } from "@/core/entities/work-order";

function createProductBrief(overrides: Partial<ProductBrief> = {}): ProductBrief {
  return {
    id: "brief_1",
    schemaVersion: 1,
    title: "Factory launch page",
    topic: "Launching a solopreneur product",
    assetKinds: ["chart", "audio"],
    qaCriteria: ["accuracy", "accessibility"],
    targetChannels: ["blog", "newsletter"],
    executionPreferences: {
      autoRetryOnFailure: true,
      parallelizeAssets: true,
      maxAssetCount: 3,
    },
    createdAt: "2026-04-27T12:00:00.000Z",
    createdBy: "user_1",
    ...overrides,
  };
}

function createProductionDAG(overrides: Partial<ProductionDAG> = {}): ProductionDAG {
  return {
    id: "dag_1",
    schemaVersion: 1,
    briefId: "brief_1",
    version: 1,
    autoParallelize: true,
    generatedAt: "2026-04-27T12:00:00.000Z",
    generatedBy: "planner_service",
    generationReason: "batch_automation",
    stages: [
      {
        key: "research",
        kind: "research",
        label: "Research",
        dependencyKeys: [],
        parallelizable: false,
        config: { kind: "research", queryHint: "solopreneur publishing" },
      },
      {
        key: "draft",
        kind: "draft",
        label: "Draft",
        dependencyKeys: ["research"],
        parallelizable: false,
        config: { kind: "draft", outlineHint: "narrative" },
      },
      {
        key: "asset_chart_1",
        kind: "asset_generation",
        label: "Generate chart",
        dependencyKeys: ["draft"],
        parallelizable: true,
        config: { kind: "asset_generation", assetKind: "chart", assetSlot: "hero-chart" },
      },
      {
        key: "compose",
        kind: "composition",
        label: "Compose page",
        dependencyKeys: ["draft", "asset_chart_1"],
        parallelizable: false,
        config: { kind: "composition", template: "landing" },
      },
      {
        key: "qa_page",
        kind: "qa",
        label: "QA page",
        dependencyKeys: ["compose"],
        parallelizable: false,
        config: { kind: "qa", scope: "page" },
      },
      {
        key: "release",
        kind: "release",
        label: "Release",
        dependencyKeys: ["qa_page"],
        parallelizable: false,
        config: { kind: "release", channels: ["blog"] },
      },
    ],
    ...overrides,
  };
}

function createStageRunRecord(overrides: Partial<StageRunRecord> = {}): StageRunRecord {
  return {
    id: "sr_1",
    stageKey: "research",
    status: "succeeded",
    startedAt: "2026-04-27T12:00:00.000Z",
    completedAt: "2026-04-27T12:01:00.000Z",
    resultRef: { entityKind: "research_packet", entityId: "rp_1" },
    attemptCount: 1,
    ...overrides,
  };
}

function createWorkOrder(overrides: Partial<WorkOrder> = {}): WorkOrder {
  const dag = createProductionDAG();
  return {
    id: "wo_1",
    schemaVersion: 1,
    briefId: dag.briefId,
    status: "running",
    currentDag: dag,
    stageRuns: [
      createStageRunRecord(),
      createStageRunRecord({
        id: "sr_2",
        stageKey: "draft",
        status: "running",
        startedAt: "2026-04-27T12:01:00.000Z",
        completedAt: undefined,
        resultRef: undefined,
        attemptCount: 1,
      }),
    ],
    executionLog: [],
    revision: 1,
    previousWorkOrderIds: [],
    createdAt: "2026-04-27T12:00:00.000Z",
    startedAt: "2026-04-27T12:00:00.000Z",
    userId: "user_1",
    initiatedBy: "batch_automation",
    ...overrides,
    operationId: overrides.operationId ?? "op_wo_1",
  };
}

function createResearchPacket(overrides: Partial<ResearchPacket> = {}): ResearchPacket {
  return {
    id: "rp_1",
    schemaVersion: 1,
    workOrderId: "wo_1",
    queryUsed: "solopreneur launch metrics",
    searchTimestamp: "2026-04-27T12:00:00.000Z",
    summary: "Sufficient evidence was found across multiple sources.",
    confidenceScore: 0.9,
    sources: [
      {
        id: "src_1",
        title: "Launch Benchmarks",
        url: "https://example.com/benchmarks",
        retrievedAt: "2026-04-27T12:00:00.000Z",
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

function createFactoryAsset(overrides: Partial<FactoryAsset> = {}): FactoryAsset {
  return {
    id: "asset_1",
    schemaVersion: 1,
    workOrderId: "wo_1",
    kind: "chart",
    uri: "/api/user-files/asset_1",
    mimeType: "image/png",
    fileSizeBytes: 2048,
    generationParams: { chartType: "line" },
    generatedAt: "2026-04-27T12:02:00.000Z",
    generationDurationMs: 3000,
    provenance: { stageKey: "asset_chart_1" },
    qaStatus: "passed",
    qaFindings: [],
    revision: 1,
    ...overrides,
  };
}

function createQAReport(overrides: Partial<QAReport> = {}): QAReport {
  return {
    id: "qa_1",
    schemaVersion: 1,
    workOrderId: "wo_1",
    status: "passed",
    totalFindings: 0,
    passedCriteria: ["accuracy", "accessibility"],
    failedCriteria: [],
    assetReports: [
      {
        assetId: "asset_1",
        assetKind: "chart",
        findings: [],
        status: "passed",
      },
    ],
    pageFindings: [],
    recommendedFixes: [],
    autoResolvableCount: 0,
    requiresUserDecision: false,
    createdAt: "2026-04-27T12:03:00.000Z",
    ...overrides,
  };
}

function createRelease(overrides: Partial<Release> = {}): Release {
  return {
    id: "release_1",
    schemaVersion: 1,
    workOrderId: "wo_1",
    version: "1.0.0",
    releaseNumber: 1,
    compositionId: "composition_1",
    publishedDestinations: [{ channel: "blog", url: "https://example.com/post" }],
    releasedAt: "2026-04-27T12:04:00.000Z",
    releasedBy: "user_1",
    ...overrides,
  };
}

function createOutcome(overrides: Partial<Outcome> = {}): Outcome {
  return {
    id: "outcome_1",
    schemaVersion: 1,
    workOrderId: "wo_1",
    releaseId: "release_1",
    observedAt: "2026-04-28T12:04:00.000Z",
    metrics: { viewCount: 100, engagementByChannel: { blog: 12 }, conversionCount: 3 },
    ...overrides,
  };
}

describe("factory core entity validation", () => {
  it("accepts a valid product brief", () => {
    expect(listProductBriefValidationErrors(createProductBrief())).toEqual([]);
  });

  it("rejects product briefs with duplicate asset kinds", () => {
    expect(
      listProductBriefValidationErrors(createProductBrief({ assetKinds: ["chart", "chart"] })),
    ).toContain("ProductBrief.assetKinds cannot contain duplicates.");
  });

  it("rejects product briefs with invalid createdAt timestamps", () => {
    expect(listProductBriefValidationErrors(createProductBrief({ createdAt: "not-a-date" }))).toContain(
      "ProductBrief.createdAt must be a valid timestamp.",
    );
  });

  it("accepts a valid production DAG", () => {
    expect(listProductionDAGValidationErrors(createProductionDAG())).toEqual([]);
  });

  it("rejects cyclic DAG dependencies", () => {
    const dag = createProductionDAG({
      stages: [
        {
          key: "a",
          kind: "research",
          label: "A",
          dependencyKeys: ["b"],
          parallelizable: false,
        },
        {
          key: "b",
          kind: "draft",
          label: "B",
          dependencyKeys: ["a"],
          parallelizable: false,
        },
      ],
    });

    expect(listProductionDAGValidationErrors(dag)).toContain("ProductionDAG cannot contain cyclic dependencies.");
  });

  it("accepts a valid succeeded stage run record", () => {
    expect(listStageRunRecordValidationErrors(createStageRunRecord())).toEqual([]);
  });

  it("rejects failed stage run records with zero attempts", () => {
    expect(
      listStageRunRecordValidationErrors(
        createStageRunRecord({ status: "failed", resultRef: undefined, attemptCount: 0 }),
      ),
    ).toContain("Failed StageRunRecord attemptCount must be at least 1.");
  });

  it("rejects stage run records without durable ids", () => {
    expect(listStageRunRecordValidationErrors(createStageRunRecord({ id: "" }))).toContain(
      "StageRunRecord.id must be a non-empty string.",
    );
  });

  it("rejects stage run records with invalid timestamps", () => {
    expect(
      listStageRunRecordValidationErrors(createStageRunRecord({ startedAt: "not-a-date" })),
    ).toContain("StageRunRecord.startedAt must be a valid timestamp when provided.");
  });

  it("accepts a valid work order and derives progress", () => {
    const workOrder = createWorkOrder();

    expect(listWorkOrderValidationErrors(workOrder)).toEqual([]);
    expect(deriveWorkOrderProgress(workOrder)).toMatchObject({
      totalStages: 6,
      completedStages: 1,
      activeStageKey: "draft",
      percent: 17,
    });
  });

  it("rejects paused work orders without pause state", () => {
    expect(
      listWorkOrderValidationErrors(createWorkOrder({ status: "paused", pausedState: undefined })),
    ).toContain("WorkOrder.pausedState is required when status is paused.");
  });

  it("rejects paused work orders with invalid pause timestamps", () => {
    expect(
      listWorkOrderValidationErrors(
        createWorkOrder({
          status: "paused",
          pausedState: { pausedAt: "not-a-date", reason: "Need review", resumeFromStageKey: "draft" },
        }),
      ),
    ).toContain("WorkOrder.pausedState.pausedAt must be a valid timestamp.");
  });

  it("accepts research packets with referenced sources", () => {
    expect(listResearchPacketValidationErrors(createResearchPacket())).toEqual([]);
  });

  it("rejects research claims that reference unknown sources", () => {
    expect(
      listResearchPacketValidationErrors(
        createResearchPacket({
          claims: [
            {
              id: "claim_1",
              text: "unsupported",
              supportingSourceIds: ["missing"],
              confidence: 0.5,
            },
          ],
        }),
      ),
    ).toContain("Claim claim_1 references unknown supporting sources.");
  });

  it("rejects research packets with invalid source timestamps", () => {
    expect(
      listResearchPacketValidationErrors(
        createResearchPacket({
          sources: [
            {
              id: "src_1",
              title: "Launch Benchmarks",
              url: "https://example.com/benchmarks",
              retrievedAt: "not-a-date",
              relevanceScore: 0.8,
            },
          ],
        }),
      ),
    ).toContain("SourceReference src_1 retrievedAt must be a valid timestamp.");
  });

  it("accepts a valid draft", () => {
    expect(
      listDraftValidationErrors({
        id: "draft_1",
        schemaVersion: 1,
        workOrderId: "wo_1",
        title: "Launch draft",
        sections: [
          { id: "s1", kind: "heading", order: 1, text: "Intro", level: 1 },
          { id: "s2", kind: "paragraph", order: 2, text: "Body" },
        ],
        createdAt: "2026-04-27T12:00:00.000Z",
        revision: 1,
      }),
    ).toEqual([]);
  });

  it("rejects draft sections with duplicate order values", () => {
    expect(
      listDraftValidationErrors({
        id: "draft_1",
        schemaVersion: 1,
        workOrderId: "wo_1",
        title: "Launch draft",
        sections: [
          { id: "s1", kind: "heading", order: 1, text: "Intro", level: 1 },
          { id: "s2", kind: "paragraph", order: 1, text: "Body" },
        ],
        createdAt: "2026-04-27T12:00:00.000Z",
        revision: 1,
      }),
    ).toContain("Draft section order values must be unique.");
  });

  it("accepts a valid factory asset and detects blocking findings", () => {
    expect(listFactoryAssetValidationErrors(createFactoryAsset())).toEqual([]);
    expect(
      hasBlockingQAFindings([
        { id: "finding_1", criterion: "accuracy", severity: "error", message: "bad data" },
      ]),
    ).toBe(true);
  });

  it("rejects failed factory assets without blocking findings", () => {
    expect(
      listFactoryAssetValidationErrors(
        createFactoryAsset({ qaStatus: "failed", qaFindings: [{ id: "f1", criterion: "accuracy", severity: "warning", message: "warn" }] }),
      ),
    ).toContain("FactoryAsset.qaStatus cannot be failed without an error-severity QA finding.");
  });

  it("accepts a valid composition", () => {
    expect(
      listCompositionValidationErrors({
        id: "composition_1",
        schemaVersion: 1,
        workOrderId: "wo_1",
        title: "Landing page",
        sections: [
          { id: "s1", kind: "heading", order: 1, text: "Landing", level: 1 },
          { id: "s2", kind: "chart", order: 2, assetId: "asset_1" },
        ],
        embeddedAssetIds: ["asset_1"],
        metadata: { targetChannel: "blog" },
        provenance: { draftId: "draft_1", assetIds: ["asset_1"] },
        createdAt: "2026-04-27T12:00:00.000Z",
        revision: 1,
      }),
    ).toEqual([]);
  });

  it("rejects composition sections that reference missing assets", () => {
    expect(
      listCompositionValidationErrors({
        id: "composition_1",
        schemaVersion: 1,
        workOrderId: "wo_1",
        title: "Landing page",
        sections: [{ id: "s1", kind: "chart", order: 1, assetId: "missing" }],
        embeddedAssetIds: [],
        metadata: {},
        provenance: { draftId: "draft_1", assetIds: [] },
        createdAt: "2026-04-27T12:00:00.000Z",
        revision: 1,
      }),
    ).toContain("Composition section s1 references missing embedded asset missing.");
  });

  it("accepts a valid QA report", () => {
    expect(listQAReportValidationErrors(createQAReport())).toEqual([]);
  });

  it("rejects QA reports whose total findings drift from report contents", () => {
    expect(listQAReportValidationErrors(createQAReport({ totalFindings: 2 }))).toContain(
      "QAReport.totalFindings must equal the number of asset and page findings.",
    );
  });

  it("accepts a valid release", () => {
    expect(listReleaseValidationErrors(createRelease())).toEqual([]);
  });

  it("rejects release posts with URLs before publication", () => {
    expect(
      listReleaseValidationErrors(
        createRelease({ socialPosts: [{ platform: "linkedin", content: "post", postUrl: "https://example.com/post" }] }),
      ),
    ).toContain("SocialPost linkedin postUrl cannot be present without postedAt.");
  });

  it("rejects releases with invalid releasedAt timestamps", () => {
    expect(listReleaseValidationErrors(createRelease({ releasedAt: "not-a-date" }))).toContain(
      "Release.releasedAt must be a valid timestamp.",
    );
  });

  it("accepts a valid outcome", () => {
    expect(listOutcomeValidationErrors(createOutcome())).toEqual([]);
  });

  it("rejects outcomes with negative metrics", () => {
    expect(listOutcomeValidationErrors(createOutcome({ metrics: { viewCount: -1 } }))).toContain(
      "Outcome.metrics.viewCount must be non-negative when provided.",
    );
  });

  it("rejects outcomes with invalid observedAt timestamps", () => {
    expect(listOutcomeValidationErrors(createOutcome({ observedAt: "not-a-date" }))).toContain(
      "Outcome.observedAt must be a valid timestamp.",
    );
  });
});
