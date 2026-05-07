import { NextRequest } from "next/server";
import { vi } from "vitest";
import { createConversationRoutingSnapshot } from "@/core/entities/conversation-routing";
import { SystemPromptBuilder } from "@/core/use-cases/SystemPromptBuilder";

type StreamRouteUser = {
  id: string;
  email: string;
  name: string;
  roles: string[];
};

type StreamRouteConversation = {
  id: string;
  userId: string;
  title: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  convertedFrom: string | null;
  messageCount: number;
  firstMessageAt: string | null;
  lastToolUsed: string | null;
  sessionSource: string;
  promptVersion: string | null;
  routingSnapshot: ReturnType<typeof createConversationRoutingSnapshot>;
};

type StreamRouteConversationState = {
  conversation: StreamRouteConversation;
  messages: Array<Record<string, unknown>>;
};

type MockControl = {
  mockResolvedValue(value: unknown): unknown;
  mockReturnValue(value: unknown): unknown;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock control signature requires flexible args
  mockImplementation(fn: (...args: any[]) => unknown): unknown;
};

export function createStreamRouteContextWindowGuard(
  overrides: Partial<{
    status: "ok" | "warn" | "block";
    reasons: string[];
    rawMessageCount: number;
    rawCharacterCount: number;
    finalMessageCount: number;
    finalCharacterCount: number;
    warnMessageCount: number;
    warnCharacterCount: number;
    maxMessageCount: number;
    maxCharacterCount: number;
  }> = {},
) {
  return {
    status: "ok" as const,
    reasons: [],
    rawMessageCount: 0,
    rawCharacterCount: 0,
    finalMessageCount: 0,
    finalCharacterCount: 0,
    warnMessageCount: 32,
    warnCharacterCount: 64_000,
    maxMessageCount: 40,
    maxCharacterCount: 80_000,
    ...overrides,
  };
}

export type StreamRouteMockSet = {
  getSessionUserMock: MockControl;
  resolveUserIdMock: MockControl;
  ensureActiveMock: MockControl;
  appendMessageMock: MockControl;
  getConversationMock: MockControl;
  updateRoutingSnapshotMock: MockControl;
  recordToolUsedMock: MockControl;
  getActiveForUserMock: MockControl;
  analyzeRoutingMock: MockControl;
  summarizeIfNeededMock: MockControl;
  buildContextWindowMock: MockControl;
  buildGuardedContextWindowMock: MockControl;
  buildContextWindowGuardPromptMock: MockControl;
  runClaudeAgentLoopStreamMock: MockControl;
  createSystemPromptBuilderMock: MockControl;
  looksLikeMathMock: MockControl;
  getSchemasForRoleMock: MockControl;
  getPromptVisibleSchemasForRoleMock?: MockControl;
  toolExecutorFactoryMock: MockControl;
  getByIdMock: MockControl;
  assignConversationMock: MockControl;
};

export function createStreamRouteUser(
  overrides: Partial<StreamRouteUser> = {},
): StreamRouteUser {
  return {
    id: "usr_anonymous",
    email: "anonymous@example.com",
    name: "Anonymous User",
    roles: ["ANONYMOUS"],
    ...overrides,
  };
}

export function createStreamRouteConversation(
  overrides: Partial<StreamRouteConversation> = {},
): StreamRouteConversation {
  return {
    id: "conv_test",
    userId: "usr_anonymous",
    title: "",
    status: "active",
    createdAt: "2026-03-18T10:00:00.000Z",
    updatedAt: "2026-03-18T10:00:00.000Z",
    convertedFrom: null,
    messageCount: 1,
    firstMessageAt: null,
    lastToolUsed: null,
    sessionSource: "anonymous_cookie",
    promptVersion: null,
    routingSnapshot: createConversationRoutingSnapshot(),
    ...overrides,
  };
}

export function createStreamRouteConversationState(
  overrides: {
    conversation?: Partial<StreamRouteConversation>;
    messages?: Array<Record<string, unknown>>;
  } = {},
): StreamRouteConversationState {
  return {
    conversation: createStreamRouteConversation(overrides.conversation),
    messages: overrides.messages ?? [],
  };
}

export function seedChatStreamRouteMocks(mocks: StreamRouteMockSet): void {
  mocks.getSessionUserMock.mockResolvedValue(createStreamRouteUser());
  mocks.resolveUserIdMock.mockResolvedValue({
    userId: "usr_anonymous",
    isAnonymous: true,
  });
  mocks.ensureActiveMock.mockResolvedValue(createStreamRouteConversation());
  mocks.appendMessageMock.mockResolvedValue({
    id: "msg_1",
    conversationId: "conv_test",
    role: "user",
    content: "",
  });
  mocks.getConversationMock.mockResolvedValue(createStreamRouteConversationState());
  mocks.updateRoutingSnapshotMock.mockResolvedValue(undefined);
  mocks.recordToolUsedMock.mockResolvedValue(undefined);
  mocks.getActiveForUserMock.mockResolvedValue(createStreamRouteConversationState());
  mocks.analyzeRoutingMock.mockResolvedValue(
    createConversationRoutingSnapshot({
      lane: "organization",
      confidence: 0.91,
      recommendedNextStep:
        "Frame the next response around advisory scoping, workflow architecture, and organizational discovery.",
      detectedNeedSummary:
        "Signals point to an organizational workflow or team enablement need: workflow, team.",
      lastAnalyzedAt: "2026-03-18T10:05:00.000Z",
    }),
  );
  mocks.summarizeIfNeededMock.mockResolvedValue(undefined);
  mocks.buildContextWindowMock.mockReturnValue({
    contextMessages: [],
    hasSummary: false,
    summaryText: null,
    guard: createStreamRouteContextWindowGuard(),
  });
  mocks.buildGuardedContextWindowMock.mockImplementation(
    (messages: Array<{ role: "user" | "assistant"; content: string }>) => ({
      contextMessages: messages,
      guard: createStreamRouteContextWindowGuard({
        rawMessageCount: messages.length,
        finalMessageCount: messages.length,
        rawCharacterCount: messages.reduce((sum, message) => sum + message.content.length, 0),
        finalCharacterCount: messages.reduce((sum, message) => sum + message.content.length, 0),
      }),
    }),
  );
  mocks.buildContextWindowGuardPromptMock.mockReturnValue(null);
  mocks.runClaudeAgentLoopStreamMock.mockImplementation(
    async ({ callbacks }: { callbacks: { onDelta: (text: string) => void } }) => {
      callbacks.onDelta("stub reply");
    },
  );
  mocks.createSystemPromptBuilderMock.mockImplementation(async () => {
    const builder = new SystemPromptBuilder().withSection({
      key: "identity",
      content: "base system prompt",
      priority: 10,
    });

    return Object.assign(builder, {
      buildResult: vi.fn(async () => ({
        surface: "chat_stream" as const,
        text: builder.build(),
        effectiveHash: "hash_stream_route_prompt",
        slotRefs: [],
        sections: [],
        warnings: [],
      })),
    });
  });
  mocks.looksLikeMathMock.mockImplementation(
    (text: string) => text.includes("+"),
  );
  mocks.getSchemasForRoleMock.mockReturnValue([]);
  mocks.getPromptVisibleSchemasForRoleMock?.mockReturnValue([]);
  mocks.toolExecutorFactoryMock.mockReturnValue(() => undefined);
  mocks.getByIdMock.mockResolvedValue({
    file: {
      id: "uf_1",
      userId: "usr_anonymous",
      conversationId: null,
      fileName: "brief.txt",
      mimeType: "text/plain",
      fileSize: 5,
    },
    diskPath: "/tmp/brief.txt",
  });
  mocks.assignConversationMock.mockResolvedValue(undefined);
}

export function createStreamRouteRequest(
  body: unknown,
  options?: {
    headers?: HeadersInit;
    cookies?: Record<string, string>;
  },
) {
  const headers = new Headers(options?.headers);

  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  if (options?.cookies && Object.keys(options.cookies).length > 0) {
    const cookieHeader = Object.entries(options.cookies)
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
    headers.set("cookie", cookieHeader);
  }

  return new NextRequest(new URL("http://localhost/api/chat/stream"), {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}
