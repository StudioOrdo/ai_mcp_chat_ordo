type JobStatusAudience = "anonymous" | "signed-in" | "admin";
type JobStatusToolKind = "single" | "list";
type JobStatusScope = "conversation" | "user";

export interface JobStatusResponseStrategy {
  readonly id: string;
  buildDirectiveLines(): string[];
}

class AnonymousChatNativeStatusStrategy implements JobStatusResponseStrategy {
  readonly id = "anonymous-chat-native";

  buildDirectiveLines(): string[] {
    return [
      "If the user asks about job status, keep the answer chat-native and sign-in-aware. Do not send them to /jobs because that route is only useful after sign-in.",
    ];
  }
}

class PlainLanguageStatusStrategy implements JobStatusResponseStrategy {
  readonly id = "plain-language-status";

  buildDirectiveLines(): string[] {
    return ["For job-status questions, answer in plain language by default."];
  }
}

class ExplicitListStatusStrategy implements JobStatusResponseStrategy {
  readonly id = "explicit-job-list";

  buildDirectiveLines(): string[] {
    return ["Only render a concise list when the user explicitly asks for a list, all jobs, or every current job."];
  }
}

class ReadOnlyStatusCheckStrategy implements JobStatusResponseStrategy {
  readonly id = "status-read-only";

  buildDirectiveLines(): string[] {
    return ["Do not start or repeat work when the user asked only for status."];
  }
}

class SignedInJobsPageStrategy implements JobStatusResponseStrategy {
  readonly id = "signed-in-jobs-page";

  buildDirectiveLines(): string[] {
    return ["When useful, signed-in users can review the full operational view at /jobs."];
  }
}

const ANONYMOUS_STATUS_STRATEGIES: readonly JobStatusResponseStrategy[] = [
  new AnonymousChatNativeStatusStrategy(),
];

const SIGNED_IN_STATUS_STRATEGIES: readonly JobStatusResponseStrategy[] = [
  new PlainLanguageStatusStrategy(),
  new ExplicitListStatusStrategy(),
  new ReadOnlyStatusCheckStrategy(),
  new SignedInJobsPageStrategy(),
];

export function getJobStatusResponseStrategies(audience: JobStatusAudience): readonly JobStatusResponseStrategy[] {
  switch (audience) {
    case "anonymous":
      return ANONYMOUS_STATUS_STRATEGIES;
    case "admin":
    case "signed-in":
      return SIGNED_IN_STATUS_STRATEGIES;
  }
}

export function getJobStatusDirectiveLines(audience: JobStatusAudience): string[] {
  return getJobStatusResponseStrategies(audience).flatMap((strategy) => strategy.buildDirectiveLines());
}

export function buildJobStatusToolDescription(options: {
  audience: Exclude<JobStatusAudience, "anonymous">;
  kind: JobStatusToolKind;
  scope: JobStatusScope;
}): string {
  const owner = options.audience === "admin" && options.scope === "conversation"
    ? "the current conversation"
    : "the signed-in user's account";

  // Appended to every description: clarify job_ IDs are not asset IDs.
  const assetIdNote =
    " IMPORTANT: The job ID (job_*) is a queue tracking key only — it is NOT an asset ID. "
    + "When a job succeeds, the resolved governed assetId is in the job's resultArtifacts array. "
    + "Use list_conversation_media_assets to obtain the canonical assetId before calling compose_media.";

  if (options.kind === "single") {
    if (options.audience === "admin" && options.scope === "conversation") {
      return "Look up the current status of a deferred job by job ID. Summarize the result in plain language after reading it. Admin only." + assetIdNote;
    }

    return "Get the current status of one of the signed-in user's jobs by job ID. Use when the user asks what a specific job is doing." + assetIdNote;
  }

  if (options.audience === "admin" && options.scope === "conversation") {
    return "List deferred jobs for the current conversation. Return active jobs by default; include terminal jobs only when the admin explicitly asks for a list or all jobs. Admin only." + assetIdNote;
  }

  return `List jobs for ${owner}. Use active_only=true or omit it for current work; use active_only=false only when the user explicitly asks for all jobs or a list.` + assetIdNote;
}