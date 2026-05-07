import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getSessionUserMock,
  loadUserJobsWorkspaceMock,
  redirectMock,
  workspaceMock,
} = vi.hoisted(() => ({
  getSessionUserMock: vi.fn(),
  loadUserJobsWorkspaceMock: vi.fn(),
  redirectMock: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
  workspaceMock: vi.fn(({
    userName,
    jobs,
    selectedJobId,
    selectedJobHistory,
  }: {
    userName: string;
    jobs: unknown[];
    selectedJobId: string | null;
    selectedJobHistory: unknown[];
  }) => (
    <div data-testid="jobs-workspace">{userName}:{jobs.length}:{selectedJobId}:{selectedJobHistory.length}</div>
  )),
}));

vi.mock("@/lib/auth", () => ({
  getSessionUser: getSessionUserMock,
}));

vi.mock("@/lib/jobs/load-user-jobs-workspace", () => ({
  loadUserJobsWorkspace: loadUserJobsWorkspaceMock,
}));

vi.mock("@/components/jobs/JobsWorkspace", () => ({
  JobsWorkspace: workspaceMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

import JobsPage from "@/app/jobs/page";

describe("/jobs page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects anonymous visitors to login", async () => {
    getSessionUserMock.mockResolvedValue({ id: "usr_anon", email: "anon@example.com", name: "Anon", roles: ["ANONYMOUS"] });

    await expect(JobsPage()).rejects.toThrow("redirect:/login");
    expect(redirectMock).toHaveBeenCalledWith("/login");
  });

  it("renders the signed-in jobs workspace for apprentices", async () => {
    getSessionUserMock.mockResolvedValue({ id: "usr_apprentice", email: "apprentice@example.com", name: "Apprentice", roles: ["APPRENTICE"] });
    loadUserJobsWorkspaceMock.mockResolvedValue({
      jobs: [
        {
          messageId: "jobmsg_1",
          conversationId: "conv_jobs",
          part: {
            type: "job_status",
            jobId: "job_1",
            toolName: "prepare_journal_post_for_publish",
            label: "Prepare Journal Post For Publish",
            status: "running",
            updatedAt: "2026-03-30T09:00:00.000Z",
          },
        },
      ],
      selectedJobId: "job_1",
      selectedJob: null,
      selectedJobHistory: [{ id: "evt_1" }],
      query: { jobId: "job_1" },
      pageInfo: { total: 1 },
    });

    render(await JobsPage({ searchParams: Promise.resolve({ jobId: "job_1" }) }));

    expect(loadUserJobsWorkspaceMock).toHaveBeenCalledWith("usr_apprentice", { jobId: "job_1" });
    expect(screen.getByTestId("jobs-workspace")).toHaveTextContent("Apprentice:1:job_1:1");
  });
});
