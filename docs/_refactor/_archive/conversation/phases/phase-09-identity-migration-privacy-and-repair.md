# Phase 09: Identity Migration Privacy And Repair

Status: implemented and validation-backed.

## Implementation Result

Phase 09 now has a runtime identity migration pipeline instead of a login-only
side effect. `migrate-anonymous-conversations.ts` delegates to
`IdentityMigrationService`, which records durable migration events and advances
through explicit stages for conversations, search repair, jobs, user files,
materializations, relationship memory, prompt bindings, prompt provenance
policy, referral repair, and restore verification.

The implementation also adds schema-backed migration status persistence,
restore projection, admin review data, and repository-level ownership repair
APIs for the canonical continuity models introduced by earlier phases. The
stale browser-storage migration toast path has been removed; user-visible or
operator-visible migration state must now come from the durable migration read
model.

## Objective

Make anonymous-to-authenticated conversion, deletion, retention, and repair
cover every canonical continuity model that now exists in production.

Identity migration is not a login side effect and it is not only a
conversation-owner update. It is a durable repair workflow across
conversations, jobs, assets, memory, workspace state, prompt bindings, and
audit surfaces.

Phase 09 starts from a codebase that already has real migration and purge
behavior. The phase is therefore not about inventing identity workflows from
zero. It is about taking the partial seams we already have, turning them into a
coherent ownership-repair pipeline, and removing the assumptions that still let
canonical models drift.

The post-Phase-08 product shape is now stricter than the original draft of this
phase. Prompt bindings, relationship memory, materialization records, workspace
restore refs, and product summary surfaces are real continuity models. Phase 09
must repair those records directly and must not recreate client-side migration
signals from browser storage or transcript clues.

## Source Specs

- [../governance-identity-and-migration-spec.md](../governance-identity-and-migration-spec.md)
- [../domain-model-spec.md](../domain-model-spec.md)
- [../restore-and-experience-spec.md](../restore-and-experience-spec.md)
- [phase-08-prompt-binding-and-governance.md](phase-08-prompt-binding-and-governance.md)
- [phase-05-asset-catalog-and-reusable-outputs.md](phase-05-asset-catalog-and-reusable-outputs.md)
- [phase-06-relationship-memory-projection.md](phase-06-relationship-memory-projection.md)

## Collect

Research the current identity, ownership, restore, and purge behavior before
coding.

Current grounded starting points:

- `src/lib/chat/resolve-user.ts`
- `src/lib/chat/migrate-anonymous-conversations.ts`
- `src/core/use-cases/ConversationInteractor.ts`
- `src/adapters/ConversationDataMapper.ts`
- `src/adapters/JobQueueDataMapper.ts`
- `src/adapters/UserFileDataMapper.ts`
- `src/adapters/MaterializationDataMapper.ts`
- `src/lib/chat/conversation-portability.ts`
- `src/core/platform/conversation-workspace/WorkspaceSnapshotProjector.ts`
- `src/core/platform/conversation-restore/WorkspaceRestore.ts`
- `src/core/platform/conversation-restore/WorkspaceRestoreReader.ts`
- `src/adapters/PromptBindingDataMapper.ts`
- `src/adapters/PromptProvenanceDataMapper.ts`
- `src/lib/jobs/materialization-registration.ts`
- `src/lib/prompts/prompt-provenance-service.ts`
- `src/lib/admin/conversations/admin-conversations.ts`
- `src/app/admin/conversations/[id]/page.tsx`
- `src/core/use-cases/IdentityMigrationRepository.ts`
- `src/core/entities/identity-migration.ts`
- `src/lib/referrals/referral-ledger.ts`

Collect and classify each surface as one of:

- identity source-of-truth or anonymous-session resolution
- current migration or ownership-transfer seam
- current restore-access boundary
- current delete, soft-delete, or purge boundary
- canonical model currently missing from migration or purge repair
- compatibility wrapper or legacy assumption that should be removed

## Ground

Before changing Phase 09, preserve the current code truths this phase must
build on.

### Anonymous Ownership Already Exists As Real Persistent State

- `src/lib/chat/resolve-user.ts` issues a stable `lms_anon_session` cookie and
  turns it into a real `anon_{uuid}` user row with anonymous role membership.
- Conversations already persist under anonymous ownership rather than under an
  in-memory or UI-only placeholder.
- Any Phase 09 design that treats anonymous state as ephemeral browser state is
  already behind the repo.

This means migration must start from durable anonymous ownership, not from a
best-effort transcript merge.

### Anonymous Migration Already Exists, But It Is Conversation-First Repair

- `src/lib/chat/migrate-anonymous-conversations.ts` already orchestrates a
  post-login or post-registration migration.
- The flow currently:
  - migrates conversations through `ConversationInteractor.migrateAnonymousConversations(...)`
  - repairs the embedded conversation ownership index
  - transfers queued and running jobs with `JobQueueRepository.transferJobsToUser(...)`
  - relinks referral state through `ReferralLedgerService`
  - clears the anonymous cookie after the work completes
- `ConversationInteractor.migrateAnonymousConversations(...)` currently archives
  the signed-in user’s active conversation, delegates ownership transfer to
  `ConversationRepository.transferOwnership(...)`, and records a `converted`
  event per conversation.

This means Phase 09 is not adding the first migration workflow. It is taking a
partially-correct migration workflow and making it canonical across all models.

### Conversation Ownership Transfer Is Real, But Narrow

- `src/adapters/ConversationDataMapper.ts` already supports
  `transferOwnership(fromUserId, toUserId)` and records `converted_from`.
- The current transfer updates conversation rows only. It does not itself own
  downstream repair for memory, assets, prompt provenance, prompt bindings,
  workspace projections, or search projections.
- `findIdsByUserAndConvertedFrom(...)` exists as a recovery helper to find
  conversations that were already converted even if the migration caller lost
  the initial return set.

This is the primary proof that the repo already has migration, and also the
primary proof that the migration boundary is still too shallow.

### Jobs Already Support Ownership Transfer As A Separate Repair Pass

- `src/adapters/JobQueueDataMapper.ts` already implements
  `transferJobsToUser(...)`.
- It rewrites `job_requests.user_id` for conversation-scoped jobs belonging to
  the anonymous or unowned identity and appends an `ownership_transferred`
  event to the job ledger.
- This is already a proper domain-side repair pass, not a UI fixup.

This means Phase 09 should extend this style to other durable models instead of
trying to centralize everything in one giant conversation update.

### Deletion And Purge Already Exist, But They Are Conversation-Led

- `ConversationInteractor.delete(...)` already performs governed soft delete
  with a retention window.
- `ConversationInteractor.restore(...)` already clears tombstone state through
  `ConversationRepository.restoreDeleted(...)`.
- `ConversationInteractor.purge(...)` already enforces purge eligibility unless
  the actor reason bypasses the waiting window.
- `ConversationDataMapper.purge(...)` records a minimal
  `conversation_purge_audits` row and then deletes the conversation.
- The current purge shape relies heavily on conversation-rooted foreign-key
  cleanup and does not yet define a canonical policy for all models that do not
  collapse cleanly behind conversation deletion.

This means Phase 09 must distinguish between conversation-led cleanup that is
already safe and ownership models that need explicit purge rules.

### Workspace Restore Already Projects Identity-Sensitive Refs

- `WorkspaceSnapshotProjector.ts` already projects `userId`, conversation
  status, active job refs, asset refs, latest memory ref, and
  `latestPromptBindingRef`.
- `WorkspaceRestoreReader.ts` and the `/api/workspace/restore` route are the
  concrete restore consumers that must keep returning a truthful contract when
  migration is pending, partially repaired, failed, or complete.
- Restore is therefore already consuming canonical refs that depend on correct
  ownership and deletion policy.
- A partial migration is no longer acceptable because restore now exposes
  enough continuity metadata that drift becomes user-visible quickly.

This means Phase 09 must treat workspace and restore surfaces as verification
targets, not merely as downstream consumers.

### Migration Status Projection Is Now Durable Runtime State

- `WorkspaceRestore.ts` now types `migration` as
  `IdentityMigrationEvent | null`, so restore can project real migration state.
- `IdentityMigrationRepository.ts` now has `IdentityMigrationDataMapper` as the
  schema-backed runtime adapter.
- The admin conversation detail loader and sidebar now expose linked migration
  status, stage, counts, and failure details for operator review.

This means Phase 09 status should be treated as a durable read model. Restore,
admin review, and any future user-facing migrated-continuation UX must read
from this model instead of inferring from `converted_from` or browser state.

### Client-Side Migration UI Has Been Pruned Until Status Is Real

- The previous `MigrationToast` path stored `migratedConversations` in
  `sessionStorage` after login or registration and rendered a shell toast from
  browser state.
- That was stale after Phase 10 because `WorkspaceRestore.migration` still
  publishes `null` and product experience cutover intentionally avoids
  transcript- or browser-derived migration UI.
- Phase 09 should reintroduce user-visible migrated-continuation messaging only
  from a durable migration event/status reader.

This means no implementation should add another browser-storage migration
notification as a shortcut. The replacement is a restore/admin projection over
the identity-migration read model.

### Prompt Binding And Prompt Provenance Are Now Part Of Canonical Continuity

- Phase 08 added durable prompt bindings through
  `PromptBindingDataMapper` and prompt-binding lineage through
  `source_prompt_binding_id`.
- `prompt_bindings.user_id` is a real owner field.
- `prompt_bindings.conversation_id` is a real access and restore boundary when
  present.
- `prompt_provenance_records` are conversation-scoped audit rows and now drive
  diagnostics that can enumerate affected durable targets.
- Neither prompt bindings nor prompt provenance are currently migrated by the
  anonymous conversion path.

This is the most important new grounded truth for Phase 09. Identity migration
was partially acceptable before prompt bindings became durable continuity
records. It is no longer acceptable now.

### Current User-File Ownership Is Durable, But Transfer Repair Is Missing

- `UserFileDataMapper` uses `user_id` as the primary owner field and
  `conversation_id` as attachment scope.
- The current code supports assigning files to conversations, not
  anonymous-to-authenticated ownership transfer as a first-class repair step.
- `user_files.conversation_id` uses `ON DELETE SET NULL`, not cascade, so
  conversation purge does not automatically satisfy privacy cleanup for durable
  uploaded or generated files.
- This means Phase 09 must decide whether file migration is owned by the user
  file repository directly, by a higher-level migration service, or by a
  dedicated asset-ownership repair pass.

### Materialization Continuity Already Exists And Must Be Migrated Explicitly

- `materialization_records` are now part of real continuity, not an optional
  side ledger.
- `materialization-registration.ts` writes durable materialization ownership
  and conversation linkage for completed compose-media jobs.
- Materializations may also carry prompt-binding lineage through
  `source_prompt_binding_id` and prompt-binding recording helpers.
- The current anonymous migration flow does not explicitly transfer or verify
  materialization ownership.
- `materialization_records.conversation_id` cascades on conversation deletion,
  but `user_id`, `reuse_policy`, output refs, produced job refs, and prompt
  lineage still need explicit migration and purge policy.

This means Phase 09 must ground materializations as a first-class migration and
purge surface rather than hiding them under generic asset language.

### Relationship Memory, Search, And Prompt Diagnostics Still Need Canonical Migration Rules

- Relationship memory is conversation-scoped and now prompt-bound, but the
  current anonymous migration flow does not explicitly repair or verify it.
- Search and embedded ownership indexes already have targeted repair helpers,
  but they are not yet modeled as a general migration status projection.
- Prompt-drift diagnostics now depend on prompt-binding lineage and must keep
  that lineage coherent after identity conversion or purge.

These are current canonical models, not optional extras.

## Current Coverage Snapshot

This inventory is the post-Phase-08 starting point. Keep it current while
implementing Phase 09.

| Model | Owner fields | Current migration coverage | Current deletion/purge behavior | Phase 09 action |
| --- | --- | --- | --- | --- |
| Anonymous identity | `users.id`, `user_roles.user_id`, `lms_anon_session` cookie | `resolve-user.ts` creates durable anonymous users. | Cookie can be cleared; anonymous user row remains unless account/user purge handles it. | Keep `resolve-user.ts` as identity entry only; do not add repair side effects there. |
| Conversations/messages/events | `conversations.user_id`, `converted_from`, conversation FK rows | `ConversationInteractor.migrateAnonymousConversations(...)` and `ConversationDataMapper.transferOwnership(...)` transfer conversation ownership. | Soft delete, restore, retention purge, and `conversation_purge_audits` exist; many conversation-owned rows cascade. | Keep as first transfer stage, then verify dependent records. |
| Search embeddings | source id includes user/conversation identity | `IdentityMigrationService` calls `repairConversationOwnershipIndex(...)`, records repaired/failed refs, and can complete as `partially_repaired`. | Vector delete exists by source id; purge linkage remains repair-oriented. | Implemented as explicit search-repair stage with status evidence. |
| Jobs/events | `job_requests.user_id`, `conversation_id`; event ledger refs | `JobQueueDataMapper.transferJobsToUser(...)` transfers anonymous/unowned conversation-scoped jobs and appends `ownership_transferred`. | Conversation purge cascades job rows/events. | Preserve as independent repair stage with counts and evidence refs. |
| User files/assets | `user_files.user_id`, `conversation_id` | `UserFileDataMapper.transferOwnershipForConversations(...)` transfers migrated conversation files to the authenticated owner. | Conversation deletion sets `conversation_id` null; files survive as user-owned records. | Implemented as explicit asset-transfer stage; remaining privacy-purge policy stays model-specific. |
| Materializations | `materialization_records.user_id`, `conversation_id`, `produced_by_job_id`, output refs | `MaterializationDataMapper.transferOwnershipForConversations(...)` transfers anonymous and unowned conversation materializations. | Conversation purge cascades records; job deletion sets `produced_by_job_id` null. | Implemented as explicit materialization-transfer stage. |
| Relationship memory | `relationship_memory_records.user_id`, `conversation_id`, `superseded_by_id` | `RelationshipMemoryDataMapper.transferOwnershipForConversations(...)` transfers migrated memory records. | Conversation purge cascades records; supersession refs set null. | Implemented as explicit relationship-memory-transfer stage. |
| Prompt bindings | `prompt_bindings.user_id`, `conversation_id`, `target_kind`, `target_id`, `source_prompt_binding_id` | `PromptBindingDataMapper.transferOwnershipForConversations(...)` transfers conversation-scoped prompt bindings. | Conversation purge cascades conversation-scoped bindings; source binding deletion sets null. | Implemented as explicit prompt-binding-transfer stage. |
| Prompt provenance | `prompt_provenance_records.conversation_id`, message refs | `PromptProvenanceDataMapper.countByConversations(...)` reports affected audit rows during migration; ownership remains conversation-scoped. | Conversation purge cascades provenance rows. | Implemented as prompt-provenance policy/count stage; provenance is not rewritten as user-owned state. |
| Workspace restore | restore DTO refs `workspace`, jobs, assets, memory, prompt binding, `migration` | `WorkspaceRestoreReader` reads latest target migration status and projects `WorkspaceRestorePayload.migration`. | Restore is read-only; deletion effects are inherited from source readers. | Implemented with durable migration reader projection. |
| Referrals | `referrals.referred_user_id`, `conversation_id`, event rows | `ReferralLedgerService.linkConversationToAuthenticatedUser(...)` runs during migration and failure blocks login/session issue. | Referral conversation FK sets null; referral audit rows are retained. | Keep as final synchronous repair or explicit failed stage with retry policy. |

## Decide

Decide the migration workflow shape against the code that already exists.

### 1. Promote Partial Migration Into A Canonical Repair Pipeline

The existing flow in `migrate-anonymous-conversations.ts` should become the
front door, but Phase 09 must stop treating it as a thin helper and define it
as an explicit migration application service with bounded repair stages.

Minimum stages now required:

- conversation ownership transfer
- job ownership transfer and eventing
- user-file and asset ownership repair
- relationship-memory and search ownership repair
- prompt-binding and prompt-provenance ownership or lineage repair
- workspace or restore status verification
- referral repair completion

Do not combine these into one raw SQL block. Each stage should have an owning
repository or repair service, return counts/evidence, and be idempotent when a
previous login attempt failed after only some stages completed.

### 2. Distinguish Transfer From Repair From Verification

Phase 09 should not hide all work behind one `transferOwnership(...)` call.

- transfer updates canonical owner fields
- repair rewrites dependent indexes, derived ownership, and lineage refs
- verification proves restore and access surfaces agree with the migrated state

### 3. Define Explicit Privacy Policy Per Model

Deletion and purge can no longer rely on “conversation delete probably cleans
it up.” Phase 09 must specify, per model, whether it is:

- conversation-owned and deleted transitively
- user-owned and purged explicitly
- audit-retained with minimal metadata only
- preserved through migration but removed on privacy purge

### 4. Make Prompt Binding A First-Class Migration Surface

Because Phase 08 made prompt binding durable, Phase 09 must explicitly cover:

- `prompt_bindings.user_id`
- `prompt_bindings.conversation_id`
- `prompt_bindings.target_kind`
- `prompt_bindings.target_id`
- `prompt_bindings.source_prompt_binding_id`
- `prompt_provenance_records` as conversation audit rows

Rejected approaches must include:

- transfer conversations only and assume every downstream model follows
- assume `conversation_id` implies ownership correctness for jobs, files, or
  prompt bindings
- treat prompt provenance as “just audit” and exclude it from purge policy
- leave restore to infer migration success from partially transferred records
- keep shipping point repairs such as index rewrites and manual ownership
  updates without a durable migration status model
- recreate migrated-conversation UI from `sessionStorage`, message history, or
  `converted_from` without a durable migration status projection

## Spec QA

Migration must cover:

- conversations
- messages
- jobs
- job events
- assets and user files
- materializations
- relationship memory
- workspace snapshots and restore-facing refs
- search indexes and embedded ownership indexes
- prompt bindings
- prompt provenance audit rows
- referral links

Deletion must distinguish:

- user-visible deletion
- soft deletion with retention window
- audit-retained operational records
- privacy-request purge

Spec QA must also answer:

- which current models are repaired synchronously during login or registration
  and which may complete asynchronously behind a migration status record
- whether prompt provenance is fully purged with the owning conversation or
  retained in a minimal audit form under a documented privacy exception
- how `source_prompt_binding_id` lineage is repaired when prompt bindings move
  across identity boundaries
- how restore behaves when migration has transferred conversations but not yet
  finished dependent repair passes

## Build

Expected deliverables:

- a durable identity-migration application service over the current helper flow
- explicit migration stage and status projection for restore and admin review
- a schema-backed identity-migration repository and read model rather than an
  interface-only contract
- repository-backed ownership repair for files, prompt bindings, and remaining
  canonical continuity records
- repository-backed ownership repair for materializations and any durable media
  continuity linked to migrated conversations or users
- repair rules for prompt-binding lineage and prompt provenance ownership
- deletion coverage for canonical models with explicit audit exceptions
- access checks at model boundaries after migration and after purge
- tests that prove anonymous-to-authenticated migration repairs continuity end
  to end

### Target Architecture

The clean shape for Phase 09 should separate identity resolution, migration
execution, ownership repair, and privacy deletion into distinct responsibilities.

- `resolve-user.ts` remains the identity entry seam only
- migration orchestration becomes an application service, not ad hoc login glue
- repositories own direct owner-field rewrites for their models
- repair services own derived indexes, lineage rewrites, and read-model repair
- restore and admin readers consume migration status instead of guessing from
  partially moved records, and Phase 09 must build those readers because the
  current restore contract still exposes `migration: null`
- purge policy is explicit per model and verified by tests

## Implementation Notes

- The current migration entry seam is still
  `src/lib/chat/migrate-anonymous-conversations.ts`. Phase 09 should retain it
  as the front door while moving orchestration into a dedicated application
  service.
- Conversation transfer is already real in
  `ConversationInteractor.migrateAnonymousConversations(...)` and
  `ConversationDataMapper.transferOwnership(...)`, but that is only the first
  stage of the final pipeline.
- Job transfer is already real in `JobQueueDataMapper.transferJobsToUser(...)`
  and should remain a separate repair pass with durable eventing.
- User-file migration is implemented through
  `UserFileDataMapper.transferOwnershipForConversations(...)`.
- Materialization migration is implemented through
  `MaterializationDataMapper.transferOwnershipForConversations(...)`.
- Restore migration status is persistence-backed through
  `IdentityMigrationDataMapper` and `WorkspaceRestoreReader`.
- Admin migration review is available on conversation detail data and sidebar
  projection for linked migration events.
- `IdentityMigrationRepository.ts` now has a schema-backed adapter and tests;
  it is no longer an interface-only target port.

## Specific Architectural Patterns Required

This phase should explicitly use these patterns.

### Application Service Pattern

Use one migration application service to coordinate transfer, repair,
verification, and finalization. Authentication callbacks and route handlers must
not keep accumulating migration side effects inline.

### Unit Of Work Pattern

Each repository-level ownership transfer or purge step should commit one
coherent model update at a time. The migration orchestration layer should then
sequence those steps and persist stage status, rather than relying on one giant
cross-model transaction that is too broad to reason about.

### Repository Pattern

Conversation, job, file, prompt-binding, and prompt-provenance ownership rules
must live behind repository contracts or dedicated repository methods, not in
raw SQL scattered through auth and route code.

### State Pattern

Migration should expose explicit states such as pending, transferring,
repairing, verifying, completed, and failed. Restore and admin tooling should
read those states instead of inferring them from a few nullable fields.

### Strategy Pattern

Deletion and purge rules vary by model. Use explicit strategies or policy
objects for conversation-owned records, user-owned records, audit-retained
records, and prompt-governance audit records instead of one conditional block
in the conversation purge path.

### Anti-Corruption Layer Pattern

Restore, admin, and auth surfaces should consume compact migration status and
ownership DTOs. They should not need to understand raw prompt-binding lineage,
job ledger details, or repository-specific tombstone fields.

## What Phase 09 Must Remove

Before this phase is complete, remove or stop extending these seams:

- the assumption that `ConversationDataMapper.transferOwnership(...)` is enough
  to declare migration complete
- the assumption that the existence of `IdentityMigrationRepository` means
  migration persistence and status projection already exist in production
- the assumption that conversation deletion automatically defines correct purge
  behavior for every canonical model
- any new ownership repair logic added directly to login, registration, or
  route handlers instead of to a migration application service
- any restore behavior that guesses migration success from `converted_from`
  alone
- any client migration toast, banner, or product-summary branch backed only by
  `sessionStorage`, API response counts, or transcript inspection
- any implementation plan that treats materializations as implicitly covered by
  asset or job transfer without explicit ownership and purge rules
- any domain code that relies on anonymous cookie presence after migration has
  already started
- any prompt-binding or prompt-provenance lifecycle rule that is left implicit
  behind foreign-key behavior rather than documented and tested
- any user-file or asset continuity rule that assumes conversation attachment
  is equivalent to user ownership migration
- any ad hoc index repair that is not attached to an explicit migration or
  purge repair stage

## Implementation Sequence

1. Inventory each canonical model by owner field, conversation field, purge
   rule, and current migration coverage.
2. Promote the existing anonymous migration helper into an explicit migration
   application service with stages and status.
3. Implement a schema-backed migration-status repository and readers for
   restore and admin surfaces before wiring partial-state UX.
4. Add repository-backed repair for user files, materializations, prompt
   bindings, prompt provenance, and any remaining canonical continuity models
   not already covered.
5. Add restore and admin verification surfaces for partial or failed migration
   states.
6. Define and implement explicit purge strategies for prompt bindings,
   prompt provenance, files, jobs, and audit records.
7. Add idempotent repair tests and privacy-purge tests across the full model
   set.

Implementation completion notes:

- Steps 1-5 are implemented in the Phase 09 runtime pipeline, repository
  adapters, restore projection, and admin migration-status view.
- Step 6 is implemented for conversation privacy purge by combining explicit
  file deletion with FK-backed cascade for messages, prompt provenance, prompt
  bindings, relationship memory, jobs, and materializations. Identity migration
  events remain audit-retained operational records.
- Step 7 is covered by mapper/service/admin/restore tests, including
  `ConversationDataMapper` privacy-purge regression coverage.

## Phase QA

Before implementation, verify the current anonymous conversion flow can be
rerun safely after partial failure. If not, fix idempotency before widening the
surface.

Before implementation, verify the deletion rule for each stored model. Do not
assume foreign keys or conversation-rooted deletes are sufficient proof of
privacy behavior.

## Implementation QA

Required validation:

- integration test for anonymous conversation, job, file, memory, prompt
  binding, prompt provenance, and materialization migration
- restore-after-login proof that the migrated workspace exposes the expected
  job, asset, memory, prompt-binding, and migration-status refs
- admin-review proof that operators can see migration stage, failure, and
  retry-relevant state for a migrated or partially migrated conversation set
- prompt-binding lineage repair tests covering `source_prompt_binding_id`
- deletion and privacy purge tests for canonical models and audit exceptions
- access-control tests at repository or model boundary after migration and
  after purge
- repair idempotency tests for partial migration restart
- no silent regression in existing anonymous resolution, conversation delete,
  restore, job transfer, or prompt-governance tests

Completed validation:

- `IdentityMigrationService.test.ts` covers staged migration, retry recovery,
  partial repair, and failed terminal state.
- `ConversationDataMapper.test.ts` covers privacy-request purge for attached
  files, FK-cascaded continuity records, and audit-retained migration events.
- `WorkspaceRestoreReader.test.ts` and `WorkspaceRestoreProjector.test.ts`
  cover durable migration status projection.
- `admin-conversations.test.ts` covers operator-visible migration status.
- Full Vitest and TypeScript validation were green after implementation.

## Update

After completion, update Phase 10 with the final migration states the UI must
render and the final restore contract for partially migrated versus fully
repaired workspaces.
