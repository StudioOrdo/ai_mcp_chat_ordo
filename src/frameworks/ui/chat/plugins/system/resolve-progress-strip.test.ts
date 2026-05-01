import { describe, expect, it } from "vitest";

import type { PresentedMessage } from "@/adapters/ChatPresenter";
import type { CapabilityPresentationDescriptor } from "@/core/entities/capability-presentation";

import {
  DESKTOP_PROGRESS_STRIP_VISIBLE_CAP,
  MOBILE_PROGRESS_STRIP_VISIBLE_CAP,
  resolveProgressStrip,
  resolveProgressStripLayout,
} from "./resolve-progress-strip";

const deferredDescriptor: CapabilityPresentationDescriptor = {
  toolName: "produce_blog_article",
  family: "editorial",
  label: "Produce Blog Article",
  cardKind: "editorial_workflow",
  executionMode: "deferred",
  progressMode: "phased",
  historyMode: "payload_snapshot",
  defaultSurface: "conversation",
  artifactKinds: [],
  supportsRetry: "whole_job",
};

const queuedDescriptor: CapabilityPresentationDescriptor = {
  ...deferredDescriptor,
  toolName: "draft_content",
  label: "Draft Content",
  progressMode: "single",
};

const inlineDescriptor: CapabilityPresentationDescriptor = {
  ...deferredDescriptor,
  toolName: "generate_graph",
  label: "Generate Graph",
  executionMode: "inline",
  progressMode: "none",
  supportsRetry: "none",
};

function makeMessage(toolRenderEntries: PresentedMessage["toolRenderEntries"]): PresentedMessage {
  return {
    id: `msg-${toolRenderEntries.length}`,
    role: "assistant",
    content: { blocks: [] },
    rawContent: "",
    commands: [],
    suggestions: [],
    actions: [],
    attachments: [],
    status: "confirmed",
    timestamp: "12:00",
    toolRenderEntries,
  };
}

function makeJobEntry(
  jobId: string,
  overrides: Partial<{
    part: Extract<PresentedMessage["toolRenderEntries"][number], { kind: "job-status" }>["part"];
    descriptor: CapabilityPresentationDescriptor;
    resultEnvelope: Extract<PresentedMessage["toolRenderEntries"][number], { kind: "job-status" }>["resultEnvelope"];
    computedActions: Extract<PresentedMessage["toolRenderEntries"][number], { kind: "job-status" }>["computedActions"];
  }> = {},
): PresentedMessage["toolRenderEntries"][number] {
  const toolName = overrides.part?.toolName ?? overrides.descriptor?.toolName ?? "produce_blog_article";
  const descriptor = overrides.descriptor
    ?? (toolName === "draft_content" ? queuedDescriptor : deferredDescriptor);

  return {
    kind: "job-status",
    part: {
      type: "job_status",
      jobId,
      toolName,
      label: descriptor.label,
      status: "running",
      updatedAt: "2026-04-08T12:00:00.000Z",
      progressLabel: "Generating outline",
      progressPercent: 18,
      ...("part" in overrides ? overrides.part : {}),
    },
    descriptor,
    resultEnvelope: overrides.resultEnvelope ?? null,
    computedActions: overrides.computedActions,
  };
}

describe("resolveProgressStrip", () => {
  it("keeps the newest eligible job per jobId and sorts attention before running before queued", () => {
    const messages = [
      makeMessage([
        makeJobEntry("job_running", {
          part: {
            type: "job_status",
            jobId: "job_running",
            toolName: "produce_blog_article",
            label: "Produce Blog Article",
            status: "running",
            sequence: 1,
            progressLabel: "Generating outline",
            progressPercent: 18,
            updatedAt: "2026-04-08T12:00:00.000Z",
          },
        }),
      ]),
      makeMessage([
        makeJobEntry("job_failed", {
          descriptor: {
            ...deferredDescriptor,
            toolName: "publish_content",
            label: "Publish Content",
          },
          part: {
            type: "job_status",
            jobId: "job_failed",
            toolName: "publish_content",
            label: "Publish Content",
            status: "failed",
            sequence: 2,
            updatedAt: "2026-04-08T12:01:00.000Z",
            summary: "Publishing needs another run.",
          },
        }),
      ]),
      makeMessage([
        makeJobEntry("job_running", {
          part: {
            type: "job_status",
            jobId: "job_running",
            toolName: "produce_blog_article",
            label: "Produce Blog Article",
            status: "running",
            sequence: 3,
            progressLabel: "Reviewing article",
            progressPercent: 42,
            updatedAt: "2026-04-08T12:02:00.000Z",
          },
        }),
      ]),
      makeMessage([
        makeJobEntry("job_queued", {
          part: {
            type: "job_status",
            jobId: "job_queued",
            toolName: "draft_content",
            label: "Draft Content",
            status: "queued",
            sequence: 1,
            updatedAt: "2026-04-08T12:03:00.000Z",
          },
        }),
      ]),
    ];

    const items = resolveProgressStrip(messages, (toolName) => {
      if (toolName === "publish_content") {
        return {
          ...deferredDescriptor,
          toolName,
          label: "Publish Content",
        };
      }

      if (toolName === "draft_content") {
        return queuedDescriptor;
      }

      return deferredDescriptor;
    });

    expect(items.map((item) => item.jobId)).toEqual([
      "job_failed",
      "job_running",
      "job_queued",
    ]);
    expect(items[0]).toMatchObject({
      label: "Publish Content",
      status: "failed",
      statusText: "Needs attention",
      canRetryWholeJob: true,
    });
    expect(items[1]).toMatchObject({
      progressPercent: 42,
      phaseLabel: "Reviewing article",
      statusText: "Reviewing article 42%",
    });
    expect(items[2]).toMatchObject({
      status: "queued",
      statusText: "Queued",
    });
  });

  it("ignores succeeded, superseded, and descriptor-ineligible job entries", () => {
    const messages = [
      makeMessage([
        makeJobEntry("job_done", {
          part: {
            type: "job_status",
            jobId: "job_done",
            toolName: "produce_blog_article",
            label: "Produce Blog Article",
            status: "succeeded",
            updatedAt: "2026-04-08T12:00:00.000Z",
          },
        }),
        makeJobEntry("job_superseded", {
          part: {
            type: "job_status",
            jobId: "job_superseded",
            toolName: "produce_blog_article",
            label: "Produce Blog Article",
            status: "running",
            supersededByJobId: "job_newer",
            updatedAt: "2026-04-08T12:01:00.000Z",
          },
        }),
        makeJobEntry("job_inline", {
          descriptor: inlineDescriptor,
          part: {
            type: "job_status",
            jobId: "job_inline",
            toolName: "generate_graph",
            label: "Generate Graph",
            status: "running",
            updatedAt: "2026-04-08T12:02:00.000Z",
          },
        }),
      ]),
    ];

    expect(resolveProgressStrip(messages, () => deferredDescriptor)).toEqual([]);
  });

  it("does not revive stale running entries after the same job succeeds", () => {
    const messages = [
      makeMessage([
        makeJobEntry("job_done", {
          part: {
            type: "job_status",
            jobId: "job_done",
            toolName: "produce_blog_article",
            label: "Produce Blog Article",
            status: "running",
            sequence: 1,
            progressLabel: "Generating article",
            progressPercent: 55,
            updatedAt: "2026-04-08T12:00:00.000Z",
          },
        }),
      ]),
      makeMessage([
        makeJobEntry("job_done", {
          part: {
            type: "job_status",
            jobId: "job_done",
            toolName: "produce_blog_article",
            label: "Produce Blog Article",
            status: "succeeded",
            sequence: 2,
            updatedAt: "2026-04-08T12:01:00.000Z",
          },
        }),
      ]),
    ];

    expect(resolveProgressStrip(messages, () => deferredDescriptor)).toEqual([]);
  });

  it("partitions visible and overflow items with explicit desktop and mobile caps", () => {
    const items = [
      makeJobEntry("job-1"),
      makeJobEntry("job-2"),
      makeJobEntry("job-3"),
      makeJobEntry("job-4"),
    ].map((entry) => resolveProgressStrip([makeMessage([entry])], () => deferredDescriptor)[0]);

    const desktopLayout = resolveProgressStripLayout(items, "desktop");
    const mobileLayout = resolveProgressStripLayout(items, "mobile");

    expect(desktopLayout.visibleCap).toBe(DESKTOP_PROGRESS_STRIP_VISIBLE_CAP);
    expect(desktopLayout.visibleItems).toHaveLength(DESKTOP_PROGRESS_STRIP_VISIBLE_CAP);
    expect(desktopLayout.overflowItems).toHaveLength(1);

    expect(mobileLayout.visibleCap).toBe(MOBILE_PROGRESS_STRIP_VISIBLE_CAP);
    expect(mobileLayout.visibleItems).toHaveLength(MOBILE_PROGRESS_STRIP_VISIBLE_CAP);
    expect(mobileLayout.overflowItems).toHaveLength(2);
  });

  it("does not surface stale active progress text for failed jobs", () => {
    const messages = [
      makeMessage([
        makeJobEntry("job_failed", {
          part: {
            type: "job_status",
            jobId: "job_failed",
            toolName: "produce_blog_article",
            label: "Produce Blog Article",
            status: "failed",
            sequence: 5,
            progressLabel: null,
            progressPercent: null,
            updatedAt: "2026-04-08T12:05:00.000Z",
            error: "Request timed out.",
          },
          resultEnvelope: {
            schemaVersion: 1,
            toolName: "produce_blog_article",
            family: "editorial",
            cardKind: "editorial_workflow",
            executionMode: "deferred",
            inputSnapshot: { brief: "Launch Plan" },
            summary: { title: "Launch Plan" },
            progress: {
              percent: 50,
              label: "Resolving QA findings",
              phases: [
                { key: "resolve_blog_article_qa", label: "Resolving QA findings", status: "active", percent: 50 },
              ],
              activePhaseKey: "resolve_blog_article_qa",
            },
            payload: null,
          },
        }),
      ]),
    ];

    const [item] = resolveProgressStrip(messages, () => deferredDescriptor);
    expect(item).toMatchObject({
      status: "failed",
      statusText: "Needs attention",
      phaseLabel: null,
      progressPercent: null,
    });
  });

  it("does not advertise whole-job retry for synthetic browser runtime jobs", () => {
    const messages = [
      makeMessage([
        makeJobEntry("browser:msg_1:compose_media:18", {
          part: {
            type: "job_status",
            jobId: "browser:msg_1:compose_media:18",
            toolName: "produce_blog_article",
            label: "Produce Blog Article",
            status: "failed",
            updatedAt: "2026-04-08T12:06:00.000Z",
          },
        }),
      ]),
    ];

    const [item] = resolveProgressStrip(messages, () => deferredDescriptor);
    expect(item).toMatchObject({
      jobId: "browser:msg_1:compose_media:18",
      canRetryWholeJob: false,
    });
  });

  it("prefers the deferred replacement when a synthetic browser job is superseded", () => {
    const messages = [
      makeMessage([
        makeJobEntry("browser:msg_1:compose_media:18", {
          descriptor: {
            ...deferredDescriptor,
            toolName: "compose_media",
            label: "Compose Media",
            executionMode: "hybrid",
          },
          part: {
            type: "job_status",
            jobId: "browser:msg_1:compose_media:18",
            toolName: "compose_media",
            label: "Compose Media",
            status: "failed",
            supersededByJobId: "job_media_deferred_18",
            updatedAt: "2026-04-08T12:06:00.000Z",
          },
        }),
        makeJobEntry("job_media_deferred_18", {
          descriptor: {
            ...deferredDescriptor,
            toolName: "compose_media",
            label: "Compose Media",
            executionMode: "deferred",
          },
          part: {
            type: "job_status",
            jobId: "job_media_deferred_18",
            toolName: "compose_media",
            label: "Compose Media",
            status: "queued",
            updatedAt: "2026-04-08T12:06:05.000Z",
          },
        }),
      ]),
    ];

    const items = resolveProgressStrip(messages, (toolName) => {
      if (toolName === "compose_media") {
        return {
          ...deferredDescriptor,
          toolName,
          label: "Compose Media",
          executionMode: "hybrid",
        };
      }

      return deferredDescriptor;
    });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      jobId: "job_media_deferred_18",
      status: "queued",
      label: "Compose Media",
    });
  });
});