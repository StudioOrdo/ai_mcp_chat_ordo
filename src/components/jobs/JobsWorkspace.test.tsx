import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { JobHistoryEntry } from "@/lib/jobs/job-event-history";
import type { CanonicalJobSnapshot } from "@/lib/jobs/job-read-model";
import type { CanonicalMediaWorkflowSnapshot } from "@/lib/media/workflows/media-workflow-read-model";

const { pushMock, replaceMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  replaceMock: vi.fn(),
}));

const { writeTextMock, createObjectUrlMock, revokeObjectUrlMock } = vi.hoisted(() => ({
  writeTextMock: vi.fn(),
  createObjectUrlMock: vi.fn(),
  revokeObjectUrlMock: vi.fn(),
}));

class MockEventSource {
  static instances: MockEventSource[] = [];

  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(public readonly url: string) {
    MockEventSource.instances.push(this);
  }

  close() {
    return undefined;
  }
}

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    replace: replaceMock,
  }),
}));

import { JobsWorkspace } from "@/components/jobs/JobsWorkspace";

function makeSnapshot(
  overrides: Partial<CanonicalJobSnapshot> = {},
): CanonicalJobSnapshot {
  return {
    jobId: "job_1",
    conversationId: "conv_jobs",
    userId: null,
    toolName: "produce_blog_article",
    label: "Produce Blog Article",
    status: "running",
    title: "Launch Plan",
    subtitle: "Compose, QA, and prepare a publish-ready draft",
    summary: "Drafting the article.",
    progressPercent: 42,
    progressLabel: "Drafting",
    createdAt: "2026-03-30T08:59:00.000Z",
    startedAt: null,
    completedAt: null,
    updatedAt: "2026-03-30T09:00:00.000Z",
    origin: { fallback: "job_created_at" },
    inputSnapshot: {},
    resultEnvelope: null,
    artifactRefs: [],
    materializationRefs: [],
    ownership: { userId: null, visibility: "anonymous_session", initiatorType: "user" },
    failure: {
      failureClass: null,
      recoveryMode: null,
      nextRetryAt: null,
      lastCheckpointId: null,
      replayedFromJobId: null,
      supersededByJobId: null,
    },
    ...overrides,
    sequence: overrides.sequence ?? 0,
  };
}

function makeHistoryEntry(overrides: Partial<JobHistoryEntry> = {}): JobHistoryEntry {
  return {
    id: "evt_1",
    jobId: "job_1",
    conversationId: "conv_jobs",
    sequence: 1,
    eventType: "progress",
    createdAt: "2026-03-30T09:01:00.000Z",
    part: {
      type: "job_status",
      jobId: "job_1",
      toolName: "produce_blog_article",
      label: "Produce Blog Article",
      status: "running",
      summary: "Drafting the article.",
      progressPercent: 42,
      progressLabel: "Drafting",
    },
    ...overrides,
  };
}

function makeWorkflow(overrides: Partial<CanonicalMediaWorkflowSnapshot> = {}): CanonicalMediaWorkflowSnapshot {
  return {
    workflowId: "mwf_1",
    conversationId: "conv_jobs",
    userId: "usr_1",
    title: "Bloom video",
    requestedDeliverable: "video",
    status: "running",
    stage: { key: "compose_media", label: "Compose video", progressPercent: 50 },
    steps: [
      { stepId: "step_audio", kind: "generate_audio", status: "ready", jobId: "job_audio", assetId: "uf_audio", label: "Generate audio" },
      { stepId: "step_compose", kind: "compose_media", status: "running", jobId: "job_compose", assetId: null, label: "Compose video" },
    ],
    finalArtifact: null,
    failure: { code: null, message: null },
    linkedJobIds: ["job_audio", "job_compose"],
    linkedJobs: [],
    originMessageId: "msg_assistant",
    originTurnId: null,
    createdAt: "2026-05-01T17:00:00.000Z",
    updatedAt: "2026-05-01T17:01:00.000Z",
    completedAt: null,
    ...overrides,
  };
}

describe("JobsWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
    vi.stubGlobal("EventSource", MockEventSource as unknown as typeof EventSource);
    MockEventSource.instances = [];
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: { writeText: writeTextMock },
    });
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectUrlMock,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectUrlMock,
    });
    writeTextMock.mockResolvedValue(undefined);
    createObjectUrlMock.mockReturnValue("blob:jobs-log");
  });

  it("renders a truthful empty state when the account has no jobs", () => {
    render(
      <JobsWorkspace
        jobs={[]}
        selectedJob={null}
        selectedJobHistory={[]}
        selectedJobId={null}
        userName="Apprentice"
      />,
    );

    expect(screen.getByRole("heading", { name: "No jobs yet" })).toBeInTheDocument();
    expect(screen.getByText(/Background jobs you own will appear here/i)).toBeInTheDocument();
  });

  it("renders selected job detail and durable history", () => {
    render(
      <JobsWorkspace
        jobs={[makeSnapshot(), makeSnapshot({ jobId: "job_2", title: "Retry me", status: "failed" })]}
        selectedJob={makeSnapshot()}
        selectedJobHistory={[makeHistoryEntry()]}
        selectedJobId="job_1"
        userName="Morgan"
      />,
    );

    expect(screen.getByTestId("job-detail-panel")).toHaveTextContent("Launch Plan");
    expect(screen.getByTestId("job-history-timeline")).toHaveTextContent("Drafting the article.");
    expect(screen.getByRole("link", { name: "Open conversation" })).toHaveAttribute(
      "href",
      "/?conversationId=conv_jobs",
    );
  });

  it("renders workflow summaries before underlying job diagnostics", () => {
    render(
      <JobsWorkspace
        workflows={[makeWorkflow()]}
        jobs={[makeSnapshot({ jobId: "job_audio", toolName: "generate_audio", title: "Audio dependency" })]}
        selectedJob={makeSnapshot({ jobId: "job_audio", toolName: "generate_audio", title: "Audio dependency" })}
        selectedJobHistory={[makeHistoryEntry({ jobId: "job_audio" })]}
        selectedJobId="job_audio"
        userName="Morgan"
      />,
    );

    expect(screen.getByTestId("workflow-card-mwf_1")).toHaveTextContent("Bloom video");
    expect(screen.getByTestId("workflow-card-mwf_1")).toHaveTextContent("2 linked jobs");
    expect(screen.getByTestId("job-card-job_audio")).toHaveTextContent("Audio dependency");
  });

  it("navigates to a deep-linked selected job when another card is chosen", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ job: makeSnapshot({ jobId: "job_2", title: "Retry me", status: "failed" }) }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ events: [makeHistoryEntry({ jobId: "job_2", sequence: 2 })] }),
      } as Response);

    render(
      <JobsWorkspace
        jobs={[makeSnapshot(), makeSnapshot({ jobId: "job_2", title: "Retry me", status: "failed" })]}
        selectedJob={makeSnapshot()}
        selectedJobHistory={[makeHistoryEntry()]}
        selectedJobId="job_1"
        userName="Morgan"
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId("job-card-job_2"));
      await Promise.resolve();
    });

    expect(pushMock).toHaveBeenCalledWith("/jobs?jobId=job_2");
  });

  it("lets the user cancel the selected active job", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        action: "cancel",
        eventSequence: 9,
        job: {
          id: "job_1",
          conversationId: "conv_jobs",
          userId: "usr_member",
          toolName: "produce_blog_article",
          status: "canceled",
          priority: 100,
          dedupeKey: null,
          initiatorType: "user",
          requestPayload: { brief: "Launch Plan" },
          resultPayload: null,
          errorMessage: null,
          progressPercent: null,
          progressLabel: null,
          attemptCount: 1,
          leaseExpiresAt: null,
          claimedBy: null,
          createdAt: "2026-03-30T09:00:00.000Z",
          startedAt: "2026-03-30T09:00:01.000Z",
          completedAt: "2026-03-30T09:00:03.000Z",
          updatedAt: "2026-03-30T09:00:03.000Z",
        },
      }),
    } as Response);

    render(
      <JobsWorkspace
        jobs={[makeSnapshot()]}
        selectedJob={makeSnapshot()}
        selectedJobHistory={[makeHistoryEntry()]}
        selectedJobId="job_1"
        userName="Morgan"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancel Launch Plan" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("/api/jobs/job_1", expect.objectContaining({
        method: "POST",
      }));
      expect(replaceMock).not.toHaveBeenCalled();
      expect(screen.getByTestId("job-detail-panel")).toHaveTextContent("Canceled");
    });
  });

  it("reconciles live job progress updates from the SSE stream", async () => {
    render(
      <JobsWorkspace
        jobs={[makeSnapshot()]}
        selectedJob={makeSnapshot()}
        selectedJobHistory={[makeHistoryEntry()]}
        selectedJobId="job_1"
        userName="Morgan"
      />,
    );

    const source = MockEventSource.instances[0];

    await act(async () => {
      source?.onopen?.();
      source?.onmessage?.({
        data: JSON.stringify({
          type: "job_progress",
          jobId: "job_1",
          conversationId: "conv_jobs",
          sequence: 8,
          toolName: "produce_blog_article",
          label: "Produce Blog Article",
          title: "Launch Plan",
          subtitle: "Compose, QA, and prepare a publish-ready draft",
          progressLabel: "Reviewing article",
          progressPercent: 64,
          updatedAt: "2026-03-30T09:05:00.000Z",
        }),
      } as MessageEvent<string>);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByTestId("job-card-job_1")).toHaveTextContent("Reviewing article");
      expect(screen.getByTestId("job-history-timeline")).toHaveTextContent("Sequence 8");
      expect(screen.getByTestId("jobs-sync-state")).toHaveTextContent("Live updates connected.");
    });
  });

  it("surfaces API errors when a job action fails", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Job cannot be retried in its current state" }),
    } as Response);

    render(
      <JobsWorkspace
        jobs={[makeSnapshot({ jobId: "job_retry", status: "failed", title: "Retry me", progressPercent: null, progressLabel: null })]}
        selectedJob={makeSnapshot({ jobId: "job_retry", status: "failed", title: "Retry me", progressPercent: null, progressLabel: null })}
        selectedJobHistory={[makeHistoryEntry({ jobId: "job_retry" })]}
        selectedJobId="job_retry"
        userName="Morgan"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Replay Retry me" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Job cannot be retried in its current state");
    });
  });

  it("switches the selected job to the new queued retry without router.refresh", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          action: "retry",
          eventSequence: 12,
          job: {
            id: "job_retry_2",
            conversationId: "conv_jobs",
            userId: "usr_member",
            toolName: "produce_blog_article",
            status: "queued",
            priority: 100,
            dedupeKey: null,
            initiatorType: "user",
            requestPayload: { brief: "Retry me" },
            resultPayload: null,
            errorMessage: null,
            progressPercent: null,
            progressLabel: null,
            attemptCount: 1,
            leaseExpiresAt: null,
            claimedBy: null,
            createdAt: "2026-03-30T09:10:00.000Z",
            startedAt: null,
            completedAt: null,
            updatedAt: "2026-03-30T09:10:00.000Z",
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          job: makeSnapshot({
            jobId: "job_retry_2",
            title: "Retry me",
            status: "queued",
            progressPercent: null,
            progressLabel: null,
          }),
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          events: [
            makeHistoryEntry({
              jobId: "job_retry_2",
              sequence: 12,
              eventType: "queued",
              part: {
                type: "job_status",
                jobId: "job_retry_2",
                toolName: "produce_blog_article",
                label: "Produce Blog Article",
                status: "queued",
              },
            }),
          ],
        }),
      } as Response);

    render(
      <JobsWorkspace
        jobs={[makeSnapshot({ jobId: "job_retry", status: "failed", title: "Retry me", progressPercent: null, progressLabel: null })]}
        selectedJob={makeSnapshot({ jobId: "job_retry", status: "failed", title: "Retry me", progressPercent: null, progressLabel: null })}
        selectedJobHistory={[makeHistoryEntry({ jobId: "job_retry" })]}
        selectedJobId="job_retry"
        userName="Morgan"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Replay Retry me" }));

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/jobs?jobId=job_retry_2");
      expect(screen.getByTestId("job-detail-panel")).toHaveTextContent("Queued");
      expect(screen.getByTestId("job-history-timeline")).toHaveTextContent("Sequence 12");
      expect(screen.getByRole("status")).toHaveTextContent("Replay queued as a new job.");
    });
  });

  it("copies the selected job summary to the clipboard", async () => {
    render(
      <JobsWorkspace
        jobs={[makeSnapshot()]}
        selectedJob={makeSnapshot()}
        selectedJobHistory={[makeHistoryEntry()]}
        selectedJobId="job_1"
        userName="Morgan"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Copy summary for Launch Plan" }));

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith(expect.stringContaining("Summary: Drafting the article."));
      expect(screen.getByRole("status")).toHaveTextContent("Job summary copied.");
    });
  });

  it("exports the selected job log as a JSON download", async () => {
    const clickMock = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    render(
      <JobsWorkspace
        jobs={[makeSnapshot()]}
        selectedJob={makeSnapshot()}
        selectedJobHistory={[makeHistoryEntry()]}
        selectedJobId="job_1"
        userName="Morgan"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Export log for Launch Plan" }));

    await waitFor(() => {
      expect(createObjectUrlMock).toHaveBeenCalledTimes(1);
      expect(clickMock).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("status")).toHaveTextContent("Job log exported.");
    });

    clickMock.mockRestore();
  });

  it("explains deduped replay outcomes and switches to the active job", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          action: "retry",
          deduped: true,
          replay: {
            outcome: "deduped",
            sourceJobId: "job_retry",
            targetJobId: "job_active",
            dedupeKey: "publish_content:post_1",
          },
          job: {
            id: "job_active",
            conversationId: "conv_jobs",
            userId: "usr_member",
            toolName: "produce_blog_article",
            status: "running",
            priority: 100,
            dedupeKey: null,
            initiatorType: "user",
            requestPayload: { brief: "Retry me" },
            resultPayload: null,
            errorMessage: null,
            progressPercent: 65,
            progressLabel: "Reviewing article",
            attemptCount: 1,
            leaseExpiresAt: null,
            claimedBy: null,
            failureClass: null,
            nextRetryAt: null,
            recoveryMode: "rerun",
            lastCheckpointId: null,
            replayedFromJobId: "job_retry",
            supersededByJobId: null,
            createdAt: "2026-03-30T09:10:00.000Z",
            startedAt: "2026-03-30T09:10:01.000Z",
            completedAt: null,
            updatedAt: "2026-03-30T09:10:02.000Z",
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          job: makeSnapshot({
            jobId: "job_active",
            title: "Retry me",
            status: "running",
            progressPercent: 65,
            progressLabel: "Reviewing article",
            failure: {
              failureClass: null,
              recoveryMode: "rerun",
              nextRetryAt: null,
              lastCheckpointId: null,
              replayedFromJobId: "job_retry",
              supersededByJobId: null,
            },
          }),
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          events: [
            makeHistoryEntry({
              jobId: "job_active",
              sequence: 15,
              part: {
                type: "job_status",
                jobId: "job_active",
                toolName: "produce_blog_article",
                label: "Produce Blog Article",
                status: "running",
                summary: "Reviewing article",
              },
            }),
          ],
        }),
      } as Response);

    render(
      <JobsWorkspace
        jobs={[makeSnapshot({ jobId: "job_retry", status: "failed", title: "Retry me", progressPercent: null, progressLabel: null })]}
        selectedJob={makeSnapshot({ jobId: "job_retry", status: "failed", title: "Retry me", progressPercent: null, progressLabel: null })}
        selectedJobHistory={[makeHistoryEntry({ jobId: "job_retry" })]}
        selectedJobId="job_retry"
        userName="Morgan"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Replay Retry me" }));

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/jobs?jobId=job_active");
      expect(screen.getByRole("status")).toHaveTextContent("Equivalent work is already running. Switched to the active job.");
      expect(screen.getByTestId("job-detail-panel")).toHaveTextContent("Replayed from");
      expect(screen.getByTestId("job-detail-panel")).toHaveTextContent("Job job_retry");
    });
  });
});
