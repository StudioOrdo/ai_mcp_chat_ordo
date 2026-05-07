import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { OrdoCard } from "@/lib/ordo-cards/ordo-card-types";
import type { UserMediaItem } from "@/lib/media/user-media";
import type { StudioWorkspaceData } from "@/lib/studio/load-studio-workspace";

import { StudioWorkspace } from "./StudioWorkspace";

function card(overrides: Partial<OrdoCard> = {}): OrdoCard {
  return {
    id: "workflow_run:media_workflow:mwf_1",
    kind: "workflow_run",
    objectRef: { kind: "workflow_run", id: "mwf_1", label: "Founder short", href: "/studio/workflows/mwf_1" },
    bucket: "in_motion",
    status: "running",
    tone: "active",
    title: "Founder short",
    summary: "Compose video",
    updatedAt: "2026-05-04T12:00:00.000Z",
    ownerUserId: "usr_1",
    roleVisibility: ["AUTHENTICATED"],
    sourceRefs: [{ sourceKind: "media_workflow", sourceId: "mwf_1", label: "Media workflow" }],
    provenanceRefs: [{ sourceKind: "media_workflow", sourceId: "mwf_1", label: "Media workflow" }],
    detailHref: "/studio/workflows/mwf_1",
    diagnosticHref: "/jobs?sourceKind=media_workflow&sourceId=mwf_1",
    primaryAction: { id: "open", label: "Open workflow", href: "/studio/workflows/mwf_1" },
    ...overrides,
  };
}

function mediaItem(overrides: Partial<UserMediaItem> = {}): UserMediaItem {
  return {
    id: "uf_audio_1",
    fileName: "founder-audio.mp3",
    mimeType: "audio/mpeg",
    fileType: "audio",
    fileSize: 1_200_000,
    createdAt: "2026-05-04T12:00:00.000Z",
    previewUrl: "/api/user-files/uf_audio_1",
    conversationId: "conv_1",
    source: "generated",
    retentionClass: "conversation",
    width: null,
    height: null,
    durationSeconds: 78,
    canDelete: false,
    ...overrides,
  };
}

function workspace(overrides: Partial<StudioWorkspaceData> = {}): StudioWorkspaceData {
  const defaultCard = card();

  return {
    cards: [defaultCard],
    selectedCard: null,
    selectedMediaItem: null,
    query: { bucket: null, kind: null, q: null, objectId: null, page: 1, limit: 20 },
    summary: {
      total: 1,
      needsAttention: 0,
      inMotion: 1,
      produced: 0,
      workflows: 1,
      assets: 0,
      content: 0,
      campaigns: 0,
    },
    pageInfo: {
      page: 1,
      limit: 20,
      total: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    },
    ...overrides,
  };
}

describe("StudioWorkspace", () => {
  it("renders Studio as an object-card index", () => {
    render(<StudioWorkspace userName="Keith" workspace={workspace()} />);

    expect(screen.getByLabelText("Studio selection")).toHaveAttribute("data-studio-selection-column", "true");
    expect(screen.getByLabelText("Studio production workspace")).toHaveAttribute("data-studio-main-column", "true");
    expect(screen.getByRole("heading", { name: "Production Brief" })).toBeInTheDocument();
    expect(screen.getByText("Founder short")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Founder short/i })).toHaveAttribute(
      "href",
      "/studio?object=workflow_run%3Amedia_workflow%3Amwf_1",
    );
    expect(document.querySelector('[data-studio-row="workflow_run:media_workflow:mwf_1"]')).not.toBeNull();
  });

  it("keeps filters and search routed through /studio", () => {
    render(<StudioWorkspace userName="Keith" workspace={workspace({
      query: { bucket: "in_motion", kind: "workflow_run", q: "founder", objectId: null, page: 1, limit: 20 },
    })} />);

    expect(screen.getByLabelText("Studio kind")).toHaveValue("workflow_run");
    expect(screen.getByLabelText("Studio status")).toHaveValue("in_motion");
    expect(screen.getByRole("link", { name: "Clear" })).toHaveAttribute("href", "/studio");
    expect(screen.getByRole("link", { name: /Founder short/i })).toHaveAttribute(
      "href",
      "/studio?bucket=in_motion&kind=workflow_run&q=founder&object=workflow_run%3Amedia_workflow%3Amwf_1",
    );
    expect(screen.getByRole("textbox", { name: "Search Studio media" })).toHaveValue("founder");
  });

  it("shows a selected Studio work object with safe evidence instead of raw diagnostics", () => {
    const selected = card();

    render(<StudioWorkspace userName="Keith" workspace={workspace({
      selectedCard: selected,
      query: {
        bucket: null,
        kind: null,
        q: null,
        objectId: selected.id,
        page: 1,
        limit: 20,
      },
    })} />);

    expect(screen.getByLabelText("Studio production workspace")).toHaveAttribute("data-studio-main-column", "true");
    expect(screen.getByRole("heading", { name: "Founder short", level: 1 })).toBeInTheDocument();
    expect(document.querySelector('[data-studio-selected-object="true"]')).not.toBeNull();
    expect(document.querySelector('[data-studio-work-detail="true"]')).not.toBeNull();
    expect(screen.getByLabelText("Studio evidence")).toBeInTheDocument();
    expect(screen.queryByLabelText("Studio summary")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open workflow" })).toHaveAttribute("href", "/studio/workflows/mwf_1");
    expect(screen.getAllByRole("link").map((link) => link.getAttribute("href") ?? "")).not.toContain("/jobs?sourceKind=media_workflow&sourceId=mwf_1");
    expect(screen.queryByText(/job_/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/provider/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/log/i)).not.toBeInTheDocument();
  });

  it("renders selected media with preview facts and related evidence", () => {
    const selected = card({
      id: "media_asset:uf_audio_1",
      kind: "media_asset",
      objectRef: { kind: "media_asset", id: "uf_audio_1", label: "founder-audio.mp3", href: "/studio/media/uf_audio_1" },
      bucket: "produced",
      status: "succeeded",
      title: "founder-audio.mp3",
      summary: "audio - generated - conversation",
      detailHref: "/studio/media/uf_audio_1",
      diagnosticHref: "/my/media?assetId=uf_audio_1",
      sourceRefs: [{ sourceKind: "asset_catalog", sourceId: "uf_audio_1", label: "Asset catalog", href: "/studio/media/uf_audio_1" }],
      provenanceRefs: [
        { sourceKind: "conversation", sourceId: "conv_1", label: "Conversation", href: "/business/conversations/conv_1" },
        { sourceKind: "job", sourceId: "job_1", label: "Producing job", href: "/jobs?jobId=job_1" },
      ],
      preview: { kind: "audio", href: "/api/user-files/uf_audio_1", label: "founder-audio.mp3", mimeType: "audio/mpeg" },
      metrics: [{ id: "duration", label: "Duration", value: 78, unit: "sec" }],
    });

    render(<StudioWorkspace userName="Keith" workspace={workspace({
      cards: [selected],
      selectedCard: selected,
      selectedMediaItem: mediaItem(),
      query: {
        bucket: null,
        kind: "media_asset",
        q: null,
        objectId: selected.id,
        page: 1,
        limit: 20,
      },
      summary: {
        total: 1,
        needsAttention: 0,
        inMotion: 0,
        produced: 1,
        workflows: 0,
        assets: 1,
        content: 0,
        campaigns: 0,
      },
    })} />);

    expect(screen.getByRole("heading", { name: "founder-audio.mp3", level: 1 })).toBeInTheDocument();
    expect(document.querySelector('[data-studio-media-detail="true"]')).not.toBeNull();
    expect(document.querySelector("audio")).not.toBeNull();
    expect(screen.getByText("1.1 MB")).toBeInTheDocument();
    expect(screen.getByText("1:18")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Source conversation" })).toHaveAttribute("href", "/business/conversations/conv_1");
    expect(screen.getByRole("link", { name: "Producing work" })).toHaveAttribute(
      "href",
      "/studio?object=workflow_run%3Ajob%3Ajob_1",
    );
    expect(screen.queryByText(/quota/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/job_1/i)).not.toBeInTheDocument();
  });

  it("rewrites legacy jobs and media actions back into Studio object selection", () => {
    const selected = card({
      id: "workflow_run:job:job_1",
      objectRef: { kind: "workflow_run", id: "job:job_1", label: "Generate audio", href: "/jobs?jobId=job_1" },
      title: "Generate audio",
      summary: "Audio generated successfully.",
      status: "succeeded",
      primaryAction: { id: "open-job", label: "Open work", href: "/jobs?jobId=job_1" },
      secondaryActions: [{ id: "open-media", label: "Open media", href: "/my/media?assetId=uf_audio_1" }],
      provenanceRefs: [{ sourceKind: "job", sourceId: "job_1", label: "Generate audio", href: "/jobs?jobId=job_1" }],
      sourceRefs: [],
    });

    render(<StudioWorkspace userName="Keith" workspace={workspace({
      selectedCard: selected,
      query: {
        bucket: null,
        kind: null,
        q: null,
        objectId: selected.id,
        page: 1,
        limit: 20,
      },
    })} />);

    expect(screen.getByRole("link", { name: "Open work" })).toHaveAttribute(
      "href",
      "/studio?object=workflow_run%3Ajob%3Ajob_1",
    );
    expect(screen.getByRole("link", { name: "Open media" })).toHaveAttribute(
      "href",
      "/studio?kind=media_asset&object=media_asset%3Auf_audio_1",
    );
    expect(screen.getByRole("link", { name: "Producing work" })).toHaveAttribute(
      "href",
      "/studio?object=workflow_run%3Ajob%3Ajob_1",
    );
  });

  it("renders the shared missing-detail state when an object query misses", () => {
    render(<StudioWorkspace userName="Keith" workspace={workspace({
      selectedCard: null,
      query: {
        bucket: null,
        kind: null,
        q: null,
        objectId: "missing",
        page: 1,
        limit: 20,
      },
    })} />);

    expect(screen.getByText("No Studio object selected.")).toBeInTheDocument();
    expect(screen.getByText("Select media or production work from the Studio column.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Production Brief" })).toBeNull();
  });

  it("renders a truthful empty state", () => {
    render(<StudioWorkspace userName="Keith" workspace={workspace({
      cards: [],
      selectedCard: null,
      summary: {
        total: 0,
        needsAttention: 0,
        inMotion: 0,
        produced: 0,
        workflows: 0,
        assets: 0,
        content: 0,
        campaigns: 0,
      },
      pageInfo: {
        page: 1,
        limit: 20,
        total: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    })} />);

    expect(screen.getByText("No Studio objects match this view.")).toBeInTheDocument();
  });
});
