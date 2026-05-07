# Phase 04: Intent Compiler And Router

Status: Implemented on 2026-05-03

## Goal

Introduce a constrained operation intent compiler and deterministic router that
runs before normal chat tool exposure.

The net result of this phase is:

- operation-backed requests are converted into durable operation drafts,
  clarifying questions, blocked operation state, or safe rejections;
- the LLM may classify and extract, but cannot execute work;
- deterministic code owns operation creation, role validation, provider/tool
  availability checks, and operation projection back into chat;
- ordinary conversational turns, math turns, and slash commands continue to use
  their existing paths;
- operation-backed work stops depending on natural-language action text such as
  `fire it`, `Create safety backup...`, or `Execute restore...`.

Phase 04 must not migrate backup/restore, media, or factory execution yet. Those
subsystem migrations belong to Phases 06 through 08. Phase 04 creates the
ingress contract those migrations will use.

## Inputs From Phase 00 Through Phase 03

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

Phase 03 implementation:

- `src/core/use-cases/operations/OperationActionDispatch.ts`
- `src/lib/operations/operation-action-view-model.ts`
- `src/lib/operations/operation-action-api.ts`
- `src/app/api/operations/[operationId]/actions/[actionId]/route.ts`
- `src/frameworks/ui/useChatSurfaceState.tsx`
- `src/frameworks/ui/RichContentRenderer.tsx`

Key constraints carried forward:

- `OperationKindRegistry` is the canonical registry for operation kinds,
  labels, role policy, risk defaults, visibility, and handler keys.
- `OperationRepository.createOperation()` is the only persistence boundary for
  new operations.
- `OperationRepository.replaceActions()` is the only persistence boundary for
  operation action exposure.
- `OperationActionDispatchService` routes by stored `operationId + actionId`,
  not by action type in the URL.
- `OperationActionPolicy` owns idempotency, stale-action handling,
  confirmation policy, role policy, disabled-action handling, and payload
  validation.
- `RichContentRenderer` already renders `actionType: "operation"` as a real
  operation button and disables it when `params.disabledReason` is present.
- Existing appliance backup rich-content actions still use `actionType: "tool"`
  and natural-language text in `src/core/use-cases/tools/appliance-backup.tool.ts`.
  That is a documented legacy gap until Phase 06 replaces those paths.

## Current Code Grounding

### Chat Stream Entry Point

Primary path:

- `src/lib/chat/stream-route-handler.ts`
- `src/lib/chat/stream-pipeline.ts`
- `src/lib/chat/stream-intake.ts`
- `src/lib/chat/stream-preparation.ts`
- `src/lib/chat/stream-short-circuits.ts`
- `src/lib/chat/stream-execution.ts`

Current order in `executeChatStreamRoute()`:

1. resolve session;
2. validate and parse request;
3. create prompt builder and tool execution surface;
4. ensure conversation;
5. assign attachments;
6. persist user message;
7. run slash-command short-circuit;
8. prepare routing/context-window state;
9. run math short-circuit;
10. block oversized context;
11. select request-scoped tools;
12. add tool manifest to prompt;
13. finalize prompt and provenance;
14. stream model/tool loop.

Decision:

Phase 04 must add one shared operation intent stage after context preparation
and context-window guard, but before `getRequestScopedToolSelection()` and
before `builder.withToolManifest()`.

The stage needs the persisted user message id, conversation id, role, user id,
latest text, attachments, prepared routing snapshot, media/task handoffs, and
tool/provider availability snapshot. It must be early enough that an
operation-backed request never receives general tool schemas.

Slash commands and the existing math short-circuit remain before the operation
compiler. Slash commands are explicit commands. Math has a deterministic local
tool path and is not operation-backed.

### Direct Turn Entry Point

Current path:

- `src/lib/chat/chat-turn.ts`

`executeDirectChatTurn()` currently builds a prompt, exposes prompt-visible
tools to the model, and lets `orchestrateChatTurn()` choose tool calls. It has
no durable conversation id and no operation creation boundary.

Decision:

Phase 04 must add a direct-turn guard for operation-backed requests. Until a
conversation-backed operation ingress exists for direct turns, direct-turn
requests that compile to operation-backed work must return a safe rejection
message that tells the caller to use the conversation/admin surface. Direct
turns may continue for normal chat and calculator-style requests.

Do not allow direct turns to execute `backup_create`, `restore_execute`,
`media_workflow`, `factory_work_order`, `content_publish`, or `tool_task`
requests through model-selected tools.

### Current Routing Is Not An Operation Compiler

Current code:

- `src/lib/chat/routing-analysis.ts`
- `src/lib/chat/tool-capability-routing.ts`

`HeuristicConversationRoutingAnalyzer` assigns broad lanes:

- `organization`
- `individual`
- `development`
- `uncertain`

`getRequestScopedToolSelection()` uses lane, role, and media continuity to
filter prompt-visible tools.

Decision:

Reuse the routing snapshot as one input to Phase 04. Do not extend the lane
router into an operation compiler. The operation compiler needs its own schema,
validation, confidence rules, role/risk policy, and deterministic router.

### Current Tool/Provider Gates

Current code:

- `src/lib/chat/tool-composition-root.ts`
- `src/core/tool-registry/ToolRegistry.ts`
- `src/lib/tools/tool-availability-service.ts`
- `src/lib/tools/tool-provider-capability-policy.ts`
- `src/core/capability-catalog/runtime-tool-binding.ts`
- `src/core/capability-catalog/families/admin-capabilities.ts`

Relevant current behavior:

- `ToolAvailabilityService` computes effective runtime availability from
  install profile, static config, admin runtime overrides, protected tools, and
  provider capability availability.
- `ToolRegistry.getPromptVisibleSchemasForRole()` already supports
  `default_chat`, `intent_gated`, `operator_chat`, and `internal`.
- Admin appliance backup/restore capabilities are currently `operator_only`,
  but admin chat uses `operator_chat`, so those tools can still be exposed to
  the chat model today.
- Provider-backed tools are gated for image, TTS, and web search through
  `TOOL_PROVIDER_CAPABILITY_REQUIREMENTS`.

Decision:

The operation intent router must check effective tool/capability availability
before creating executable operation actions. If a required tool or provider
capability is disabled, missing, or role-denied, the router creates a blocked
operation state or safe rejection. It must not expose a button that can only
fail through a missing executor unless that button is intentionally disabled
with a clear `disabledReason`.

Phase 04 should also introduce an operation-backed tool exclusion in normal chat
tool selection so requests that are already handled by the compiler do not fall
through into model-selected tool execution.

### Current Executor And Resource Gates

Current code:

- `src/lib/appliance/health-facade.ts`
- `src/lib/appliance/probes/backup-restore-probe.ts`
- `src/lib/appliance/resources/resource-pressure-service.ts`
- `src/lib/appliance/backup/backup-self-service.ts`

Backup/restore availability is not only a tool/provider question. The current
system also has executor and resource guardrails:

- backup/restore executor availability depends on `ORDO_BACKUP_EXECUTOR_PATH`
  and `DISABLE_BACKUP_EXECUTOR`;
- resource pressure can block backup, pre-restore backup, restore execution, and
  large media work before mutation;
- backup health already projects policy, failed command, latest backup, and
  executor warnings.

Decision:

Phase 04 must treat these as abstract gate inputs to the router. Infrastructure
may read the health facade, backup restore probe, and resource pressure summary,
but the core router receives a serializable gate snapshot. The core router must
not import backup self-service classes, health facade classes, resource service
classes, or Rust executor code.

### Existing Operation Creation And Action Dispatch

Current code:

- `src/core/use-cases/operations/OperationRepository.ts`
- `src/adapters/OperationDataMapper.ts`
- `src/core/use-cases/operations/OperationActionDispatch.ts`
- `src/lib/operations/operation-action-view-model.ts`
- `src/app/api/operations/[operationId]/actions/[actionId]/route.ts`

Important current limits:

- Production operation action dispatch currently wires only a
  `diagnostic.run` executor.
- Backup/restore, media, and factory operation action executors are not wired
  yet.
- Therefore Phase 04 can create operation drafts and disabled/blocked actions
  for those families, but must not claim execution is available until later
  migration phases register executors.

Decision:

Phase 04 operation creation is valuable even before subsystem migration because
it gives the user a durable truth object, blocks unsafe execution, and removes
the false-completion failure mode from chat. Executable buttons for subsystem
work arrive in Phases 06 through 08.

### Current Message Projection Shape

Current code:

- `src/core/entities/conversation.ts`
- `src/core/entities/message-parts.ts`
- `src/core/entities/rich-content.ts`
- `src/adapters/MarkdownParserService.ts`
- `src/adapters/ChatPresenter.ts`

Messages persist `content` markdown plus `parts`. The presenter parses markdown
into rich content. There is no general persisted `RichContent` message payload
today.

Decision:

Phase 04 must not make every chat caller hand-build operation action query
strings. Add a small operation action markdown serializer in `src/lib/operations`
that converts stored `OperationAction` records through
`operationActionToActionLink()` and then serializes the resulting action link
into the existing `[Label](?operation=...)` markdown syntax. Test the serializer
with `MarkdownParserService` and `parseOperationActionLinkModel()` so projected
operation buttons are round-trip safe.

## Clean Architecture Shape

### Core Use Cases

Create operation intent contracts in the core layer:

- `src/core/use-cases/operations/OperationIntent.ts`
- `src/core/use-cases/operations/OperationIntentCompiler.ts`
- `src/core/use-cases/operations/OperationIntentRouter.ts`
- `src/core/use-cases/operations/OperationIntentPolicy.ts`
- `src/core/use-cases/operations/OperationDraftFactory.ts`
- `src/core/use-cases/operations/OperationIntentRouter.test.ts`
- `src/core/use-cases/operations/OperationIntentPolicy.test.ts`

Core owns:

- schema-safe intent data types;
- compiler output validation;
- deterministic intent outcome routing;
- operation kind lookup through `OperationKindRegistry`;
- role/risk authorization decisions;
- draft/blocked/clarification/rejection state selection;
- operation input payload shape for `OperationRepository.createOperation()`;
- action construction rules for disabled and enabled operation actions.

Core must not import Next.js, React, Anthropic SDKs, `better-sqlite3`, route
handlers, or the tool registry implementation.

### Infrastructure And Chat Integration

Create adapter/integration code outside the core layer:

- `src/lib/operations/operation-intent-schema.ts`
- `src/lib/operations/operation-intent-compiler.ts`
- `src/lib/operations/operation-intent-ingress.ts`
- `src/lib/operations/operation-intent-projection.ts`
- `src/lib/operations/operation-action-markdown.ts`
- `src/lib/operations/operation-intent-root.ts`
- `src/lib/operations/operation-intent-schema.test.ts`
- `src/lib/operations/operation-intent-ingress.test.ts`
- `src/lib/operations/operation-intent-projection.test.ts`
- `src/lib/operations/operation-action-markdown.test.ts`

Modify chat integration:

- `src/lib/chat/stream-pipeline.ts`
- `src/lib/chat/stream-route-handler.ts`
- `src/lib/chat/stream-response-helpers.ts`
- `src/lib/chat/chat-turn.ts`
- `src/lib/chat/tool-capability-routing.ts`

Infrastructure owns:

- optional LLM-backed compiler adapter;
- deterministic fallback compiler for obvious operation-backed requests;
- provider resilience/observability integration if an LLM compiler is used;
- reading the effective tool manifest;
- mapping tool, provider, executor, and resource availability into core policy
  inputs;
- persisting assistant projection messages;
- returning a short-circuit SSE response when an operation result replaces the
  normal model stream.

### Patterns

Use these patterns deliberately:

- Strategy: `OperationIntentCompiler` allows a deterministic compiler and an
  LLM-backed compiler behind the same interface.
- Factory Method: per-kind `OperationDraftFactory` builders create operation
  inputs, steps, and candidate actions.
- Chain of Responsibility: deterministic pre-classifiers can claim obvious
  operation intents before the LLM compiler is called.
- Adapter: chat stream/direct-turn code depends on `OperationIntentIngress`,
  not compiler internals.
- Policy Object: role, risk, provider, and tool gates remain explicit and
  testable.

Avoid:

- API routes creating operation rows directly;
- React components inferring operation state;
- model output becoming operation state without schema validation;
- operation actions encoded as `actionType: "tool"`;
- natural-language button text dispatch for operation-backed work;
- a second autonomous "planner agent" between user and system.

## Intent Contract

### Compiler Input

`OperationIntentCompilerInput` must include:

- `conversationId`
- `originMessageId`
- `userId`
- `role`
- `latestUserText`
- `latestUserContent`
- `routingSnapshot`
- `attachments`
- `taskOriginHandoff`
- `mediaContinuityHandoff`
- `effectiveToolManifestVersion`
- `availableToolNames`
- `providerCapabilitySummary`
- `gateSnapshot`
- `now`

The compiler receives summaries and ids, not direct repository handles or tool
executors.

`providerCapabilitySummary`, executor state, and resource state should be
normalized into one `OperationGateSnapshot` before entering the core router.
That snapshot should contain only serializable facts such as gate id, state,
summary, remediation, and affected operation kinds.

### Compiler Output

The compiler output is a discriminated union:

- `pass_through`
- `operation_intent`
- `clarification_required`
- `rejected`

For `operation_intent`, required fields:

- `intentKind`
- `confidence`
- `operationKind`
- `requiredRole`
- `riskLevel`
- `title`
- `summary`
- `input`
- `requiredCapabilities`
- `requiredProviderSlots`
- `missingInputs`
- `source`

`source` is one of:

- `deterministic`
- `llm`
- `hybrid`

`confidence` rules:

- `>= 0.80`: eligible for deterministic routing if all required fields pass
  validation;
- `0.50` through `0.79`: create a clarification question or draft that requires
  confirmation;
- `< 0.50`: pass through normal chat unless destructive terms are present, in
  which case create a safe clarification.

### Supported Initial Intents

Phase 04 must support these initial operation intents:

- `backup_create`
  - admin only;
  - operation status `draft` or `blocked`;
  - candidate backup action is disabled until Phase 06 registers
    `backup.create`;
  - if backup executor/tool availability is missing, status is `blocked`.
- `restore_execute`
  - admin only;
  - destructive;
  - requires a full unambiguous backup snapshot id before creating an
    executable restore plan;
  - ambiguous or missing snapshot id produces clarification;
  - candidate restore actions are disabled until Phase 06 registers restore
    executors.
- `media_workflow`
  - authenticated or higher;
  - operation status `draft` when the request needs artifact generation,
    composition, retries, or multi-step media processing;
  - candidate media actions are disabled until Phase 07 migrates media
    workflows.
- `factory_work_order`
  - staff/admin only;
  - operation status `draft` for software factory work, issue creation,
    implementation, QA, and release-style requests;
  - candidate factory actions are disabled until Phase 08 migrates factory work
    orders.
- `content_publish`
  - staff/admin only;
  - high risk;
  - draft or awaiting confirmation only in Phase 04.
- `onboarding_flow` and `help_flow`
  - all roles;
  - informational;
  - safe to create as operations when the request is for guided onboarding or
    role-gated system help, but no tool execution is required in this phase.

Normal conversation, retrieval/help that does not need durable state, math,
single-turn writing, and public Q&A should return `pass_through`.

## Router Contract

`OperationIntentRouter` accepts validated compiler output and returns one of:

- `pass_through`
- `created_operation`
- `clarification_response`
- `rejected_response`
- `blocked_operation`

Rules:

- The router must re-check `OperationKindRegistry` for every `operationKind`.
- The router must authorize the current role against the operation kind before
  operation creation unless the product requirement is to create a visible
  blocked operation for an authorized user with missing prerequisites.
- Unauthorized users receive a safe rejection before operation creation.
- Missing required fields create a clarification response. For destructive
  restore requests, missing or ambiguous snapshot ids must never be guessed.
- Tool/provider unavailable conditions create `blocked_operation` for authorized
  users, with `operation.error` and `operation.input.gates` recording the
  reason.
- Executor/resource unavailable conditions create `blocked_operation` for
  authorized users, with the gate id, summary, and remediation recorded in
  `operation.input.gates`.
- Before creating a new conversation-scoped operation, the router must query
  active operations in the same conversation and same operation kind. If a
  draft, awaiting-confirmation, queued, running, or blocked operation already
  exists for the same intent, project that operation instead of creating a
  duplicate unless the user explicitly asks for a new independent operation.
- The router must never execute a tool, enqueue a job, call the backup service,
  invoke Rust, mutate media/factory state, or dispatch operation actions.
- The router may create disabled operation actions if that improves UI clarity.
  Disabled actions must include `disabledReason` and must render through
  `operationActionToActionLink()`.
- Created operations must include `originMessageId`, `conversationId`,
  `createdByUserId`, and `createdByRole`.
- Every created operation must append the standard `operation_created` event
  through `OperationRepository.createOperation()`.

## Chat Integration Contract

Add a pipeline stage such as `maybeHandleOperationIntent()` to
`ChatStreamPipeline`.

The stage should run in `executeChatStreamRoute()` after:

- user message persistence,
- slash-command handling,
- prepared stream context creation,
- math short-circuit,
- context-window block check.

The stage must run before:

- request-scoped tool selection,
- `builder.withToolManifest()`,
- prompt finalization,
- prompt provenance recording,
- model streaming.

Outcome behavior:

- `pass_through`: continue existing stream path unchanged.
- `created_operation` or `blocked_operation`: persist an assistant message
  summarizing the operation state and available operation actions, then return a
  short-circuit stream response.
- `clarification_response`: persist a concise assistant clarification, then
  return a short-circuit stream response.
- `rejected_response`: persist a safe refusal/rejection, then return a
  short-circuit stream response.

The assistant projection must be generated from operation state, not from raw
compiler prose. Use a projection helper that can read:

- operation snapshot;
- available actions from `OperationRepository.listAvailableActions()`;
- `operationActionsToActionLinks()`;
- disabled-action reasons;
- operation risk and status.

Do not let compiler text claim that a backup, restore, media workflow, or
factory job completed. Completion can only come from the operation ledger and
later executors.

## Prompt And Provider Rules

If Phase 04 uses an LLM compiler adapter:

- add `intent_compiler` to `ProviderSurface` in
  `src/lib/chat/provider-policy.ts`;
- update provider policy tests and provider instrumentation tests for that
  surface;
- call the shared provider runtime instead of direct env/provider reads;
- set strict JSON-only output instructions;
- validate output with local code before routing;
- fall back to deterministic classifier behavior when the provider fails;
- persist provider/compiler failure as safe clarification or blocked state,
  never as completed work.

The LLM compiler is optional. The deterministic classifier is required because
obvious high-risk requests such as "restore from backup X" must not depend on a
second provider call merely to avoid unsafe tool exposure.

Implementation default:

- ship the deterministic compiler first;
- keep the LLM compiler behind the `OperationIntentCompiler` strategy interface;
- do not add a new provider call in Phase 04 unless deterministic tests prove a
  necessary operation-backed intent cannot be handled safely without it.

## Tool Selection Pruning

Add an explicit operation-backed tool exclusion for normal chat prompt exposure.

Initial excluded tool names:

- `create_appliance_backup`
- `list_appliance_backups`
- `validate_appliance_backup`
- `prepare_appliance_restore`
- `request_pre_restore_backup`
- `confirm_appliance_restore`
- `execute_appliance_restore`
- `cancel_appliance_restore`
- `configure_backup_policy`

`list_appliance_backups` is excluded from normal chat in Phase 04 because the
current tool result can include legacy `actionType: "tool"` mutation actions
such as validate, prepare restore, and create backup. It may only return to
normal chat before Phase 06 if its presentation strips all legacy mutation
actions or converts them to disabled operation actions. Admin pages,
diagnostics, MCP/admin tooling, and internal operation executors may still use
the read path.

The exclusion must not unregister tools from the internal registry. It only
prevents normal chat prompt exposure from bypassing the operation ingress.
Admin pages, MCP/admin tooling, later operation executors, and tests can still
use internal execution surfaces.

## Operation Projection Requirements

Projection text must be plain and verifiable. Use this shape:

- operation title;
- status;
- why the system created or blocked it;
- what is known;
- what is missing or gated;
- next available operation buttons, if any;
- disabled action reasons, if any.

The projection must avoid saying:

- "I ran the backup";
- "restore completed";
- "media generated";
- "factory job started";
- "tool succeeded";

unless the operation snapshot and events prove that state.

Operation buttons must be produced through:

- `operationActionToActionLink()`
- `operationActionsToActionLinks()`
- the Phase 04 operation action markdown serializer for assistant message
  content

Do not manually assemble operation action query strings in chat route,
projection, or React code.

## Files To Modify

Expected new files:

- `src/core/use-cases/operations/OperationIntent.ts`
- `src/core/use-cases/operations/OperationIntentCompiler.ts`
- `src/core/use-cases/operations/OperationIntentRouter.ts`
- `src/core/use-cases/operations/OperationIntentPolicy.ts`
- `src/core/use-cases/operations/OperationDraftFactory.ts`
- `src/core/use-cases/operations/OperationIntentRouter.test.ts`
- `src/core/use-cases/operations/OperationIntentPolicy.test.ts`
- `src/lib/operations/operation-intent-schema.ts`
- `src/lib/operations/operation-intent-compiler.ts`
- `src/lib/operations/operation-intent-ingress.ts`
- `src/lib/operations/operation-intent-projection.ts`
- `src/lib/operations/operation-action-markdown.ts`
- `src/lib/operations/operation-intent-root.ts`
- `src/lib/operations/operation-intent-schema.test.ts`
- `src/lib/operations/operation-intent-ingress.test.ts`
- `src/lib/operations/operation-intent-projection.test.ts`
- `src/lib/operations/operation-action-markdown.test.ts`

Expected modified files:

- `src/lib/chat/stream-pipeline.ts`
- `src/lib/chat/stream-route-handler.ts`
- `src/lib/chat/stream-response-helpers.ts`
- `src/lib/chat/chat-turn.ts`
- `src/lib/chat/tool-capability-routing.ts`
- `src/lib/chat/provider-policy.ts` only if the LLM compiler adapter is added
- `src/lib/chat/provider-policy.test.ts` only if the LLM compiler adapter is
  added
- `src/lib/chat/provider-instrumentation.test.ts` only if the LLM compiler
  adapter is added
- `src/core/use-cases/operations/OperationActionPolicy.ts` only if new
  payload validators are required for disabled draft actions

Do not modify backup/restore execution services in Phase 04 except for tests
that prove those paths are no longer exposed to normal chat prompt execution.
Execution migration is Phase 06.

## Tests Required

Core tests:

- backup request compiles/routes to `backup_create`;
- restore request compiles/routes to `restore_execute`;
- ambiguous short backup id creates a clarification response;
- missing backup id for restore creates a clarification response;
- non-admin backup request is rejected before operation creation;
- admin backup request with missing executor/tool gate creates a blocked
  operation;
- disabled tool creates blocked operation state and no enabled action;
- resource pressure or missing Rust executor creates blocked operation state and
  no enabled action;
- invalid compiler output is rejected safely;
- low-confidence non-dangerous compiler output passes through;
- low-confidence destructive output asks clarification rather than passing
  through;
- repeated request for an active operation in the same conversation projects the
  existing operation instead of creating a duplicate;
- router never calls a tool executor.

Infrastructure tests:

- `operation-intent-schema` rejects malformed JSON, unknown operation kinds,
  unknown risk levels, missing title, missing operation draft input, and invalid
  required roles;
- deterministic classifier recognizes create backup, restore from backup,
  media workflow, factory work order, onboarding/help, and pass-through chat;
- LLM compiler adapter, if implemented, validates output and falls back safely
  on provider error;
- `operation-intent-projection` renders operation buttons through
  `operationActionsToActionLinks()`;
- `operation-action-markdown` round-trips stored operation actions through
  markdown parsing and `parseOperationActionLinkModel()`;
- disabled operation actions include `disabledReason` and render as disabled.

Chat tests:

- stream route short-circuits operation-backed admin backup request before tool
  selection and before model streaming;
- stream route still executes slash commands before the intent compiler;
- stream route still executes math short-circuit before the intent compiler;
- stream route continues normal chat path for pass-through requests;
- stream route persists `originMessageId` on created operations;
- direct turn rejects operation-backed requests safely and does not expose
  operation-backed tools;
- prompt-visible admin tool selection excludes operation-backed mutation tools
  and `list_appliance_backups` from normal chat exposure.

Regression tests:

- no new `actionType: "tool"` links are produced for Phase 04 operation
  projections;
- operation action URL shape remains
  `/api/operations/[operationId]/actions/[actionId]`;
- no route handler imports `OperationDataMapper` or raw SQLite directly;
- compiler/router code does not import React, Next route handlers, Rust
  executors, or concrete backup/media/factory services.

Minimum verification commands:

```bash
npx vitest run \
  src/core/use-cases/operations/OperationIntentRouter.test.ts \
  src/core/use-cases/operations/OperationIntentPolicy.test.ts \
  src/lib/operations/operation-intent-schema.test.ts \
  src/lib/operations/operation-intent-ingress.test.ts \
  src/lib/operations/operation-intent-projection.test.ts \
  src/lib/operations/operation-action-markdown.test.ts \
  src/lib/chat/tool-capability-routing.test.ts \
  src/lib/chat/chat-turn.test.ts

npm run typecheck
npm run lint
```

If route-handler tests are added for the stream route, include them in the
phase closeout. If an LLM compiler adapter is added, include provider policy and
instrumentation tests.

## Negative And Edge Cases

The implementation must handle:

- anonymous user asks for backup or restore;
- authenticated non-admin user asks for backup or restore;
- admin asks to restore but provides no backup id;
- admin provides a backup id prefix that matches multiple snapshots;
- admin asks to restore "the latest" when no latest successful backup exists;
- admin asks to execute restore without a prepared/confirmed/safety-backed
  restore plan;
- backup executor binary is unavailable;
- backup tool is disabled by admin runtime configuration;
- list backups would expose legacy natural-language mutation actions;
- resource pressure blocks backup, pre-restore backup, restore execution, or
  large media work;
- provider capability is missing for media/image/audio requests;
- LLM compiler returns invalid JSON;
- LLM compiler returns an operation kind not in `OperationKindRegistry`;
- LLM compiler says work completed;
- repeated operation request arrives while one operation is already draft or
  awaiting confirmation in the same conversation;
- stale operation button is clicked after the operation revision changes;
- direct turn receives a destructive operation request;
- context preparation falls back safely.

## Pruning And Follow-On Work

Phase 04 should prune prompt exposure and ingress duplication. It should not
delete subsystem execution paths yet.

Allowed pruning in Phase 04:

- remove operation-backed mutation tools from normal chat prompt exposure;
- centralize operation intent routing in one ingress service;
- stop adding new natural-language tool action links for operation projections;
- remove any new duplicate classifier code after the shared compiler/router is
  introduced.

Deferred pruning:

- backup/restore natural-language `tool` actions in
  `src/core/use-cases/tools/appliance-backup.tool.ts` are removed in Phase 06;
- media workflow direct tool/job action paths are migrated in Phase 07;
- factory work-order direct action paths are migrated in Phase 08.

## QA Certification

QA result: implemented and verified.

What was checked:

- Phase 04 is grounded against the implemented Phase 01 operation domain,
  Phase 02 repository/read models, and Phase 03 operation action dispatch path.
- The chat stream insertion point matches the current order in
  `executeChatStreamRoute()`.
- The direct-turn gap is explicitly handled instead of leaving a bypass path.
- The operation action API route is correctly specified as
  `/api/operations/[operationId]/actions/[actionId]`.
- The spec avoids migrating backup/restore, media, or factory execution in
  Phase 04.
- The current markdown-based message projection model is handled through a
  required operation action serializer.
- Tool, provider, executor, and resource gates are all explicit.
- `list_appliance_backups` is excluded from normal chat until its legacy
  natural-language mutation actions are removed or converted.
- Repeated operation requests have an active-operation dedupe rule.

Implementation evidence:

- Added the core operation intent contract, compiler interface, router, policy,
  and draft factory under `src/core/use-cases/operations`.
- Added deterministic operation classification, schema validation, ingress,
  projection, action-link markdown serialization, and runtime composition under
  `src/lib/operations`.
- Tightened deterministic classification so generic "help me..." requests and
  noun uses such as "draft a post..." remain normal chat unless they ask for
  Ordo/system documentation or explicit publish/release operation work.
- Wired chat stream ingress after persisted user messages, slash commands,
  context preparation, math short-circuit, and context guard, but before normal
  prompt tool selection and model streaming.
- Wired direct-turn protection so operation-backed requests return a safe
  conversation-surface rejection before provider/model/tool exposure.
- Pruned appliance backup/restore mutation tools and `list_appliance_backups`
  from normal chat prompt exposure without unregistering them from internal
  execution surfaces.
- Operation projections use `operationActionToActionLink()` through the Phase 04
  markdown serializer; no new operation projection emits legacy
  `actionType: "tool"` links.
- Router creates durable operation drafts, blocked states, clarifications, safe
  rejections, and existing-operation projections. It does not execute tools,
  enqueue jobs, invoke backup self-service, invoke media/factory services, or
  call Rust.

Verification commands run:

```bash
npx vitest run \
  src/core/use-cases/operations/OperationIntentRouter.test.ts \
  src/core/use-cases/operations/OperationIntentPolicy.test.ts \
  src/lib/operations/operation-intent-schema.test.ts \
  src/lib/operations/operation-intent-ingress.test.ts \
  src/lib/operations/operation-intent-projection.test.ts \
  src/lib/operations/operation-action-markdown.test.ts \
  src/lib/chat/tool-capability-routing.test.ts \
  src/lib/chat/chat-turn.test.ts \
  src/app/api/chat/stream/route.test.ts \
  src/core/use-cases/tools/appliance-backup.tool.test.ts \
  src/lib/appliance/resources/resource-pressure-service.test.ts \
  tests/stream-pipeline.test.ts \
  tests/stream-pipeline.prompt-runtime-seam.test.ts \
  tests/chat/chat-stream-route.test.ts \
  tests/chat/chat-stream-route.prompt-runtime-seam.test.ts \
  tests/chat/chat-route.test.ts
```

Result: 16 files passed, 132 tests passed.

```bash
npm run typecheck
```

Result: passed.

```bash
npm run lint
```

Result: passed with existing repo warnings and no errors.

Closeout QA commands run:

```bash
rg -n "next/server|React|OperationDataMapper|BackupSelfService|backup-self-service|ResourcePressureService|ToolRegistry|runClaude|create_appliance_backup\\(" \
  src/core/use-cases/operations/OperationIntent* \
  src/core/use-cases/operations/OperationDraftFactory.ts

rg -n "actionType:\\s*\\\"tool\\\"|\\?tool=|Create safety backup|fire it" \
  src/lib/operations \
  src/core/use-cases/operations/OperationIntent* \
  src/core/use-cases/operations/OperationDraftFactory.ts

git diff --check
```

Result: no forbidden core imports, no legacy operation projection tool links
except the deterministic destructive phrase classifier, and no whitespace
errors.

Deliberately deferred:

- Backup/restore execution remains Phase 06.
- Media workflow execution remains Phase 07.
- Factory work-order execution remains Phase 08.
- Existing legacy appliance backup tool actions in
  `src/core/use-cases/tools/appliance-backup.tool.ts` remain until Phase 06
  migrates that subsystem onto operation actions end-to-end.

## Exit Criteria

Phase 04 is complete when:

- chat stream operation-backed requests enter the operation kernel before normal
  model tool exposure;
- direct-turn operation-backed requests are blocked from model-to-tool execution
  until a conversation operation ingress exists;
- compiler output is schema-validated and cannot execute actions;
- deterministic router creates operation drafts, blocked states,
  clarifications, or safe rejections through `OperationRepository`;
- operation projections are generated from ledger state;
- operation buttons, when present, use Phase 03 typed operation action links;
- disabled/missing tool/provider/executor/resource state is visible as operation
  state;
- normal chat, slash commands, and math requests still work;
- all Phase 04 tests pass;
- the phase doc is updated to `Status: Implemented` with evidence commands and
  any deliberately deferred migration work.
