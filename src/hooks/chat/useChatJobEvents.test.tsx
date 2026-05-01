import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CHAT_JOB_RECONCILE_INTERVAL_MS,
  useChatJobEvents,
} from "@/hooks/chat/useChatJobEvents";
import type { ChatAction } from "@/hooks/chat/chatState";
import type { CanonicalJobSnapshot } from "@/lib/jobs/job-read-model";

const fetchMock = vi.fn();
const dispatchMock = vi.fn<(action: ChatAction) => void>();
const upsertJobStateEntriesMock = vi.fn();

class MockEventSource {
  static instances: MockEventSource[] = [];

  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;

  constructor(public readonly url: string) {
    MockEventSource.instances.push(this);
  }

  close() {
    this.closed = true;
    return undefined;
  }
}

function Harness({ conversationId, includeUpsert = false }: { conversationId: string | null; includeUpsert?: boolean }) {
  useChatJobEvents({
    conversationId,
    dispatch: dispatchMock,
    upsertJobStateEntries: includeUpsert ? upsertJobStateEntriesMock : undefined,
  });
  return null;
}

async function flushHookEffects() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function jobSnapshot(overrides: Partial<CanonicalJobSnapshot> = {}): CanonicalJobSnapshot {
  const jobId = overrides.jobId ?? "job_1";
  const sequence = overrides.sequence ?? 1;
  return {
    jobId,
    conversationId: overrides.conversationId ?? "conv_1",
    userId: overrides.userId ?? "usr_1",
    toolName: overrides.toolName ?? "admin_web_search",
    label: overrides.label ?? "Admin Web Search",
    status: overrides.status ?? "running",
    sequence,
    createdAt: overrides.createdAt ?? "2026-04-30T15:00:00.000Z",
    startedAt: overrides.startedAt ?? null,
    completedAt: overrides.completedAt ?? null,
    updatedAt: overrides.updatedAt ?? `2026-04-30T15:00:${String(sequence).padStart(2, "0")}.000Z`,
    origin: overrides.origin ?? { fallback: "job_created_at" },
    inputSnapshot: overrides.inputSnapshot ?? {},
    resultEnvelope: overrides.resultEnvelope ?? null,
    artifactRefs: overrides.artifactRefs ?? [],
    materializationRefs: overrides.materializationRefs ?? [],
    ownership: overrides.ownership ?? { userId: "usr_1", visibility: "owner", initiatorType: "user" },
    failure: overrides.failure ?? {
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

describe("useChatJobEvents", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("EventSource", MockEventSource as unknown as typeof EventSource);
    fetchMock.mockReset();
    dispatchMock.mockReset();
    upsertJobStateEntriesMock.mockReset();
    MockEventSource.instances = [];
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("backs off snapshot reconciliation after a missing conversation response", async () => {
    fetchMock.mockResolvedValue({
      status: 404,
      ok: false,
      json: async () => ({ error: "Conversation not found" }),
    });

    render(<Harness conversationId="conv_missing" />);

    await flushHookEffects();

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const source = MockEventSource.instances[0];

    act(() => {
      source?.onerror?.();
      window.dispatchEvent(new Event("focus"));
    });

    await flushHookEffects();

    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });

    act(() => {
      window.dispatchEvent(new Event("focus"));
    });

    await flushHookEffects();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("preserves normalized canonical snapshots from live SSE events", async () => {
    fetchMock.mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ jobs: [] }),
    });

    render(<Harness conversationId="conv_live" includeUpsert />);

    await flushHookEffects();

    const source = MockEventSource.instances[0];

    act(() => {
      source?.onmessage?.({
        data: JSON.stringify({
          type: "job_progress",
          messageId: "jobmsg_job_1",
          jobId: "job_1",
          conversationId: "conv_live",
          sequence: 8,
          toolName: "produce_blog_article",
          label: "Produce Blog Article",
          progressPercent: 42,
          progressLabel: "Reviewing article",
          part: {
            type: "job_status",
            jobId: "job_1",
            toolName: "produce_blog_article",
            label: "Produce Blog Article",
            status: "running",
            sequence: 8,
            progressPercent: 42,
            progressLabel: "Reviewing article",
            resultEnvelope: {
              schemaVersion: 1,
              toolName: "produce_blog_article",
              family: "editorial",
              cardKind: "editorial_workflow",
              executionMode: "deferred",
              inputSnapshot: { brief: "Launch Plan" },
              summary: { title: "Launch Plan" },
              progress: {
                percent: 42,
                label: "Reviewing article",
                phases: [
                  { key: "qa_blog_article", label: "Reviewing article", status: "active", percent: 60 },
                ],
                activePhaseKey: "qa_blog_article",
              },
              payload: null,
            },
          },
        }),
      } as MessageEvent<string>);
    });

    expect(upsertJobStateEntriesMock).toHaveBeenCalledWith([
      expect.objectContaining({
        jobId: "job_1",
        status: "running",
        sequence: 8,
        resultEnvelope: expect.objectContaining({ toolName: "produce_blog_article" }),
      }),
    ]);
    expect(dispatchMock).not.toHaveBeenCalledWith(expect.objectContaining({ type: "UPSERT_JOB_STATUS" }));
  });

  it("opens the chat event stream with the reconciled conversation sequence cursor", async () => {
    fetchMock.mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({
        jobs: [
          jobSnapshot({ jobId: "job_1", sequence: 3 }),
          jobSnapshot({ jobId: "job_2", toolName: "produce_blog_article", label: "Produce Blog Article", sequence: 7 }),
        ],
      }),
    });

    render(<Harness conversationId="conv_cursor" includeUpsert />);

    await flushHookEffects();

    expect(MockEventSource.instances[0]?.url).toBe("/api/chat/events?conversationId=conv_cursor&afterSequence=7");
    expect(upsertJobStateEntriesMock).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ jobId: "job_2", sequence: 7 }),
    ]));
  });

  it("restores completed generated audio from reconciliation when the completion event was missed", async () => {
    fetchMock.mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({
        jobs: [
          jobSnapshot({
            jobId: "job_audio_1",
            toolName: "generate_audio",
            label: "Generate Audio",
            title: "Founder memo",
            status: "succeeded",
            sequence: 12,
            summary: "Audio generated successfully.",
            completedAt: "2026-04-30T15:00:12.000Z",
            resultPayload: {
              action: "generate_audio",
              title: "Founder memo",
              text: "Weekly review audio",
              assetId: "uf_audio_1",
              provider: "openai-speech",
              generationStatus: "completed",
            },
            resultEnvelope: {
              schemaVersion: 1,
              toolName: "generate_audio",
              family: "artifact",
              cardKind: "artifact_viewer",
              executionMode: "deferred",
              inputSnapshot: { title: "Founder memo", text: "Weekly review audio" },
              summary: { title: "Founder memo", statusLine: "succeeded" },
              artifacts: [
                {
                  kind: "audio",
                  label: "Founder memo",
                  mimeType: "audio/mpeg",
                  assetId: "uf_audio_1",
                  uri: "/api/user-files/uf_audio_1",
                  source: "generated",
                  retentionClass: "conversation",
                },
              ],
              payload: {
                action: "generate_audio",
                title: "Founder memo",
                text: "Weekly review audio",
                assetId: "uf_audio_1",
                provider: "openai-speech",
                generationStatus: "completed",
              },
            },
            artifactRefs: [
              {
                kind: "audio",
                label: "Founder memo",
                mimeType: "audio/mpeg",
                assetId: "uf_audio_1",
                uri: "/api/user-files/uf_audio_1",
                source: "generated",
                retentionClass: "conversation",
              },
            ],
          }),
        ],
      }),
    });

    render(<Harness conversationId="conv_audio_restore" includeUpsert />);

    await flushHookEffects();

    expect(upsertJobStateEntriesMock).toHaveBeenCalledWith([
      expect.objectContaining({
        jobId: "job_audio_1",
        toolName: "generate_audio",
        status: "succeeded",
        sequence: 12,
        resultEnvelope: expect.objectContaining({
          artifacts: [expect.objectContaining({
            kind: "audio",
            assetId: "uf_audio_1",
          })],
        }),
      }),
    ]);
    expect(MockEventSource.instances[0]?.url).toBe("/api/chat/events?conversationId=conv_audio_restore&afterSequence=12");
  });

  it("advances the conversation cursor only for accepted newer live job events", async () => {
    fetchMock.mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({
        jobs: [jobSnapshot({ jobId: "job_1", sequence: 8 })],
      }),
    });

    render(<Harness conversationId="conv_stale" includeUpsert />);

    await flushHookEffects();

    const source = MockEventSource.instances[0];

    act(() => {
      source?.onmessage?.({
        data: JSON.stringify({
          type: "job_progress",
          messageId: "jobmsg_job_1",
          jobId: "job_1",
          conversationId: "conv_stale",
          sequence: 8,
          toolName: "admin_web_search",
          label: "Admin Web Search",
          part: {
            type: "job_status",
            jobId: "job_1",
            toolName: "admin_web_search",
            label: "Admin Web Search",
            status: "running",
            sequence: 8,
          },
        }),
      } as MessageEvent<string>);
      source?.onmessage?.({
        data: JSON.stringify({
          type: "job_completed",
          messageId: "jobmsg_job_1",
          jobId: "job_1",
          conversationId: "conv_stale",
          sequence: 9,
          toolName: "admin_web_search",
          label: "Admin Web Search",
          summary: "Done",
          part: {
            type: "job_status",
            jobId: "job_1",
            toolName: "admin_web_search",
            label: "Admin Web Search",
            status: "succeeded",
            sequence: 9,
            summary: "Done",
          },
        }),
      } as MessageEvent<string>);
      source?.onmessage?.({
        data: JSON.stringify({
          type: "job_progress",
          messageId: "jobmsg_job_1",
          jobId: "job_1",
          conversationId: "conv_stale",
          sequence: 7,
          toolName: "admin_web_search",
          label: "Admin Web Search",
          part: {
            type: "job_status",
            jobId: "job_1",
            toolName: "admin_web_search",
            label: "Admin Web Search",
            status: "running",
            sequence: 7,
          },
        }),
      } as MessageEvent<string>);
    });

    expect(dispatchMock).not.toHaveBeenCalledWith(expect.objectContaining({
      type: "UPSERT_JOB_STATUS",
    }));
    expect(upsertJobStateEntriesMock).toHaveBeenCalledWith([
      expect.objectContaining({
        jobId: "job_1",
        status: "succeeded",
        sequence: 9,
      }),
    ]);
  });

  it("rehydrates a larger deferred-job snapshot set for busy conversations", async () => {
    fetchMock.mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({
        jobs: Array.from({ length: 20 }, (_, index) => jobSnapshot({
          jobId: `job_${index + 1}`,
          toolName: "produce_blog_article",
          label: "Produce Blog Article",
          status: index < 3 ? "running" : "succeeded",
          sequence: index + 1,
        })),
      }),
    });

    render(<Harness conversationId="conv_busy" includeUpsert />);

    await flushHookEffects();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/chat/jobs?conversationId=conv_busy&limit=50",
      expect.any(Object),
    );
    expect(dispatchMock).not.toHaveBeenCalledWith(expect.objectContaining({ type: "UPSERT_JOB_STATUS" }));
    expect(upsertJobStateEntriesMock).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ jobId: "job_20", sequence: 20 }),
    ]));
  });

  it("periodically reconciles deferred jobs while the conversation stays open", async () => {
    fetchMock.mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ jobs: [] }),
    });

    render(<Harness conversationId="conv_polling" />);

    await flushHookEffects();

    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(CHAT_JOB_RECONCILE_INTERVAL_MS);
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("reconciles and reopens the stream with the latest conversation sequence after an error", async () => {
    fetchMock
      .mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({
          jobs: [jobSnapshot({ jobId: "job_1", sequence: 3 })],
        }),
      })
      .mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({
          jobs: [jobSnapshot({ jobId: "job_1", status: "succeeded", sequence: 10 })],
        }),
      });

    render(<Harness conversationId="conv_reconnect" />);

    await flushHookEffects();

    const firstSource = MockEventSource.instances[0];
    expect(firstSource?.url).toBe("/api/chat/events?conversationId=conv_reconnect&afterSequence=3");

    act(() => {
      firstSource?.onerror?.();
    });

    await flushHookEffects();

    expect(firstSource?.closed).toBe(true);
    expect(MockEventSource.instances[1]?.url).toBe("/api/chat/events?conversationId=conv_reconnect&afterSequence=10");
  });

  it("resets the conversation sequence cursor and closes the old stream when the conversation changes", async () => {
    fetchMock
      .mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({
          jobs: [jobSnapshot({ jobId: "job_1", sequence: 12 })],
        }),
      })
      .mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({ jobs: [] }),
      });

    const { rerender } = render(<Harness conversationId="conv_first" />);

    await flushHookEffects();

    const firstSource = MockEventSource.instances[0];
    expect(firstSource?.url).toBe("/api/chat/events?conversationId=conv_first&afterSequence=12");

    rerender(<Harness conversationId="conv_second" />);

    await flushHookEffects();

    expect(firstSource?.closed).toBe(true);
    expect(MockEventSource.instances[1]?.url).toBe("/api/chat/events?conversationId=conv_second&afterSequence=0");
  });

  it("does not fetch or open a stream when conversationId is missing", async () => {
    render(<Harness conversationId={null} />);

    await flushHookEffects();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(MockEventSource.instances).toHaveLength(0);
  });

  it("keeps snapshot reconciliation as fallback when EventSource is unavailable", async () => {
    vi.unstubAllGlobals();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ jobs: [] }),
    });

    render(<Harness conversationId="conv_no_eventsource" />);

    await flushHookEffects();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/chat/jobs?conversationId=conv_no_eventsource&limit=50",
      expect.any(Object),
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(CHAT_JOB_RECONCILE_INTERVAL_MS);
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(MockEventSource.instances).toHaveLength(0);
  });
});
