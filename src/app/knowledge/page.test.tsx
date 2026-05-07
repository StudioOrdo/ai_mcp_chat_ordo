import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getSessionUserMock,
  loadKnowledgeBaseWorkspaceMock,
  redirectMock,
  workspaceMock,
} = vi.hoisted(() => ({
  getSessionUserMock: vi.fn(),
  loadKnowledgeBaseWorkspaceMock: vi.fn(),
  redirectMock: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
  workspaceMock: vi.fn((props: { userName: string; workspace: { objects: unknown[] } }) => (
    <div data-testid="knowledge-base-workspace">{props.userName}:{props.workspace.objects.length}</div>
  )),
}));

vi.mock("@/lib/auth", () => ({
  getSessionUser: getSessionUserMock,
}));

vi.mock("@/lib/knowledge/load-knowledge-base-workspace", () => ({
  loadKnowledgeBaseWorkspace: loadKnowledgeBaseWorkspaceMock,
}));

vi.mock("@/components/knowledge/KnowledgeBaseWorkspace", () => ({
  KnowledgeBaseWorkspace: workspaceMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

import KnowledgeBasePage from "@/app/knowledge/page";

describe("/knowledge page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects anonymous visitors to login", async () => {
    getSessionUserMock.mockResolvedValue({
      id: "usr_anon",
      email: "anon@example.com",
      name: "Anon",
      roles: ["ANONYMOUS"],
    });

    await expect(KnowledgeBasePage()).rejects.toThrow("redirect:/login");
    expect(redirectMock).toHaveBeenCalledWith("/login");
    expect(loadKnowledgeBaseWorkspaceMock).not.toHaveBeenCalled();
  });

  it("renders the signed-in Knowledge Base owner surface", async () => {
    const user = {
      id: "usr_1",
      email: "keith@example.com",
      name: "Keith",
      roles: ["AUTHENTICATED"],
      tier: "account",
    };
    getSessionUserMock.mockResolvedValue(user);
    loadKnowledgeBaseWorkspaceMock.mockResolvedValue({ objects: [{ id: "knowledge_1" }] });

    render(await KnowledgeBasePage({ searchParams: Promise.resolve({ q: "brief", audience: "account" }) }));

    expect(loadKnowledgeBaseWorkspaceMock).toHaveBeenCalledWith(user, { q: "brief", audience: "account" });
    expect(screen.getByTestId("knowledge-base-workspace")).toHaveTextContent("Keith:1");
  });
});
