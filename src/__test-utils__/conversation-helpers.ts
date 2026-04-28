/**
 * Conversation mock factories for chat-related tests.
 *
 * Absorbs tests/helpers/conversation-interactor-fixture.ts
 * and tests/helpers/conversation-route-fixture.ts.
 */
import { vi } from "vitest";
import { NextRequest } from "next/server";
import { createConversationRoutingSnapshot } from "@/core/entities/conversation-routing";

type MockFunction = (...args: never[]) => unknown;

type ConversationInteractorMock = {
  getActiveForUser: MockFunction;
  list: MockFunction;
  get: MockFunction;
  create: MockFunction;
  archive: MockFunction;
  restore: MockFunction;
};

type ConversationRuntimeServices = {
  getConversationInteractor: MockFunction;
  getConversationEventDataMapper: MockFunction;
};

/** Standard session token for route-level tests. */
export const TEST_SESSION_TOKEN = "test-session-token";

/**
 * Create a mock conversation interactor with safe defaults.
 * Override individual methods to control per-test behavior.
 */
export function createConversationInteractorMock(overrides: {
  getActiveForUser?: MockFunction;
  list?: MockFunction;
  get?: MockFunction;
  create?: MockFunction;
  archive?: MockFunction;
  restore?: MockFunction;
} = {}): ConversationInteractorMock {
  return {
    getActiveForUser: overrides.getActiveForUser ?? vi.fn().mockResolvedValue(null),
    list: overrides.list ?? vi.fn().mockResolvedValue([]),
    get: overrides.get ?? vi.fn().mockResolvedValue(null),
    create: overrides.create ?? vi.fn(),
    archive: overrides.archive ?? vi.fn(),
    restore: overrides.restore ?? vi.fn(),
  };
}

/**
 * Create a mock for `createConversationRuntimeServices` used by the
 * chat stream route handler.
 */
export function createConversationRuntimeServicesMock(overrides: {
  getConversationInteractor?: MockFunction;
  getConversationEventDataMapper?: MockFunction;
} = {}): () => ConversationRuntimeServices {
  return vi.fn(() => ({
    getConversationInteractor: overrides.getConversationInteractor ?? vi.fn(),
    getConversationEventDataMapper: overrides.getConversationEventDataMapper ?? vi.fn(),
  }));
}

// ---------------------------------------------------------------------------
// Conversation route fixture helpers
// (Absorbed from tests/helpers/conversation-route-fixture.ts)
// ---------------------------------------------------------------------------

/** Build a minimal validated session user for route tests. */
export function createValidatedSessionUser(overrides: Record<string, unknown> = {}) {
  return { id: "usr_123", ...overrides };
}

/** Build a NextRequest for conversation API routes with optional session cookie. */
export function createConversationRouteRequest(
  path: string,
  method: "GET" | "POST" | "PATCH" | "DELETE" = "GET",
  includeSession = true,
  body?: unknown,
) {
  const headers = includeSession
    ? {
        cookie: `lms_session_token=${TEST_SESSION_TOKEN}`,
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
      }
    : undefined;

  return new NextRequest(new URL(path, "http://localhost:3000"), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/** Build route params with a conversation ID wrapped in a Promise. */
export function createConversationRouteParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

/** Build a mock active conversation result. */
export function createActiveConversationResult(
  overrides: {
    conversation?: Record<string, unknown>;
    messages?: Array<Record<string, unknown>>;
  } = {},
) {
  return {
    conversation: {
      id: "conv_1",
      routingSnapshot: createConversationRoutingSnapshot({
        lane: "organization",
        confidence: 0.84,
      }),
      ...overrides.conversation,
    },
    messages: overrides.messages ?? [{ id: "msg_1", content: "Hello" }],
  };
}

/** Build a mock for `createConversationRouteServices` with all interactor methods. */
export function createConversationRouteServicesMock(overrides: {
  getActiveForUser?: unknown;
  archiveActive?: unknown;
  list?: unknown;
  ensureActive?: unknown;
  get?: unknown;
  exportConversation?: unknown;
  importConversation?: unknown;
  delete?: unknown;
  rename?: unknown;
  archive?: unknown;
  restore?: unknown;
  purge?: unknown;
} = {}) {
  return {
    interactor: {
      getActiveForUser: overrides.getActiveForUser,
      archiveActive: overrides.archiveActive,
      list: overrides.list,
      ensureActive: overrides.ensureActive,
      get: overrides.get,
      exportConversation: overrides.exportConversation,
      importConversation: overrides.importConversation,
      delete: overrides.delete,
      rename: overrides.rename,
      archive: overrides.archive,
      restore: overrides.restore,
      purge: overrides.purge,
    },
  };
}
