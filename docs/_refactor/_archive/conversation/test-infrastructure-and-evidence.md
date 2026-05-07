# Test Infrastructure And Evidence Spec

## Objective

Define the test infrastructure required to make the conversation refactor safe.

The conversation system should inherit the proof discipline already established
by the later media phases: deterministic suites for contracts, browser suites
for product continuity, fault-induction suites for known failure modes, and
release evidence that records exactly what was proven.

This is not a generic testing wishlist. It is the evidence system for proving
that conversation has caught up to the stronger platform systems built after
it.

## Source Patterns To Reuse

The capability-platform media phases already define the right shape:

- [../capability-platform-unification/phase-7-media-evals-and-video-proof.md](../capability-platform-unification/phase-7-media-evals-and-video-proof.md)
- [../capability-platform-unification/phase-8-media-fault-induction-and-continuity-proof.md](../capability-platform-unification/phase-8-media-fault-induction-and-continuity-proof.md)
- [../capability-platform-unification/phase-9-shared-media-materialization-and-live-runtime-proof.md](../capability-platform-unification/phase-9-shared-media-materialization-and-live-runtime-proof.md)

Those phases add four practices the conversation package must copy:

1. name the required scenario matrix explicitly
2. separate deterministic proof from browser/live proof
3. retain enough evidence to diagnose failures without ad hoc reruns
4. classify coverage as covered, partial, missing, misleading, or guarded

## Existing Test Infrastructure To Ground In

Start from the repo's current test and evidence surfaces:

- `vitest` unit and integration suites under `src/` and `tests/`
- Playwright product suites under `tests/browser-ui/`
- browser helpers under `tests/browser-ui/helpers/`
- release evidence JSON under `release/`
- phase runners such as `scripts/run-phase-7-media-evals.ts`,
  `scripts/run-phase-9-media-runtime-evals.ts`, and
  `scripts/run-phase-11-tool-invocation-qa.ts`
- existing package scripts in `package.json` such as `test`, `typecheck`,
  `test:browser-live`, `quality`, and `browser:verify`

The exact filenames for conversation tests can change, but the package must not
pretend proof exists unless one of these layers records it.

## Conversation Evidence Layers

### Layer 1: Deterministic Contract Tests

Use Vitest for fast proof of canonical contracts and repository behavior.

Current executable suites:

- `tests/conversation/phase-00-baseline-evidence.test.ts`
- `tests/conversation/phase-01-canonical-domain-contracts.test.ts`

Required coverage:

- `WorkspaceSnapshot` projection filters active, failed, canceled, and
  succeeded jobs correctly
- restore read model never derives active work from old message parts
- materialization keys are stable and exclude transient browser or job ids
- asset catalog lineage and readiness rules are deterministic
- relationship memory projection records evidence refs and supersession
- prompt binding records effective hashes and slot refs for durable decisions
- identity migration repair is idempotent across all canonical models
- business workflow context projection keeps task-origin, related business refs,
  lifecycle refs, interrupted-turn refs, notification refs, and health refs
  compact and source-owned
- operator transition projection creates compact status, mode, expertise,
  audience, offer, and next-action refs without duplicating profile or CRM data
- trust distribution projection uses referral/QR/link/ledger state without
  treating chat tool cards or transcript messages as source truth

### Layer 2: Database Integration Tests

Use database-backed tests for tables, projections, migration, and repair.

Required coverage:

- rebuild workspace snapshots from existing durable rows
- link jobs, materializations, and assets without transcript scanning
- migrate anonymous conversation, jobs, assets, memory, search refs, and prompt
  bindings to an authenticated user
- delete or retain canonical records according to privacy and audit policy
- rebuild relationship memory and transcript recall indexes independently

### Layer 3: Browser Product Continuity Tests

Use Playwright for the user-facing conversation behavior.

Required coverage:

- repeated homepage loads do not create new jobs
- clearing browser session storage does not remove active work, assets, or
  memory continuity
- a returning user sees active work from the job ledger and reusable assets
  from the asset catalog
- old successful media remains visible as history or reusable output without
  rerunning
- anonymous-to-authenticated restore shows the migrated workspace
- long conversations restore from memory and recent transcript, not full
  transcript replay
- lead, deal, referral, training, setup, or operations origin restores with a
  useful next action and return-to-source affordance
- first-run or post-install state restores into an operator transition path
  instead of an empty dashboard when useful
- referral QR/link sharing, signed visit activation, anonymous chat, and
  registration preserve a coherent trust-distribution path

### Layer 3.5: Hook And SSE Contract Tests

Hooks and SSE are central to the shipped conversation experience. The refactor
should use them aggressively, but only as projection and transport layers over
canonical durable state.

Required coverage:

- `useChatRestore` accepts the restore read model without scanning transcript
  parts for operational state
- `useGlobalChat` treats restored workspace state as canonical initialization,
  not as a hint to be re-derived from message parts
- `useBrowserCapabilityRuntime` can hydrate disposable browser runtime state
  without becoming the authority for active work
- `useJobsEventStream` applies live job events and then reconciles from durable
  job/read-model state after disconnects or missed events
- hook remounts, route transitions, and page reloads preserve one coherent
  workspace state
- stale SSE events, duplicate events, and out-of-order terminal events cannot
  resurrect completed or superseded work as active

### Layer 4: Fault-Induction Tests

The package needs adversarial tests, not only happy paths.

Required induced faults:

- old transcript contains successful tool results that look executable
- browser runtime cache is empty or stale
- job SSE event is missed and restore must reconcile from durable state
- SSE disconnect, duplicate event, stale terminal event, and out-of-order event
  cases are induced directly
- hooks remount after restore while browser runtime cache contains stale
  candidates
- repeated equivalent media request should reuse materialization instead of
  enqueueing duplicate work
- failed or superseded job should not dominate the active work surface
- anonymous migration partially completes and repair must finish idempotently
- relationship memory correction or retraction supersedes an older memory
- invalid QR/referral code, stale signed referral cookie, disabled affiliate
  access, and credit-review exceptions produce stable user-visible states

### Layer 5: Release Evidence Runner

The conversation package should have one phase runner that records what passed,
failed, or was skipped.

Target-state files:

- `scripts/run-conversation-refactor-qa.ts`
- `release/conversation-refactor-evidence.json`

Current runner command:

- `npm run qa:conversation-refactor`

Current deterministic bundle includes the Phase 00 evidence suite and the Phase
01 canonical contract suite. Later phases should add their focused suites to
the same runner before closing.

The runner should follow the phase-runner pattern used by media:

- deterministic command list
- browser command list
- optional live or long-running gates behind an explicit flag
- scenario matrix in the evidence payload
- passing rules in the evidence payload
- command exit codes plus stdout and stderr tails

## Required Scenario Matrix

### Restore Matrix

| Scenario | Required proof |
| --- | --- |
| empty workspace | restore returns an empty canonical workspace |
| active job | active work comes from job ledger |
| completed media job | asset is visible and no new job is created |
| failed job | attention-needed state is visible without rerun |
| cleared browser cache | durable state restores correctly |
| long conversation | memory summary plus recent transcript load correctly |

### Hook And SSE Matrix

| Scenario | Required proof |
| --- | --- |
| hook remount after restore | state remains canonical and no jobs are created |
| route transition back to chat | restored workspace does not re-run old parts |
| SSE disconnect during active job | durable reconcile restores current status |
| duplicate SSE event | UI remains idempotent |
| out-of-order terminal event | terminal state follows durable job ledger |
| stale browser runtime cache | cache is ignored or reconciled without authority |

### Business Workflow Matrix

| Scenario | Required proof |
| --- | --- |
| lead queue opens chat | restore preserves lead context and return href |
| deal follow-up starts work | next action remains revenue-focused |
| onboarding is incomplete | restore recommends setup continuation |
| failed send had task-origin | retry preserves business frame after reload |
| job completion notification sent | restore offers review, reuse, or retry |
| runtime health blocks work | next action names the blocker truthfully |

### Operator Transition Matrix

| Scenario | Required proof |
| --- | --- |
| first admin completes install | first useful conversation is available before dashboard sprawl |
| existing business user returns | restore keeps the active business objective visible |
| career-transition user returns | restore preserves offer formation and first-share next action |
| community affiliate user returns | QR/link/script context remains available |
| setup blocker exists | guidance names the blocker instead of pretending work can continue |

### Trust Distribution Matrix

| Scenario | Required proof |
| --- | --- |
| affiliate asks chat for QR | canonical referral URL and QR route are returned |
| affiliate access disabled | user gets a stable unavailable state and `/referrals` route |
| QR scan opens `/r/{code}` | signed referral visit is recorded without duplicate attribution |
| anonymous visitor starts chat | conversation is linked to validated referral context |
| visitor registers | referral linkage migrates to authenticated user |
| referral reaches milestone | workflow context and analytics show the milestone |
| credit needs review | admin exception or payout-review surface remains visible |

### Materialization Matrix

| Scenario | Required proof |
| --- | --- |
| same normalized request repeated | existing materialization is returned |
| same active request repeated | active equivalent job is returned |
| variant request | new materialization path is explicit |
| retry after failure | retry is intentional and auditable |
| replay by operator | replay bypasses or records reuse policy intentionally |

### Identity Matrix

| Scenario | Required proof |
| --- | --- |
| anonymous user signs up | conversations, jobs, assets, memory, and refs migrate |
| partial migration failure | repair can rerun safely |
| deleted user content | restore and search no longer expose deleted records |
| audit-retained record | user-visible state is removed while policy allows audit |

### Truthfulness Matrix

| Scenario | Required proof |
| --- | --- |
| system claims reuse | evidence shows reuse actually happened |
| system regenerates | UI does not claim reuse |
| job superseded by retry | user sees one coherent workflow track |
| old transcript has executable-looking parts | renderer treats them as history only |

## Coverage Accounting Rule

Every phase must classify its proof surface as one of:

- covered: deterministic and product-level proof exists
- partial: one layer exists but another required layer is missing
- missing: no meaningful proof exists yet
- misleading: existing proof looks relevant but bypasses the product seam
- guarded: unsupported behavior is intentionally rejected with stable UX

The package must not treat same-turn or synthetic harness success as proof of
long-lived conversation continuity unless the real product path is covered.

## Evidence Bundle Rule

Any browser or fault-induction test added for this package must retain enough
state to diagnose failures.

Minimum evidence for product-level failures:

- user or anonymous identity state
- conversation id
- restore response snapshot
- active job ids and statuses
- asset ids and readiness states
- materialization decision, if relevant
- browser storage state before and after restore, if relevant
- SSE connection state and last event id or reconciliation marker, if relevant
- hook state transition summary for restore, remount, or route-transition cases
- screenshot or DOM state for user-visible contradictions
- request and console failure summary when available

## Reproduce, Explain, Resolve Rule

Critical failures are not closed when they are merely recorded.

For each critical induced failure:

1. reproduce it with retained evidence
2. explain it using canonical state, transcript state, job state, asset state,
   and browser state
3. fix the root cause or classify the behavior as an explicit guardrail
4. rerun the same scenario and update release evidence

## Initial Target Files

Likely new files:

- `tests/conversation/restore-read-model.test.ts`
- `tests/conversation/workspace-snapshot.test.ts`
- `tests/conversation/materialization-reuse.test.ts`
- `tests/conversation/relationship-memory-projection.test.ts`
- `tests/conversation/identity-migration-repair.test.ts`
- `tests/browser-ui/conversation-restore-continuity.spec.ts`
- `tests/browser-ui/conversation-fault-induction.spec.ts`
- `tests/browser-ui/conversation-identity-continuity.spec.ts`
- `tests/browser-ui/helpers/conversation-evidence.ts`
- `scripts/run-conversation-refactor-qa.ts`
- `release/conversation-refactor-evidence.json`

Use existing names and locations if the current repo has better local patterns.

## Completion Standard

The conversation refactor is not release-ready until the evidence runner proves:

- restore does not execute history
- active work comes from the job ledger
- hooks and SSE project durable state without becoming separate authorities
- business workflow context restores revenue, service, training, operations,
  setup, or general momentum
- materialization reuse prevents duplicate work
- browser cache is disposable
- relationship memory survives long conversations
- search surfaces stay separate
- prompt binding explains durable decisions
- anonymous migration repairs continuity
- user-visible workflow state remains truthful under retries, reloads, and
  partial failures
