import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { JobQueueDataMapper } from "@/adapters/JobQueueDataMapper";
import { ensureSchema } from "@/lib/db/schema";
import {
  KEITH_BASELINE_CONVERSATION_ID,
  KEITH_BASELINE_JOB_EVENTS,
  KEITH_BASELINE_TOOL_NAME,
  KEITH_BASELINE_USER_ID,
} from "./fixtures/chat-job-event-baseline";

function createDb() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  ensureSchema(db);
  return db;
}

function seedConversation(db: Database.Database) {
  db.prepare(`INSERT INTO users (id, email, name) VALUES (?, ?, ?)`)
    .run(KEITH_BASELINE_USER_ID, "keith@firehose360.com", "Keith");
  db.prepare(
    `INSERT INTO conversations (id, user_id, title, status, session_source)
     VALUES (?, ?, 'Keith baseline', 'active', 'authenticated')`,
  ).run(KEITH_BASELINE_CONVERSATION_ID, KEITH_BASELINE_USER_ID);
}

describe("chat job event delivery baseline evidence", () => {
  it("records one durable web-search job with queued, started, and result events", async () => {
    const db = createDb();
    seedConversation(db);
    const repo = new JobQueueDataMapper(db);

    const job = await repo.createJob({
      conversationId: KEITH_BASELINE_CONVERSATION_ID,
      userId: KEITH_BASELINE_USER_ID,
      toolName: KEITH_BASELINE_TOOL_NAME,
      requestPayload: { query: "current market evidence" },
    });

    await repo.appendEvent({
      jobId: job.id,
      conversationId: KEITH_BASELINE_CONVERSATION_ID,
      eventType: "queued",
      payload: { status: "queued" },
    });
    await repo.updateJobStatus(job.id, {
      status: "running",
      progressPercent: 40,
      progressLabel: "Searching the web",
      startedAt: "2026-04-30T15:01:00.000Z",
    });
    await repo.appendEvent({
      jobId: job.id,
      conversationId: KEITH_BASELINE_CONVERSATION_ID,
      eventType: "started",
      payload: { status: "running", progressPercent: 40 },
    });
    await repo.updateJobStatus(job.id, {
      status: "succeeded",
      progressPercent: 100,
      progressLabel: "Complete",
      completedAt: "2026-04-30T15:04:00.000Z",
      resultPayload: { answer: "Sourced research summary." },
    });
    await repo.appendEvent({
      jobId: job.id,
      conversationId: KEITH_BASELINE_CONVERSATION_ID,
      eventType: "result",
      payload: { status: "succeeded", result: { answer: "Sourced research summary." } },
    });

    const jobs = await repo.listJobsByConversation(KEITH_BASELINE_CONVERSATION_ID);
    const events = await repo.listEventsForJob(job.id);

    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      id: job.id,
      toolName: KEITH_BASELINE_TOOL_NAME,
      status: "succeeded",
      resultPayload: { answer: "Sourced research summary." },
    });
    expect(events.map((event) => ({ eventType: event.eventType, sequence: event.sequence }))).toEqual(
      KEITH_BASELINE_JOB_EVENTS,
    );
  });
});
