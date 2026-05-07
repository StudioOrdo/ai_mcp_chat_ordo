import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const {
  getSessionUserMock,
  executeDirectChatTurnMock,
} = vi.hoisted(() => ({
  getSessionUserMock: vi.fn(),
  executeDirectChatTurnMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getSessionUser: getSessionUserMock,
}));

vi.mock("@/lib/chat/chat-turn", () => ({
  executeDirectChatTurn: executeDirectChatTurnMock,
}));

import { ChatProviderError } from "@/lib/chat/provider-decorators";
import { POST } from "@/app/api/chat/route";
import { createRouteRequest } from "../helpers/workflow-route-fixture";

describe("POST /api/chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionUserMock.mockResolvedValue({
      id: "usr_1",
      roles: ["AUTHENTICATED"],
    });
    executeDirectChatTurnMock.mockResolvedValue("ok");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 400 for empty messages", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");

    const response = await POST(createRouteRequest("http://localhost/api/chat", "POST", { messages: [] }) as never);
    const payload = (await response.json()) as { error: string; errorCode: string; requestId: string };

    expect(response.status).toBe(400);
    expect(payload.error).toContain("messages must be a non-empty array");
    expect(payload.errorCode).toBe("VALIDATION_ERROR");
    expect(payload.requestId).toBeTruthy();
    expect(getSessionUserMock).not.toHaveBeenCalled();
    expect(executeDirectChatTurnMock).not.toHaveBeenCalled();
  });

  it("returns 400 when no user message exists", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");

    const response = await POST(
      createRouteRequest("http://localhost/api/chat", "POST", {
        messages: [{ role: "assistant", content: "ready" }],
      }) as never,
    );

    const payload = (await response.json()) as { error: string; errorCode: string; requestId: string };

    expect(response.status).toBe(400);
    expect(payload.error).toContain("No user message found");
    expect(payload.errorCode).toBe("VALIDATION_ERROR");
    expect(payload.requestId).toBeTruthy();
    expect(getSessionUserMock).not.toHaveBeenCalled();
    expect(executeDirectChatTurnMock).not.toHaveBeenCalled();
  });

  it("returns 400 when user content is blank after trimming", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");

    const response = await POST(
      createRouteRequest("http://localhost/api/chat", "POST", {
        messages: [{ role: "user", content: "   " }],
      }) as never,
    );

    const payload = (await response.json()) as { error: string; errorCode: string; requestId: string };

    expect(response.status).toBe(400);
    expect(payload.error).toContain("messages must include non-empty user or assistant content");
    expect(payload.errorCode).toBe("VALIDATION_ERROR");
    expect(payload.requestId).toBeTruthy();
    expect(getSessionUserMock).not.toHaveBeenCalled();
    expect(executeDirectChatTurnMock).not.toHaveBeenCalled();
  });

  it("returns 200 and forwards request context when direct-turn execution succeeds", async () => {
    const response = await POST(
      createRouteRequest("http://localhost/api/chat", "POST", {
        messages: [{ role: "user", content: "hello" }],
      }) as never,
    );

    const payload = (await response.json()) as {
      reply: string;
      requestId: string;
    };

    expect(response.status).toBe(200);
    expect(payload.reply).toBe("ok");
    expect(payload.requestId).toBeTruthy();
    expect(getSessionUserMock).toHaveBeenCalledTimes(1);
    expect(executeDirectChatTurnMock).toHaveBeenCalledWith(
      expect.objectContaining({
        incomingMessages: [{ role: "user", content: "hello" }],
        user: { id: "usr_1", roles: ["AUTHENTICATED"] },
        route: "/api/chat",
        requestId: expect.any(String),
      }),
    );
  });

  it("returns 500 when direct-turn provider execution fails", async () => {
    executeDirectChatTurnMock.mockRejectedValueOnce(
      new ChatProviderError("Intelligence provider error: Provider request timed out."),
    );

    const response = await POST(
      createRouteRequest("http://localhost/api/chat", "POST", {
        messages: [{ role: "user", content: "hello" }],
      }) as never,
    );

    const payload = (await response.json()) as {
      error: string;
      errorCode: string;
      requestId: string;
    };

    expect(response.status).toBe(500);
    expect(payload.error).toContain(
      "Intelligence provider error: Provider request timed out.",
    );
    expect(payload.errorCode).toBe("INTERNAL_ERROR");
    expect(payload.requestId).toBeTruthy();
    expect(getSessionUserMock).toHaveBeenCalledTimes(1);
    expect(executeDirectChatTurnMock).toHaveBeenCalledTimes(1);
  });
});
