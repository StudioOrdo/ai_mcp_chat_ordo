import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf-8");
}

describe("TD-C — job visibility SRP", () => {
  it("P1: jobs page serves the signed-in self-service workspace", () => {
    const page = readSource("src/app/jobs/page.tsx");

    expect(page).toContain("loadUserJobsWorkspace");
    expect(page).toContain("<JobsWorkspace");
    expect(page).toContain('redirect("/login")');
    expect(page).not.toContain('redirect("/admin/jobs")');
    expect(page).not.toContain("getJobQueueRepository");
    expect(page).not.toContain("buildJobStatusSnapshot");
    expect(page).not.toContain("findLatestEventForJob");
  });

  it("P2: user and chat job read routes delegate snapshot assembly to the read query", () => {
    const userListRoute = readSource("src/app/api/jobs/route.ts");
    const userDetailRoute = readSource("src/app/api/jobs/[jobId]/route.ts");
    const chatListRoute = readSource("src/app/api/chat/jobs/route.ts");
    const chatDetailRoute = readSource("src/app/api/chat/jobs/[jobId]/route.ts");

    for (const source of [userListRoute, userDetailRoute, chatListRoute, chatDetailRoute]) {
      expect(source).toContain("getJobStatusQuery");
      expect(source).not.toContain("findLatestEventForJob");
    }
  });
});

describe("TD-C — job visibility DIP and ISP", () => {
  it("P3: job status tools depend on JobStatusQuery rather than the mutable queue repository", () => {
    const tools = readSource("src/core/use-cases/tools/deferred-job-status.tool.ts");

    expect(tools).toContain('import type { JobStatusQuery }');
    expect(tools).not.toContain('import type { JobQueueRepository }');
    expect(tools).not.toContain("findLatestEventForJob");
    expect(tools).not.toContain("buildJobStatusSnapshot");
  });

  it("P4: repository factory exposes a read query facade for job snapshot consumers", () => {
    const factory = readSource("src/adapters/RepositoryFactory.ts");
    const query = readSource("src/lib/jobs/job-status-query.ts");

    expect(factory).toContain("export function getJobStatusQuery()");
    expect(query).toContain("class RepositoryBackedJobStatusQuery");
    expect(query).toContain("listUserJobSnapshots");
    expect(query).toContain("listConversationJobSnapshots");
    expect(query).toContain("getUserJobSnapshot");
  });
});

describe("TD-C — job visibility OCP", () => {
  it("P5: Jobs remains a data-driven shell route and account-menu extension", () => {
    const shellNavigation = readSource("src/lib/shell/shell-navigation.ts");

    expect(shellNavigation).toContain('id: "jobs"');
    expect(shellNavigation).toContain('ACCOUNT_MENU_ROUTE_IDS = ["jobs", "my-media", "operations-media", "profile"]');
    expect(shellNavigation).not.toContain('if (route.id === "jobs")');
  });

  it("P6: role directives extend signed-in status guidance without sending anonymous users to /jobs", () => {
    const directives = readSource("src/core/entities/role-directive-assembler.ts");
    const jobStatusStrategy = readSource("src/core/entities/job-status-response-strategy.ts");

    expect(directives).toContain('const jobAudience = role === "ANONYMOUS" ? "anonymous" : "signed-in"');
    expect(directives).toContain("getJobStatusDirectiveLines(jobAudience)");
    expect(jobStatusStrategy).toContain('When useful, signed-in users can review the full operational view at /jobs.');
    expect(jobStatusStrategy).toContain('If the user asks about job status, keep the answer chat-native and sign-in-aware. Do not send them to /jobs because that route is only useful after sign-in.');
  });
});

describe("TD-C — job visibility behavioral preservation", () => {
  it("P7: the read-query module exists", () => {
    expect(existsSync(join(process.cwd(), "src/lib/jobs/job-status-query.ts"))).toBe(true);
  });

  it("P8: read-query factory returns the expected methods", async () => {
    const mod = await import("@/lib/jobs/job-status-query");
    const query = mod.createJobStatusQuery({
      findJobById: async () => null,
      findLatestEventForJob: async () => null,
      findLatestRenderableEventForJob: async () => null,
      listJobsByConversation: async () => [],
      listJobsByUser: async () => [],
    } as never);

    expect(query.getJobSnapshot).toBeTypeOf("function");
    expect(query.getUserJobSnapshot).toBeTypeOf("function");
    expect(query.listConversationJobSnapshots).toBeTypeOf("function");
    expect(query.listUserJobSnapshots).toBeTypeOf("function");
  });
});