import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf-8");
}

describe("TD-A — job visibility transcript cohesion", () => {
  it("P1: transcript viewport delegates message rendering without jobs page concerns", () => {
    const viewport = readSource("src/frameworks/ui/ChatMessageViewport.tsx");

    expect(viewport).toContain("from \"./MessageList\"");
    expect(viewport).not.toContain("JobsPagePanel");
    expect(viewport).not.toContain("/api/jobs");
  });

  it("P2: message list renders job-status parts inside message rendering", () => {
    const messageList = readSource("src/frameworks/ui/MessageList.tsx");

    expect(messageList).toContain('case "job-status"');
    expect(messageList).toContain("RichContentRenderer");
  });
});

describe("TD-A — job visibility state locality", () => {
  it("P3: jobs page panel monolith replaced by admin BREAD surface", () => {
    // JobsPagePanel.tsx was deleted in Sprint 5 (D5.6).
    // The admin jobs Browse + Detail pages now handle job visibility.
    const browsePage = readSource("src/app/admin/jobs/page.tsx");
    expect(browsePage).toContain("AdminSection");
    expect(browsePage).toContain("loadAdminJobList");
    expect(browsePage).not.toContain("ConversationDataMapper");
    expect(browsePage).not.toContain("MessageDataMapper");
    expect(browsePage).not.toContain("getDb(");
  });
});

describe("TD-A — job visibility read-model encapsulation", () => {
  it("P4: list route stays on repository and read-model abstractions", () => {
    const route = readSource("src/app/api/jobs/route.ts");

    // Route now uses getJobStatusQuery (read-model query) and getActiveJobStatuses
    // instead of the older getJobQueueRepository + buildCanonicalJobSnapshot pattern
    expect(route).toContain("getPlatformInteractionFacade");
    expect(route).toContain("getActiveJobStatuses");
    expect(route).not.toContain("ConversationDataMapper");
    expect(route).not.toContain("MessageDataMapper");
    expect(route).not.toContain("getDb(");
  });

  it("P5: detail routes use the projector composition root instead of mapper setup", () => {
    const memberRoute = readSource("src/app/api/jobs/[jobId]/route.ts");
    const chatRoute = readSource("src/app/api/chat/jobs/[jobId]/route.ts");
    const interactionFacadeRoot = readSource("src/lib/platform/agent-platform-facade-root.ts");

    expect(memberRoute).toContain("getPlatformInteractionFacade");
    expect(chatRoute).toContain("getPlatformInteractionFacade");

    expect(memberRoute).not.toContain("ConversationDataMapper");
    expect(memberRoute).not.toContain("MessageDataMapper");
    expect(memberRoute).not.toContain("getDb(");

    expect(chatRoute).not.toContain("ConversationDataMapper");
    expect(chatRoute).not.toContain("MessageDataMapper");
    expect(chatRoute).not.toContain("getDb(");

    expect(interactionFacadeRoot).toContain("getAgentPlatformFacade");
  });
});

describe("TD-A — event transport modularity findings", () => {
  it("P6: user event stream route delegates polling and SSE formatting to the shared stream module", () => {
    const route = readSource("src/app/api/jobs/events/route.ts");
    const stream = readSource("src/lib/jobs/job-event-stream.ts");

    expect(route).toContain("requireAuthenticatedUser");
    expect(route).toContain("listUserEvents");
    expect(route).toContain("createJobEventStreamResponse");
    expect(route).not.toContain("encodeJobEvent");
    expect(route).not.toContain("mapJobEventPayload");
    expect(route).not.toContain("new ReadableStream");

    expect(stream).toContain("export function createJobEventStreamResponse");
    expect(stream).toContain("encodeJobEvent");
    expect(stream).toContain("mapJobEventPayload");
  });

  it("P7: per-job event history route delegates projection shaping to a presenter module", () => {
    const route = readSource("src/app/api/jobs/[jobId]/events/route.ts");
    const presenter = readSource("src/lib/jobs/job-event-history.ts");

    expect(route).toContain("requireAuthenticatedUser");
    expect(route).toContain("ensureUserOwnsConversationJob");
    expect(route).toContain("getUserJobHistoryInteraction");
    expect(route).not.toContain("projectJobForEvent");
    expect(route).not.toContain("buildJobStatusPartFromProjection");

    expect(presenter).toContain("projectJobForEvent");
    expect(presenter).toContain("buildJobStatusPartFromProjection");
  });
});

describe("TD-A — job visibility runtime preservation", () => {
  it("P8: deferred job flows do not depend on the deleted transcript projector root", () => {
    const runtime = readSource("src/lib/jobs/deferred-job-runtime.ts");
    const worker = readSource("src/lib/jobs/deferred-job-worker.ts");

    expect(runtime).not.toContain("createDeferredJobConversationProjector");
    expect(worker).not.toContain("DeferredJobConversationProjector");
  });

  it("P9: job read model still exposes snapshot construction", async () => {
    const readModel = await import("@/lib/jobs/job-read-model");

    expect(readModel.buildCanonicalJobSnapshot).toBeTypeOf("function");
    expect(readModel.getActiveJobStatuses).toBeTypeOf("function");
  });
});
