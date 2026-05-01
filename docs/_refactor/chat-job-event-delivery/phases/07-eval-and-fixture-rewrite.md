# Phase 07 - Eval And Fixture Rewrite

## Goal

Remove old eval incentives that teach the assistant to recover by polling status
tools when the app should recover through event delivery.

## Post-09 Hard-Cutover Note

This phase is historical eval cleanup evidence. Phases 09a-09d removed
message-shaped job lifecycle rendering and the old
`deferredJobResultToMessagePart(...)` product bridge. Any reference below to
that helper describes pre-cutover fixture behavior, not current product
architecture.

Phase 06 already changed the prompt/tool guardrails and the highest-risk
recovery metadata. Phase 07 is the cleanup and fixture-alignment phase: make the
deterministic and live eval fixtures prove the new product contract without
accidentally reintroducing status-tool polling as the default recovery path.

## Current State After Phase 06

Implemented before Phase 07 begins:

- `src/core/entities/job-status-response-strategy.ts` now says status tools are
   for explicit inspection/diagnostics, active chat waits through job events and
   reconciliation, and unchanged `jobId/status/sequence` should not be repeatedly
   polled.
- `src/core/capability-catalog/families/job-capabilities.ts` now gives ADMIN the
   same no-wait-loop prompt guidance.
- `src/lib/evals/scenarios.ts` changed
   `blog-missed-sse-recovery-deterministic` and
   `live-blog-completion-recovery` from status-tool `must_use` policies to
   `recover` policies with empty `toolIds`.
- `src/lib/evals/runner.ts` changed the deterministic missed-SSE recovery proof
   to record a `state_transition` with `source: "durable_job_reconciliation"`
   instead of synthesized `list_deferred_jobs` and
   `get_deferred_job_status` tool calls.
- `src/lib/evals/live-scenarios.ts` changed the live completion recovery prompt
   from "Use the deferred job tools..." to recovering from latest durable state.
- `src/lib/evals/live-runner.ts` no longer requires status tools for the
   `terminal-job-recovered` checkpoint in `live-blog-completion-recovery`; it now
   checks publish-readiness explanation and rerun avoidance.
- `src/lib/evals/scenarios.test.ts` now proves explicit status scenarios keep
   `must_use` status-tool policies, missed-SSE/completion recovery scenarios do
   not require status tools, and `validateEvalCatalog()` stays clean.

Phase 06 QA command passed:

```bash
npm exec vitest run \
   src/core/capability-catalog/prompt-directive-unification.test.ts \
   tests/deferred-job-status.tool.test.ts \
   tests/job-status-summary-tools.test.ts \
   src/lib/evals/scenarios.test.ts
```

Result: 4 files, 42 tests passed.

## Current Code Grounding

### Scenario Metadata

Current status-tool `must_use` scenarios in `src/lib/evals/scenarios.ts`:

| Scenario | Current status | Phase 07 decision |
| --- | --- | --- |
| `member-job-status-summary-deterministic` | `must_use: ["list_my_jobs"]` | Keep. User asks for job status summary. |
| `member-explicit-job-status-deterministic` | `must_use: ["get_my_job_status"]` | Keep. User asks for a specific job. |
| `member-all-jobs-list-deterministic` | `must_use: ["list_my_jobs"]` | Keep. User asks for all/list jobs. |
| `blog-job-status-continuity-deterministic` | `must_use: ["list_deferred_jobs", "get_deferred_job_status"]` | Review copy and fixture. It is a status read surface and can remain if the simulated user ask is explicitly status-oriented. Do not use it as missed-SSE proof. |
| `blog-explicit-status-check-deterministic` | `must_use: ["list_deferred_jobs", "get_deferred_job_status"]` | Keep. Fixture includes explicit job-id follow-up: `Check the status of job ...`. |
| `blog-job-dedupe-clarity-deterministic` | `must_use: ["list_deferred_jobs", "get_deferred_job_status"]` | Keep as reuse/diagnostic inspection. It proves reuse/dedupe clarity, not missed-SSE recovery. |
| `live-blog-job-status-and-publish-handoff` | `must_use: ["list_deferred_jobs", "get_deferred_job_status", "publish_content"]` | Keep if prompt remains explicit inspection plus publish. It is not a passive wait/recovery scenario. |
| `live-blog-job-reuse-instead-of-rerun` | `must_use: ["list_deferred_jobs", "get_deferred_job_status"]` | Keep if prompt remains explicit: "Tell me the status" / avoid rerun. It is reuse diagnostics, not missed-SSE recovery. |

Recovery scenarios already changed by Phase 06:

| Scenario | Current status | Phase 07 decision |
| --- | --- | --- |
| `blog-missed-sse-recovery-deterministic` | `recover`, empty `toolIds` | Keep. Ensure tests assert no status tool observations are synthesized. |
| `live-blog-completion-recovery` | `recover`, empty `toolIds` | Rewrite remaining live test fixture so it does not call status tools in the mocked runtime. |

### Deterministic Runner

Current anchors in `src/lib/evals/runner.ts`:

- `blog-job-status-continuity-deterministic` still synthesizes
   `list_deferred_jobs` and `get_deferred_job_status` observations. This can
   remain only if the scenario continues to represent an explicit status read
   surface.
- `blog-explicit-status-check-deterministic` still synthesizes status tool
   observations and includes an explicit `Check the status of job ...` message.
   Keep.
- `blog-job-dedupe-clarity-deterministic` still synthesizes status tool
   observations as a reuse/diagnostic inspection scenario. It also asserts
   `deferredJobResultToMessagePart(..., { deduped: true })`, active job count,
   and clear reuse copy, so it is not used as missed-SSE recovery proof.
- `blog-missed-sse-recovery-deterministic` now records
   `kind: "state_transition"` with `source: "durable_job_reconciliation"`; do
   not regress it back to tool-call observations.

### Live Runner And Fixtures

Current anchors:

- `src/lib/evals/live-scenarios.ts`: `live-blog-job-status-and-publish-handoff`
   still instructs "Use the deferred job tools...". Keep only if this remains an
   explicit inspection plus publish scenario.
- `src/lib/evals/live-scenarios.ts`: `live-blog-job-reuse-instead-of-rerun`
   still instructs "Use the deferred job tools...". Keep only if this remains an
   explicit status/reuse diagnostic scenario.
- `src/lib/evals/live-scenarios.ts`: `live-blog-completion-recovery` now says
   "Recover ... from the latest durable state..." and should not be tested by
   mocked status-tool calls.
- `src/lib/evals/live-runner.ts`: `live-blog-job-status-and-publish-handoff`
   checks status tools and publish. Keep if the scenario remains explicit
   inspection plus publish.
- `src/lib/evals/live-runner.ts`: `live-blog-job-reuse-instead-of-rerun` checks
   status tools and no rerun. Keep if the scenario remains explicit reuse
   diagnostics.
- `src/lib/evals/live-runner.ts`: `live-blog-completion-recovery` no longer
   checks status-tool calls for recovery. It checks publish readiness and no
   `produce_blog_article` rerun.
- `tests/evals/eval-live-runner.test.ts`: the
   `live-blog-completion-recovery` test now models durable state recovery without
   `list_deferred_jobs` or `get_deferred_job_status` calls in the mocked runtime.

### Scoring

Current anchor: `src/lib/evals/scoring.ts`.

- `tool_selection` treats `recover` as satisfied by a passing recovery
   checkpoint, including `terminal-job-recovered`.
- This supports Phase 07's desired metadata shape for missed-SSE and completion
   recovery.
- Phase 07 does not need to change scoring unless a recovery scenario should
   also assert absence of specific tools. If absence is required, add an explicit
   `avoid` policy alongside `recover`, and update tests accordingly.

## Steps

1. Add or extend eval metadata tests so every scenario that uses
    `list_deferred_jobs` or `get_deferred_job_status` is classified as one of:
    explicit status ask, reuse/diagnostic inspection, publish handoff, or
    event/reconciliation recovery.
2. Keep status-tool expectations for explicit user status requests:
    `member-job-status-summary-deterministic`,
    `member-explicit-job-status-deterministic`,
    `member-all-jobs-list-deterministic`, and
    `blog-explicit-status-check-deterministic`.
3. Keep or explicitly justify status-tool expectations for reuse/diagnostic
    scenarios:
    `blog-job-status-continuity-deterministic`,
    `blog-job-dedupe-clarity-deterministic`,
    `live-blog-job-status-and-publish-handoff`, and
    `live-blog-job-reuse-instead-of-rerun`.
4. Strengthen `blog-missed-sse-recovery-deterministic` coverage so it asserts
    the deterministic runner emits a `durable_job_reconciliation` state transition
    and does not synthesize `list_deferred_jobs` or `get_deferred_job_status`
    observations.
5. Rewrite `tests/evals/eval-live-runner.test.ts` for
    `live-blog-completion-recovery` so the mocked runtime no longer recovers by
    calling status tools. The test should prove the checkpoint passes from
    durable-state/publish-readiness text and no production rerun.
6. Decide whether `blog-job-dedupe-clarity-deterministic` should keep status-tool
    observations. If it is really proving deduped deferred result presentation,
    rewrite it to use deduped job result envelope state rather than status-tool
    observations.
7. Preserve deterministic fixtures that are setup data and not model behavior
    requirements.
8. Update release evidence scripts only if they summarize old eval expectations
    or hardcode old recovery/status-tool assumptions.

## Required Test Updates

1. Extend `src/lib/evals/scenarios.test.ts` or
    `tests/evals/eval-scenarios.test.ts` with a classification table for all
    status-tool scenarios.
2. Extend `tests/evals/eval-runner.test.ts` for
    `blog-missed-sse-recovery-deterministic`:
    - expect a `state_transition` observation with
       `source: "durable_job_reconciliation"`,
    - expect no `tool_call` observations for `list_deferred_jobs`,
       `get_deferred_job_status`,
    - keep the terminal recovery, summary, and post-id checkpoints.
3. Update `tests/evals/eval-live-runner.test.ts` for
    `live-blog-completion-recovery`:
    - do not call status tools in the mocked runtime,
    - keep no-rerun proof by ensuring `produce_blog_article` is absent,
    - keep publish-readiness explanation proof,
    - assert the scenario passes under the `recover` policy.
4. If `blog-job-dedupe-clarity-deterministic` is rewritten, add a deterministic
    runner assertion that it records no status tool observations while preserving
    `dedupe-detected`, `reuse-copy-clear`, and `single-job-preserved`.

Suggested focused command:

```bash
npm exec vitest run \
   src/lib/evals/scenarios.test.ts \
   tests/evals/eval-scenarios.test.ts \
   tests/evals/eval-runner.test.ts \
   tests/evals/eval-live-runner.test.ts \
   tests/evals/eval-scoring.test.ts
```

Then run targeted lint on touched eval source and tests.

## Code Anchors

- `src/lib/evals/scenarios.ts`
- `src/lib/evals/scenarios.test.ts`
- `src/lib/evals/runner.ts`
- `src/lib/evals/live-runner.ts`
- `src/lib/evals/live-scenarios.ts`
- `src/lib/evals/scoring.ts`
- `tests/evals/eval-runner.test.ts`
- `tests/evals/eval-scenarios.test.ts`
- `tests/evals/eval-live-runner.test.ts`
- `tests/evals/eval-scoring.test.ts`
- `tests/evals/eval-release-evidence.test.ts`

## Positive Cases

- Explicit user status asks still require the appropriate status tool.
- Explicit admin reuse diagnostics can still inspect jobs to avoid reruns.
- Publish handoff can still inspect a completed job and call `publish_content`
   when the prompt asks for inspection plus publish.
- Missed-SSE recovery is proven by durable reconciliation state, not by model
   polling.
- Live completion recovery can pass without status-tool calls if the response
   explains publish readiness and avoids a production rerun.

## Negative Cases

- Do not remove or unregister any status tool.
- Do not make all status-tool use an `avoid` policy; explicit inspection remains
   valid.
- Do not weaken `tool_selection` so status tools can be skipped for explicit
   status asks.
- Do not reintroduce synthesized status-tool observations into missed-SSE
   recovery.
- Do not use mocked live-runtime status tool calls as the proof for completion
   recovery.

## Edge Cases

- A scenario can combine explicit inspection and publish handoff. Keep status
   tools there if the prompt asks for inspection.
- A reuse scenario can be diagnostic rather than passive waiting. Keep status
   tools only when the prompt asks for status/reuse clarity.
- A recovery scenario can still have durable job setup data. The boundary is the
   expected assistant/model behavior, not whether seeded durable jobs exist.
- `recover` with empty `toolIds` is valid because scoring reads recovery
   checkpoints. Add `avoid` only if Phase 07 wants to fail unexpected status-tool
   calls explicitly.

## Implementation Guardrails

- Keep this phase limited to eval metadata, fixtures, runner tests, and release
   evidence references.
- Do not change SSE routes, hooks, presenter dedupe, Jobs rail projection,
   repository, SQLite schema, or Push behavior.
- Do not change Phase 06 prompt/tool descriptions unless a Phase 07 test proves
   a contradiction.
- Preserve raw transcript and diagnostic evidence.

## Implementation Evidence - 2026-04-30

Implemented changes:

- `src/lib/evals/scenarios.test.ts` now contains a job-status eval
  classification table covering explicit status, diagnostic status, reuse
  diagnostics, publish handoff, and event/reconciliation recovery scenarios.
- `tests/evals/eval-runner.test.ts` now proves
  `blog-missed-sse-recovery-deterministic` recovers through a
  `durable_job_reconciliation` state transition and does not synthesize
  `list_deferred_jobs` or `get_deferred_job_status` tool observations.
- `tests/evals/eval-live-runner.test.ts` now proves
  `live-blog-completion-recovery` can pass with no status-tool calls and no
   `produce_blog_article` rerun. The mocked runtime answers from durable state
   instead of status-tool polling.

Focused validation passed:

```bash
npm exec vitest run \
  src/lib/evals/scenarios.test.ts \
  tests/evals/eval-scenarios.test.ts \
  tests/evals/eval-runner.test.ts \
  tests/evals/eval-live-runner.test.ts \
  tests/evals/eval-scoring.test.ts
```

Result: 5 files, 53 tests passed.

## QA Closeout - 2026-04-30

QA verdict: implemented with no Phase 07 blockers found.

Additional QA actions:

- Replaced lingering recovery-fixture wording in `src/lib/evals/scenarios.ts`
   from snapshot recovery to durable reconciliation.
- Replaced the missed-SSE seed recommendation in `src/lib/evals/seeding.ts` so
   it points to durable reconciliation, not the old snapshot-oriented wording.
- Rechecked stale Phase 07 recovery language across eval source, eval tests, and
   this phase doc. The only remaining `job_status snapshots` matches are in
   `src/lib/evals/conversation-refactor-evidence.ts`, where they describe browser
   runtime evidence and are outside the Phase 07 status-polling recovery contract.

Focused Phase 07 validation passed again:

```bash
npm exec vitest run \
   src/lib/evals/scenarios.test.ts \
   tests/evals/eval-scenarios.test.ts \
   tests/evals/eval-runner.test.ts \
   tests/evals/eval-live-runner.test.ts \
   tests/evals/eval-scoring.test.ts
```

Result: 5 files, 53 tests passed.

Adjacent Phase 06/07 guardrail validation passed:

```bash
npm exec vitest run \
   src/core/capability-catalog/prompt-directive-unification.test.ts \
   tests/deferred-job-status.tool.test.ts \
   tests/job-status-summary-tools.test.ts \
   src/lib/evals/scenarios.test.ts
```

Result: 4 files, 43 tests passed.

Targeted ESLint, `get_errors`, and `git diff --check` were clean for all Phase
07 QA-touched files.

## Done

- [x] Every status-tool eval is classified as explicit status, reuse/diagnostic,
   publish handoff, or event/reconciliation recovery.
- [x] No eval requires assistant status polling for non-user-initiated recovery.
- [x] `blog-missed-sse-recovery-deterministic` runner tests prove durable
   reconciliation state and no synthesized status tool observations.
- [x] `live-blog-completion-recovery` live-runner tests no longer recover by
   calling status tools.
- [x] Explicit status-request evals still require the correct status tool.
- [x] Reuse/diagnostic evals that keep status tools have a code-grounded
   rationale.
- [x] Focused eval/scoring tests pass.
- [x] Targeted lint and `get_errors` are clean for touched eval files.
