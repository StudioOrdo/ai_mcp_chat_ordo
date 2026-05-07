# Phase 03: Operation Action Dispatch

Status: Implemented and QA closed on 2026-05-03

## Goal

Make operation-backed buttons execute durable typed operation actions instead of
sending natural-language text back into chat.

Phase 03 is the dispatch boundary. It must connect the Phase 01 action policy
and Phase 02 operation ledger to API and UI action handling. It must not migrate
backup/restore, media, or factory behavior yet. Those subsystem migrations begin
in Phases 06 through 08.

The net result is:

- every operation action click goes through a typed API,
- stale, unauthorized, disabled, expired, duplicate, and malformed actions fail
  safely,
- the response returns current operation state and available next actions,
- low-risk chat suggestions remain available but are visually and semantically
  separate from operation actions.

## Inputs From Phase 00, 01, And 02

Phase 00 evidence:

- `../evidence/phase-00-baseline.md`

Phase 01 implementation:

- `src/core/entities/operation.ts`
- `src/core/use-cases/operations/OperationActionPolicy.ts`
- `src/core/use-cases/operations/OperationStateMachine.ts`
- `src/core/use-cases/operations/OperationKindRegistry.ts`
- `src/core/use-cases/operations/OperationStatusMapping.ts`

Phase 02 implementation:

- `src/core/use-cases/operations/OperationRepository.ts`
- `src/core/use-cases/operations/OperationReadModel.ts`
- `src/adapters/OperationDataMapper.ts`
- `src/adapters/RepositoryFactory.ts`

Key constraints carried forward:

- `OperationAction.id` is the durable button identity.
- `OperationAction.actionType` is the handler name and is not unique enough for
  API routing.
- `OperationAction.operationRevision` must match the current operation revision
  unless the same action was already accepted with the same `idempotencyKey`.
- `OperationRepository.acceptAction` records accepted actions and appends
  `action_requested`.
- Policy-level rejections append `action_rejected`.
- Reusing an accepted action id with a different `idempotencyKey` is rejected
  before mutation.
- Phase 02 already exposes `getOperationRepository()` with DB-handle
  invalidation.

## Current Code Grounding

### Existing UI Action Surfaces

- `src/core/entities/rich-content.ts`
  - `ActionLinkType` currently supports `conversation`, `route`, `send`,
    `tool`, `corpus`, `external`, and `job`.
  - `ActionLinkInlineNode.params` is `Record<string, string>`, so any operation
    action bridge must either use string-safe params or introduce a typed
    operation action model.
- `src/core/entities/message-parts.ts`
  - job status message parts can carry action links with `ActionLinkType`.
- `src/frameworks/ui/useChatSurfaceState.tsx`
  - centralizes `ACTION_HANDLERS`.
  - `tool` actions still call `sendMessage(text)`.
  - `job` actions call `/api/chat/jobs/:jobId`.
- `src/frameworks/ui/RichContentRenderer.tsx`
  - inline action links render as underlined text-like buttons.
- `src/frameworks/ui/MessageList.tsx`
  - message action chips render compact pill buttons and infer primary values
    from `ACTION_VALUE_KEY`.
- `src/frameworks/ui/chat/bubbles/AssistantBubble.tsx`
  - duplicates message action chip behavior for assistant bubbles.
- `src/frameworks/ui/chat/primitives/CapabilityActionRail.tsx`
  - renders tool-plugin action rails from computed actions.
- `src/frameworks/ui/chat/plugins/custom/ApplianceBackupCard.tsx`
  - renders backup and restore action rails.

Decision:

Add `operation` as a first-class action type, but do not let every renderer
hand-roll operation dispatch. Centralize normalization in one UI adapter and one
action handler. Operation buttons must render with a button treatment distinct
from inline links and low-risk suggestions.

### Existing Natural-Language Action Gap

- `src/core/use-cases/tools/appliance-backup.tool.ts`
  - `toolAction()` creates `actionType: "tool"` links that send text such as
    `Create safety backup for appliance restore ...`.
  - This is the exact failure mode Phase 03 is designed to prevent for
    operation-backed actions.

Decision:

Phase 03 must not fully migrate appliance backup/restore actions because that
belongs to Phase 06. It must create the typed operation action path and add a
guardrail: new dangerous or multi-step rich-content actions must use
`ActionLinkType: "operation"` and must carry a stored `OperationAction.id`.
Existing appliance backup `tool` actions are a documented legacy exception until
Phase 06 replaces them with operation actions.

### Existing API And Auth Patterns

- `src/app/api/chat/jobs/[jobId]/route.ts`
  - existing chat job action route shape.
- `src/app/api/jobs/[jobId]/route.ts`
  - existing job action route shape.
- `src/app/api/admin/system/backups/route.ts`
  - uses `requireAdminPageAccess()` before backup mutation.
- `src/app/api/admin/system/restore-plans/[planId]/execute/route.ts`
  - maps resource-pressure and backup errors to HTTP responses.
- `src/lib/auth.ts`
  - exposes `getSessionUser()`.
- `src/lib/access/content-access.ts`
  - has `getPrimaryRole()`, but it returns the first role rather than the
    strongest role.
- `src/core/entities/user.ts`
  - role literals are `ANONYMOUS`, `AUTHENTICATED`, `APPRENTICE`, `STAFF`,
    `ADMIN`.

Decision:

Do not use `getPrimaryRole()` for operation action dispatch. Add a local helper
that resolves the strongest effective role in this order:

1. `ADMIN`
2. `STAFF`
3. `APPRENTICE`
4. `AUTHENTICATED`
5. `ANONYMOUS`

Then pass that role to Phase 01 `OperationActionPolicy` through
`OperationRepository.acceptAction`.

### Existing Operation Storage

- `OperationDataMapper` already persists operations, actions, events, artifacts,
  and read models.
- `acceptAction` already performs idempotency, stale-action, authorization,
  confirmation, and payload validation through Phase 01 policy.
- `listAvailableActions` and conversation/admin summaries already provide the
  current operation state needed after a click.

Decision:

The API route must call a use case that depends on the `OperationRepository`
interface, not on raw SQL or `OperationDataMapper` directly.

## Clean Architecture Shape

Expected new core/use-case files:

- `src/core/use-cases/operations/OperationActionDispatch.ts`
- `src/core/use-cases/operations/OperationActionDispatch.test.ts`

Expected new framework/lib files:

- `src/lib/operations/operation-action-api.ts`
- `src/lib/operations/operation-action-api.test.ts`
- `src/lib/operations/operation-action-view-model.ts`
- `src/lib/operations/operation-action-view-model.test.ts`

Expected new API route:

- `src/app/api/operations/[operationId]/actions/[actionId]/route.ts`
- `src/app/api/operations/[operationId]/actions/[actionId]/route.test.ts`

Expected modified UI/domain files:

- `src/core/entities/rich-content.ts`
- `src/core/entities/message-parts.ts`
- `src/frameworks/ui/useChatSurfaceState.tsx`
- `src/frameworks/ui/RichContentRenderer.tsx`
- `src/frameworks/ui/MessageList.tsx`
- `src/frameworks/ui/chat/bubbles/AssistantBubble.tsx`
- `src/frameworks/ui/chat/primitives/CapabilityActionRail.tsx`
- relevant renderer tests for the modified surfaces.

Do not put operation action dispatch into React components, chat stream code, or
tool implementations. React can render and call the endpoint; the use case owns
the action contract.

## Dispatch Use Case Contract

Create `OperationActionDispatchService` in
`src/core/use-cases/operations/OperationActionDispatch.ts`.

Required input:

- `operationId`
- `actionId`
- `idempotencyKey`
- `clientOperationRevision`
- `actorUserId`
- `actorRole`
- `payload`
- `confirmation`
- `now`

Required output:

- `accepted`
- `duplicate`
- `operationId`
- `actionId`
- `actionType`
- `idempotencyKey`
- `acceptedAt`
- `snapshot`
- `conversationSummary`
- `availableActions`

Rules:

- Load the current operation snapshot before accepting the action.
- Reject missing operations or missing actions before mutation.
- Compare `clientOperationRevision` to the stored action
  `operationRevision`; stale clients must fail before mutation and return
  current operation state.
- Resolve the handler name from stored `OperationAction.actionType`, not from
  the request path.
- Call `OperationRepository.acceptAction()` for authorization, idempotency,
  confirmation, stale status, expiration, and payload validation.
- If `acceptAction()` returns `duplicate: true`, return the current snapshot
  without appending a second event.
- The use case must accept a registry of action executors. Phase 03 may wire an
  empty production registry until later phases expose supported operation action
  types, but tests must inject a fake executor to prove the dispatch path.
- Unknown executable action types must not perform side effects. If no executor
  exists for the stored `actionType`, reject before acceptance and append an
  `action_rejected` event through the repository.

Executor interface:

```ts
export interface OperationActionExecutor {
  canExecute(actionType: string): boolean;
  execute(input: OperationActionExecutorInput): Promise<OperationActionExecutorResult>;
}
```

Executors are not allowed to bypass the repository. They may advance operation
status, transition steps, append events, attach artifacts, or enqueue subsystem
work through dedicated adapters.

Design pattern:

- Use the Command pattern for operation action executors.
- Use a Strategy/Registry for resolving `actionType` to an executor.
- Use Adapter objects at API/UI boundaries to translate HTTP and rendered action
  params into core dispatch input.

## API Contract

Add:

```text
POST /api/operations/:operationId/actions/:actionId
```

Do not use `actionType` in the path. `actionType` is not a durable identity.

Request body:

```json
{
  "idempotencyKey": "operation_action_idem_...",
  "operationRevision": 3,
  "payload": {},
  "confirmation": {
    "confirmed": true,
    "phrase": "RESTORE restore_...",
    "reauthenticated": false
  }
}
```

Response body on success:

```json
{
  "accepted": true,
  "duplicate": false,
  "operation": {},
  "conversationSummary": {},
  "availableActions": []
}
```

Response body on stale or rejected action:

```json
{
  "error": "Operation action is stale.",
  "errorCode": "OPERATION_ACTION_STALE",
  "operation": {},
  "conversationSummary": {},
  "availableActions": []
}
```

HTTP mapping:

- `401` for anonymous users where action roles do not allow anonymous dispatch.
- `403` for authenticated users whose strongest role is not allowed.
- `404` for missing operations/actions where revealing existence is not allowed.
- `409` for stale, expired, disabled, duplicate-with-different-key, or blocked
  action state.
- `422` for malformed body, malformed payload, or missing confirmation data.
- `501` for operation action types that have no registered executor.
- `500` only for unexpected server errors.

Route rules:

- Use `getSessionUser()` and strongest-role resolution.
- Construct the use case with `getOperationRepository()`.
- Do not import `OperationDataMapper` in the route.
- Do not call subsystem services directly from this route in Phase 03.
- Return current operation read state on all domain errors where the operation
  can be safely disclosed.

## UI Dispatch Contract

Add `operation` to `ActionLinkType` and `VALID_ACTION_TYPES`.

Operation action params must be generated from an `OperationAction` record by a
single view-model helper. UI code must not manually construct operation action
params in scattered components.

Required string params for an operation action link:

- `operationId`
- `actionId`
- `idempotencyKey`
- `operationRevision`
- optional `payloadJson`
- optional `confirmPolicy`
- optional `confirmationText`
- optional `riskLevel`
- optional `disabledReason`

`value` should be `operationId` for compatibility with current action handler
signatures. The handler must require `params.actionId`, `params.idempotencyKey`,
and `params.operationRevision`.

UI rules:

- `ACTION_HANDLERS.operation` must call the operation API.
- It must never call `sendMessage`.
- It must refresh the current conversation/operation state after success or
  domain rejection.
- It must preserve low-risk `send` suggestions as composer-fill actions.
- It must preserve `tool` actions only for non-operation legacy flows until
  Phases 06 through 08 migrate them.
- Operation actions must have a visible button treatment, not underlined inline
  text.
- Destructive actions must render with danger styling and confirmation UI.
- Disabled/stale actions must display the reason and avoid dispatch.

Confirmation UX:

- `confirmPolicy: "none"` can dispatch directly.
- `confirmPolicy: "single_click"` must use an explicit click button.
- `confirmPolicy: "phrase"` must collect and submit the phrase.
- `confirmPolicy: "admin_reauth"` must require a reauth flag or block with a
  clear message until reauth exists.

## Greenfield Pruning Rules

Do:

- add the operation action API route,
- add a core dispatch use case,
- add typed action rendering and click dispatch,
- keep all authorization and stale-action checks in the operation use case and
  repository,
- add tests that prove operation buttons do not send chat text.

Do not:

- migrate backup/restore tool behavior in Phase 03,
- migrate media or factory workflows,
- add prompt-grounding behavior,
- execute Rust commands directly from the operation action route,
- add direct SQL in API routes or UI components,
- add new dangerous `actionType: "tool"` or `actionType: "send"` buttons.

Documented temporary exception:

- Existing appliance backup/restore custom-card actions in
  `appliance-backup.tool.ts` may continue to use `actionType: "tool"` until
  Phase 06. Phase 03 should make this exception explicit in tests or comments so
  it does not become the pattern for new operation-backed work.

## Positive Use Cases

- A rendered operation action button posts to
  `/api/operations/:operationId/actions/:actionId`.
- An admin user accepts a current destructive action with a registered executor,
  matching `idempotencyKey`, `operationRevision`, and confirmation.
- The API returns updated operation summary and available actions.
- A duplicate double-click with the same `idempotencyKey` returns duplicate
  success without a second event.
- Low-risk chat suggestions still fill the composer through `send`.
- Existing job actions still call `/api/chat/jobs/:jobId` until job migration is
  scheduled separately.

## Negative Use Cases

- An operation action click never calls `sendMessage`.
- Missing `actionId`, `idempotencyKey`, or `operationRevision` is rejected before
  network dispatch.
- Anonymous users cannot dispatch admin-only actions.
- Staff users cannot dispatch admin-only actions.
- Stale `operationRevision` is rejected before acceptance mutation.
- Reusing an accepted action id with a different `idempotencyKey` is rejected.
- Missing confirmation phrase for a phrase-protected action is rejected.
- Disabled action is visible with a reason and does not dispatch.
- Unknown action handler cannot perform side effects.

## Edge Use Cases

- Action is accepted, response fails to refresh conversation; UI still shows a
  local pending/error state.
- Operation has no `conversationId`; dispatch still works for admin/system
  surfaces.
- Action expires between render and click; API returns current state and stale
  action error.
- User has multiple roles; dispatch uses strongest effective role.
- The action is already accepted and the same button is clicked again after a
  browser retry; idempotency returns duplicate success.
- Payload JSON in UI params is malformed; handler rejects before API call.

## Test Plan

Required tests:

```bash
npx vitest run \
  src/core/use-cases/operations/OperationActionDispatch.test.ts \
  src/lib/operations/operation-action-api.test.ts \
  src/lib/operations/operation-action-view-model.test.ts \
  'src/app/api/operations/[operationId]/actions/[actionId]/route.test.ts' \
  src/frameworks/ui/useChatSurfaceState.test.tsx \
  src/frameworks/ui/RichContentRenderer.test.tsx \
  src/frameworks/ui/MessageList.test.tsx \
  src/frameworks/ui/chat/bubbles/AssistantBubble.test.tsx \
  src/core/entities/operation.test.ts \
  src/adapters/OperationDataMapper.test.ts \
  src/core/use-cases/operations/OperationStateMachine.test.ts \
  src/core/use-cases/operations/OperationActionPolicy.test.ts \
  src/core/use-cases/operations/OperationKindRegistry.test.ts \
  src/core/use-cases/operations/OperationStatusMapping.test.ts

npm run typecheck -- --pretty false
```

Focused lint:

```bash
npx eslint \
  src/core/use-cases/operations/OperationActionDispatch.ts \
  src/lib/operations/operation-action-api.ts \
  src/lib/operations/operation-action-view-model.ts \
  'src/app/api/operations/[operationId]/actions/[actionId]/route.ts' \
  src/frameworks/ui/useChatSurfaceState.tsx \
  src/frameworks/ui/RichContentRenderer.tsx \
  src/frameworks/ui/MessageList.tsx \
  src/frameworks/ui/chat/bubbles/AssistantBubble.tsx
```

Minimum coverage:

- dispatch service accepts a valid action,
- dispatch service rejects stale client revision before mutation,
- dispatch service preserves duplicate idempotent click behavior,
- route maps auth/domain errors to stable HTTP responses,
- route does not import concrete SQLite mappers,
- view-model helper maps `OperationAction` to operation action params,
- UI operation handler calls operation API,
- UI operation handler never calls `sendMessage`,
- destructive action rendering is visibly button-like and danger-styled,
- disabled/stale action rendering explains why,
- legacy `send` suggestion still fills composer text.

## Exit Criteria

- `operation` is a first-class action type.
- Operation action API route exists and routes by `operationId` plus `actionId`.
- Operation action dispatch uses `OperationRepository`, not raw SQL.
- Operation action dispatch uses Phase 01 policy through
  `OperationRepository.acceptAction`.
- Stale, unauthorized, disabled, expired, malformed, and duplicate action cases
  have deterministic outcomes.
- UI action handling is centralized and type-safe.
- Operation buttons no longer rely on natural-language chat text.
- Low-risk suggestions remain clearly separate from operation buttons.
- No backup/restore, media, factory, prompt, or Rust migration leaks into Phase
  03.

## QA Certification

QA completed on 2026-05-03 against:

- Phase 00 baseline evidence,
- Phase 01 operation domain/action policy,
- Phase 02 operation repository and mapper,
- current rich-content action types,
- current chat action dispatch,
- current API route/auth/test conventions.

Certification notes:

- The route identity is correctly specified as `operationId + actionId`; stored
  `OperationAction.actionType` remains the executor handler key.
- The UI action identity is correctly specified as rich-content
  `ActionLinkType: "operation"`.
- The spec preserves Phase 03 scope by excluding backup/restore, media, factory,
  prompt-grounding, and Rust migration work.
- The test plan covers positive, negative, and edge cases needed to prevent the
  previous natural-language action failure mode from returning.

## Implementation Closeout

Implemented on 2026-05-03.

### Completed Scope

- Added `ActionLinkType: "operation"` and rich-content validation support.
- Added `OperationActionDispatchService` with executor registry, stale-client
  rejection, unknown-executor rejection, duplicate idempotency preservation, and
  current-state domain error projection.
- Added typed HTTP helpers for request parsing, strongest-role resolution, and
  deterministic error-to-status mapping.
- Added operation action view-model helpers that convert stored
  `OperationAction` records into string-safe rich-content params and reject
  malformed `payloadJson` before network dispatch.
- Added `POST /api/operations/[operationId]/actions/[actionId]`, routed by
  durable operation/action identity and backed by `getOperationRepository()`.
- Kept Phase 03 production execution intentionally narrow with a no-op
  `diagnostic.run` executor; subsystem executors for backup/restore, media, and
  factory remain reserved for later migration phases.
- Updated chat action handling so operation clicks call the operation API and
  never call `sendMessage`.
- Operation action dispatch now refreshes on success/domain rejection and
  surfaces a local chat error if the dispatch fails before refresh.
- Updated rich-content, message-chip, assistant-bubble, and capability-rail
  rendering so operation actions are visibly button-like, destructive actions
  carry danger intent, and disabled operation actions display a reason and do
  not dispatch.
- Updated both action normalizers so `operation` links are preserved only when
  they include durable operation/action identity, idempotency key, and revision.
- Guarded markdown action parsing so arbitrary `?operation=` links without the
  required durable params fall back to plain text instead of becoming malformed
  dispatch buttons.
- Preserved legacy `tool`, `send`, `job`, route, conversation, corpus, and
  external action behavior.

### Verification

Passed:

```bash
npx vitest run src/adapters/ChatPresenter.test.ts src/adapters/MarkdownParserService.test.ts tests/ActionRouteNormalizer.test.ts src/core/use-cases/operations/OperationActionDispatch.test.ts src/lib/operations/operation-action-api.test.ts src/lib/operations/operation-action-view-model.test.ts 'src/app/api/operations/[operationId]/actions/[actionId]/route.test.ts' src/frameworks/ui/useChatSurfaceState.test.tsx src/frameworks/ui/RichContentRenderer.test.tsx src/frameworks/ui/MessageList.test.tsx src/frameworks/ui/chat/bubbles/AssistantBubble.test.tsx src/core/entities/operation.test.ts src/adapters/OperationDataMapper.test.ts src/core/use-cases/operations/OperationStateMachine.test.ts src/core/use-cases/operations/OperationActionPolicy.test.ts src/core/use-cases/operations/OperationKindRegistry.test.ts src/core/use-cases/operations/OperationStatusMapping.test.ts src/frameworks/ui/chat/primitives/capability-card-primitives.test.tsx src/frameworks/ui/chat/ToolPluginPartRenderer.test.tsx src/frameworks/ui/jobs-rail/resolve-jobs-rail.test.ts src/frameworks/ui/jobs-rail/JobsRail.test.tsx
```

Result: 21 files passed, 281 tests passed.

Passed:

```bash
npm run typecheck -- --pretty false
```

Passed:

```bash
npx eslint src/core/use-cases/operations/OperationActionDispatch.ts src/lib/operations/operation-action-api.ts src/lib/operations/operation-action-view-model.ts 'src/app/api/operations/[operationId]/actions/[actionId]/route.ts' src/frameworks/ui/useChatSurfaceState.tsx src/frameworks/ui/RichContentRenderer.tsx src/frameworks/ui/MessageList.tsx src/frameworks/ui/chat/bubbles/AssistantBubble.tsx src/frameworks/ui/chat/primitives/CapabilityActionRail.tsx src/lib/chat/ActionRouteNormalizer.ts src/adapters/MarkdownParserService.ts
```

### Residual Scope

- Backup/restore, media, factory, prompt-grounding, and Rust executor
  migrations remain intentionally out of Phase 03.
- Existing appliance backup/restore `tool` action links remain a documented
  temporary exception until Phase 06 migrates them to stored operation actions.

## QA Revalidation

Revalidated on 2026-05-03 after the implementation closeout.

Passed:

```bash
npx vitest run src/adapters/ChatPresenter.test.ts src/adapters/MarkdownParserService.test.ts tests/ActionRouteNormalizer.test.ts src/core/use-cases/operations/OperationActionDispatch.test.ts src/lib/operations/operation-action-api.test.ts src/lib/operations/operation-action-view-model.test.ts 'src/app/api/operations/[operationId]/actions/[actionId]/route.test.ts' src/frameworks/ui/useChatSurfaceState.test.tsx src/frameworks/ui/RichContentRenderer.test.tsx src/frameworks/ui/MessageList.test.tsx src/frameworks/ui/chat/bubbles/AssistantBubble.test.tsx src/core/entities/operation.test.ts src/adapters/OperationDataMapper.test.ts src/core/use-cases/operations/OperationStateMachine.test.ts src/core/use-cases/operations/OperationActionPolicy.test.ts src/core/use-cases/operations/OperationKindRegistry.test.ts src/core/use-cases/operations/OperationStatusMapping.test.ts src/frameworks/ui/chat/primitives/capability-card-primitives.test.tsx src/frameworks/ui/chat/ToolPluginPartRenderer.test.tsx src/frameworks/ui/jobs-rail/resolve-jobs-rail.test.ts src/frameworks/ui/jobs-rail/JobsRail.test.tsx
```

Result: 21 files passed, 281 tests passed.

Passed:

```bash
npm run typecheck -- --pretty false
```

Passed:

```bash
npx eslint src/core/use-cases/operations/OperationActionDispatch.ts src/lib/operations/operation-action-api.ts src/lib/operations/operation-action-view-model.ts 'src/app/api/operations/[operationId]/actions/[actionId]/route.ts' src/frameworks/ui/useChatSurfaceState.tsx src/frameworks/ui/RichContentRenderer.tsx src/frameworks/ui/MessageList.tsx src/frameworks/ui/chat/bubbles/AssistantBubble.tsx src/frameworks/ui/chat/primitives/CapabilityActionRail.tsx src/lib/chat/ActionRouteNormalizer.ts src/adapters/MarkdownParserService.ts src/adapters/ChatPresenter.ts
```

Manual QA confirmed:

- the operation action API route uses `operationId + actionId` and
  `getOperationRepository()`,
- no concrete operation mapper, raw SQLite handle, Rust command, or
  backup/restore/media/factory subsystem call is imported by the Phase 03 route
  or dispatch use case,
- stale client revisions and unknown executors reject before acceptance,
- operation UI dispatch posts to the operation API and never sends natural
  language chat text for operation buttons,
- malformed operation links are filtered before they become dispatchable UI.
