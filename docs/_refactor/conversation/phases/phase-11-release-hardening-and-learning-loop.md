# Phase 11: Release Hardening And Learning Loop

## Objective

Close the current conversation refactor with release-grade validation,
evidence consolidation, compatibility retirement, and a deliberate handoff
into the next batch of platform work.

This phase exists because the architecture is only done when the system proves
the current control plane works under repeat restore, migration, deletion, and
long conversation conditions, and when that proof is translated into concrete
specs and phases for what comes next.

The repo already contains real hardening runners and artifacts:

- `npm run qa:conversation-refactor`
- `npm run qa:runtime-integrity`
- `tsx scripts/run-phase-11-tool-invocation-qa.ts`
- `npm run release:evidence`

Phase 11 is therefore not about inventing the first release gate. It is about
turning the existing gate stack into one coherent, enforceable, and removable
hardening layer.

## Completion Status

- 2026-04-29: complete against the grounded Phase 11 scope.
- Authoritative release gates are the conversation-refactor QA runner, the
  runtime-integrity QA runner, the Phase 11 tool-invocation runner, and the
  composite release-evidence generator.
- Important scope boundary: `WorkspaceRestore.migration` still publishes
  `null`, so Phase 11 intentionally did not invent a migration-status strip or
  transcript-derived migration UI.

## Source Specs

- [../validation-strategy.md](../validation-strategy.md)
- [../target-architecture.md](../target-architecture.md)
- [../governance-identity-and-migration-spec.md](../governance-identity-and-migration-spec.md)
- [../test-infrastructure-and-evidence.md](../test-infrastructure-and-evidence.md)
- [phase-10-product-experience-cutover.md](phase-10-product-experience-cutover.md)

## Collect

Research final changed surfaces from all prior phases:

- canonical tables and migrations
- restore endpoints
- memory projection jobs
- materialization registry
- asset catalog registration
- prompt binding recorder
- identity migration workflow
- UI cutover surfaces
- observability and runtime logs
- deterministic, browser, fault-induction, and release-evidence suites added
  during the package

Likely starting points:

- `scripts/run-conversation-refactor-qa.ts`
- `scripts/run-runtime-integrity-qa.ts`
- `scripts/run-phase-11-tool-invocation-qa.ts`
- `scripts/generate-release-evidence.ts`
- `src/lib/evals/release-evidence.ts`
- `release/conversation-refactor-evidence.json`
- `release/runtime-integrity-evidence.json`
- `release/phase-11-tool-invocation-evidence.json`
- `src/hooks/chat/workspaceRestoreApi.ts`
- `src/hooks/chat/useChatRestoreCompatibility.ts`
- `src/frameworks/ui/chat/plugins/system/resolve-progress-strip.ts`
- `src/hooks/chat/composeMediaMaterializationCore.ts`
- `src/adapters/RepositoryFactory.ts`
- `src/lib/db/data-access-canary.test.ts`
- `src/lib/chat/stream-execution.ts`
- `src/lib/capabilities/external-target-adapters.ts`

Do not rely on this original phase list. Read the actual implementation notes
from Phases 00 through 10.

## Decide

Decide release readiness:

- what must be migrated before deploy
- what can be rebuilt lazily
- what repair scripts are required
- what old transcript-driven behavior can be deleted
- what compatibility shims remain temporarily
- what proof surfaces are covered, partial, missing, misleading, or guarded
- which gates belong in the final conversation refactor runner
- which broader platform ideas belong in the next batch instead of being forced
  back into unfinished conversation phases
- which specs and phase docs must be written immediately after hardening so the
  next package starts from grounded facts instead of fresh speculation

Rejected approaches must include:

- closing the refactor with only unit tests
- leaving old and new restore paths both authoritative
- shipping without repair or rebuild evidence
- adding another one-off QA runner with its own spawn loop and evidence shape
- leaving baseline evidence artifacts ambiguous about whether they are final or
  historical
- treating the next platform package as an informal brainstorm instead of a
  spec-backed follow-on plan

## Spec QA

Re-run the core proofs from [../validation-strategy.md](../validation-strategy.md):

- restore does not execute history
- active work comes from job ledger
- materialization reuse prevents duplicate work
- browser cache is disposable
- relationship memory updates continuously
- search surfaces stay separate
- prompt binding is recorded for durable decisions
- anonymous migration repairs continuity

## Ground

Before coding or cleanup, preserve these current code truths.

### Release Evidence And Hardening Runners Already Exist

- `scripts/run-conversation-refactor-qa.ts` already runs the focused
  conversation-refactor suites and writes `release/conversation-refactor-evidence.json`.
- `scripts/run-runtime-integrity-qa.ts` already runs integrity suites plus a
  production build and writes `release/runtime-integrity-evidence.json`.
- `scripts/run-phase-11-tool-invocation-qa.ts` already runs deterministic
  tool-invocation and media-generation proofs and writes
  `release/phase-11-tool-invocation-evidence.json`.
- `scripts/generate-release-evidence.ts` already writes the top-level release
  gate artifact through `src/lib/evals/release-evidence.ts`.

This means Phase 11 is not inventing the first hardening layer. It is
consolidating, normalizing, and enforcing an existing one.

### Runner Orchestration Is Still Duplicated

- `scripts/run-conversation-refactor-qa.ts` and
  `scripts/run-runtime-integrity-qa.ts` both define local `Step` structs,
  `printUsage()`, `runStep()`, and identical `spawnSync` loops.
- `scripts/run-phase-11-tool-invocation-qa.ts` implements another bespoke
  command-orchestration shape with its own evidence format.

This means Phase 11 should extract one shared QA-runner kernel instead of
continuing to clone script-local orchestration.

### Release Approval Already Has A Composite Model

- `src/lib/evals/release-evidence.ts` already aggregates manifest, health,
  referral diagnostics, runtime-integrity evidence, elite-ops status, and
  canary summaries into one `ReleaseEvidence` object.
- `validateReleaseEvidence()` already returns a list of concrete failures
  instead of a single boolean.

This means Phase 11 should extend one release-evidence composite and one
validation surface rather than spreading approval logic across scripts.

### Conversation-Refactor Evidence Is Still A Baseline Artifact

- `release/conversation-refactor-evidence.json` currently records the
  `conversation-refactor-phase-00-02b-operator-transition-and-trust-distribution`
  bundle rather than a final 00-11 closeout artifact.
- `src/lib/evals/conversation-refactor-evidence.ts` still reflects that
  baseline-oriented coverage model.

This means Phase 11 must either supersede this artifact with a final closure
artifact or archive it explicitly as baseline evidence instead of leaving it
ambiguous.

### Workspace Restore Is Canonical But A Legacy Bridge Still Remains

- `src/hooks/chat/workspaceRestoreApi.ts` still defines
  `LegacyRestoreConversationResponse` and `buildCompatibilityConversation()`.
- The durable `WorkspaceRestorePayload` path is authoritative, but the legacy
  conversation/message conversion path still exists as a compatibility bridge.
- `WorkspaceRestore.migration` remains `null`, so Phase 11 must not invent a
  new migration UI while performing release hardening.

This means Phase 11 must retire or strictly deprecate the compatibility
restore bridge instead of silently keeping it authoritative.

### Product UI Still Carries Transcript-Derived Compatibility Adapters

- `src/hooks/chat/useChatRestoreCompatibility.ts` still adapts restore into
  transcript-era routing and executable-message behavior.
- `src/frameworks/ui/chat/plugins/system/resolve-progress-strip.ts` still
  derives progress-strip items from presented transcript state.
- `src/frameworks/ui/MessageList.tsx` remains the transcript history renderer
  and should not regain product-truth ownership.

This means Phase 11 should continue shrinking compatibility surfaces and stop
extending transcript-derived operational state.

### Repository Lifetime Policy Exists But Still Needs Enforcement

- `src/adapters/RepositoryFactory.ts` already documents the process-cached
  singleton lifetime and the allowed transaction-local composition-root
  exceptions.
- `src/lib/db/data-access-canary.test.ts` already guards approved direct
  `getDb()` callers.
- The repo still contains approved raw-SQL callers and shrink-only exceptions
  that must not expand.

This means Phase 11 must reduce or hold the `getDb()` allowlist, not add new
exceptions under release pressure.

### Tool Invocation Identity And Audit Provenance Exist But Are Not Fully Gated

- `src/lib/chat/stream-execution.ts` durably threads `toolInvocationId`
  through tool-call and tool-result transcript parts.
- `src/lib/capabilities/external-target-adapters.ts` already records
  `invoke_started`, `invoke_succeeded`, and `invoke_failed` audit events via
  `appendRuntimeAuditLog()` for external execution targets.
- `scripts/run-phase-11-tool-invocation-qa.ts` already codifies deterministic
  tool-invocation/media rules.

This means Phase 11 should add audit-provenance validation as a first-class
release gate rather than treating transcript IDs and audit logs as separate
concerns.

### Media Composition Still Retains Transcript Rehydration Fallback

- `src/hooks/chat/composeMediaMaterializationCore.ts` still falls back to
  `assetResolutionIndex` transcript payloads when governed stored chart/graph
  payloads cannot be rehydrated.

This means Phase 11 must either remove this transcript fallback or place it
behind a critical audit/deprecation path so governed asset storage remains the
real authority.

### Phase 10 Outcome Is Already The New UI Baseline

- `src/frameworks/ui/product-experience-facade.ts` now owns explicit
  experience-state routing above the chat surface.
- `src/frameworks/ui/product-experience-summary.ts` and
  `src/frameworks/ui/ProductExperienceSummary.tsx` now render canonical
  current-work, workflow, operator-motion, job, asset, and memory sections
  above transcript history.
- `src/lib/shell/shell-navigation.ts` now routes signed-in users to the
  canonical referrals workspace alongside jobs and personal media.
- Anonymous homepage QA already proved the first-run hero survives
  storage/cache clearing and explicit reload without falling back to the
  low-signal restore summary state.

This means Phase 11 should harden and prove the new product surface, not
re-open Phase 10 by reintroducing transcript-owned truth.

## Build

Expected deliverables:

- shared QA-runner kernel or equivalent orchestration layer used by
  `scripts/run-conversation-refactor-qa.ts`,
  `scripts/run-runtime-integrity-qa.ts`, and
  `scripts/run-phase-11-tool-invocation-qa.ts`
- final release evidence document and generated QA artifacts
- an explicit decision about whether `release/conversation-refactor-evidence.json`
  remains a baseline artifact or becomes the final 00-11 closure artifact
- repair/rebuild commands where needed
- migration dry-run or local proof using the current migration/repair path,
  not a new ad hoc workflow
- tool-invocation audit provenance proof tied to `toolInvocationId`
- deprecation guard or removal for legacy workspace-restore compatibility
  conversion
- deprecation guard or removal for transcript-based media source rehydration
  fallback
- no expansion of direct `getDb()` callers beyond the current canary allowlist
- deletion of obsolete compatibility paths when safe
- observability checks for restore, migration, memory, and materialization
- updated package docs and phase statuses
- a next-batch spec set or equivalent architecture docs for the broader
  platform direction
- a next-batch phase sequence that records what belongs after the conversation
  package and what explicitly does not belong in retroactive Phase 01 through
  Phase 10 scope

## Specific Architectural Patterns Required

Phase 11 should explicitly use these patterns.

### Template Method Pattern

Extract the repeated QA-runner flow from the existing scripts into one shared
runner skeleton: define steps, run them, capture status, write evidence, and
exit non-zero on blockers. Phase-specific scripts should supply only their
step list and evidence writer.

### Composite Pattern

Treat `ReleaseEvidence` as the single composite release gate. Manifest,
health, referral diagnostics, runtime integrity, elite ops, canary, and
tool-invocation proof should compose into one review object rather than being
approved independently in separate scripts.

### Specification Pattern

Represent each release gate as a named rule that returns explicit violations.
Do not bury approval logic in nested script conditionals. Manifest presence,
runtime-integrity pass, canary pass, referral verification, audit provenance,
and compatibility retirement should each be isolated specifications.

### Abstract Factory And Composition Root Pattern

Keep repository lifetime and construction policy in `RepositoryFactory` and
the existing composition roots. Raw route handlers and release scripts should
not create new ad hoc dependency graphs around `getDb()` unless the file is an
explicitly approved shrink-only exception.

### Interactor Pattern

All new repair, rebuild, migration-verification, and cleanup logic should live
in interactors or application services with constructor-injected dependencies.
Do not push release-hardening logic down into route handlers, script-local SQL,
or UI hooks.

### Adapter And Strangler Pattern

Treat compatibility code as removable adapters around the canonical model.
`workspaceRestoreApi`, `useChatRestoreCompatibility`, transcript-derived
progress, and transcript media fallbacks should either disappear or emit
deprecation evidence proving they are no longer authoritative.

### Command Pattern

Each hardening step should be a typed command or step object with label,
command, status, and evidence payload. This keeps runner orchestration simple,
testable, and open to extension without rewriting each script.

### Audit Trail Pattern

`toolInvocationId` and `appendRuntimeAuditLog()` should define one provenance
chain from invocation to result. Release evidence must be able to prove that
every durable tool invocation has corresponding audit events.

### Single Responsibility Principle

Command execution, evidence shaping, gate validation, artifact writing, and
next-batch documentation should not live in the same function or script. Phase
11 should reduce that coupling rather than formalize it.

## What Phase 11 Must Remove

Before this phase is complete, remove or stop extending these seams:

- `LegacyRestoreConversationResponse` in `src/hooks/chat/workspaceRestoreApi.ts`
- `buildCompatibilityConversation()` in `src/hooks/chat/workspaceRestoreApi.ts`
- any new operational UI truth derived from `useChatRestoreCompatibility()` or
  `resolve-progress-strip.ts`
- transcript payload fallback for chart/graph composition in
  `src/hooks/chat/composeMediaMaterializationCore.ts` once governed source
  rehydration is proven
- any new direct `getDb()` caller outside the approved canary allowlist
- duplicated QA runner boilerplate across the Phase 11, runtime-integrity, and
  conversation-refactor scripts once a shared runner exists
- any release approval logic duplicated outside `src/lib/evals/release-evidence.ts`
- ambiguous use of `release/conversation-refactor-evidence.json` as though it
  were already the final package closeout artifact

## Phase QA

Before implementation, decide whether failures are implementation defects or
spec defects:

- Tier 1 or 2 failure: fix in place
- Tier 3 failure: re-check phase boundary
- Tier 4 failure: stop and return to Decide

## Implementation QA

Required validation:

- `npm run qa:conversation-refactor`
- `npm run qa:runtime-integrity`
- `tsx scripts/run-phase-11-tool-invocation-qa.ts`
- `npm run release:evidence`
- static analysis and data-access canary validation
- integration tests across restore, jobs, assets, memory, migration, and search
- browser tests for homepage restore, asset reuse, and cache disposability
- fault-induction tests for restore, retry, missed events, browser cache, and
  partial migration
- audit-log validation proving every durable tool invocation has the expected
  provenance events
- artifact review confirming `release/runtime-inventory.json`,
  `release/runtime-integrity-evidence.json`,
  `release/phase-11-tool-invocation-evidence.json`, and top-level release
  evidence agree on status
- functional review against the original product intent
- document review proving the next-batch specs and phases are grounded in the
  actual package outcomes rather than pre-package assumptions

## Implementation Sequence

1. Inventory the current runners, artifacts, and gate definitions so Phase 11
  starts from the existing evidence stack rather than replacing it blindly.
2. Extract a shared QA-runner kernel from the current script-local spawn
  orchestration.
3. Extend `src/lib/evals/release-evidence.ts` so tool-invocation provenance and
  final conversation-refactor closure are part of one release gate.
4. Add audit-log validation for durable `toolInvocationId` flows.
5. Deprecate and then remove the legacy restore compatibility bridge in
  `workspaceRestoreApi.ts` once evidence proves no production dependency.
6. Deprecate and then remove transcript-based media source fallback once
  governed asset rehydration is proven.
7. Tighten the `getDb()` allowlist and preserve the composition-root policy.
8. Run the full hardening bundle and write final release evidence artifacts.
9. Update the follow-on architecture specs and phase docs from the validated
  outcomes rather than from pre-existing roadmap assumptions.

## Update

After completion, update:

- every phase doc with actual outcomes or deviations
- [../README.md](../README.md) with final status
- [../ROADMAP.md](../ROADMAP.md) with completed sequence
- the next-batch architecture specs and phase docs produced from this handoff
- repository memory with any durable lessons that future agents need

Phase 11 should explicitly document:

- which compatibility adapters were removed
- which ones remain temporarily and why
- which release gates are now authoritative
- which baseline artifacts were archived versus promoted to final evidence
- which next-batch phases are truly new work rather than deferred cleanup from
  Phase 11

Phase 11 should end with the next package explicitly framed, not merely
suggested.

## Implementation Notes

Phase 11 implementation is complete.

Delivered components:

- `scripts/lib/qa-runner.ts` now provides the shared QA-runner kernel used by
  the conversation-refactor and runtime-integrity runners, and the Phase 11
  runner now follows the same step-and-evidence conventions.
- `src/lib/evals/phase-11-tool-invocation-evidence.ts` and
  `src/lib/evals/release-evidence.ts` now carry tool-invocation hardening into
  the composite release gate.
- Durable tool execution now preserves `toolInvocationId` and audit provenance
  through external-target adapters and MCP execution-target plumbing.
- `src/hooks/chat/workspaceRestoreApi.ts` is now canonical-only; the legacy
  conversation/message compatibility bridge was removed.
- `src/hooks/chat/composeMediaMaterializationCore.ts` now treats governed
  chart/graph source rehydration as authoritative and no longer falls back to
  transcript payload recovery.
- Deterministic hardening blockers were fixed in the owning validation seams:
  restore tests, compose-media materialization tests, chat-stream route mocks,
  and the runtime-tool-binding deterministic bundle.

Compatibility retirement status:

- Removed: legacy workspace-restore compatibility conversion and transcript
  chart/graph materialization fallback.
- Remaining temporarily: `src/hooks/chat/useChatRestoreCompatibility.ts`
  remains as a shrinking UI adapter around the canonical restore payload. It no
  longer owns restore parsing or legacy payload support.

Artifact decision:

- `release/conversation-refactor-evidence.json` remains a baseline artifact for
  earlier package closure, not the sole final release-approval surface.
- Final release approval now flows through the composite model in
  `src/lib/evals/release-evidence.ts`, backed by runtime-integrity evidence and
  Phase 11 tool-invocation evidence.

Validated closeout:

- `npm exec vitest run src/hooks/useGlobalChat.test.tsx` passed 25/25 after the
  canonical restore cutover.
- `npm exec vitest run src/hooks/chat/useComposeMediaMaterialization.test.tsx src/lib/media/server/compose-media-plan-materialization.test.ts` passed 7/7 after transcript fallback removal.
- `npm exec vitest run tests/chat/chat-stream-route.test.ts` passed 30/30 after
  route dependency mock repair.
- `npm exec vitest run src/core/capability-catalog/runtime-tool-binding.test.ts`
  passed 27 tests with 2 skipped after the deterministic timeout adjustment.
- `npm exec tsx scripts/run-phase-11-tool-invocation-qa.ts` passed the
  deterministic Phase 11 hardening bundle.
- `npm exec tsx scripts/generate-release-evidence.ts` regenerated the composite
  release artifact.
- `npm exec vitest run tests/evals/eval-release-evidence.test.ts` passed 9/9
  after release-evidence regeneration.
