import { describe, expect, it } from "vitest";

import type { JobStatusMessagePart } from "@/core/entities/message-parts";

import { buildJobStatusActions } from "./JobActionResolvers";

function makePart(status: JobStatusMessagePart["status"]): JobStatusMessagePart {
  return {
    type: "job_status",
    jobId: "job_1",
    toolName: "produce_blog_article",
    label: "Produce Blog Article",
    status,
  };
}

describe("buildJobStatusActions", () => {
  it("returns a recover label for dead-letter jobs", () => {
    expect(buildJobStatusActions(makePart("dead_letter"))).toEqual([
      expect.objectContaining({
        type: "action-link",
        label: "Recover job",
        actionType: "job",
        value: "job_1",
        params: { operation: "retry" },
      }),
    ]);
  });

  it("retains cancel control for running jobs", () => {
    expect(buildJobStatusActions(makePart("running"))).toEqual([
      expect.objectContaining({
        label: "Cancel",
        params: { operation: "cancel" },
      }),
    ]);
  });
});