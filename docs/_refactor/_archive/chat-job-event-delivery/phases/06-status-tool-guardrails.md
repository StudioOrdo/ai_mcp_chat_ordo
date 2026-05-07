# Phase 06 - Status Tool Guardrails

## Goal

Keep status tools useful for explicit inspection while preventing wait-loop
polling.

Phases 03-05 changed the default correctness path:

- Active chat now receives durable job updates through SSE/reconciliation.
- `useJobStateStore()` and `ConversationMessages` merge latest durable job
   state by `jobId` before presentation.
- `ChatPresenter` now dedupes repeated nested status-tool snapshots so old
   transcript noise does not multiply visible cards.

Phase 06 should therefore change assistant incentives and status-tool guardrails,
not presentation dedupe. The status tools must remain available for explicit
user asks, diagnostics, admin inspection, and deterministic fixtures; they should
stop being normalized as the assistant's waiting mechanism for ordinary deferred
work.

## Preparation Evidence

Current code shape on 2026-04-30:

| Surface | Current behavior | Phase 06 decision |
| --- | --- | --- |
| `src/core/entities/job-status-response-strategy.ts` | Builds job-status directive lines and tool descriptions. It says status reads are read-only and anonymous status answers should stay chat-native, but it does not explicitly say active chat should wait through events/reconciliation or forbid repeated unchanged reads. | Add the no-wait-loop language here so tool descriptions and role directive lines share the same policy. |
| `src/core/capability-catalog/families/job-capabilities.ts` | Admin prompt hints say to summarize `list_deferred_jobs` / `get_deferred_job_status` output and clarify reused-vs-new jobs. | Add admin prompt guidance: inspect once when explicitly asked, summarize once, then rely on job events/reconciliation instead of repeated polling. |
| `src/core/capability-catalog/families/profile-capabilities.ts` | Signed-in `get_my_job_status` and `list_my_jobs` have no prompt hints today. | Add signed-in prompt hints if implementation needs member-facing no-wait-loop guidance. Keep anonymous users away from signed-in job tools. |
| `src/core/use-cases/tools/deferred-job-status.tool.ts` | Defines `get_deferred_job_status`, `list_deferred_jobs`, `get_my_job_status`, and `list_my_jobs`. The commands return current snapshots and do not currently mark duplicate/unchanged reads. | Preserve explicit inspection behavior. Evaluate a runtime guard only if prompt/eval changes are insufficient. If added, scope it to one assistant turn and do not block explicit user status requests. |
| `tests/deferred-job-status.tool.test.ts` | Covers admin single-job and list tools, including roles and active-default list behavior. | Extend with tool description/policy assertions and explicit-inspection behavior if descriptions change here. |
| `tests/job-status-summary-tools.test.ts` | Covers signed-in job status/list tools and anonymous rejection for signed-in tools. | Keep these passing; add prompt/description assertions for signed-in tool behavior if profile capabilities gain hints. |
| `src/core/capability-catalog/prompt-directive-unification.test.ts` | Verifies catalog prompt hints are assembled into role directives and currently checks ADMIN deferred job guidance exists. | Add assertions for no repeated wait-loop guidance and chat-native anonymous status behavior. |
| `src/lib/evals/scenarios.ts` | Explicit member/admin status scenarios correctly mark status tools as `must_use`. Some recovery/dedupe scenarios still require `list_deferred_jobs` and `get_deferred_job_status` as the proof path for missed SSE/completion recovery. | Keep explicit status scenarios. Rewrite non-user-initiated recovery expectations so event/reconciliation proof is the target, not assistant status polling. |
| `src/lib/evals/runner.ts` / `src/lib/evals/live-runner.ts` | Deterministic and live runners synthesize or require status tool calls for several blog recovery paths. | Update only after scenario expectations are changed; do not weaken explicit status-request tests. |

Important current eval distinctions:

- Keep `must_use` for explicit user asks:
  - `member-job-status-summary-deterministic`
  - `member-explicit-job-status-deterministic`
  - `member-all-jobs-list-deterministic`
  - `blog-explicit-status-check-deterministic`
- Review or rewrite `must_use` status-tool expectations for recovery/waiting
   paths that are no longer user-initiated status asks:
  - `blog-missed-sse-recovery-deterministic`
  - `live-blog-completion-recovery`
  - any runner fixture where missed SSE is proven by synthesized
    `list_deferred_jobs` + `get_deferred_job_status` observations instead of
    durable event/reconciliation proof.
- `blog-job-status-continuity-deterministic`, `blog-job-dedupe-clarity-deterministic`,
   `live-blog-job-status-and-publish-handoff`, and
   `live-blog-job-reuse-instead-of-rerun` require product judgment during
   implementation: if the scenario prompt is an explicit status/reuse ask, status
   tools can remain valid; if it is recovery/waiting proof, move the expectation
   to event/reconciliation or durable snapshot state.

Existing adjacent proof already available:

- `src/frameworks/ui/jobs-rail/resolve-jobs-rail.test.ts` already has
   `keeps one durable rail item for Keith-style repeated status snapshots`, so
   Phase 06 does not need to re-prove jobs rail dedupe unless guardrail changes
   touch the rail.
- Phase 05 presenter tests already prove repeated status snapshots do not
   multiply visible cards. Phase 06 should not duplicate that logic.

## Implementation Evidence

Implemented on 2026-04-30.

Changed guardrail text:

- Updated `src/core/entities/job-status-response-strategy.ts` so shared job
   status directive lines and tool descriptions say status tools are for explicit
   inspection/diagnostics, active chat waits through job events and
   reconciliation, and unchanged job status should not be repeatedly polled.
- Updated admin prompt hints in
   `src/core/capability-catalog/families/job-capabilities.ts` with the same
   no-wait-loop guidance for `list_deferred_jobs` and
   `get_deferred_job_status`.
- Kept signed-in guidance centralized in the shared job-status directive
   strategy and tool descriptions rather than adding duplicate profile capability
   prompt hints.

Changed eval incentives:

- Updated `blog-missed-sse-recovery-deterministic` and
   `live-blog-completion-recovery` in `src/lib/evals/scenarios.ts` from
   status-tool `must_use` policies to recovery policies that prove durable
   reconciliation instead of assistant polling.
- Updated `src/lib/evals/runner.ts` so the deterministic missed-SSE recovery
   proof records a `durable_job_reconciliation` state transition instead of
   synthesized `list_deferred_jobs` / `get_deferred_job_status` tool calls.
- Updated `src/lib/evals/live-scenarios.ts` and `src/lib/evals/live-runner.ts`
   so live completion recovery no longer instructs or requires the model to use
   deferred job status tools as the recovery path.

Runtime repeated-status guard decision:

- Deferred. Phase 05 already suppresses repeated visible status artifacts, and
   Phase 06 removes the prompt/eval incentives that made repeated unchanged
   status reads the normal waiting path. The current status tool execution context
   does not expose a clean assistant-turn scoped duplicate cache; adding a global
   throttle would risk blocking explicit follow-up checks and diagnostics. Revisit
   only if telemetry shows repeated unchanged reads are still persisted within a
   single assistant turn after the prompt/eval changes.

Added or updated focused tests:

- `src/core/capability-catalog/prompt-directive-unification.test.ts` now proves
   ADMIN and signed-in directives include no-wait-loop job status guidance and
   anonymous status guidance stays chat-native without `/jobs` routing.
- `tests/deferred-job-status.tool.test.ts` now proves admin status tool
   descriptions mention explicit inspection, event/reconciliation waiting, and no
   repeated unchanged reads.
- `tests/job-status-summary-tools.test.ts` now proves signed-in status tool
   descriptions carry the same policy while explicit status behavior remains.
- Added `src/lib/evals/scenarios.test.ts` to prove explicit status scenarios
   retain status-tool `must_use` policies while missed-SSE/completion recovery
   scenarios no longer require status tools. QA tightened this test to include
   `member-all-jobs-list-deterministic` and `validateEvalCatalog()` coverage.

Verification command:

```bash
npm exec vitest run \
   src/core/capability-catalog/prompt-directive-unification.test.ts \
   tests/deferred-job-status.tool.test.ts \
   tests/job-status-summary-tools.test.ts \
   src/lib/evals/scenarios.test.ts
```

Result:

- 4 test files passed.
- 42 tests passed.

QA verification on 2026-04-30:

- Re-ran the focused command above after tightening eval metadata coverage.
- Ran targeted ESLint across the Phase 06 source, runner, scenario, and test
   files.
- Ran `get_errors` on touched source, tests, and package docs.
- Ran `git diff --check` on the Phase 06 touched files.
- Searched eval sources for stale recovery prompts or policies that still force
   `list_deferred_jobs` / `get_deferred_job_status`; remaining matches are
   explicit status, dedupe/reuse, or publish-handoff scenarios retained by the
   phase product judgment.

## Steps

1. Update `buildJobStatusToolDescription()` and directive strategies so all job
    status tools explain the current product contract:
    - use status tools for explicit inspection and diagnostics,
    - summarize the status once in plain language,
    - active chat waiting is handled by job events and reconciliation,
    - do not repeatedly call status tools for unchanged `jobId` / `status` /
       `sequence` unless the user explicitly asks for another status check.
2. Update catalog prompt hints:
    - admin hints in `job-capabilities.ts`,
    - signed-in member hints in `profile-capabilities.ts` if needed,
    - keep anonymous guidance in role/directive strategies rather than exposing
       signed-in job tools.
3. Add prompt/directive tests proving ADMIN and signed-in role directives contain
    no-wait-loop guidance and anonymous status guidance does not push `/jobs`.
4. Add or update tool tests proving descriptions include the event/reconciliation
    wait contract while explicit status requests still return normal snapshots.
5. Rewrite eval expectations for missed-SSE/completion-recovery scenarios so the
    proof is durable event/reconciliation state, not assistant-driven status
    polling. Keep explicit status-request scenarios as `must_use`.
6. Evaluate whether a runtime repeated-status guard is still needed after prompt
    and eval changes. Use this decision rule:
    - If the only remaining duplicate risk is visible transcript rendering,
       Phase 05 already handles it; document no runtime guard.
    - If model/tool execution can still persist repeated unchanged status reads
       in the same assistant turn, add a scoped guard that marks duplicates as
       non-rendering or compact, without blocking explicit user requests or admin
       diagnostics.
7. If a runtime guard is implemented, keep it outside repository/SQLite and
    scoped to one assistant turn or tool-execution context. Do not make global
    per-user throttles that would break diagnostics.
8. Document retained status-tool use cases in closeout.

## Required Test Additions

Extend `src/core/capability-catalog/prompt-directive-unification.test.ts` to
prove:

1. ADMIN directives include no repeated status wait-loop guidance.
2. Signed-in role directives include no repeated status wait-loop guidance if
    signed-in job prompt hints are added.
3. Anonymous status guidance stays chat-native and does not mention `/jobs` as a
    default status answer.
4. Catalog prompt hints still flow through `assembleRoleDirective()`.

Extend `tests/deferred-job-status.tool.test.ts` and/or
`tests/job-status-summary-tools.test.ts` to prove:

1. `get_deferred_job_status` and `list_deferred_jobs` descriptions mention
    event/reconciliation waiting and discourage repeated unchanged reads.
2. `get_my_job_status` and `list_my_jobs` descriptions carry the same policy for
    signed-in users if descriptions are updated centrally.
3. Explicit status reads still return snapshots and summaries normally.
4. Anonymous callers are still rejected from signed-in tools.

Add or update eval tests where they already exist. If no focused scenario test
exists, add a narrow test around scenario metadata or runner behavior proving:

1. Missed-SSE/completion-recovery scenarios no longer require status tools as a
    `must_use` policy unless the scenario prompt is explicitly a status request.
2. Explicit status-check scenarios still require the appropriate status tool.

If a runtime repeated-status guard is added, add a focused unit test proving:

1. Duplicate unchanged reads for the same `jobId`, `status`, and `sequence` in
    one assistant turn are marked compact/non-rendering or otherwise suppressed.
2. A later changed `sequence` or terminal status is not suppressed.
3. A new user-requested turn can inspect the same job again.
4. Diagnostics/admin inspection is not blocked.

Suggested focused command:

```bash
npm exec vitest run \
   src/core/capability-catalog/prompt-directive-unification.test.ts \
   tests/deferred-job-status.tool.test.ts \
   tests/job-status-summary-tools.test.ts \
   src/lib/evals/scenarios.test.ts
```

If eval metadata coverage lives in a different file, update the command and the
implementation evidence.

## Code Anchors

- `src/core/entities/job-status-response-strategy.ts`
- `src/core/use-cases/tools/deferred-job-status.tool.ts`
- `src/core/capability-catalog/families/job-capabilities.ts`
- `src/core/capability-catalog/families/profile-capabilities.ts`
- `src/core/capability-catalog/prompt-directive-unification.test.ts`
- `src/lib/evals/scenarios.ts`
- `src/lib/evals/runner.ts`
- `src/lib/evals/live-runner.ts`
- `tests/deferred-job-status.tool.test.ts`
- `tests/job-status-summary-tools.test.ts`

## Positive Cases

- Explicit user request for a job status still uses the appropriate status tool.
- Explicit user request for all jobs still uses list status tools and can include
   terminal jobs when requested.
- Admin diagnostics can still inspect current and historical jobs.
- Prompt/tool descriptions steer active waiting toward events and
   reconciliation.
- Anonymous status answers remain chat-native and do not route users to `/jobs`.

## Negative Cases

- The assistant is not instructed to repeatedly call `get_deferred_job_status` or
   `list_deferred_jobs` while waiting for ordinary deferred work.
- Missed-SSE recovery is not proven by requiring model-driven status polling.
- Runtime guardrails, if added, do not hide real changed status, terminal
   status, failures, or diagnostics.
- Do not remove or unregister any status tool.
- Do not change SSE routes, presenter dedupe, Jobs rail projection, repository,
   SQLite, or Push behavior in this phase.

## Edge Cases

- Same `jobId`, `status`, and `sequence` repeated in one assistant turn.
- Same `jobId` with a higher `sequence` after an earlier read.
- Same `jobId` transitioning from active to terminal.
- Explicit user asks for a second status check after a prior answer.
- Anonymous user asks about status.
- Signed-in non-admin user asks about their own jobs.
- Admin asks for current conversation jobs.
- Eval scenario is recovery-oriented rather than explicit status-oriented.

## Done

- [x] Status tools remain available and registered.
- [x] Tool descriptions mention active chat event/reconciliation waiting and
   discourage repeated unchanged status reads.
- [x] ADMIN prompt hints include no-wait-loop status guidance.
- [x] Signed-in job status guidance is updated or explicitly documented as
   covered by shared tool descriptions/directive strategies.
- [x] Anonymous status guidance stays chat-native and does not push `/jobs`.
- [x] Explicit status-request tests still pass for admin and signed-in users.
- [x] Missed-SSE/completion-recovery eval expectations no longer require status
   tools as the normal recovery proof unless the user explicitly asks for status.
- [x] Runtime repeated-status guard is either implemented with focused tests or
   explicitly deferred with a code-grounded rationale.
- [x] No route, EventSource, presenter, Jobs rail, repository, SQLite, Push, or
   status-tool availability changes are included in this phase.
