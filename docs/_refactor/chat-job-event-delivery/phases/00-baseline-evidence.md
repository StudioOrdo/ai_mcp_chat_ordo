# Phase 00 - Baseline Evidence

## Goal

Capture the current bug shape and prove the durable job truth before changing
behavior.

## Inputs

- Keith April 30 conversation evidence.
- Current local DB investigation notes.
- `contract-spec.md` incident grounding.
- `systemic-audit.md` fragmentation findings.

## Steps

1. Create a deterministic fixture for one `admin_web_search` job with `queued`,
   `started`, and `result` events.
2. Create a deterministic assistant transcript with one web-search result and
   repeated unchanged `get_deferred_job_status` tool results for the same
   `jobId`.
3. Record which transcript parts are explicit `job_status` parts and which are
   nested `tool_result.result` snapshots.
4. Assert durable `job_requests` count is one.
5. Assert durable `job_events` has the expected timeline.
6. Assert the current visible chat presentation reproduces the duplicate-card
   failure or, if already fixed by other work, record the current behavior.
7. Assert Jobs rail projection still sees one durable job.
8. Store fixture notes in the package closeout section before implementation
   begins.

## Code Anchors

- `src/adapters/ChatPresenter.test.ts`
- `src/frameworks/ui/jobs-rail/resolve-jobs-rail.test.ts`
- `tests/deferred-job-events-route.test.ts`
- `src/lib/jobs/job-read-model.test.ts`

## Positive Cases

- One durable job appears as one Jobs rail item.
- Repeated transcript status reads remain available in raw history.

## Negative Cases

- Repeated unchanged status reads must not become the source of operational
  truth.
- Automated tests must not depend on `.data/local.db`.

## Edge Cases

- The fixture can include terminal `succeeded` after repeated `running`
  snapshots.
- The fixture can include equal sequence and missing `updatedAt` variants.

## Implementation Evidence

Implemented on 2026-04-30.

Added deterministic fixture:

- `tests/fixtures/chat-job-event-baseline.ts`

Added focused baseline tests:

- `tests/chat-job-event-baseline.test.ts` proves one durable
   `admin_web_search` job with `queued`, `started`, and `result` events.
- `src/adapters/ChatPresenter.test.ts` includes an `it.fails` baseline proving
   the current transcript-level duplicate-card behavior before the presentation
   refactor.
- `src/frameworks/ui/jobs-rail/resolve-jobs-rail.test.ts` proves Keith-style
   repeated status snapshots still resolve to one durable Jobs rail item.

Verification command:

```bash
npm exec vitest run tests/chat-job-event-baseline.test.ts src/adapters/ChatPresenter.test.ts src/frameworks/ui/jobs-rail/resolve-jobs-rail.test.ts
```

Result:

- 3 test files passed.
- 61 tests passed.

## Done

- [x] Baseline fixture exists.
- [x] Current failure or current already-fixed behavior is documented.
- [x] No production code has been changed in this phase except test fixture
   support.
