import { describe, expect, it } from "vitest";

import type { JobStatusMessagePart } from "@/core/entities/message-parts";

import {
  compareJobRenderCandidateFreshness,
  type JobRenderCandidate,
} from "./JobRenderCandidateMerger";

function part(overrides: Partial<JobStatusMessagePart> = {}): JobStatusMessagePart {
  return {
    type: "job_status",
    jobId: "job_1",
    toolName: "admin_web_search",
    label: "Admin Web Search",
    status: "running",
    sequence: 1,
    updatedAt: "2026-04-30T15:00:00.000Z",
    ...overrides,
  };
}

function candidate(
  overrides: Partial<JobStatusMessagePart> = {},
  candidateOverrides: Partial<JobRenderCandidate> = {},
): JobRenderCandidate {
  return {
    part: part(overrides),
    encounterOrder: 0,
    ...candidateOverrides,
  };
}

describe("JobRenderCandidateMerger", () => {
  it("prefers higher sequence", () => {
    expect(compareJobRenderCandidateFreshness(
      candidate({ sequence: 1 }),
      candidate({ sequence: 2 }),
    )).toBeLessThan(0);
  });

  it("prefers later updatedAt when sequence ties", () => {
    expect(compareJobRenderCandidateFreshness(
      candidate({ sequence: 2, updatedAt: "2026-04-30T15:00:00.000Z" }),
      candidate({ sequence: 2, updatedAt: "2026-04-30T15:01:00.000Z" }),
    )).toBeLessThan(0);
  });

  it("prefers terminal status when sequence and updatedAt tie", () => {
    expect(compareJobRenderCandidateFreshness(
      candidate({ sequence: 2, status: "running", updatedAt: "2026-04-30T15:00:00.000Z" }),
      candidate({ sequence: 2, status: "succeeded", updatedAt: "2026-04-30T15:00:00.000Z" }),
    )).toBeLessThan(0);
  });

  it("prefers result-bearing candidates when sequence and updatedAt tie", () => {
    expect(compareJobRenderCandidateFreshness(
      candidate({ sequence: 3, status: "succeeded", updatedAt: "2026-04-30T15:00:00.000Z" }),
      candidate({
        sequence: 3,
        status: "succeeded",
        updatedAt: "2026-04-30T15:00:00.000Z",
        resultPayload: { answer: "done" },
      }),
    )).toBeLessThan(0);
  });

  it("prefers explicit candidates over equivalent nested candidates", () => {
    expect(compareJobRenderCandidateFreshness(
      candidate({ sequence: 3, status: "succeeded" }, { source: "nested" }),
      candidate({ sequence: 3, status: "succeeded" }, { source: "explicit" }),
    )).toBeLessThan(0);
  });

  it("uses encounter order as the final deterministic tie breaker", () => {
    expect(compareJobRenderCandidateFreshness(
      candidate({ sequence: 3, status: "running" }, { encounterOrder: 1 }),
      candidate({ sequence: 3, status: "running" }, { encounterOrder: 2 }),
    )).toBeLessThan(0);
  });
});