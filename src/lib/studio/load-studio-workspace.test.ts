import { beforeEach, describe, expect, it, vi } from "vitest";

import type { UserFile } from "@/core/entities/user-file";
import type { CanonicalJobSnapshot } from "@/lib/jobs/job-read-model";
import type { CanonicalMediaWorkflowSnapshot } from "@/lib/media/workflows/media-workflow-read-model";

const {
  listUserJobSnapshotsMock,
  listUserWorkflowsMock,
  listForUserMock,
  loadOwnerContentCampaignMock,
} = vi.hoisted(() => ({
  listUserJobSnapshotsMock: vi.fn(),
  listUserWorkflowsMock: vi.fn(),
  listForUserMock: vi.fn(),
  loadOwnerContentCampaignMock: vi.fn(),
}));

vi.mock("@/adapters/RepositoryFactory", () => ({
  getJobStatusQuery: () => ({
    listUserJobSnapshots: listUserJobSnapshotsMock,
  }),
  getMediaWorkflowReadModel: () => ({
    listUserWorkflows: listUserWorkflowsMock,
  }),
  getUserFileDataMapper: () => ({
    listForUser: listForUserMock,
  }),
}));

vi.mock("@/lib/content/content-campaign-read-model", () => ({
  loadOwnerContentCampaign: loadOwnerContentCampaignMock,
}));

import { loadStudioWorkspace } from "@/lib/studio/load-studio-workspace";

function job(overrides: Partial<CanonicalJobSnapshot> = {}): CanonicalJobSnapshot {
  const updatedAt = overrides.updatedAt ?? "2026-05-04T10:00:00.000Z";
  return {
    jobId: "job_1",
    conversationId: "conv_1",
    userId: "usr_1",
    toolName: "generate_audio",
    label: "Generate audio",
    title: "Generate audio",
    status: "running",
    sequence: 1,
    createdAt: updatedAt,
    startedAt: null,
    completedAt: null,
    updatedAt,
    summary: "Audio is rendering.",
    origin: { fallback: "job_created_at" },
    inputSnapshot: {},
    resultEnvelope: null,
    artifactRefs: [],
    materializationRefs: [],
    ownership: { userId: "usr_1", visibility: "owner", initiatorType: "user" },
    failure: {
      failureClass: null,
      recoveryMode: null,
      nextRetryAt: null,
      lastCheckpointId: null,
      replayedFromJobId: null,
      supersededByJobId: null,
    },
    ...overrides,
  };
}

function workflow(overrides: Partial<CanonicalMediaWorkflowSnapshot> = {}): CanonicalMediaWorkflowSnapshot {
  return {
    workflowId: "mwf_1",
    conversationId: "conv_1",
    userId: "usr_1",
    title: "Founder short",
    requestedDeliverable: "video",
    status: "running",
    stage: { key: "compose_media", label: "Compose video", progressPercent: 50 },
    steps: [],
    finalArtifact: null,
    failure: { code: null, message: null },
    linkedJobIds: [],
    linkedJobs: [],
    originMessageId: null,
    originTurnId: null,
    createdAt: "2026-05-04T09:00:00.000Z",
    updatedAt: "2026-05-04T11:00:00.000Z",
    completedAt: null,
    ...overrides,
  };
}

function file(overrides: Partial<UserFile> = {}): UserFile {
  return {
    id: "uf_image_1",
    userId: "usr_1",
    conversationId: "conv_1",
    status: "ready",
    contentHash: "hash_1",
    fileType: "image",
    fileName: "hero.png",
    mimeType: "image/png",
    fileSize: 123,
    metadata: { assetKind: "image", source: "generated", retentionClass: "durable" },
    createdAt: "2026-05-04T12:00:00.000Z",
    ...overrides,
  };
}

describe("loadStudioWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listUserJobSnapshotsMock.mockResolvedValue([]);
    listUserWorkflowsMock.mockResolvedValue([]);
    listForUserMock.mockResolvedValue({ items: [], nextCursor: null });
    loadOwnerContentCampaignMock.mockResolvedValue(null);
  });

  it("projects workflows, standalone jobs, and media assets into Studio cards", async () => {
    listUserWorkflowsMock.mockResolvedValue([
      workflow({ linkedJobIds: ["job_linked"] }),
    ]);
    listUserJobSnapshotsMock.mockResolvedValue([
      job({ jobId: "job_linked", title: "Linked step" }),
      job({ jobId: "job_standalone", title: "Standalone audio" }),
    ]);
    listForUserMock.mockResolvedValue({ items: [file()], nextCursor: null });

    const result = await loadStudioWorkspace("usr_1");

    expect(result.cards.map((card) => card.id)).toContain("workflow_run:media_workflow:mwf_1");
    expect(result.cards.map((card) => card.id)).toContain("workflow_run:job:job_standalone");
    expect(result.cards.map((card) => card.id)).toContain("media_asset:uf_image_1");
    expect(result.cards.map((card) => card.id)).not.toContain("workflow_run:job:job_linked");
    expect(result.cards.find((card) => card.id === "media_asset:uf_image_1")?.summary).toBe(
      "image asset · attached to a conversation",
    );
    expect(result.summary).toMatchObject({
      total: 3,
      inMotion: 2,
      produced: 1,
      workflows: 2,
      assets: 1,
      content: 0,
      campaigns: 0,
    });
  });

  it("returns selected media item detail data for Studio asset selection", async () => {
    listForUserMock.mockResolvedValue({
      items: [
        file({
          id: "uf_audio_1",
          fileName: "founder-audio.mp3",
          fileType: "audio",
          mimeType: "audio/mpeg",
          fileSize: 1_200_000,
          metadata: {
            assetKind: "audio",
            source: "generated",
            retentionClass: "conversation",
            durationSeconds: 78,
          },
        }),
      ],
      nextCursor: null,
    });

    const result = await loadStudioWorkspace("usr_1", {
      object: "media_asset:uf_audio_1",
    });

    expect(result.selectedCard).toMatchObject({
      id: "media_asset:uf_audio_1",
      kind: "media_asset",
    });
    expect(result.selectedMediaItem).toMatchObject({
      id: "uf_audio_1",
      fileName: "founder-audio.mp3",
      fileType: "audio",
      previewUrl: "/api/user-files/uf_audio_1",
      durationSeconds: 78,
      canDelete: false,
    });
  });

  it("projects content and campaign read-model objects into Studio cards", async () => {
    loadOwnerContentCampaignMock.mockResolvedValue({
      id: "content-performance",
      ownerUserId: "usr_1",
      title: "Content performance loop",
      summary: "Measurable content loop.",
      items: [{
        post: {
          id: "blogpost_1",
          slug: "launch-note",
          title: "Launch Note",
          description: "A published note.",
          content: "## Launch",
          standfirst: null,
          section: "essay",
          heroImageAssetId: null,
          status: "published",
          publishedAt: "2026-05-04T12:00:00.000Z",
          createdAt: "2026-05-04T11:00:00.000Z",
          updatedAt: "2026-05-04T12:00:00.000Z",
          createdByUserId: "usr_1",
          publishedByUserId: "usr_1",
        },
        heroAsset: null,
        assets: [],
        artifacts: [],
        trackedLinks: [],
        performance: {
          links: 0,
          visits: 0,
          chats: 0,
          signups: 0,
          offerViews: 0,
          offerChoices: 0,
          simulatedPurchases: 0,
          conversions: 0,
        },
        publicHref: "/feed/launch-note",
        detailHref: "/studio/content/blogpost_1",
        isPublic: true,
      }],
      offers: [],
      trackedLinks: [],
      performance: {
        links: 0,
        visits: 0,
        chats: 0,
        signups: 0,
        offerViews: 0,
        offerChoices: 0,
        simulatedPurchases: 0,
        conversions: 0,
      },
      createdAt: "2026-05-04T11:00:00.000Z",
      updatedAt: "2026-05-04T12:00:00.000Z",
    });

    const result = await loadStudioWorkspace("usr_1", { kind: "content_item" });

    expect(result.cards.map((card) => card.id)).toEqual(["content_item:blogpost_1"]);
    expect(result.summary).toMatchObject({
      total: 2,
      content: 1,
      campaigns: 1,
    });
  });

  it("filters by bucket, kind, and search without exposing donor-page state", async () => {
    listUserWorkflowsMock.mockResolvedValue([
      workflow({ workflowId: "mwf_failed", title: "Failed video", status: "failed", failure: { code: "provider", message: "Provider failed" } }),
      workflow({ workflowId: "mwf_done", title: "Finished video", status: "succeeded", finalArtifact: { assetId: "uf_video_1", kind: "video" } }),
    ]);
    listForUserMock.mockResolvedValue({ items: [file({ id: "uf_other", fileName: "notes.txt", fileType: "document", mimeType: "text/plain" })], nextCursor: null });

    const result = await loadStudioWorkspace("usr_1", {
      bucket: "needs_attention",
      kind: "workflow_run",
      q: "failed",
    });

    expect(result.cards).toHaveLength(1);
    expect(result.cards[0]).toMatchObject({
      id: "workflow_run:media_workflow:mwf_failed",
      detailHref: "/studio/workflows/mwf_failed",
      diagnosticHref: "/jobs?sourceKind=media_workflow&sourceId=mwf_failed",
    });
    expect(listForUserMock).toHaveBeenCalledWith("usr_1", {
      limit: 100,
      search: "failed",
    });
  });
});
