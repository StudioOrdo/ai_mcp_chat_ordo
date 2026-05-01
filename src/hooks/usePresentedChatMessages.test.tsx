import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { usePresentedChatMessages } from "@/hooks/usePresentedChatMessages";
import type { ChatMessage } from "@/core/entities/chat-message";
import type { JobStateEntry } from "@/hooks/chat/useJobStateStore";
import type { JobStatusMessagePart } from "@/core/entities/message-parts";
import type { CanonicalMediaWorkflowSnapshot } from "@/lib/media/workflows/media-workflow-read-model";

function jobSnapshotFromPart(part: JobStatusMessagePart, originMessageId = "assistant-job-1"): JobStateEntry {
  const updatedAt = part.updatedAt ?? "2026-04-30T00:00:00.000Z";
  return {
    jobId: part.jobId,
    conversationId: "conv_1",
    userId: null,
    toolName: part.toolName,
    label: part.label,
    title: part.title,
    subtitle: part.subtitle,
    status: part.status,
    sequence: part.sequence ?? 0,
    progressPercent: part.progressPercent,
    progressLabel: part.progressLabel,
    summary: part.summary,
    error: part.error,
    createdAt: updatedAt,
    startedAt: part.startedAt ?? null,
    completedAt: part.completedAt ?? null,
    updatedAt,
    origin: { originMessageId, fallback: "explicit_origin" },
    inputSnapshot: part.resultEnvelope?.inputSnapshot ?? {},
    resultPayload: part.resultPayload,
    resultEnvelope: part.resultEnvelope ?? null,
    artifactRefs: part.resultEnvelope?.artifacts ?? [],
    materializationRefs: [],
    ownership: { userId: null, visibility: "anonymous_session", initiatorType: "user" },
    failure: {
      failureClass: part.failureClass ?? null,
      recoveryMode: part.recoveryMode ?? null,
      nextRetryAt: part.nextRetryAt ?? null,
      lastCheckpointId: part.lastCheckpointId ?? null,
      replayedFromJobId: part.replayedFromJobId ?? null,
      supersededByJobId: part.supersededByJobId ?? null,
    },
  };
}

function Harness({
  messages,
  jobStateEntries = [],
  workflowStateEntries = [],
}: {
  messages: ChatMessage[];
  jobStateEntries?: readonly JobStateEntry[];
  workflowStateEntries?: readonly CanonicalMediaWorkflowSnapshot[];
}) {
  const { presentedMessages, dynamicSuggestions, scrollDependency } =
    usePresentedChatMessages(messages, false, jobStateEntries, workflowStateEntries);
  const firstJobEntry = presentedMessages
    .flatMap((message) => message.toolRenderEntries)
    .find((entry) => entry.kind === "job-status");
  const firstWorkflowEntry = presentedMessages
    .flatMap((message) => message.toolRenderEntries)
    .find((entry) => entry.kind === "workflow-status");
  const jobEntryCount = presentedMessages
    .flatMap((message) => message.toolRenderEntries)
    .filter((entry) => entry.kind === "job-status").length;
  const workflowEntryCount = presentedMessages
    .flatMap((message) => message.toolRenderEntries)
    .filter((entry) => entry.kind === "workflow-status").length;
  const toolCallEntryCount = presentedMessages
    .flatMap((message) => message.toolRenderEntries)
    .filter((entry) => entry.kind === "tool-call").length;

  return (
    <div>
      <div data-testid="message-count">{presentedMessages.length}</div>
      <div data-testid="suggestion-count">{dynamicSuggestions.length}</div>
      <div data-testid="last-response-state">{presentedMessages[0]?.responseState ?? "none"}</div>
      <div data-testid="scroll-dependency">{scrollDependency}</div>
      <div data-testid="first-job-status">{firstJobEntry?.kind === "job-status" ? firstJobEntry.part.status : "none"}</div>
      <div data-testid="first-job-summary">{firstJobEntry?.kind === "job-status" ? firstJobEntry.part.summary ?? "" : ""}</div>
      <div data-testid="job-entry-count">{jobEntryCount}</div>
      <div data-testid="workflow-entry-count">{workflowEntryCount}</div>
      <div data-testid="first-workflow-title">{firstWorkflowEntry?.kind === "workflow-status" ? firstWorkflowEntry.workflow.title : ""}</div>
      <div data-testid="first-workflow-status">{firstWorkflowEntry?.kind === "workflow-status" ? firstWorkflowEntry.workflow.status : "none"}</div>
      <div data-testid="tool-call-entry-count">{toolCallEntryCount}</div>
    </div>
  );
}

function workflowSnapshot(overrides: Partial<CanonicalMediaWorkflowSnapshot> = {}): CanonicalMediaWorkflowSnapshot {
  return {
    workflowId: "mwf_1",
    conversationId: "conv_1",
    userId: "usr_1",
    title: "Bloom video",
    requestedDeliverable: "video",
    status: "succeeded",
    stage: { key: "succeeded", label: "Video ready", progressPercent: 100 },
    steps: [
      { stepId: "step_audio", kind: "generate_audio", status: "ready", jobId: "job_audio", assetId: "uf_audio", label: "Generate audio" },
      { stepId: "step_compose", kind: "compose_media", status: "ready", jobId: "job_compose", assetId: "uf_video", label: "Compose video" },
    ],
    finalArtifact: { assetId: "uf_video", kind: "video" },
    failure: { code: null, message: null },
    linkedJobIds: ["job_audio", "job_compose"],
    linkedJobs: [],
    originMessageId: "assistant-workflow",
    originTurnId: null,
    createdAt: "2026-05-01T17:00:00.000Z",
    updatedAt: "2026-05-01T17:02:00.000Z",
    completedAt: "2026-05-01T17:02:00.000Z",
    ...overrides,
  };
}

describe("usePresentedChatMessages", () => {
  it("derives rendered messages, suggestions, and scroll dependency together", () => {
    const messages: ChatMessage[] = [
      {
        id: "assistant-1",
        role: "assistant",
        content: 'Plan the rollout.\n\n__suggestions__:["Review risks","Define milestones"]',
        timestamp: new Date("2026-03-15T12:00:00.000Z"),
        parts: [],
      },
    ];

    render(<Harness messages={messages} />);

    expect(screen.getByTestId("message-count")).toHaveTextContent("1");
    expect(screen.getByTestId("suggestion-count")).toHaveTextContent("2");
    expect(screen.getByTestId("last-response-state")).toHaveTextContent("open");
    // scrollDependency is now a monotonic counter — first render produces 1
    expect(screen.getByTestId("scroll-dependency")).toHaveTextContent("1");
  });

  it("suppresses dynamic suggestions for closed assistant answers", () => {
    const messages: ChatMessage[] = [
      {
        id: "assistant-2",
        role: "assistant",
        content: 'Done.\n\n__response_state__:"closed"\n\n__suggestions__:["Should stay hidden"]',
        timestamp: new Date("2026-03-15T12:05:00.000Z"),
        parts: [],
      },
    ];

    render(<Harness messages={messages} />);

    expect(screen.getByTestId("suggestion-count")).toHaveTextContent("0");
    expect(screen.getByTestId("last-response-state")).toHaveTextContent("closed");
  });

  it("reconciles stale transcript job parts with newer durable job snapshots", () => {
    const messages: ChatMessage[] = [
      {
        id: "assistant-job-1",
        role: "assistant",
        content: "",
        timestamp: new Date("2026-04-29T23:24:21.371Z"),
        parts: [
          {
            type: "job_status",
            jobId: "job_search_1",
            toolName: "admin_web_search",
            label: "Admin Web Search",
            title: "Iran news today 2025",
            subtitle: "Perform an administrative web search and store the results.",
            status: "running",
            sequence: 2,
            updatedAt: "2026-04-29T23:24:21.339Z",
          },
        ],
      },
    ];

    const jobStateEntries: JobStateEntry[] = [
      jobSnapshotFromPart(
        {
          type: "job_status",
          jobId: "job_search_1",
          toolName: "admin_web_search",
          label: "Admin Web Search",
          title: "Iran news today 2025",
          subtitle: "Perform an administrative web search and store the results.",
          status: "succeeded",
          sequence: 3,
          progressPercent: 100,
          summary: "Search complete.",
          updatedAt: "2026-04-29T23:24:32.862Z",
        },
        "assistant-job-1",
      ),
    ];

    render(<Harness messages={messages} jobStateEntries={jobStateEntries} />);

    expect(screen.getByTestId("message-count")).toHaveTextContent("1");
    expect(screen.getByTestId("first-job-status")).toHaveTextContent("succeeded");
    expect(screen.getByTestId("first-job-summary")).toHaveTextContent("Search complete.");
  });

  it("renders restored workflow snapshots and suppresses linked dependency job cards", () => {
    const messages: ChatMessage[] = [
      {
        id: "assistant-workflow",
        role: "assistant",
        content: "Generating your video.",
        timestamp: new Date("2026-05-01T17:00:00.000Z"),
        parts: [],
      },
    ];
    const jobStateEntries: JobStateEntry[] = [
      jobSnapshotFromPart({
        type: "job_status",
        jobId: "job_audio",
        toolName: "generate_audio",
        label: "Generate Audio",
        status: "succeeded",
        sequence: 4,
        updatedAt: "2026-05-01T17:01:00.000Z",
      }, "assistant-workflow"),
      jobSnapshotFromPart({
        type: "job_status",
        jobId: "job_compose",
        toolName: "compose_media",
        label: "Compose Media",
        status: "succeeded",
        sequence: 5,
        updatedAt: "2026-05-01T17:02:00.000Z",
      }, "assistant-workflow"),
    ];

    render(<Harness
      messages={messages}
      jobStateEntries={jobStateEntries}
      workflowStateEntries={[workflowSnapshot()]}
    />);

    expect(screen.getByTestId("workflow-entry-count")).toHaveTextContent("1");
    expect(screen.getByTestId("first-workflow-title")).toHaveTextContent("Bloom video");
    expect(screen.getByTestId("first-workflow-status")).toHaveTextContent("succeeded");
    expect(screen.getByTestId("job-entry-count")).toHaveTextContent("0");
  });

  it("ignores raw duplicate job-status messages without canonical snapshots", () => {
    const messages: ChatMessage[] = [
      {
        id: "assistant-job-running",
        role: "assistant",
        content: "",
        timestamp: new Date("2026-04-29T23:59:04.000Z"),
        parts: [
          {
            type: "job_status",
            jobId: "job_image_1",
            toolName: "generate_blog_image",
            label: "Generate Image",
            status: "running",
            updatedAt: "2026-04-29T23:59:04.000Z",
          },
        ],
      },
      {
        id: "assistant-job-succeeded",
        role: "assistant",
        content: "",
        timestamp: new Date("2026-04-30T00:00:09.000Z"),
        parts: [
          {
            type: "job_status",
            jobId: "job_image_1",
            toolName: "generate_blog_image",
            label: "Generate Image",
            status: "succeeded",
            summary: "Image generated.",
            updatedAt: "2026-04-30T00:00:09.000Z",
          },
        ],
      },
    ];

    render(<Harness messages={messages} />);

    expect(screen.getByTestId("message-count")).toHaveTextContent("2");
    expect(screen.getByTestId("job-entry-count")).toHaveTextContent("0");
    expect(screen.getByTestId("first-job-status")).toHaveTextContent("none");
  });

  it("shows the succeeded compose artifact instead of a later stale queued transcript card", () => {
    const messages: ChatMessage[] = [
      {
        id: "assistant-compose-succeeded",
        role: "assistant",
        content: "",
        timestamp: new Date("2026-04-30T07:46:38.596Z"),
        parts: [
          {
            type: "job_status",
            jobId: "job_303abe81-42d4-4e63-8afb-3ee9481e8627",
            toolName: "compose_media",
            label: "Compose Media",
            status: "succeeded",
            sequence: 28,
            summary: "Composition complete.",
            updatedAt: "2026-04-30T07:46:43.199Z",
            resultEnvelope: {
              schemaVersion: 1,
              toolName: "compose_media",
              family: "artifact",
              cardKind: "media_render",
              executionMode: "deferred",
              inputSnapshot: {},
              summary: { title: "Media Composition", statusLine: "succeeded" },
              artifacts: [
                {
                  kind: "video",
                  label: "Composed Video",
                  mimeType: "video/mp4",
                  assetId: "uf_e80d2b44-d8a7-4697-8bd2-b798c5017f8b",
                  uri: "/api/user-files/uf_e80d2b44-d8a7-4697-8bd2-b798c5017f8b",
                },
              ],
              payload: { primaryAssetId: "uf_e80d2b44-d8a7-4697-8bd2-b798c5017f8b" },
            },
          },
        ],
      },
      {
        id: "assistant-compose-queued-text",
        role: "assistant",
        content: "Rendering in progress. The job is queued.",
        timestamp: new Date("2026-04-30T07:46:43.534Z"),
        parts: [
          {
            type: "tool_call",
            name: "compose_media",
            args: { plan: { id: "plan_1" } },
            toolInvocationId: "toolu_compose_queued",
          },
          {
            type: "tool_result",
            name: "compose_media",
            toolInvocationId: "toolu_compose_queued",
            result: {
              job: {
                messageId: "assistant-compose-queued-text",
                conversationId: "conv_837e0675-bde1-4db8-a433-5a65e4cf2f95",
                part: {
                  type: "job_status",
                  jobId: "job_303abe81-42d4-4e63-8afb-3ee9481e8627",
                  toolName: "compose_media",
                  label: "Compose Media",
                  status: "queued",
                  sequence: 13,
                  progressPercent: 0,
                  progressLabel: "Queued",
                  updatedAt: "2026-04-30T07:46:36.783Z",
                },
              },
            },
          },
          {
            type: "job_status",
            jobId: "job_303abe81-42d4-4e63-8afb-3ee9481e8627",
            toolName: "compose_media",
            label: "Compose Media",
            status: "queued",
            sequence: 13,
            progressPercent: 0,
            progressLabel: "Queued",
            updatedAt: "2026-04-30T07:46:36.783Z",
          },
          { type: "text", text: "Rendering in progress. The job is queued." },
        ],
      },
    ];

    const jobStateEntries = [
      jobSnapshotFromPart(messages[0]?.parts?.[0] as JobStatusMessagePart, "assistant-compose-succeeded"),
    ];

    render(<Harness messages={messages} jobStateEntries={jobStateEntries} />);

    expect(screen.getByTestId("message-count")).toHaveTextContent("2");
    expect(screen.getByTestId("job-entry-count")).toHaveTextContent("1");
    expect(screen.getByTestId("first-job-status")).toHaveTextContent("succeeded");
    expect(screen.getByTestId("first-job-summary")).toHaveTextContent("Composition complete.");
  });

  it("applies durable job truth without mutating raw message history", () => {
    const messages: ChatMessage[] = [
      {
        id: "assistant-job-raw",
        role: "assistant",
        content: "",
        timestamp: new Date("2026-04-29T23:24:21.371Z"),
        parts: [
          {
            type: "job_status",
            jobId: "job_search_1",
            toolName: "admin_web_search",
            label: "Admin Web Search",
            status: "running",
            sequence: 2,
          },
        ],
      },
    ];

    const jobStateEntries: JobStateEntry[] = [
      jobSnapshotFromPart(
        {
          type: "job_status",
          jobId: "job_search_1",
          toolName: "admin_web_search",
          label: "Admin Web Search",
          status: "succeeded",
          sequence: 3,
          summary: "Search complete.",
        },
        "assistant-job-raw",
      ),
    ];

    render(<Harness messages={messages} jobStateEntries={jobStateEntries} />);

    expect(screen.getByTestId("first-job-status")).toHaveTextContent("succeeded");
    expect(messages[0]?.parts?.[0]).toMatchObject({
      type: "job_status",
      status: "running",
      sequence: 2,
    });
  });

  it("restores completed generated audio from canonical job state without direct transcript controls", () => {
    const messages: ChatMessage[] = [
      {
        id: "assistant-audio-direct",
        role: "assistant",
        content: "The audio job is complete.",
        timestamp: new Date("2026-04-30T15:00:00.000Z"),
        parts: [
          {
            type: "tool_call",
            name: "generate_audio",
            args: { title: "Founder memo", text: "Weekly review audio" },
            toolInvocationId: "toolu_audio_1",
          },
          {
            type: "tool_result",
            name: "generate_audio",
            toolInvocationId: "toolu_audio_1",
            result: {
              action: "generate_audio",
              title: "Founder memo",
              text: "Weekly review audio",
              assetId: "uf_audio_direct_1",
              provider: "user-file-cache",
              generationStatus: "cached_asset",
            },
          },
        ],
      },
    ];
    const completedAudioPart: JobStatusMessagePart = {
      type: "job_status",
      jobId: "job_audio_1",
      toolInvocationId: "toolu_audio_1",
      toolName: "generate_audio",
      label: "Generate Audio",
      title: "Founder memo",
      status: "succeeded",
      sequence: 11,
      summary: "Audio generated successfully.",
      updatedAt: "2026-04-30T15:00:11.000Z",
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
    };

    render(<Harness
      messages={messages}
      jobStateEntries={[jobSnapshotFromPart(completedAudioPart, "assistant-audio-direct")]}
    />);

    expect(screen.getByTestId("job-entry-count")).toHaveTextContent("1");
    expect(screen.getByTestId("tool-call-entry-count")).toHaveTextContent("0");
    expect(screen.getByTestId("first-job-status")).toHaveTextContent("succeeded");
    expect(screen.getByTestId("first-job-summary")).toHaveTextContent("Audio generated successfully.");
  });

  it("keeps newer completed generated audio ahead of stale running transcript state", () => {
    const messages: ChatMessage[] = [
      {
        id: "assistant-audio-running",
        role: "assistant",
        content: "Generating audio.",
        timestamp: new Date("2026-04-30T15:00:00.000Z"),
        parts: [
          {
            type: "job_status",
            jobId: "job_audio_1",
            toolName: "generate_audio",
            label: "Generate Audio",
            status: "running",
            sequence: 4,
            progressPercent: 50,
            progressLabel: "Generating audio",
            updatedAt: "2026-04-30T15:00:04.000Z",
          },
        ],
      },
    ];
    const completedAudioPart: JobStatusMessagePart = {
      type: "job_status",
      jobId: "job_audio_1",
      toolName: "generate_audio",
      label: "Generate Audio",
      status: "succeeded",
      sequence: 5,
      summary: "Audio generated successfully.",
      updatedAt: "2026-04-30T15:00:05.000Z",
      resultPayload: { action: "generate_audio", title: "Founder memo", text: "Weekly review audio", assetId: "uf_audio_1" },
    };

    render(<Harness
      messages={messages}
      jobStateEntries={[jobSnapshotFromPart(completedAudioPart, "assistant-audio-running")]}
    />);

    expect(screen.getByTestId("job-entry-count")).toHaveTextContent("1");
    expect(screen.getByTestId("first-job-status")).toHaveTextContent("succeeded");
    expect(screen.getByTestId("first-job-summary")).toHaveTextContent("Audio generated successfully.");
  });
});
