# Phase 00: Baseline Inventory And Evidence

## Objective

Freeze the current behavior of conversation restore, jobs, assets, search,
prompt runtime, browser runtime, and identity migration before changing the
architecture.

This phase creates the evidence pack future phases use to prove they preserved
good behavior while removing transcript-driven restore and duplicate work.

## Source Specs

- [../architecture-audit.md](../architecture-audit.md)
- [../restore-and-experience-spec.md](../restore-and-experience-spec.md)
- [../jobs-assets-materialization-spec.md](../jobs-assets-materialization-spec.md)
- [../relationship-memory-and-search-spec.md](../relationship-memory-and-search-spec.md)
- [../governance-identity-and-migration-spec.md](../governance-identity-and-migration-spec.md)
- [../validation-strategy.md](../validation-strategy.md)
- [../test-infrastructure-and-evidence.md](../test-infrastructure-and-evidence.md)

## Collect

Research the current code and data paths for:

- homepage load and active conversation restore
- message-part persistence and restore rendering
- browser runtime candidate discovery and recovery
- job queue tables, job events, job read models, and SSE reconciliation
- user-file storage, media asset projection, and upload cleanup
- conversation embedding and search indexing
- prompt runtime provenance and prompt control plane
- anonymous session resolution and migration
- existing deterministic, browser, fault-induction, and release-evidence
  infrastructure that can be reused for conversation proof

Start with these known areas, then update the list if the code has moved:

- `src/app/page.tsx`
- `src/app/api/conversations/active/route.ts`
- `src/hooks/chat/useChatRestore.ts`
- `src/hooks/chat/useBrowserCapabilityRuntime.ts`
- `src/lib/media/browser-runtime/job-snapshots.ts`
- `src/adapters/ConversationDataMapper.ts`
- `src/adapters/MessageDataMapper.ts`
- `src/adapters/JobQueueDataMapper.ts`
- `src/adapters/UserFileDataMapper.ts`
- `src/lib/jobs/job-read-model.ts`
- `src/lib/chat/embed-conversation.ts`
- `src/lib/chat/prompt-runtime.ts`
- `src/lib/chat/resolve-user.ts`

## Decide

Before implementation, decide:

- which current behavior must be preserved exactly
- which current behavior is a bug and should be captured as a negative case
- which tests already cover restore, jobs, assets, search, and migration
- which proof gaps require new tests or evidence scripts
- which existing tests are misleading because they bypass the long-lived
  conversation product path

Record rejected approaches, especially any attempt to fix restore by patching
only a UI hook or by suppressing old tool parts without creating durable state.

## Spec QA

Validate that the baseline covers these required defects:

- repeated restore does not create new media jobs
- completed jobs are not active work
- reusable assets are discoverable without transcript scanning
- clearing browser session storage does not remove durable continuity
- anonymous migration preserves jobs, assets, memory candidates, and search refs
- current proof coverage is classified as covered, partial, missing,
  misleading, or guarded

## Ground

Map every proof to actual files and database tables. At minimum, inspect:

- `conversations`
- `messages`
- `job_requests`
- `job_events`
- `user_files`
- `embeddings`
- `system_prompts`
- `conversation_events`

If migrations have changed table names, update this phase and the following
phases before coding.

## Build

Build evidence, not product behavior.

Expected deliverables:

- baseline restore test or fixture proving current behavior
- job ledger inventory notes or tests
- asset lineage inventory notes or tests
- search/indexing inventory notes or tests
- prompt provenance inventory notes or tests
- identity migration inventory notes or tests
- current test-infrastructure inventory, including existing suites, missing
  suites, evidence files, and candidate phase-runner commands

Implemented deliverables:

- [../phase-00-baseline-evidence.md](../phase-00-baseline-evidence.md)
- `src/lib/evals/conversation-refactor-evidence.ts`
- `tests/conversation/phase-00-baseline-evidence.test.ts`
- `scripts/run-conversation-refactor-qa.ts`
- `release/conversation-refactor-evidence.json`

## Phase QA

Do not close this phase until the team can answer:

- what state is currently transcript-owned
- what state is already durable outside the transcript
- what durable state is missing
- what behaviors are intentionally broken and should not be preserved
- which proof surfaces need deterministic tests, browser tests,
  fault-induction tests, or release evidence before implementation can begin

## Implementation QA

Run focused tests for the inspected areas. If no focused test exists, create an
evidence note that names the gap and link it from this phase.

Also produce the first coverage accounting table for the package:

- covered
- partial
- missing
- misleading
- guarded

## Update

After this phase, update Phase 01 with the exact durable surfaces that already
exist and the exact contract gaps that must be introduced.

Phase 01 input is recorded in
[../phase-00-baseline-evidence.md](../phase-00-baseline-evidence.md#phase-01-input).
