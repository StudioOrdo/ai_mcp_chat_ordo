import { act, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { describe, expect, it } from "vitest";

import type { ChatMessage } from "@/core/entities/chat-message";
import type { JobStatusMessagePart } from "@/core/entities/message-parts";
import { useJobStateStore, type JobStateEntry } from "@/hooks/chat/useJobStateStore";

function part(overrides: Partial<JobStatusMessagePart> = {}): JobStatusMessagePart {
  return {
    type: "job_status",
    jobId: "job_1",
    toolName: "admin_web_search",
    label: "Admin Web Search",
    status: "running",
    sequence: 1,
    ...overrides,
  };
}

function entry(overrides: Partial<JobStatusMessagePart> = {}): JobStateEntry {
  const statusPart = part(overrides);
  const updatedAt = statusPart.updatedAt ?? "2026-04-30T12:00:00.000Z";
  return {
    jobId: statusPart.jobId,
    conversationId: "conv_1",
    userId: null,
    toolName: statusPart.toolName,
    label: statusPart.label,
    title: statusPart.title,
    subtitle: statusPart.subtitle,
    status: statusPart.status,
    sequence: statusPart.sequence ?? 0,
    progressPercent: statusPart.progressPercent,
    progressLabel: statusPart.progressLabel,
    summary: statusPart.summary,
    error: statusPart.error,
    createdAt: updatedAt,
    startedAt: statusPart.startedAt ?? null,
    completedAt: statusPart.completedAt ?? null,
    updatedAt,
    origin: { fallback: "job_created_at" },
    inputSnapshot: statusPart.resultEnvelope?.inputSnapshot ?? {},
    resultPayload: statusPart.resultPayload,
    resultEnvelope: statusPart.resultEnvelope ?? null,
    artifactRefs: statusPart.resultEnvelope?.artifacts ?? [],
    materializationRefs: [],
    ownership: { userId: null, visibility: "anonymous_session", initiatorType: "user" },
    failure: {
      failureClass: statusPart.failureClass ?? null,
      recoveryMode: statusPart.recoveryMode ?? null,
      nextRetryAt: statusPart.nextRetryAt ?? null,
      lastCheckpointId: statusPart.lastCheckpointId ?? null,
      replayedFromJobId: statusPart.replayedFromJobId ?? null,
      supersededByJobId: statusPart.supersededByJobId ?? null,
    },
  };
}

function Harness({
  conversationId,
  messages = [],
  incomingEntries = [],
}: {
  conversationId: string | null;
  messages?: ChatMessage[];
  incomingEntries?: JobStateEntry[];
}) {
  const { jobStateEntries, upsertJobStateEntries } = useJobStateStore(conversationId, []);

  useEffect(() => {
    if (incomingEntries.length > 0) {
      upsertJobStateEntries(incomingEntries);
    }
  }, [incomingEntries, upsertJobStateEntries]);

  const first = jobStateEntries[0];

  return (
    <div>
      <div data-testid="entry-count">{jobStateEntries.length}</div>
      <div data-testid="status">{first?.status ?? "none"}</div>
      <div data-testid="sequence">{first?.sequence ?? "none"}</div>
      <div data-testid="summary">{first?.summary ?? "none"}</div>
      <div data-testid="progress-percent">{first?.progressPercent === null ? "null" : first?.progressPercent ?? "none"}</div>
      <div data-testid="progress-label">{first?.progressLabel === null ? "null" : first?.progressLabel ?? "none"}</div>
      <div data-testid="result-envelope">{first?.resultEnvelope === null ? "null" : first?.resultEnvelope ? "present" : "none"}</div>
    </div>
  );
}

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe("useJobStateStore", () => {
  it("keeps the latest terminal job entry by sequence", async () => {
    const { rerender } = render(
      <Harness conversationId="conv_1" incomingEntries={[entry({ status: "running", sequence: 4 })]} />,
    );
    await flushEffects();

    rerender(
      <Harness conversationId="conv_1" incomingEntries={[entry({ status: "succeeded", sequence: 5, summary: "Done" })]} />,
    );
    await flushEffects();

    expect(screen.getByTestId("status")).toHaveTextContent("succeeded");
    expect(screen.getByTestId("sequence")).toHaveTextContent("5");
    expect(screen.getByTestId("summary")).toHaveTextContent("Done");
  });

  it("does not regress a terminal entry with an older running entry", async () => {
    const { rerender } = render(
      <Harness conversationId="conv_1" incomingEntries={[entry({ status: "succeeded", sequence: 5, summary: "Done" })]} />,
    );
    await flushEffects();

    rerender(
      <Harness conversationId="conv_1" incomingEntries={[entry({ status: "running", sequence: 4, summary: "Stale" })]} />,
    );
    await flushEffects();

    expect(screen.getByTestId("status")).toHaveTextContent("succeeded");
    expect(screen.getByTestId("summary")).toHaveTextContent("Done");
  });

  it("merges equal sequence entries deterministically while preserving omitted useful fields", async () => {
    const { rerender } = render(
      <Harness conversationId="conv_1" incomingEntries={[entry({ status: "running", sequence: 3, summary: "Research ready" })]} />,
    );
    await flushEffects();

    rerender(
      <Harness conversationId="conv_1" incomingEntries={[entry({ status: "running", sequence: 3, progressPercent: 80 })]} />,
    );
    await flushEffects();

    expect(screen.getByTestId("sequence")).toHaveTextContent("3");
    expect(screen.getByTestId("summary")).toHaveTextContent("Research ready");
    expect(screen.getByTestId("progress-percent")).toHaveTextContent("80");
  });

  it("treats missing sequence as lower priority than numeric sequence", async () => {
    const { rerender } = render(
      <Harness conversationId="conv_1" incomingEntries={[entry({ status: "succeeded", sequence: 2, summary: "Done" })]} />,
    );
    await flushEffects();

    rerender(
      <Harness conversationId="conv_1" incomingEntries={[entry({ status: "running", sequence: undefined, summary: "Stale" })]} />,
    );
    await flushEffects();

    expect(screen.getByTestId("status")).toHaveTextContent("succeeded");
    expect(screen.getByTestId("summary")).toHaveTextContent("Done");
  });

  it("allows incoming null fields to clear stale progress and result envelope fields", async () => {
    const { rerender } = render(
      <Harness
        conversationId="conv_1"
        incomingEntries={[entry({
          sequence: 1,
          progressPercent: 50,
          progressLabel: "Searching",
          resultEnvelope: {
            schemaVersion: 1,
            toolName: "admin_web_search",
            family: "search",
            cardKind: "search_result",
            executionMode: "deferred",
            inputSnapshot: {},
            summary: { title: "Search" },
            payload: null,
          },
        })]}
      />,
    );
    await flushEffects();

    rerender(
      <Harness
        conversationId="conv_1"
        incomingEntries={[entry({
          status: "failed",
          sequence: 2,
          progressPercent: null,
          progressLabel: null,
          resultEnvelope: null,
        })]}
      />,
    );
    await flushEffects();

    expect(screen.getByTestId("status")).toHaveTextContent("failed");
    expect(screen.getByTestId("progress-percent")).toHaveTextContent("null");
    expect(screen.getByTestId("progress-label")).toHaveTextContent("null");
    expect(screen.getByTestId("result-envelope")).toHaveTextContent("null");
  });

  it("clears ephemeral entries when the conversation changes", async () => {
    const { rerender } = render(
      <Harness conversationId="conv_1" incomingEntries={[entry({ status: "running", sequence: 3 })]} />,
    );
    await flushEffects();

    expect(screen.getByTestId("entry-count")).toHaveTextContent("1");

    rerender(<Harness conversationId="conv_2" incomingEntries={[]} />);
    await flushEffects();

    expect(screen.getByTestId("entry-count")).toHaveTextContent("0");
  });

  it("ignores incoming upserts when conversationId is null", async () => {
    render(<Harness conversationId={null} incomingEntries={[entry({ status: "running", sequence: 3 })]} />);
    await flushEffects();

    expect(screen.getByTestId("entry-count")).toHaveTextContent("0");
  });
});
