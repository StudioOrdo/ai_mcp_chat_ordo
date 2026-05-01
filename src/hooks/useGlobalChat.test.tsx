import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Message } from "@/core/entities/conversation";
import { createConversationRoutingSnapshot } from "@/core/entities/conversation-routing";
import type { CanonicalJobSnapshot } from "@/lib/jobs/job-read-model";
import { useState } from "react";

const { fetchStreamMock, usePathnameMock } = vi.hoisted(() => ({
  fetchStreamMock: vi.fn(),
  usePathnameMock: vi.fn(),
}));

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
  }
}

vi.mock("@/adapters/StreamProviderFactory", () => ({
  getChatStreamProvider: () => ({
    fetchStream: fetchStreamMock,
  }),
}));

vi.mock("next/navigation", () => ({
  usePathname: usePathnameMock,
}));

vi.mock("@/hooks/chat/useCurrentPageMemento", () => {
  let currentPathname = "/";
  return {
    useCurrentPageMemento: (pathname: string) => {
      currentPathname = pathname;
      return {
        getSnapshot: () => ({
          pathname: currentPathname,
          title: "Test Page",
          mainHeading: null,
          sectionHeadings: [],
          selectedText: null,
          contentExcerpt: null,
        }),
        start: () => {},
        stop: () => {},
        setPathname: (p: string) => { currentPathname = p; },
      };
    },
  };
});

import { ChatProvider, useGlobalChat } from "./useGlobalChat";

function ChatProbe() {
  const chat = useGlobalChat();
  const firstJobSnapshot = chat.jobStateEntries[0];

  return (
    <div>
      <div data-testid="message-count">{chat.messages.length}</div>
      <div data-testid="first-message">{chat.messages[0]?.content ?? ""}</div>
      <div data-testid="first-job-status">{firstJobSnapshot?.status ?? "none"}</div>
      <div data-testid="first-job-summary">{firstJobSnapshot?.summary ?? ""}</div>
      <div data-testid="conversation-id">{chat.conversationId ?? "none"}</div>
      <div data-testid="conversation-lane">{chat.routingSnapshot?.lane ?? "none"}</div>
      <div data-testid="loading-state">{String(chat.isLoadingMessages)}</div>
      <button type="button" onClick={() => void chat.sendMessage("Send this") }>
        send
      </button>
      <button
        type="button"
        onClick={() =>
          void chat.sendMessage("Review the lead queue", [], {
            sourceBlockId: "lead_queue",
            sourceContextId: "lead-queue:header",
          })
        }
      >
        send-task-origin
      </button>
      <button
        type="button"
        onClick={() =>
          void chat.sendMessage("", [
            new File(["brief"], "brief.txt", { type: "text/plain" }),
          ])
        }
      >
        send-attachment
      </button>
    </div>
  );
}

function renderChatProvider(initialRole: "ANONYMOUS" | "AUTHENTICATED" | "STAFF" | "ADMIN" = "ANONYMOUS") {
  return render(
    <ChatProvider initialRole={initialRole}>
      <ChatProbe />
    </ChatProvider>,
  );
}

function createNoReferralVisitResponse() {
  return {
    status: 404,
    ok: false,
    json: async () => ({ error: "No referral visit" }),
  };
}

function createWorkspaceRestoreResponse(options: {
  conversation: {
    id: string;
    userId: string;
    title: string;
    status: "active" | "archived";
    updatedAt: string;
    routingSnapshot: {
      detectedNeedSummary: string | null;
      recommendedNextStep: string | null;
    };
    [key: string]: unknown;
  };
  messages: Array<{
    id: string;
    role: "user" | "assistant" | "system";
    content: string;
    parts: Message["parts"];
    createdAt: string;
  }>;
  activeJobs?: CanonicalJobSnapshot[];
  attentionNeededJobs?: CanonicalJobSnapshot[];
}) {
  const { conversation, messages } = options;

  return {
    workspace: {
      id: `workspace:${conversation.id}`,
      userId: conversation.userId,
      conversationId: conversation.id,
      status: conversation.status,
      title: conversation.title,
      currentObjective: conversation.routingSnapshot.detectedNeedSummary ?? null,
      recommendedNextStep: conversation.routingSnapshot.recommendedNextStep ?? null,
      openLoops: [],
      activeJobRefs: [],
      importantAssetRefs: [],
      workflowContextRef: null,
      operatorTransitionRef: null,
      trustDistributionRef: null,
      relatedBusinessRefs: [],
      latestMemoryRef: null,
      latestPromptBindingRef: null,
      updatedAt: conversation.updatedAt,
    },
    activeJobs: options.activeJobs ?? [],
    attentionNeededJobs: options.attentionNeededJobs ?? [],
    assets: [],
    workflow: null,
    operatorTransition: null,
    trustDistribution: null,
    memory: null,
    recentTranscript: messages.map((message) => ({
      ...message,
      conversationId: conversation.id,
      tokenEstimate: 0,
    })),
    migration: null,
    restoreMeta: {
      schemaVersion: 1,
      restoredAt: conversation.updatedAt,
      source: "durable_read_model" as const,
    },
  };
}

function jobSnapshot(overrides: Partial<CanonicalJobSnapshot> = {}): CanonicalJobSnapshot {
  const jobId = overrides.jobId ?? "job_1";
  return {
    jobId,
    conversationId: overrides.conversationId ?? "conv_active",
    userId: overrides.userId ?? "usr_123",
    toolName: overrides.toolName ?? "draft_content",
    label: overrides.label ?? "Draft Content",
    status: overrides.status ?? "succeeded",
    sequence: overrides.sequence ?? 1,
    summary: overrides.summary,
    createdAt: overrides.createdAt ?? "2026-03-15T10:00:00.000Z",
    startedAt: overrides.startedAt ?? null,
    completedAt: overrides.completedAt ?? null,
    updatedAt: overrides.updatedAt ?? "2026-03-15T10:00:01.000Z",
    origin: overrides.origin ?? { originMessageId: "job_job_1", fallback: "explicit_origin" },
    inputSnapshot: overrides.inputSnapshot ?? {},
    resultPayload: overrides.resultPayload,
    resultEnvelope: overrides.resultEnvelope ?? null,
    artifactRefs: overrides.artifactRefs ?? [],
    materializationRefs: overrides.materializationRefs ?? [],
    ownership: overrides.ownership ?? { userId: "usr_123", visibility: "owner", initiatorType: "user" },
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

describe("ChatProvider active conversation restore", () => {
  const fetchMock = vi.fn();
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    window.history.replaceState({}, "", "/");
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("EventSource", MockEventSource as unknown as typeof EventSource);
    fetchMock.mockReset();
    fetchStreamMock.mockReset();
    usePathnameMock.mockImplementation(() => window.location.pathname);
    MockEventSource.instances = [];
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    errorSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it("refreshes the bootstrap copy when the initial role changes across a client transition", async () => {
    fetchMock.mockResolvedValue({
      status: 404,
      ok: false,
      json: async () => ({ error: "No active conversation" }),
    });

    function RoleSwitcher() {
      const [role, setRole] = useState<"ANONYMOUS" | "AUTHENTICATED">("ANONYMOUS");

      return (
        <>
          <button type="button" onClick={() => setRole("AUTHENTICATED")}>switch-role</button>
          <ChatProvider initialRole={role}>
            <ChatProbe />
          </ChatProvider>
        </>
      );
    }

    render(<RoleSwitcher />);

    expect(screen.getByTestId("first-message")).toHaveTextContent("Bring me the next decision, messy idea, or customer problem");

    fireEvent.click(screen.getByRole("button", { name: "switch-role" }));

    await waitFor(() => {
      expect(screen.getByTestId("first-message")).toHaveTextContent("Welcome back. Bring me the customer workflow");
    });
  });

  it("seeds customer-friendly bootstrap copy for authenticated users", () => {
    fetchMock.mockResolvedValue({
      status: 404,
      ok: false,
      json: async () => ({ error: "No active conversation" }),
    });

    renderChatProvider("AUTHENTICATED");

    expect(screen.getByTestId("first-message")).toHaveTextContent("Welcome back. Bring me the customer workflow");
    expect(screen.getByTestId("first-message")).toHaveTextContent("Recommend my next step");
    expect(screen.getByTestId("first-message")).toHaveTextContent("Turn this into a training plan");
  });

  it("seeds operator-focused bootstrap copy for admins", () => {
    fetchMock.mockResolvedValue({
      status: 404,
      ok: false,
      json: async () => ({ error: "No active conversation" }),
    });

    renderChatProvider("ADMIN");

    expect(screen.getByTestId("first-message")).toHaveTextContent("Operator console is ready");
    expect(screen.getByTestId("first-message")).toHaveTextContent("Prioritize founder work");
    expect(screen.getByTestId("first-message")).toHaveTextContent("Check live market signal");
    expect(screen.getByTestId("first-message")).not.toHaveTextContent("Train my team");
  });

  it("hydrates messages and conversation id when an active conversation exists", async () => {
    fetchMock.mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => createWorkspaceRestoreResponse({
        conversation: {
          id: "conv_active",
          userId: "anon_123",
          title: "Restored",
          status: "active",
          createdAt: "2026-03-15T10:00:00.000Z",
          updatedAt: "2026-03-15T10:00:01.000Z",
          convertedFrom: null,
          messageCount: 2,
          firstMessageAt: "2026-03-15T10:00:00.000Z",
          lastToolUsed: null,
          sessionSource: "anonymous_cookie",
          promptVersion: null,
          routingSnapshot: createConversationRoutingSnapshot({
            lane: "organization",
            confidence: 0.88,
            recommendedNextStep: "Move to advisory scoping",
          }),
        },
        messages: [
          {
            id: "msg_1",
            role: "user",
            content: "Restored question",
            parts: [{ type: "text", text: "Restored question" }],
            createdAt: "2026-03-15T10:00:00.000Z",
          },
          {
            id: "msg_2",
            role: "assistant",
            content: "Restored answer",
            parts: [{ type: "text", text: "Restored answer" }],
            createdAt: "2026-03-15T10:00:01.000Z",
          },
        ],
      }),
    });

    renderChatProvider();

    await waitFor(() => {
      expect(screen.getByTestId("loading-state")).toHaveTextContent("false");
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/workspace/restore", undefined);
    expect(screen.getByTestId("message-count")).toHaveTextContent("2");
    expect(screen.getByTestId("first-message")).toHaveTextContent("Restored question");
    expect(screen.getByTestId("conversation-id")).toHaveTextContent("conv_active");
    expect(screen.getByTestId("conversation-lane")).toHaveTextContent("uncertain");
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("subscribes to deferred job events and updates canonical job state", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/chat/jobs?")) {
        return {
          status: 200,
          ok: true,
          json: async () => ({ jobs: [] }),
        };
      }

      return {
        status: 200,
        ok: true,
        json: async () => createWorkspaceRestoreResponse({
          conversation: {
            id: "conv_active",
            userId: "anon_123",
            title: "Restored",
            status: "active",
            createdAt: "2026-03-15T10:00:00.000Z",
            updatedAt: "2026-03-15T10:00:01.000Z",
            convertedFrom: null,
            messageCount: 0,
            firstMessageAt: null,
            lastToolUsed: null,
            sessionSource: "anonymous_cookie",
            promptVersion: null,
            routingSnapshot: createConversationRoutingSnapshot(),
            referralSource: null,
          },
          messages: [],
        }),
      };
    });

    renderChatProvider();

    await waitFor(() => {
      expect(screen.getByTestId("conversation-id")).toHaveTextContent("conv_active");
    });

    const source = MockEventSource.instances[0];
    expect(source?.url).toBe("/api/chat/events?conversationId=conv_active&afterSequence=0");

    source?.onmessage?.({
      data: JSON.stringify({
        type: "job_progress",
        jobId: "job_1",
        conversationId: "conv_active",
        sequence: 2,
        toolName: "draft_content",
        label: "Draft Content",
        progressPercent: 55,
        progressLabel: "Drafting",
      }),
    } as MessageEvent<string>);

    await waitFor(() => {
      expect(screen.getByTestId("first-job-status")).toHaveTextContent("running");
    });
  });

  it("rehydrates a completed deferred blog job after reload from the active conversation snapshot", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/chat/jobs?")) {
        return {
          status: 200,
          ok: true,
          json: async () => ({
            jobs: [
              jobSnapshot({
                jobId: "job_1",
                toolName: "draft_content",
                label: "Draft Content",
                status: "succeeded",
                summary: 'Draft "Deferred Queue Post" ready at /journal/deferred-queue-post.',
                resultPayload: {
                  id: "post_1",
                  slug: "deferred-queue-post",
                  title: "Deferred Queue Post",
                  status: "draft",
                },
              }),
            ],
          }),
        };
      }

      return {
        status: 200,
        ok: true,
        json: async () => createWorkspaceRestoreResponse({
          conversation: {
            id: "conv_active",
            userId: "usr_123",
            title: "Deferred blog",
            status: "active",
            createdAt: "2026-03-15T10:00:00.000Z",
            updatedAt: "2026-03-15T10:00:01.000Z",
            convertedFrom: null,
            messageCount: 1,
            firstMessageAt: "2026-03-15T10:00:00.000Z",
            lastToolUsed: "draft_content",
            sessionSource: "authenticated",
            promptVersion: null,
            routingSnapshot: createConversationRoutingSnapshot(),
            referralSource: null,
          },
          messages: [
            {
              id: "job_job_1",
              role: "assistant",
              content: "",
              parts: [
                {
                  type: "job_status",
                  jobId: "job_1",
                  toolName: "draft_content",
                  label: "Draft Content",
                  status: "succeeded",
                  summary: 'Draft "Deferred Queue Post" ready at /journal/deferred-queue-post.',
                  resultPayload: {
                    id: "post_1",
                    slug: "deferred-queue-post",
                    title: "Deferred Queue Post",
                    status: "draft",
                  },
                },
              ],
              createdAt: "2026-03-15T10:00:01.000Z",
            },
          ],
        }),
      };
    });

    renderChatProvider("AUTHENTICATED");

    await waitFor(() => {
      expect(screen.getByTestId("loading-state")).toHaveTextContent("false");
    });

    expect(screen.getByTestId("message-count")).toHaveTextContent("1");
    await waitFor(() => {
      expect(screen.getByTestId("first-job-status")).toHaveTextContent("succeeded");
    });
    expect(screen.getByTestId("first-job-summary")).toHaveTextContent('Draft "Deferred Queue Post" ready at /journal/deferred-queue-post.');
  });

  it("handles live job_canceled events from the EventSource stream", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/chat/jobs?")) {
        return {
          status: 200,
          ok: true,
          json: async () => ({ jobs: [] }),
        };
      }

      return {
        status: 200,
        ok: true,
        json: async () => createWorkspaceRestoreResponse({
          conversation: {
            id: "conv_active",
            userId: "anon_123",
            title: "Restored",
            status: "active",
            createdAt: "2026-03-15T10:00:00.000Z",
            updatedAt: "2026-03-15T10:00:01.000Z",
            convertedFrom: null,
            messageCount: 0,
            firstMessageAt: null,
            lastToolUsed: null,
            sessionSource: "anonymous_cookie",
            promptVersion: null,
            routingSnapshot: createConversationRoutingSnapshot(),
            referralSource: null,
          },
          messages: [],
        }),
      };
    });

    renderChatProvider();

    await waitFor(() => {
      expect(screen.getByTestId("conversation-id")).toHaveTextContent("conv_active");
    });

    await waitFor(() => {
      expect(MockEventSource.instances.length).toBeGreaterThan(0);
    });

    const source = MockEventSource.instances[0];
    expect(source).toBeDefined();
    source.onmessage?.({
      data: JSON.stringify({
        type: "job_canceled",
        jobId: "job_1",
        conversationId: "conv_active",
        sequence: 3,
        toolName: "draft_content",
        label: "Draft Content",
      }),
    } as MessageEvent<string>);

    await waitFor(() => {
      expect(screen.getByTestId("first-job-status")).toHaveTextContent("canceled");
    });
  });

  it("reconciles deferred jobs from the snapshot route on load", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/chat/jobs?conversationId=conv_active")) {
        return {
          status: 200,
          ok: true,
          json: async () => ({
            jobs: [
              jobSnapshot({
                jobId: "job_1",
                toolName: "produce_blog_article",
                label: "Produce Blog Article",
                status: "succeeded",
                summary: 'Produced draft "Launch Plan" at /journal/launch-plan with hero asset asset_1.',
                resultPayload: {
                  id: "post_1",
                  slug: "launch-plan",
                  title: "Launch Plan",
                  status: "draft",
                  imageAssetId: "asset_1",
                },
              }),
            ],
          }),
        };
      }

      return {
        status: 200,
        ok: true,
        json: async () => createWorkspaceRestoreResponse({
          conversation: {
            id: "conv_active",
            userId: "usr_123",
            title: "Deferred blog",
            status: "active",
            createdAt: "2026-03-15T10:00:00.000Z",
            updatedAt: "2026-03-15T10:00:01.000Z",
            convertedFrom: null,
            messageCount: 0,
            firstMessageAt: null,
            lastToolUsed: null,
            sessionSource: "authenticated",
            promptVersion: null,
            routingSnapshot: createConversationRoutingSnapshot(),
            referralSource: null,
          },
          messages: [],
        }),
      };
    });

    renderChatProvider("AUTHENTICATED");

    await waitFor(() => {
      expect(screen.getByTestId("conversation-id")).toHaveTextContent("conv_active");
    });

    await waitFor(() => {
      expect(screen.getByTestId("first-job-status")).toHaveTextContent("succeeded");
    });
    expect(screen.getByTestId("first-job-summary")).toHaveTextContent('Produced draft "Launch Plan" at /journal/launch-plan with hero asset asset_1.');
  });

  it("does not let restored transcript-only browser-runtime candidates execute on homepage restore", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/chat/jobs?")) {
        return {
          status: 200,
          ok: true,
          json: async () => ({ jobs: [] }),
        };
      }

      return {
        status: 200,
        ok: true,
        json: async () => ({
          workspace: {
            id: "workspace:conv_active",
            userId: "usr_123",
            conversationId: "conv_active",
            status: "active",
            title: "Restored media history",
            currentObjective: "Review restored media",
            recommendedNextStep: "Inspect the asset shelf",
            openLoops: [],
            activeJobRefs: [],
            importantAssetRefs: [],
            workflowContextRef: null,
            operatorTransitionRef: null,
            trustDistributionRef: null,
            relatedBusinessRefs: [],
            latestMemoryRef: null,
            latestPromptBindingRef: null,
            updatedAt: "2026-03-15T10:00:01.000Z",
          },
          activeJobs: [],
          attentionNeededJobs: [],
          assets: [],
          workflow: null,
          operatorTransition: null,
          trustDistribution: null,
          memory: null,
          migration: null,
          restoreMeta: {
            schemaVersion: 1,
            restoredAt: "2026-03-15T10:00:01.000Z",
            source: "durable_read_model",
          },
          recentTranscript: [
            {
              id: "msg_restored_browser_candidate",
              conversationId: "conv_active",
              role: "assistant",
              content: "",
              parts: [
                { type: "tool_call", name: "compose_media", args: { plan: { id: "plan_restore" } } },
                { type: "tool_result", name: "compose_media", result: { plan: { id: "plan_restore" } } },
              ],
              createdAt: "2026-03-15T10:00:01.000Z",
              tokenEstimate: 0,
            },
          ],
        }),
      };
    });

    renderChatProvider("AUTHENTICATED");

    await waitFor(() => {
      expect(screen.getByTestId("loading-state")).toHaveTextContent("false");
    });

    expect(screen.getByTestId("message-count")).toHaveTextContent("1");
    expect(screen.getByTestId("first-job-status")).toHaveTextContent("none");
  });

  it("restores a selected conversation when conversationId is present in the URL", async () => {
    window.history.replaceState({}, "", "/?conversationId=conv_selected");

    fetchMock.mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => createWorkspaceRestoreResponse({
        conversation: {
          id: "conv_selected",
          userId: "anon_123",
          title: "Selected thread",
          status: "archived",
          createdAt: "2026-03-15T10:00:00.000Z",
          updatedAt: "2026-03-15T10:00:01.000Z",
          convertedFrom: null,
          messageCount: 2,
          firstMessageAt: "2026-03-15T10:00:00.000Z",
          lastToolUsed: null,
          sessionSource: "anonymous_cookie",
          promptVersion: null,
          routingSnapshot: createConversationRoutingSnapshot({
            lane: "organization",
            confidence: 0.91,
            recommendedNextStep: "Resume review",
          }),
        },
        messages: [
          {
            id: "msg_selected_1",
            role: "user",
            content: "Selected question",
            parts: [{ type: "text", text: "Selected question" }],
            createdAt: "2026-03-15T10:00:00.000Z",
          },
          {
            id: "msg_selected_2",
            role: "assistant",
            content: "Selected answer",
            parts: [{ type: "text", text: "Selected answer" }],
            createdAt: "2026-03-15T10:00:01.000Z",
          },
        ],
      }),
    });

    renderChatProvider();

    await waitFor(() => {
      expect(screen.getByTestId("loading-state")).toHaveTextContent("false");
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/workspace/restore?conversationId=conv_selected", undefined);
    expect(screen.getByTestId("message-count")).toHaveTextContent("2");
    expect(screen.getByTestId("first-message")).toHaveTextContent("Selected question");
    expect(screen.getByTestId("conversation-id")).toHaveTextContent("conv_selected");
    expect(screen.getByTestId("conversation-lane")).toHaveTextContent("uncertain");
    expect(window.location.search).toBe("");
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("keeps a selected conversation stable after sending a new message", async () => {
    window.history.replaceState({}, "", "/?conversationId=conv_selected");

    fetchMock
      .mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => createWorkspaceRestoreResponse({
          conversation: {
            id: "conv_selected",
            userId: "anon_123",
            title: "Selected thread",
            status: "archived",
            createdAt: "2026-03-15T10:00:00.000Z",
            updatedAt: "2026-03-15T10:00:01.000Z",
            convertedFrom: null,
            messageCount: 2,
            firstMessageAt: "2026-03-15T10:00:00.000Z",
            lastToolUsed: null,
            sessionSource: "anonymous_cookie",
            promptVersion: null,
            routingSnapshot: createConversationRoutingSnapshot({
              lane: "organization",
              confidence: 0.91,
              recommendedNextStep: "Resume review",
            }),
          },
          messages: [
            {
              id: "msg_selected_1",
              role: "user",
              content: "Selected question",
              parts: [{ type: "text", text: "Selected question" }],
              createdAt: "2026-03-15T10:00:00.000Z",
            },
            {
              id: "msg_selected_2",
              role: "assistant",
              content: "Selected answer",
              parts: [{ type: "text", text: "Selected answer" }],
              createdAt: "2026-03-15T10:00:01.000Z",
            },
          ],
          }),
      })
      .mockResolvedValueOnce(createNoReferralVisitResponse())
      .mockResolvedValueOnce({
        status: 200,
        ok: true,
          json: async () => createWorkspaceRestoreResponse({
          conversation: {
            id: "conv_selected",
            userId: "anon_123",
            title: "Selected thread",
            status: "archived",
            createdAt: "2026-03-15T10:00:00.000Z",
            updatedAt: "2026-03-18T10:00:01.000Z",
            convertedFrom: null,
            messageCount: 4,
            firstMessageAt: "2026-03-15T10:00:00.000Z",
            lastToolUsed: null,
            sessionSource: "anonymous_cookie",
            promptVersion: null,
            routingSnapshot: createConversationRoutingSnapshot({
              lane: "organization",
              confidence: 0.92,
              recommendedNextStep: "Resume review",
            }),
          },
          messages: [
            {
              id: "msg_selected_1",
              role: "user",
              content: "Selected question",
              parts: [{ type: "text", text: "Selected question" }],
              createdAt: "2026-03-15T10:00:00.000Z",
            },
            {
              id: "msg_selected_2",
              role: "assistant",
              content: "Selected answer",
              parts: [{ type: "text", text: "Selected answer" }],
              createdAt: "2026-03-15T10:00:01.000Z",
            },
            {
              id: "msg_selected_3",
              role: "user",
              content: "Send this",
              parts: [{ type: "text", text: "Send this" }],
              createdAt: "2026-03-18T10:00:00.000Z",
            },
            {
              id: "msg_selected_4",
              role: "assistant",
              content: "Thread-specific reply",
              parts: [{ type: "text", text: "Thread-specific reply" }],
              createdAt: "2026-03-18T10:00:01.000Z",
            },
          ],
          }),
      });

    fetchStreamMock.mockResolvedValue({
      events: async function* () {
        yield { type: "text", delta: "Thread-specific reply" };
      },
    });

    renderChatProvider();

    await waitFor(() => {
      expect(screen.getByTestId("conversation-id")).toHaveTextContent("conv_selected");
    });

    fireEvent.click(screen.getByRole("button", { name: "send" }));

    await waitFor(() => {
      expect(fetchStreamMock).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ role: "user", content: "Send this" }),
        ]),
        expect.objectContaining({
          conversationId: "conv_selected",
          attachments: [],
        }),
      );
    });

    await waitFor(() => {
      expect(fetchMock.mock.calls.some((call) => call[0] === "/api/workspace/restore?conversationId=conv_selected")).toBe(true);
      expect(screen.getByTestId("conversation-id")).toHaveTextContent("conv_selected");
      expect(screen.getByTestId("message-count")).toHaveTextContent("4");
    });
  });

  it("falls back to the active conversation endpoint when a newly created thread is not yet restorable by id", async () => {
    fetchMock
      .mockResolvedValueOnce({
        status: 404,
        ok: false,
        json: async () => ({ error: "No active conversation" }),
      })
      .mockResolvedValueOnce(createNoReferralVisitResponse())
      .mockResolvedValueOnce({
        status: 404,
        ok: false,
        json: async () => ({ error: "Conversation not found" }),
      })
      .mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => createWorkspaceRestoreResponse({
          conversation: {
            id: "conv_new",
            userId: "anon_123",
            title: "Fresh thread",
            status: "active",
            createdAt: "2026-03-18T10:00:00.000Z",
            updatedAt: "2026-03-18T10:00:01.000Z",
            convertedFrom: null,
            messageCount: 2,
            firstMessageAt: "2026-03-18T10:00:00.000Z",
            lastToolUsed: null,
            sessionSource: "anonymous_cookie",
            promptVersion: null,
            routingSnapshot: createConversationRoutingSnapshot({
              lane: "individual",
              confidence: 0.89,
              recommendedNextStep: "Continue the new thread",
            }),
          },
          messages: [
            {
              id: "msg_new_1",
              role: "user",
              content: "Send this",
              parts: [{ type: "text", text: "Send this" }],
              createdAt: "2026-03-18T10:00:00.000Z",
            },
            {
              id: "msg_new_2",
              role: "assistant",
              content: "Fresh reply",
              parts: [{ type: "text", text: "Fresh reply" }],
              createdAt: "2026-03-18T10:00:01.000Z",
            },
          ],
          }),
      });

    fetchStreamMock.mockResolvedValue({
      events: async function* () {
        yield { type: "conversation_id", id: "conv_new" };
        yield { type: "text", delta: "Fresh reply" };
      },
    });

    renderChatProvider();

    await waitFor(() => {
      expect(screen.getByTestId("loading-state")).toHaveTextContent("false");
    });

    fireEvent.click(screen.getByRole("button", { name: "send" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/referral/visit");
      expect(fetchMock).toHaveBeenNthCalledWith(3, "/api/workspace/restore?conversationId=conv_new", undefined);
      expect(fetchMock).toHaveBeenNthCalledWith(4, "/api/workspace/restore", undefined);
      expect(screen.getByTestId("conversation-id")).toHaveTextContent("conv_new");
      expect(screen.getByTestId("message-count")).toHaveTextContent("2");
    });
  });

  it("keeps the hero state when no active conversation exists", async () => {
    fetchMock.mockResolvedValue({
      status: 404,
      ok: false,
      json: async () => ({ error: "No active conversation" }),
    });

    renderChatProvider();

    await waitFor(() => {
      expect(screen.getByTestId("loading-state")).toHaveTextContent("false");
    });

    expect(screen.getByTestId("message-count")).toHaveTextContent("1");
    expect(screen.getByTestId("first-message").textContent).toBeTruthy();
    expect(screen.getByTestId("conversation-id")).toHaveTextContent("none");
    expect(screen.getByTestId("conversation-lane")).toHaveTextContent("none");
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("keeps the hero state when active workspace restore returns 204", async () => {
    fetchMock.mockResolvedValue({
      status: 204,
      ok: true,
      json: async () => undefined,
    });

    renderChatProvider();

    await waitFor(() => {
      expect(screen.getByTestId("loading-state")).toHaveTextContent("false");
    });

    expect(screen.getByTestId("message-count")).toHaveTextContent("1");
    expect(screen.getByTestId("first-message")).toHaveTextContent("Bring me the next decision, messy idea, or customer problem");
    expect(screen.getByTestId("conversation-id")).toHaveTextContent("none");
    expect(screen.getByTestId("conversation-lane")).toHaveTextContent("none");
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("warns and keeps the hero state when restore unexpectedly returns 401", async () => {
    fetchMock.mockResolvedValue({
      status: 401,
      ok: false,
      json: async () => ({ error: "Authentication required" }),
    });

    renderChatProvider();

    await waitFor(() => {
      expect(screen.getByTestId("loading-state")).toHaveTextContent("false");
    });

    expect(screen.getByTestId("message-count")).toHaveTextContent("1");
    expect(screen.getByTestId("first-message").textContent).toBeTruthy();
    expect(screen.getByTestId("conversation-id")).toHaveTextContent("none");
    expect(screen.getByTestId("conversation-lane")).toHaveTextContent("none");
    expect(warnSpy).toHaveBeenCalledWith(
      "Active workspace restore unexpectedly required authentication.",
    );
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("keeps the hero state on network failure", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));

    renderChatProvider();

    await waitFor(() => {
      expect(screen.getByTestId("loading-state")).toHaveTextContent("false");
    });

    expect(screen.getByTestId("message-count")).toHaveTextContent("1");
    expect(screen.getByTestId("first-message").textContent).toBeTruthy();
    expect(screen.getByTestId("conversation-id")).toHaveTextContent("none");
    expect(screen.getByTestId("conversation-lane")).toHaveTextContent("none");
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("streams an assistant reply through the public sendMessage API", async () => {
    fetchMock
      .mockResolvedValueOnce({
        status: 404,
        ok: false,
        json: async () => ({ error: "No active conversation" }),
      })
      .mockResolvedValueOnce(createNoReferralVisitResponse())
      .mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => createWorkspaceRestoreResponse({
          conversation: {
            id: "conv_new",
            userId: "anon_123",
            title: "Send this",
            status: "active",
            createdAt: "2026-03-18T10:00:00.000Z",
            updatedAt: "2026-03-18T10:00:01.000Z",
            convertedFrom: null,
            messageCount: 2,
            firstMessageAt: "2026-03-18T10:00:00.000Z",
            lastToolUsed: null,
            sessionSource: "anonymous_cookie",
            promptVersion: null,
            routingSnapshot: createConversationRoutingSnapshot({ lane: "individual", confidence: 0.78 }),
          },
          messages: [
            {
              id: "msg_1",
              role: "user",
              content: "Send this",
              parts: [{ type: "text", text: "Send this" }],
              createdAt: "2026-03-18T10:00:00.000Z",
            },
            {
              id: "msg_2",
              role: "assistant",
              content: "Assistant reply",
              parts: [{ type: "text", text: "Assistant reply" }],
              createdAt: "2026-03-18T10:00:01.000Z",
            },
          ],
          }),
      });
    fetchStreamMock.mockResolvedValue({
      events: async function* () {
        yield { type: "conversation_id", id: "conv_new" };
        yield { type: "text", delta: "Assistant reply" };
      },
    });

    renderChatProvider();

    await waitFor(() => {
      expect(screen.getByTestId("loading-state")).toHaveTextContent("false");
    });

    fireEvent.click(screen.getByRole("button", { name: "send" }));

    await waitFor(() => {
      expect(fetchStreamMock).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ role: "user", content: "Send this" }),
        ]),
        expect.objectContaining({ attachments: [] }),
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId("conversation-id")).toHaveTextContent("conv_new");
      expect(screen.getByTestId("message-count")).toHaveTextContent("2");
    });
    expect(screen.getByTestId("conversation-lane")).toHaveTextContent("uncertain");
  });

  it("forwards the current pathname when sending from the register page", async () => {
    window.history.replaceState({}, "", "/register");

    fetchMock
      .mockResolvedValueOnce({
        status: 404,
        ok: false,
        json: async () => ({ error: "No active conversation" }),
      })
      .mockResolvedValueOnce(createNoReferralVisitResponse())
      .mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => createWorkspaceRestoreResponse({
          conversation: {
            id: "conv_register",
            userId: "anon_123",
            title: "Send this",
            status: "active",
            createdAt: "2026-03-18T10:00:00.000Z",
            updatedAt: "2026-03-18T10:00:01.000Z",
            convertedFrom: null,
            messageCount: 2,
            firstMessageAt: "2026-03-18T10:00:00.000Z",
            lastToolUsed: null,
            sessionSource: "anonymous_cookie",
            promptVersion: null,
            routingSnapshot: createConversationRoutingSnapshot({ lane: "individual", confidence: 0.78 }),
          },
          messages: [
            {
              id: "msg_1",
              role: "user",
              content: "Send this",
              parts: [{ type: "text", text: "Send this" }],
              createdAt: "2026-03-18T10:00:00.000Z",
            },
            {
              id: "msg_2",
              role: "assistant",
              content: "Register reply",
              parts: [{ type: "text", text: "Register reply" }],
              createdAt: "2026-03-18T10:00:01.000Z",
            },
          ],
          }),
      });
    fetchStreamMock.mockResolvedValue({
      events: async function* () {
        yield { type: "conversation_id", id: "conv_register" };
        yield { type: "text", delta: "Register reply" };
      },
    });

    renderChatProvider();

    await waitFor(() => {
      expect(screen.getByTestId("loading-state")).toHaveTextContent("false");
    });

    fireEvent.click(screen.getByRole("button", { name: "send" }));

    await waitFor(() => {
      expect(fetchStreamMock).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ role: "user", content: "Send this" }),
        ]),
        expect.objectContaining({
          attachments: [],
          currentPathname: "/register",
          currentPageSnapshot: expect.objectContaining({
            pathname: "/register",
          }),
        }),
      );
    });
  });

  it("updates the forwarded pathname after the route changes", async () => {
    let pathname = "/library";
    usePathnameMock.mockImplementation(() => pathname);

    fetchMock
      .mockResolvedValueOnce({
        status: 404,
        ok: false,
        json: async () => ({ error: "No active conversation" }),
      })
      .mockResolvedValueOnce(createNoReferralVisitResponse())
      .mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => createWorkspaceRestoreResponse({
          conversation: {
            id: "conv_route_change",
            userId: "anon_123",
            title: "Send this",
            status: "active",
            createdAt: "2026-03-18T10:00:00.000Z",
            updatedAt: "2026-03-18T10:00:01.000Z",
            convertedFrom: null,
            messageCount: 2,
            firstMessageAt: "2026-03-18T10:00:00.000Z",
            lastToolUsed: null,
            sessionSource: "anonymous_cookie",
            promptVersion: null,
            routingSnapshot: createConversationRoutingSnapshot({ lane: "individual", confidence: 0.78 }),
          },
          messages: [
            {
              id: "msg_1",
              role: "user",
              content: "Send this",
              parts: [{ type: "text", text: "Send this" }],
              createdAt: "2026-03-18T10:00:00.000Z",
            },
            {
              id: "msg_2",
              role: "assistant",
              content: "Route-aware reply",
              parts: [{ type: "text", text: "Route-aware reply" }],
              createdAt: "2026-03-18T10:00:01.000Z",
            },
          ],
          }),
      });
    fetchStreamMock.mockResolvedValue({
      events: async function* () {
        yield { type: "conversation_id", id: "conv_route_change" };
        yield { type: "text", delta: "Route-aware reply" };
      },
    });

    function PathnameRerenderHarness() {
      const [tick, setTick] = useState(0);

      return (
        <>
          <button type="button" onClick={() => setTick((value) => value + 1)}>
            rerender-pathname
          </button>
          <div data-testid="pathname-rerender-count">{tick}</div>
          <ChatProvider>
            <ChatProbe />
          </ChatProvider>
        </>
      );
    }

    render(<PathnameRerenderHarness />);

    await waitFor(() => {
      expect(screen.getByTestId("loading-state")).toHaveTextContent("false");
    });

    pathname = "/register";
    fireEvent.click(screen.getByRole("button", { name: "rerender-pathname" }));
    fireEvent.click(screen.getByRole("button", { name: "send" }));

    await waitFor(() => {
      expect(fetchStreamMock).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ role: "user", content: "Send this" }),
        ]),
        expect.objectContaining({
          attachments: [],
          currentPathname: "/register",
          currentPageSnapshot: expect.objectContaining({
            pathname: "/register",
          }),
        }),
      );
    });
  });

  it("forwards task-origin handoff metadata through the public sendMessage API", async () => {
    fetchMock
      .mockResolvedValueOnce({
        status: 404,
        ok: false,
        json: async () => ({ error: "No active conversation" }),
      })
      .mockResolvedValueOnce(createNoReferralVisitResponse())
      .mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => createWorkspaceRestoreResponse({
          conversation: {
            id: "conv_task_origin",
            userId: "anon_123",
            title: "Review the lead queue",
            status: "active",
            createdAt: "2026-03-18T10:00:00.000Z",
            updatedAt: "2026-03-18T10:00:01.000Z",
            convertedFrom: null,
            messageCount: 2,
            firstMessageAt: "2026-03-18T10:00:00.000Z",
            lastToolUsed: null,
            sessionSource: "anonymous_cookie",
            promptVersion: null,
            routingSnapshot: createConversationRoutingSnapshot({ lane: "organization", confidence: 0.86 }),
          },
          messages: [
            {
              id: "msg_1",
              role: "user",
              content: "Review the lead queue",
              parts: [{ type: "text", text: "Review the lead queue" }],
              createdAt: "2026-03-18T10:00:00.000Z",
            },
            {
              id: "msg_2",
              role: "assistant",
              content: "Lead-focused reply",
              parts: [{ type: "text", text: "Lead-focused reply" }],
              createdAt: "2026-03-18T10:00:01.000Z",
            },
          ],
          }),
      });
    fetchStreamMock.mockResolvedValue({
      events: async function* () {
        yield { type: "conversation_id", id: "conv_task_origin" };
        yield { type: "text", delta: "Lead-focused reply" };
      },
    });

    renderChatProvider();

    await waitFor(() => {
      expect(screen.getByTestId("loading-state")).toHaveTextContent("false");
    });

    fireEvent.click(screen.getByRole("button", { name: "send-task-origin" }));

    await waitFor(() => {
      expect(fetchStreamMock).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ role: "user", content: "Review the lead queue" }),
        ]),
        expect.objectContaining({
          attachments: [],
          currentPathname: "/",
          currentPageSnapshot: expect.objectContaining({
            pathname: "/",
          }),
          taskOriginHandoff: {
            sourceBlockId: "lead_queue",
            sourceContextId: "lead-queue:header",
          },
        }),
      );
    });
  });

  it("uploads attachments before streaming the message", async () => {
    fetchMock
      .mockResolvedValueOnce({
        status: 404,
        ok: false,
        json: async () => ({ error: "No active conversation" }),
      })
      .mockResolvedValueOnce(createNoReferralVisitResponse())
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          attachments: [
            {
              assetId: "uf_attachment",
              fileName: "brief.txt",
              mimeType: "text/plain",
              fileSize: 5,
            },
          ],
        }),
      });

    fetchStreamMock.mockResolvedValue({
      events: async function* () {
        yield { type: "conversation_id", id: "conv_upload" };
        yield { type: "text", delta: "Uploaded reply" };
      },
    });

    renderChatProvider();

    await waitFor(() => {
      expect(screen.getByTestId("loading-state")).toHaveTextContent("false");
    });

    fireEvent.click(screen.getByRole("button", { name: "send-attachment" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenLastCalledWith(
        "/api/chat/uploads",
        expect.objectContaining({ method: "POST" }),
      );
    });

    await waitFor(() => {
      expect(fetchStreamMock).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            role: "user",
            content: "Attachment: brief.txt",
          }),
        ]),
        expect.objectContaining({
          conversationId: undefined,
          currentPathname: "/",
          currentPageSnapshot: expect.objectContaining({
            pathname: "/",
          }),
          attachments: [
            {
              type: "attachment",
              assetId: "uf_attachment",
              fileName: "brief.txt",
              mimeType: "text/plain",
              fileSize: 5,
            },
          ],
        }),
      );
    });
  });

  it("does not start streaming when attachment upload fails", async () => {
    fetchMock
      .mockResolvedValueOnce({
        status: 404,
        ok: false,
        json: async () => ({ error: "No active conversation" }),
      })
      .mockResolvedValueOnce(createNoReferralVisitResponse())
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: "Upload failed" }),
      });

    renderChatProvider();

    await waitFor(() => {
      expect(screen.getByTestId("loading-state")).toHaveTextContent("false");
    });

    fireEvent.click(screen.getByRole("button", { name: "send-attachment" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenLastCalledWith(
        "/api/chat/uploads",
        expect.objectContaining({ method: "POST" }),
      );
    });

    expect(fetchStreamMock).not.toHaveBeenCalled();
  });

  it("preserves uploaded attachments for retry when streaming fails after upload", async () => {
    fetchMock
      .mockResolvedValueOnce({
        status: 404,
        ok: false,
        json: async () => ({ error: "No active conversation" }),
      })
      .mockResolvedValueOnce(createNoReferralVisitResponse())
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          attachments: [
            {
              assetId: "uf_attachment",
              fileName: "brief.txt",
              mimeType: "text/plain",
              fileSize: 5,
            },
          ],
        }),
      })
    fetchStreamMock.mockRejectedValue(new Error("stream down"));

    renderChatProvider();

    await waitFor(() => {
      expect(screen.getByTestId("loading-state")).toHaveTextContent("false");
    });

    fireEvent.click(screen.getByRole("button", { name: "send-attachment" }));

    await waitFor(() => {
      expect(fetchStreamMock).toHaveBeenCalled();
    });

    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/chat/uploads",
      expect.objectContaining({
        method: "DELETE",
      }),
    );
  });
});

describe("ChatProvider architecture", () => {
  it("keeps the ChatProvider module under 150 lines", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const filePath = path.resolve(__dirname, "useGlobalChat.tsx");
    const lines = fs.readFileSync(filePath, "utf-8").split("\n").length;
    expect(lines).toBeLessThanOrEqual(150);
  });

  it("keeps the ChatProvider function body under 100 lines", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const filePath = path.resolve(__dirname, "useGlobalChat.tsx");
    const source = fs.readFileSync(filePath, "utf-8");
    const lines = source.split("\n");
    const start = lines.findIndex((l) => l.includes("export function ChatProvider"));
    let depth = 0;
    let end = start;
    for (let i = start; i < lines.length; i++) {
      for (const ch of lines[i]) {
        if (ch === "{") depth++;
        if (ch === "}") depth--;
      }
      if (depth === 0 && i > start) {
        end = i;
        break;
      }
    }
    const functionLines = end - start + 1;
    expect(functionLines).toBeLessThanOrEqual(100);
  });
});
