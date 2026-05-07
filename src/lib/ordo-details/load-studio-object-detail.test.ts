import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  assetCatalogReaderMock,
  jobQueueRepositoryMock,
  jobStatusQueryMock,
  mediaWorkflowReadModelMock,
  mediaWorkflowRepositoryMock,
  loadOwnerContentCampaignMock,
  loadOwnerContentItemMock,
  projectContentCampaignToOrdoDetailMock,
  projectContentItemToOrdoDetailMock,
  projectMediaAssetToOrdoDetailMock,
  projectWorkflowRunToOrdoDetailMock,
} = vi.hoisted(() => ({
  assetCatalogReaderMock: {
    findByAssetId: vi.fn(),
  },
  jobQueueRepositoryMock: {
    findJobById: vi.fn(),
    listEventsForUserJob: vi.fn(),
  },
  jobStatusQueryMock: {
    getUserJobSnapshot: vi.fn(),
  },
  mediaWorkflowReadModelMock: {
    buildSnapshot: vi.fn(),
    listUserWorkflows: vi.fn(),
  },
  mediaWorkflowRepositoryMock: {
    findWorkflowById: vi.fn(),
  },
  loadOwnerContentCampaignMock: vi.fn(),
  loadOwnerContentItemMock: vi.fn(),
  projectContentCampaignToOrdoDetailMock: vi.fn(),
  projectContentItemToOrdoDetailMock: vi.fn(),
  projectMediaAssetToOrdoDetailMock: vi.fn(),
  projectWorkflowRunToOrdoDetailMock: vi.fn(),
}));

vi.mock("@/adapters/RepositoryFactory", () => ({
  getAssetCatalogReader: () => assetCatalogReaderMock,
  getJobQueueRepository: () => jobQueueRepositoryMock,
  getJobStatusQuery: () => jobStatusQueryMock,
  getMediaWorkflowReadModel: () => mediaWorkflowReadModelMock,
  getMediaWorkflowRepository: () => mediaWorkflowRepositoryMock,
}));

vi.mock("@/lib/jobs/job-event-history", () => ({
  mapJobEventHistory: vi.fn(() => [{ id: "event_1", eventType: "succeeded" }]),
}));

vi.mock("@/lib/content/content-campaign-read-model", () => ({
  loadOwnerContentCampaign: loadOwnerContentCampaignMock,
  loadOwnerContentItem: loadOwnerContentItemMock,
}));

vi.mock("./ordo-detail-projectors", () => ({
  projectContentCampaignToOrdoDetail: projectContentCampaignToOrdoDetailMock,
  projectContentItemToOrdoDetail: projectContentItemToOrdoDetailMock,
  projectMediaAssetToOrdoDetail: projectMediaAssetToOrdoDetailMock,
  projectWorkflowRunToOrdoDetail: projectWorkflowRunToOrdoDetailMock,
}));

import type { SessionUser } from "@/lib/auth";
import {
  loadStudioMediaDetail,
  loadStudioCampaignDetail,
  loadStudioContentDetail,
  loadStudioWorkflowDetail,
} from "./load-studio-object-detail";

const user: SessionUser = {
  id: "usr_1",
  email: "keith@example.com",
  name: "Keith",
  roles: ["AUTHENTICATED"],
};

describe("studio object detail loaders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    projectMediaAssetToOrdoDetailMock.mockReturnValue({ title: "Media detail" });
    projectWorkflowRunToOrdoDetailMock.mockReturnValue({ title: "Workflow detail" });
    projectContentItemToOrdoDetailMock.mockReturnValue({ title: "Content detail" });
    projectContentCampaignToOrdoDetailMock.mockReturnValue({ title: "Campaign detail" });
    mediaWorkflowReadModelMock.listUserWorkflows.mockResolvedValue([]);
    mediaWorkflowReadModelMock.buildSnapshot.mockResolvedValue({ workflowId: "mwf_1" });
  });

  it("loads media through the owner-scoped asset catalog reader", async () => {
    assetCatalogReaderMock.findByAssetId.mockResolvedValue({
      assetId: "uf_1",
      ownerUserId: "usr_1",
      producedByJobId: "job_1",
    });
    jobStatusQueryMock.getUserJobSnapshot.mockResolvedValue({ jobId: "job_1" });
    jobQueueRepositoryMock.findJobById.mockResolvedValue({ id: "job_1", userId: "usr_1" });
    jobQueueRepositoryMock.listEventsForUserJob.mockResolvedValue([{ id: "raw_event_1" }]);

    const detail = await loadStudioMediaDetail(user, "uf_1");

    expect(assetCatalogReaderMock.findByAssetId).toHaveBeenCalledWith({
      assetId: "uf_1",
      userId: "usr_1",
    });
    expect(jobStatusQueryMock.getUserJobSnapshot).toHaveBeenCalledWith("usr_1", "job_1");
    expect(jobQueueRepositoryMock.listEventsForUserJob).toHaveBeenCalledWith("usr_1", "job_1", {
      limit: 50,
    });
    expect(projectMediaAssetToOrdoDetailMock).toHaveBeenCalledWith(expect.objectContaining({
      producingJob: { jobId: "job_1" },
      jobHistory: [expect.objectContaining({ id: "event_1" })],
      canViewAdminDiagnostics: false,
    }));
    expect(detail).toEqual({ title: "Media detail" });
  });

  it("does not fall back when the owner-scoped media lookup misses", async () => {
    assetCatalogReaderMock.findByAssetId.mockResolvedValue(null);

    const detail = await loadStudioMediaDetail(user, "uf_other");

    expect(detail).toBeNull();
    expect(projectMediaAssetToOrdoDetailMock).not.toHaveBeenCalled();
    expect(jobStatusQueryMock.getUserJobSnapshot).not.toHaveBeenCalled();
  });

  it("does not expose job history when the producing job belongs to another user", async () => {
    assetCatalogReaderMock.findByAssetId.mockResolvedValue({
      assetId: "uf_1",
      ownerUserId: "usr_1",
      producedByJobId: "job_other",
    });
    jobQueueRepositoryMock.findJobById.mockResolvedValue({ id: "job_other", userId: "usr_other" });

    await loadStudioMediaDetail(user, "uf_1");

    expect(jobQueueRepositoryMock.listEventsForUserJob).not.toHaveBeenCalled();
    expect(projectMediaAssetToOrdoDetailMock).toHaveBeenCalledWith(expect.objectContaining({
      jobHistory: [],
    }));
  });

  it("loads only owner-scoped workflow details", async () => {
    mediaWorkflowRepositoryMock.findWorkflowById.mockReturnValue({
      workflow: { id: "mwf_1", userId: "usr_1" },
    });

    const detail = await loadStudioWorkflowDetail(user, "mwf_1");

    expect(mediaWorkflowRepositoryMock.findWorkflowById).toHaveBeenCalledWith("mwf_1");
    expect(mediaWorkflowReadModelMock.buildSnapshot).toHaveBeenCalled();
    expect(projectWorkflowRunToOrdoDetailMock).toHaveBeenCalledWith({ workflowId: "mwf_1" }, {
      canViewAdminDiagnostics: false,
    });
    expect(detail).toEqual({ title: "Workflow detail" });
  });

  it("rejects workflow details owned by another user", async () => {
    mediaWorkflowRepositoryMock.findWorkflowById.mockReturnValue({
      workflow: { id: "mwf_other", userId: "usr_other" },
    });

    const detail = await loadStudioWorkflowDetail(user, "mwf_other");

    expect(detail).toBeNull();
    expect(mediaWorkflowReadModelMock.buildSnapshot).not.toHaveBeenCalled();
    expect(projectWorkflowRunToOrdoDetailMock).not.toHaveBeenCalled();
  });

  it("loads only owner-scoped content details", async () => {
    loadOwnerContentItemMock.mockResolvedValue({ post: { id: "blogpost_1" } });

    const detail = await loadStudioContentDetail(user, "blogpost_1");

    expect(loadOwnerContentItemMock).toHaveBeenCalledWith("usr_1", "blogpost_1");
    expect(projectContentItemToOrdoDetailMock).toHaveBeenCalledWith({ post: { id: "blogpost_1" } });
    expect(detail).toEqual({ title: "Content detail" });
  });

  it("returns null when content is not owned by the viewer", async () => {
    loadOwnerContentItemMock.mockResolvedValue(null);

    await expect(loadStudioContentDetail(user, "blogpost_other")).resolves.toBeNull();
    expect(projectContentItemToOrdoDetailMock).not.toHaveBeenCalled();
  });

  it("loads the owner content campaign read model", async () => {
    loadOwnerContentCampaignMock.mockResolvedValue({ id: "content-performance" });

    const detail = await loadStudioCampaignDetail(user, "content-performance");

    expect(loadOwnerContentCampaignMock).toHaveBeenCalledWith("usr_1", "content-performance");
    expect(projectContentCampaignToOrdoDetailMock).toHaveBeenCalledWith({ id: "content-performance" });
    expect(detail).toEqual({ title: "Campaign detail" });
  });
});
