# Phase 09: Admin And Conversation Operation Surfaces

Status: Implemented and QA verified on 2026-05-03

## QA Certification

This document was QA reviewed against the current codebase on 2026-05-03.

Issues corrected during QA:

- Added the role-resolution prerequisite for corpus/help/onboarding surfaces.
  `src/lib/corpus-access.ts` currently uses `getPrimaryRole(user.roles)`, while
  chat and operation actions use strongest-role authorization helpers. Phase 09
  must not let users with `["AUTHENTICATED", "ADMIN"]` get downgraded to
  authenticated-only handbook access.
- Added missing operation-action wiring for `help_flow` and `onboarding_flow`.
  Those operation kinds are registered today, and the deterministic compiler can
  classify them, but `OperationDraftFactory` currently returns no actions and
  `OperationActionPolicy` has no payload validators for their future action
  types.
- Added `POST /api/operations` to the API contract for UI-started help,
  onboarding, and admin operations. It must go through operation intent/draft
  policy and must not become a bypass around the operation kernel.

Certification result:

- Existing code anchors in the grounding section were rechecked and exist.
- The implementation plan now covers operation creation, read APIs, UI cards,
  confirmation, role-gated corpus access, action policy, dispatch, and
  onboarding/help flows.
- No unresolved documentation blockers remain.

## Goal

Make the operation ledger the visible product surface.

After Phases 01 through 08, Ordo has durable operations, steps, events,
actions, artifacts, prompt grounding, typed action dispatch, and migrated
backup, media, and factory operation families. Phase 09 turns those primitives
into clear admin, operator, conversation, help, and onboarding experiences.

The user should never have to type magic phrases such as "fire it" to advance
dangerous or multi-step work. The UI must show current operation truth and expose
valid actions as unmistakable buttons backed by typed operation actions.

## Inputs From Phase 00 Through Phase 08

- Phase 00 showed the failure mode: chat text, tool output, runtime state, and
  user-visible actions drift when there is no durable operation surface.
- Phase 01 defined `Operation`, `OperationStep`, `OperationEvent`,
  `OperationAction`, `OperationArtifact`, role policy, risk, confirmation, and
  stale-action contracts.
- Phase 02 persisted operation truth through `OperationRepository`,
  `OperationReadModel`, and `OperationDataMapper`.
- Phase 03 added the single action dispatch boundary and the
  `POST /api/operations/[operationId]/actions/[actionId]` route.
- Phase 04 added deterministic intent compilation and operation draft creation.
- Phase 05 made current operation state authoritative in backend prompt
  grounding.
- Phase 06 moved backup and restore onto operation actions.
- Phase 07 moved media workflows onto operation actions while preserving the
  existing media worker and job queue boundary.
- Phase 08 moved factory work orders onto operation actions and proved that the
  dispatch root must lazy-load feature executors so unrelated actions cannot fail
  because another feature root is unavailable.

## Current Code Grounding

### Operation Ledger And Read Models

Use these files as the source of truth:

- `src/core/entities/operation.ts`
- `src/core/use-cases/operations/OperationRepository.ts`
- `src/core/use-cases/operations/OperationReadModel.ts`
- `src/adapters/OperationDataMapper.ts`
- `src/adapters/RepositoryFactory.ts`

Relevant repository methods already exist:

- `listOperationsByConversation`
- `listOperationsForUser`
- `listOperationsForAdmin`
- `listEvents`
- `listArtifacts`
- `listAvailableActions`
- `getConversationSummary`
- `getAdminSummary`
- `getHealthAggregate`
- `getPromptGroundingSummary`

Phase 09 must reuse these methods. Do not add route-local SQL or a second
operation query model.

### Current API Surface

The only operation API route currently present is:

- `src/app/api/operations/[operationId]/actions/[actionId]/route.ts`

Phase 09 must add operation creation/read APIs and/or route-owned server
loaders for operation lists, details, events, artifacts, and health. The action
route remains the only mutation path for visible operation transitions after an
operation exists.

`POST /api/operations` is required by the AgentOS contract, but it must not be a
generic write-anything endpoint. It should create operations only through the
same deterministic intent, draft, authorization, gate, and repository contracts
used by chat.

### Current Chat Action Surface

Operation actions can already be serialized and dispatched through:

- `src/lib/operations/operation-action-view-model.ts`
- `src/lib/operations/operation-action-markdown.ts`
- `src/frameworks/ui/useChatSurfaceState.tsx`
- `src/frameworks/ui/RichContentRenderer.tsx`
- `src/frameworks/ui/chat/primitives/CapabilityActionRail.tsx`
- `src/frameworks/ui/MessageList.tsx`
- `src/frameworks/ui/chat/bubbles/AssistantBubble.tsx`

Current weakness:

- Operation actions are rendered in several places with duplicated visual intent
  logic.
- Phrase confirmation currently uses `window.prompt` in
  `useChatSurfaceState.tsx`.
- Rich content only has inline `action-link` nodes. There is no first-class
  operation card block.

Phase 09 must centralize operation action rendering and replace browser prompts
with a controlled confirmation UI.

### Existing Operator And Admin Surfaces

Use these patterns:

- `src/lib/operations/operations-access.ts` gates shared `/operations/*`
  workspaces to `STAFF` and `ADMIN` without widening `/admin`.
- `src/app/operations/layout.tsx` establishes the shared operations shell.
- `src/app/operations/media/page.tsx` is the live staff/admin operations
  precedent.
- `src/components/media/MediaOperationsWorkspace.tsx` shows the current dense
  operator workspace style.
- `src/app/admin/system/page.tsx` is the admin-only system status page.
- `src/app/admin/system/backups/*`, `src/app/admin/system/tools/*`, and
  `src/app/admin/system/keys/*` are existing admin self-service patterns.
- `src/components/AppShell.tsx` currently treats `/admin` specially but does not
  classify `/operations` as its own shell surface.

Phase 09 must preserve the existing access split:

- `/operations/*`: shared operator workspace for `STAFF` and `ADMIN`.
- `/admin/system/*`: admin-only appliance configuration and destructive system
  controls.

### Corpus And Content Access

Use:

- `src/lib/access/content-access.ts`
- `src/lib/corpus-access.ts`
- `src/lib/corpus-library.ts`
- `src/adapters/FileSystemCorpusRepository.ts`
- `src/core/platform/knowledge-access/KnowledgeAccessService.ts`
- `src/core/capability-catalog/families/corpus-capabilities.ts`

Current content access is role-aware through these audiences:

- `public`
- `member`
- `account`
- `premium`
- `apprentice`
- `staff`
- `admin`

Important grounded finding:

- `FileSystemCorpusRepository` only ingests corpus directories that contain a
  valid `book.json`.
- `docs/_corpus/system-docs/chapters/*` exists, but
  `docs/_corpus/system-docs/book.json` is missing, so those chapters are not a
  reliable active handbook source today.
- `src/lib/corpus-access.ts#getViewerRole` currently returns
  `getPrimaryRole(user.roles)`. This can downgrade multi-role users if roles are
  ordered as `["AUTHENTICATED", "ADMIN"]`. Chat and operation action routes use
  strongest-role helpers such as `resolveSessionAuthorizationRole` and
  `resolveStrongestOperationRole`.
- `getAllowedAudiencesForUser` does not currently include the `member` audience
  in its `ALL_AUDIENCES` list even though `member` is a valid
  `ContentAudience`. If Phase 09 uses allowed-audience lists for vector or
  handbook filtering, it must cover `member` explicitly.

Phase 09 must make the system handbook ingestible before using it for help or
onboarding, and must use a strongest effective role for governed help content.

### Current Install And First-Run Surfaces

Use:

- `src/lib/appliance/install/install-state.ts`
- `src/app/install/InstallWizard.tsx`
- `src/app/install/page.tsx`
- `src/app/welcome/page.tsx`
- `src/frameworks/ui/product-experience-facade.ts`

Current weakness:

- Install is admin/setup oriented and not operation-backed.
- Welcome is role-neutral.
- Anonymous first-run behavior exists through the product experience facade, but
  it is not tied to governed help or onboarding operations.

Phase 09 must make first-user onboarding role-aware without breaking the install
flow.

## Product Shape

Use one system handbook with role-gated sections, not separate books per role.

Reason:

- Shared concepts stay consistent.
- Content access controls decide which sections are visible.
- The assistant can explain Ordo differently for anonymous, member, apprentice,
  staff, and admin users without duplicating the whole documentation tree.

The anonymous assistant persona is the public-facing chief of staff for the CEO.
It should be helpful, bounded, and clear about what public visitors can do. It
must not behave like a generic salesperson.

## Target Architecture

### 1. Operation Presentation Layer

Create a pure presentation boundary that maps operation snapshots and summaries
into UI models.

Suggested files:

- `src/lib/operations/operation-presentation.ts`
- `src/lib/operations/operation-presentation.test.ts`

Responsibilities:

- Build an `OperationCardModel` from `OperationSnapshot`,
  `ConversationOperationSummary`, or `AdminOperationSummary`.
- Classify status, risk, progress, latest events, artifacts, and available
  actions.
- Produce stable labels and empty states.
- Never mutate operations or infer state transitions.

This is the Adapter pattern: domain/read-model data enters once and UI surfaces
receive stable view models.

### 2. Shared Operation UI Primitives

Create shared UI primitives and migrate existing operation buttons to them.

Suggested files:

- `src/frameworks/ui/operations/OperationCard.tsx`
- `src/frameworks/ui/operations/OperationActionButton.tsx`
- `src/frameworks/ui/operations/OperationActionConfirmationDialog.tsx`
- `src/frameworks/ui/operations/OperationTimeline.tsx`
- `src/frameworks/ui/operations/operation-ui-intent.ts`
- `src/frameworks/ui/operations/*.test.tsx`

Rules:

- Primary, secondary, destructive, and disabled actions must be visually distinct.
- Dangerous actions must show risk language before dispatch.
- Phrase confirmation must use an owned dialog, not `window.prompt`.
- Disabled actions must show the disabled reason and must not dispatch.
- Stale action failures must refresh operation state and explain the current
  state.

This removes duplicated action-intent logic from:

- `RichContentRenderer.tsx`
- `CapabilityActionRail.tsx`
- `MessageList.tsx`
- `AssistantBubble.tsx`
- `JobsWorkspace.tsx`

### 3. Rich Content Operation Card Block

Add an operation card block to rich content.

Suggested files:

- `src/core/entities/rich-content.ts`
- `src/frameworks/ui/RichContentRenderer.tsx`
- `src/frameworks/ui/RichContentRenderer.test.tsx`
- `src/lib/operations/operation-intent-projection.ts`

Contract:

- Add `BLOCK_TYPES.OPERATION_CARD`.
- The block carries an `OperationCardModel`, not raw markdown.
- `projectOperationSnapshot` should prefer the operation card block for
  conversation output.
- Existing markdown action links may remain as a fallback, but new operation
  projections should not depend on users noticing text links.

### 4. Operation Creation/Read APIs And Loaders

Add creation and read surfaces for operation truth.

Suggested files:

- `src/app/api/operations/route.ts`
- `src/app/api/operations/[operationId]/route.ts`
- `src/app/api/operations/[operationId]/events/route.ts`
- `src/app/api/operations/[operationId]/artifacts/route.ts`
- `src/lib/operations/operation-read-api.ts`
- `src/lib/operations/operation-workspace-loader.ts`
- route tests for each API

Authorization:

- Anonymous users can only read their own conversation-scoped public/help
  operations where existing session rules allow it.
- Authenticated users can read their own user/conversation operations.
- Staff can read staff-visible operations in `/operations/*`.
- Admin can read all operation summaries and admin-only appliance operations.

Do not widen `/admin` to serve staff.

Creation rule:

- `POST /api/operations` may create help, onboarding, diagnostic, and other
  explicitly supported operation drafts.
- It must call the same intent/draft path used by
  `OperationIntentIngress`/`OperationIntentRouter`, or a route-owned launcher
  that delegates to the same `OperationDraftFactory`, `OperationIntentPolicy`,
  and `OperationRepository`.
- It must not insert rows directly or bypass `OperationActionPolicy`.

### 5. Shared Operations Workspace

Create a general operations workspace under `/operations`.

Suggested files:

- `src/app/operations/page.tsx`
- `src/app/operations/[operationId]/page.tsx`
- `src/components/operations/OperationsWorkspace.tsx`
- `src/components/operations/OperationDetailWorkspace.tsx`
- tests for route access and rendered state

Scope:

- `STAFF` and `ADMIN` can see active, blocked, failed, and recently completed
  operations.
- Filters: kind, status, risk, created role, updated range.
- Summary tiles: active, blocked, failed, pending destructive actions, oldest
  active age.
- Details: timeline, steps, artifacts, available actions, raw event evidence.
- Links to existing family surfaces such as `/operations/media`.

### 6. Admin System Operation Surface

Add an admin-only system operation surface.

Suggested files:

- `src/app/admin/system/operations/page.tsx`
- `src/components/admin/system/SystemOperationsManager.tsx`
- `src/app/admin/system/operations/page.test.tsx`

Scope:

- Show appliance operation health from `getHealthAggregate`.
- Highlight destructive operations such as restore.
- Show blocked operation gates from Phase 04/05.
- Link to backup, provider, tools, and image health surfaces where relevant.
- Keep all dangerous actions behind operation action dispatch.

### 7. Governed Help Handbook

Make the system handbook active in `_corpus`.

Implementation decision:

- Add `docs/_corpus/system-docs/book.json` with slug `system-docs`.
- Keep one handbook and use chapter/frontmatter `audience` values to gate
  sections.
- Keep the current orphaned `docs/_corpus/system-docs/chapters/*` content, but
  rewrite or expand it into role-appropriate help chapters.

Minimum handbook sections:

- Public: what Ordo is, what a public visitor can ask, and how the CEO chief of
  staff voice behaves.
- Member/account: using conversations, files, media, and personal operations.
- Apprentice: learning workflow and guided practice.
- Staff: `/operations`, factory work orders, media workflow monitoring, and
  issue/production flow.
- Admin: providers, tools, backups, restore, install, image, health, and release
  operations.

Tests must prove role filtering through `getCorpusSummaries`, `searchCorpus`,
and `getSectionFull`.

### 8. Help Flow Operations

Make help requests operation-backed.

Suggested files:

- `src/core/use-cases/operations/HelpFlowOperationActions.ts`
- `src/lib/operations/help-flow-operation.ts`
- `src/lib/operations/help-flow-operation.test.ts`
- updates to `src/core/use-cases/operations/OperationActionPolicy.ts`
- updates to `src/core/use-cases/operations/OperationDraftFactory.ts`
- updates to `src/lib/operations/operation-action-dispatch-root.ts`

Initial actions:

- `help.search`
- `help.open_section`
- `help.start_checklist`
- `help.complete_checklist_item`
- `help.finish`

Rules:

- Help flow operations are `info` risk.
- Visibility is conversation-scoped by default.
- Role and audience are captured in operation input.
- The assistant may summarize help, but visible sections come from corpus access
  checks.
- Help flow action payload schemas must be registered in
  `DEFAULT_OPERATION_PAYLOAD_VALIDATORS`.
- Help flow action executors must be registered through the operation dispatch
  root, preferably behind lazy action executors like the Phase 08 factory fix.

### 9. Onboarding Flow Operations

Make first-run onboarding role-aware and operation-backed.

Suggested files:

- `src/core/use-cases/operations/OnboardingFlowOperationActions.ts`
- `src/lib/operations/onboarding-flow-operation.ts`
- `src/lib/operations/onboarding-flow-operation.test.ts`
- updates to `src/core/use-cases/operations/OperationActionPolicy.ts`
- updates to `src/core/use-cases/operations/OperationDraftFactory.ts`
- updates to `src/lib/operations/operation-action-dispatch-root.ts`
- updates to `src/app/welcome/page.tsx`
- updates to `src/frameworks/ui/product-experience-facade.ts`

Role paths:

- `ANONYMOUS`: public chief-of-staff welcome, public proof, public help, signup
  route where available.
- `AUTHENTICATED`: first useful conversation, files, media, and personal help.
- `APPRENTICE`: guided learning path and practice flow.
- `STAFF`: operations workspace, media/factory responsibilities, issue capture.
- `ADMIN`: provider setup, tools, backups, restore safety, image/runtime health.

Initial actions:

- `onboarding.start`
- `onboarding.complete_step`
- `onboarding.skip_step`
- `onboarding.open_help`
- `onboarding.finish`

The install wizard should remain focused on making the appliance usable. The
welcome and first conversation should create or resume the onboarding operation.

Current code note:

- `OperationKindRegistry` already registers `onboarding_flow` and `help_flow`.
- `DeterministicOperationIntentCompiler` already emits both operation kinds.
- `OperationDraftFactory` currently returns no actions for those kinds.
- `OperationActionPolicy` currently has no validators for `help.*` or
  `onboarding.*` payload schemas.

Phase 09 must close that gap before claiming help or onboarding operations are
usable.

## Implementation Slices

1. Add operation creation/read APIs/loaders and tests.
2. Add operation presentation mapper and tests.
3. Add shared operation UI primitives and replace duplicated action rendering.
4. Add rich-content operation card block and migrate operation projections.
5. Add `/operations` list/detail workspace.
6. Add `/admin/system/operations` and link it from `/admin/system`.
7. Add active `system-docs` corpus manifest and role-gated handbook chapters.
8. Fix strongest-role corpus/help resolution and member-audience filtering.
9. Add help flow operation actions, validators, dispatch, and projection.
10. Add onboarding flow operation actions, validators, dispatch, and role-aware
   first-run projection.
11. Run QA, prune duplicate rendering code, and update this phase closeout.

## Dead Code And Simplification Targets

Remove or collapse:

- Duplicated action intent classification in chat components after
  `OperationActionButton` exists.
- Browser prompt confirmation for operation phrase actions.
- Markdown-only operation projection for new operation-backed messages.
- Any direct operation state inference in UI components.
- Any route-local operation SQL.
- Role-specific content logic that uses first-role ordering instead of strongest
  effective role.

Keep for now:

- Legacy job action rendering for non-operation jobs.
- Existing media and backup admin pages, but link them to operation details where
  operation ids exist.
- `/operations/media` as a family-specific workspace.

## Positive Use Cases

- Admin opens `/admin/system/operations` and sees active backup, restore, media,
  and factory operations with health aggregate counts.
- Staff opens `/operations` and sees staff-visible media and factory operations
  without gaining `/admin` access.
- A restore operation shown in chat displays destructive actions as destructive
  buttons, requires phrase confirmation in an owned dialog, dispatches through
  the operation action API, then refreshes to the current state.
- A help request creates or resumes a `help_flow` operation and returns only
  corpus sections allowed for the viewer role.
- The first admin after install sees an onboarding operation focused on provider,
  tool, backup, and health setup.
- Anonymous visitors see public help and public next steps in the CEO chief of
  staff voice.

## Negative Use Cases

- Staff cannot open `/admin/system/operations`.
- Anonymous users cannot see staff or admin handbook sections.
- Admin users with roles ordered as `["AUTHENTICATED", "ADMIN"]` still see admin
  handbook sections.
- Staff users with roles ordered as `["AUTHENTICATED", "STAFF"]` still see staff
  handbook sections but not admin sections.
- A stale operation button returns a stale/current-state response and does not
  dispatch the old action.
- A disabled operation button cannot dispatch from chat, admin, or jobs rail.
- A destructive action without required phrase confirmation is rejected before
  executor code runs.
- The assistant cannot claim an operation succeeded unless the operation ledger
  says it succeeded.

## Edge Cases

- Operation has no steps yet.
- Operation has no available actions.
- Operation has expired actions.
- Operation has more events, artifacts, or actions than the UI can display.
- Operation belongs to a deleted or unavailable conversation.
- Corpus handbook exists but a requested role has no matching section.
- `system-docs` is missing or malformed and help flow must report a blocked
  operation rather than hallucinating docs.
- The viewer has multiple roles and the strongest role is not first in the role
  array.
- The operation action route returns 409 stale after the UI rendered an old card.
- The user changes role simulation while viewing a role-gated help flow.

## Tests Required

Run and keep green:

```bash
npx vitest run \
  src/lib/operations/operation-presentation.test.ts \
  src/lib/operations/operation-action-view-model.test.ts \
  src/lib/operations/operation-action-markdown.test.ts \
  src/lib/operations/operation-action-api.test.ts \
  'src/app/api/operations/route.test.ts' \
  'src/app/api/operations/[operationId]/route.test.ts' \
  'src/app/api/operations/[operationId]/events/route.test.ts' \
  'src/app/api/operations/[operationId]/artifacts/route.test.ts' \
  'src/app/api/operations/[operationId]/actions/[actionId]/route.test.ts' \
  src/frameworks/ui/operations/OperationActionButton.test.tsx \
  src/frameworks/ui/operations/OperationCard.test.tsx \
  src/frameworks/ui/RichContentRenderer.test.tsx \
  src/frameworks/ui/MessageList.test.tsx \
  src/frameworks/ui/chat/bubbles/AssistantBubble.test.tsx \
  src/frameworks/ui/chat/primitives/capability-card-primitives.test.tsx \
  src/frameworks/ui/useChatSurfaceState.test.tsx \
  src/app/operations/page.test.tsx \
  'src/app/operations/[operationId]/page.test.tsx' \
  src/app/admin/system/operations/page.test.tsx \
  src/lib/access/content-access.test.ts \
  src/lib/corpus-access.test.ts \
  src/lib/corpus-library.test.ts \
  src/core/platform/knowledge-access/KnowledgeAccessService.test.ts \
  src/lib/operations/help-flow-operation.test.ts \
  src/lib/operations/onboarding-flow-operation.test.ts \
  src/lib/operations/operation-action-dispatch-root.test.ts \
  src/core/use-cases/operations/OperationActionPolicy.test.ts \
  src/core/use-cases/operations/OperationDraftFactory.test.ts \
  src/core/use-cases/operations/OperationKindRegistry.test.ts \
  src/core/use-cases/operations/OperationPromptGrounding.test.ts
```

Also run:

```bash
npm run typecheck
npm run lint
git diff --check
```

Guardrail searches:

```bash
rg -n "window\\.prompt\\(" src/frameworks/ui src/components src/app
rg -n "listOperationsForAdmin\\(|listOperationsByConversation\\(" src/app/api src/lib/operations
rg -n "system-docs\"|slug\": \"system-docs\"" docs/_corpus/system-docs
rg -n "help\\.|onboarding\\." src/core/use-cases/operations src/lib/operations
```

Expected guardrail outcomes:

- No `window.prompt` remains in operation action confirmation.
- Operation read routes/loaders use repository read methods rather than SQL.
- `docs/_corpus/system-docs/book.json` exists and uses slug `system-docs`.
- `help.*` and `onboarding.*` actions have action factories, payload
  validators, draft-factory output, and dispatch executors.
- Role-gated help uses strongest effective role, not first role array order.

## Implementation Closeout

Phase 09 is implemented as of 2026-05-03.

Implemented code surfaces:

- Operation read/create APIs and server loaders:
  `src/app/api/operations/*`, `src/lib/operations/operation-read-api.ts`, and
  `src/lib/operations/operation-workspace-loader.ts`.
- Shared operation presentation and UI primitives:
  `src/lib/operations/operation-presentation.ts` and
  `src/frameworks/ui/operations/*`.
- First-class operation-card rich content:
  `src/core/entities/rich-content.ts`,
  `src/adapters/MarkdownParserService.ts`,
  `src/frameworks/ui/RichContentRenderer.tsx`, and
  `src/lib/operations/operation-intent-projection.ts`.
- Staff/admin operation workspaces:
  `/operations`, `/operations/[operationId]`, and
  `/admin/system/operations`.
- Governed system handbook:
  `docs/_corpus/system-docs/book.json` and role-gated chapters under
  `docs/_corpus/system-docs/chapters`.
- Help and onboarding operation actions, validators, draft output, and dispatch
  executors:
  `HelpFlowOperationActions.ts`, `OnboardingFlowOperationActions.ts`,
  `help-flow-operation.ts`, `onboarding-flow-operation.ts`,
  `OperationActionPolicy.ts`, `OperationDraftFactory.ts`, and
  `operation-action-dispatch-root.ts`.
- Strongest-role corpus/help access and explicit `member` audience support:
  `src/lib/corpus-access.ts` and `src/lib/access/content-access.ts`.

Verification completed:

- Required Phase 09 vitest suite: 30 files passed, 181 tests passed.
- `npm run typecheck`: passed.
- `npm run lint`: passed with warnings only.
- `git diff --check`: passed.
- `rg -n "window\\.prompt\\(" src/frameworks/ui src/components src/app`:
  no matches.
- `rg -n "listOperationsForAdmin\\(|listOperationsByConversation\\("
  src/app/api src/lib/operations`: only centralized repository read usage in
  `src/lib/operations/operation-read-api.ts`.
- `rg -n "system-docs\"|slug\": \"system-docs\""
  docs/_corpus/system-docs`: active `book.json` manifest found.
- `rg -n "help\\.|onboarding\\." src/core/use-cases/operations
  src/lib/operations`: factories, validators, executors, and tests found.

## Exit Criteria

- Conversation operation messages render first-class operation cards, not just
  markdown text with hidden-looking links.
- All user-visible operation actions are typed operation actions with clear
  visual state.
- Dangerous actions use owned confirmation UI and fail safely when stale.
- `/operations` gives staff/admin a shared operation queue and detail view.
- `/admin/system/operations` gives admins appliance operation health and
  destructive-operation oversight.
- The system handbook is active in `_corpus` and role-gated by existing content
  access controls.
- Multi-role users get handbook access according to their strongest effective
  role.
- Help and onboarding flows create or resume `help_flow` and
  `onboarding_flow` operations.
- The first user experience changes by role and matches what the CEO chief of
  staff should reveal to that role.
- No operation state is inferred from chat text when operation ledger truth is
  available.
