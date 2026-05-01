import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf-8");
}

describe("TD-D — job visibility Repository and Facade", () => {
  it("P1: queue persistence remains behind repository ports and adapters", () => {
    const repositoryPort = readSource("src/core/use-cases/JobQueueRepository.ts");
    const repositoryFactory = readSource("src/adapters/RepositoryFactory.ts");

    expect(repositoryPort).toContain("export interface JobQueueRepository");
    expect(repositoryFactory).toContain("JobQueueDataMapper");
    expect(repositoryFactory).toContain("export function getJobQueueRepository()");
  });

  it("P2: job status query acts as a facade for read-model assembly", () => {
    const query = readSource("src/lib/jobs/job-status-query.ts");
    const route = readSource("src/app/api/jobs/route.ts");

    expect(query).toContain("class RepositoryBackedJobStatusQuery");
    expect(query).toContain("buildCanonicalJobSnapshot");
    expect(route).toContain("getPlatformInteractionFacade().listUserJobInteractions");
    expect(route).not.toContain("buildCanonicalJobSnapshot");
  });
});

describe("TD-D — job visibility Observer", () => {
  it("P3: event stream routes delegate SSE propagation to the shared observer-style stream module", () => {
    const userEventsRoute = readSource("src/app/api/jobs/events/route.ts");
    const chatEventsRoute = readSource("src/app/api/chat/events/route.ts");
    const streamModule = readSource("src/lib/jobs/job-event-stream.ts");

    expect(userEventsRoute).toContain("createJobEventStreamResponse");
    expect(chatEventsRoute).toContain("createJobEventStreamResponse");
    expect(streamModule).toContain("export function createJobEventStreamResponse");
    // JobsPagePanel was deleted in Sprint 5; SSE consumer now lives in client hooks
  });
});

describe("TD-D — job visibility Strategy", () => {
  it("P4: status-response guidance comes from explicit strategy objects and role-directive assembly", () => {
    const strategy = readSource("src/core/entities/job-status-response-strategy.ts");
    const assembler = readSource("src/core/entities/role-directive-assembler.ts");
    const directives = readSource("src/core/entities/role-directives.ts");
    const tools = readSource("src/core/use-cases/tools/deferred-job-status.tool.ts");

    expect(strategy).toContain("export interface JobStatusResponseStrategy");
    expect(strategy).toContain("class PlainLanguageStatusStrategy");
    expect(strategy).toContain("class ExplicitListStatusStrategy");
    expect(strategy).toContain("class AnonymousChatNativeStatusStrategy");

    expect(assembler).toContain('import { getJobStatusDirectiveLines } from "./job-status-response-strategy"');
    expect(assembler).toContain("lines.push(...getJobStatusDirectiveLines(jobAudience));");
    expect(directives).toContain('assembleRoleDirective("ANONYMOUS")');
    expect(directives).toContain('assembleRoleDirective("AUTHENTICATED")');
    expect(tools).toContain("buildJobStatusToolDescription");
  });

  it("P5: strategy helpers preserve the prose and list guidance contract", async () => {
    const mod = await import("@/core/entities/job-status-response-strategy");

    expect(mod.getJobStatusDirectiveLines("anonymous")).toContain(
      "If the user asks about job status, keep the answer chat-native and sign-in-aware. Do not send them to /jobs because that route is only useful after sign-in.",
    );
    expect(mod.getJobStatusDirectiveLines("signed-in")).toContain(
      "For job-status questions, answer in plain language by default.",
    );
    expect(mod.getJobStatusDirectiveLines("signed-in")).toContain(
      "Only render a concise list when the user explicitly asks for a list, all jobs, or every current job.",
    );
    expect(mod.buildJobStatusToolDescription({ audience: "signed-in", kind: "list", scope: "user" })).toContain(
      "explicitly asks for all jobs or a list",
    );
  });
});

describe("TD-D — job visibility runtime preservation", () => {
  it("P6: TD-D strategy module exists", () => {
    expect(existsSync(join(process.cwd(), "src/core/entities/job-status-response-strategy.ts"))).toBe(true);
  });
});
