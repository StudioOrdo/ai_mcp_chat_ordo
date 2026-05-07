# Phase 00 Baseline Evidence

## Status

Phase 00 is implemented as an evidence baseline, not as runtime behavior.

The executable bundle is:

- `scripts/run-conversation-refactor-qa.ts`
- `tests/conversation/phase-00-baseline-evidence.test.ts`
- `src/lib/evals/conversation-refactor-evidence.ts`
- `release/conversation-refactor-evidence.json`

## Baseline Finding

The current system has strong durable subsystems, but restore is still too
transcript-centric.

Durable state already exists for conversations, messages, jobs, job events,
user files, prompt provenance, transcript search indexes, referrals, and
referral events. The missing layer is not storage in general. The missing layer
is a canonical workspace restore contract that says which durable surfaces own
continuity and which transcript parts are only history.

## Coverage Accounting

| Surface | Classification | Baseline read |
| --- | --- | --- |
| Homepage active restore | misleading | It restores the active conversation and message list, but not a workspace read model. |
| Message-part rendering | partial | Parts persist and render, but still carry operational-looking state. |
| Browser runtime recovery | guarded | Terminal snapshots guard restarts, but candidate discovery is still transcript-derived. |
| Job ledger and SSE | partial | Jobs and events are durable; missed-event reconcile and materialization reuse need proof. |
| Asset storage and lineage | partial | User files are durable; reusable asset catalog queries are not the restore authority yet. |
| Conversation search indexing | partial | Transcript recall exists; relationship memory does not. |
| Prompt runtime provenance | partial | Chat-turn provenance exists; durable PromptBinding is not yet shared by all decisions. |
| Identity migration | partial | Anonymous migration covers major records; it is not yet a canonical workflow with status projection. |

## Current Durable State

| Surface | Tables | Notes |
| --- | --- | --- |
| Active transcript | `conversations`, `messages` | `/api/conversations/active` returns `conversation` and `messages`. |
| Deferred jobs | `job_requests`, `job_events` | Active status is currently `queued` or `running`. |
| User files and media | `user_files` | Generated and uploaded media can persist outside transcript messages. |
| Transcript search | `embeddings` | Conversation search indexes transcript recall under user/conversation source ids. |
| Prompt provenance | `system_prompts`, `prompt_provenance_records` | Runtime records effective hashes, slot refs, sections, warnings, and replay context. |
| Referral attribution | `referrals`, `referral_events` | Referral visits, conversations, registration, and milestone events are durable. |
| Domain events | `conversation_events` | Existing event stream can support future projections. |

## Transcript-Owned Or Transcript-Derived State

- Homepage restore initializes chat from restored messages.
- Browser runtime recovery discovers candidates from historical tool call/result
  parts.
- Reusable media visibility can still depend on old tool cards until an asset
  catalog query owns the restore shelf.
- Relationship memory is not yet a structured projection with evidence refs.

## Required Negative Cases

Future phases must keep these as explicit regression cases:

- repeated homepage restore must not create a new media job
- completed jobs must not appear as active work
- reusable outputs must be discoverable without transcript scanning
- browser session storage must be disposable
- missed SSE events must reconcile from durable job state
- anonymous migration must preserve jobs, files, search ownership, and referral
  attribution
- old executable-looking transcript parts must render as history only

## Rejected Approaches

- Do not patch only `useChatRestore` to hide old tool parts.
- Do not suppress browser-runtime candidates without adding canonical durable
  restore state.
- Do not treat embeddings as relationship memory.
- Do not make browser session storage authoritative recovery truth.
- Do not rebuild the job ledger before proving the current durable job model and
  its exact gaps.

## Phase 01 Input

Phase 01 should introduce contracts and adapters for the missing canonical
surfaces, not a table for every noun.

Known durable surfaces to adapt first:

- `conversations` and `messages` for transcript and active conversation state
- `job_requests` and `job_events` for active work and history
- `user_files` for generated/uploaded asset backing
- `embeddings` for transcript recall only
- `prompt_provenance_records` for chat-turn prompt provenance
- `referrals` and `referral_events` for trust-distribution milestones

Known contract gaps:

- `WorkspaceSnapshot`
- `BusinessWorkflowContext`
- `OperatorTransitionProfile`
- `TrustDistributionContext`
- `MaterializationRecord`
- `RelationshipMemory`
- `PromptBinding`
- `IdentityMigrationEvent` and migration status projection

Phase 00 is closed when this baseline artifact and release evidence stay green.
