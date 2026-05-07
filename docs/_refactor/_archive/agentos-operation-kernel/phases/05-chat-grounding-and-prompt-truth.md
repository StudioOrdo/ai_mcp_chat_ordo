# Phase 05: Chat Grounding And Prompt Truth

Status: Implemented on 2026-05-03

## Goal

Make the model see exact current operation truth when a conversation continues.

The net result of this phase is:

- active and recently relevant operations are injected into the governed prompt
  as server-owned grounding;
- operation state, latest events, blockers, artifacts, and available actions are
  read from the operation ledger, not inferred from chat text;
- relevant persisted tool-call/tool-result evidence is summarized and tied to
  operations without making raw tool output the source of truth;
- prompt budget is bounded and deterministic;
- the assistant cannot honestly claim that backup, restore, media, factory, or
  publish work completed unless operation state proves it;
- Phase 06 through Phase 08 migrations can rely on one current-thread truth
  channel instead of subsystem-specific prompt patches.

This phase does not migrate backup/restore, media, or factory execution. It
builds the grounding layer those migrations need.

## Inputs From Phase 00 Through Phase 04

Phase 00 evidence:

- `../evidence/phase-00-baseline.md`
- `../evidence/initial-code-grounding.md`

Important Phase 00 finding:

- `src/lib/chat/stream-execution.ts` persists `tool_call` and `tool_result`
  parts into assistant messages.
- `src/hooks/chat/chatSendPolicy.ts` drops `tool_call` and `tool_result` parts
  from client-sent backend history.
- `src/lib/chat/message-attachments.ts` also omits tool evidence when
  `buildContextWindow()` converts persisted messages into model context.

Phase 01 through Phase 03 implementation:

- `src/core/entities/operation.ts`
- `src/core/use-cases/operations/OperationRepository.ts`
- `src/core/use-cases/operations/OperationReadModel.ts`
- `src/adapters/OperationDataMapper.ts`
- `src/core/use-cases/operations/OperationActionDispatch.ts`
- `src/lib/operations/operation-action-view-model.ts`
- `src/app/api/operations/[operationId]/actions/[actionId]/route.ts`

Phase 04 implementation:

- `src/core/use-cases/operations/OperationIntent.ts`
- `src/core/use-cases/operations/OperationIntentRouter.ts`
- `src/lib/operations/operation-intent-root.ts`
- `src/lib/operations/operation-intent-ingress.ts`
- `src/lib/operations/operation-intent-projection.ts`
- `src/lib/chat/stream-route-handler.ts`
- `src/lib/chat/stream-pipeline.ts`
- `src/lib/chat/tool-capability-routing.ts`

Key constraints carried forward:

- `OperationRepository` is the only read/write boundary for operation truth.
- Operation projections must be derived from operation snapshots, read models,
  events, artifacts, and actions.
- Operation-backed chat requests enter the operation intent stage before normal
  prompt tool exposure.
- Direct-turn operation-backed requests are rejected until a conversation-backed
  ingress exists.
- Prompt-visible backup/restore mutation tools are pruned from normal chat in
  Phase 04, but legacy subsystem execution remains until Phase 06 through 08.

## Current Code Grounding

### Server Stream Path

Primary stream path:

- `src/lib/chat/stream-route-handler.ts`
- `src/lib/chat/stream-pipeline.ts`
- `src/lib/chat/stream-preparation.ts`
- `src/lib/chat/stream-execution.ts`
- `src/lib/chat/context-window.ts`
- `src/lib/chat/prompt-runtime.ts`

Current order in `executeChatStreamRoute()` after Phase 04:

1. resolve selected intelligence runtime;
2. resolve session;
3. parse request;
4. create prompt builder;
5. create tool execution surface;
6. ensure conversation;
7. persist user message;
8. run slash-command short-circuit;
9. prepare routing/context-window state;
10. run math short-circuit;
11. block oversized context;
12. run operation intent stage;
13. select prompt-visible tools;
14. add tool manifest;
15. finalize prompt/provenance;
16. stream model/tool loop.

Decision:

Phase 05 must add operation grounding during the preparation window, after the
conversation has been persisted and loaded, and before prompt finalization. The
grounding section should be present for normal model turns and available to the
operation intent compiler input for follow-up references.

The grounding stage must not run before slash commands. Slash commands are
explicit local commands. Math short-circuit can remain before grounding
projection into the model response path, but the operation grounding data should
be computed during preparation so it is available if the request continues.

### Prompt Runtime Seam

Current code:

- `PromptRuntimeBuilder.withSection()` stores request-owned sections.
- `DefaultPromptRuntime.build()` appends `extraSections` into the final prompt.
- Existing prompt section priorities:
  - identity: `10`
  - tool manifest: `15`
  - role directive: `20`
  - page context: `25`
  - user preferences: `30`
  - conversation summary: `40`
  - context window guard: `42`
  - relationship memory: `44`
  - trusted referral: `45`
  - routing: `50`
  - media continuity: `88`
  - task origin: `90`

Decision:

Add an `operation_grounding` request section with priority `43`. It should sit
after the context-window guard and before relationship memory, referral, and
routing. That placement makes operation truth visible early without overriding
identity, role policy, or page context.

The section must be recorded in `PromptRuntimeResult.sections` and prompt
provenance so QA can prove it was included.

### Current Context Window Gap

Current code:

- `src/lib/chat/context-window.ts`
- `src/lib/chat/message-attachments.ts`
- `src/hooks/chat/chatSendPolicy.ts`

`buildContextWindow()` uses `buildMessageContextText(message.content,
message.parts)`. That helper includes message text and attachments only. It
does not include:

- `tool_call`
- `tool_result`
- `job_status`
- operation state
- operation events

`chatSendPolicy.ts` deliberately drops `tool_call` and `tool_result` from the
client-sent backend history.

Decision:

Do not make client-sent history the source of operation truth. The primary
server path must recover current-thread truth from persisted server state. The
fallback path may continue to be thinner, but it must include a safe warning if
operation grounding could not be loaded: the assistant must not infer operation
status or completion from chat text alone.

### Current Operation Read Models

Current code:

- `src/core/use-cases/operations/OperationRepository.ts`
- `src/core/use-cases/operations/OperationReadModel.ts`
- `src/adapters/OperationDataMapper.ts`

Available read APIs:

- `listOperationsByConversation(conversationId, options)`
- `findOperationById(operationId)`
- `listEvents(operationId, { limit })`
- `listArtifacts(operationId, { limit })`
- `listAvailableActions(operationId, { now })`
- `getConversationSummary(operationId)`
- `getPromptGroundingSummary(operationId)`

`PromptGroundingOperationSummary` already contains:

- operation id;
- kind;
- status;
- revision;
- current step id;
- latest events;
- available action ids/types/labels;
- artifacts;
- error code/message.

Decision:

Phase 05 should use these read models instead of adding new SQL reads in chat
code. If additional grounding data is required, extend the operation read model
contract first, then implement it in `OperationDataMapper`.

The initial implementation should extend `PromptGroundingOperationSummary` when
needed rather than bypassing it. In particular, if grounding exposes disabled or
stale actions for explanation, the read model must carry `enabled`,
`disabledReason`, `riskLevel`, and `confirmPolicy`; otherwise only enabled
`availableActions` should be listed.

### Current Tool Evidence

Current code:

- `src/lib/chat/stream-execution.ts`
- `src/core/entities/message-parts.ts`
- `src/adapters/MessageDataMapper.ts`

Tool evidence is persisted as assistant message parts:

- `{ type: "tool_call", name, args, toolInvocationId }`
- `{ type: "tool_result", name, result, toolInvocationId }`

Decision:

Phase 05 should add a bounded tool evidence extractor over the server-loaded
message list. It should:

- pair calls/results by `toolInvocationId` when available;
- include latest failures and latest operation-relevant results;
- summarize JSON instead of dumping raw payloads;
- redact secrets and large blobs;
- treat tool evidence as supporting evidence only;
- prefer operation events/status over tool output if they disagree.

## Clean Architecture Shape

### Core Use Case

Create a core use case that selects and structures operation grounding:

- `src/core/use-cases/operations/OperationPromptGrounding.ts`
- `src/core/use-cases/operations/OperationPromptGrounding.test.ts`

Core owns:

- selection rules for relevant operations;
- active/completed/irrelevant operation filtering;
- event/artifact/action count budgets;
- compact DTO shape for prompt grounding;
- explicit "grounding unavailable" DTO when dependencies fail safely.

Core must not import:

- Next.js;
- React;
- Anthropic SDKs;
- prompt runtime classes;
- SQLite concrete mappers;
- backup/media/factory concrete services;
- Rust executors.

### Infrastructure And Prompt Adapter

Create infrastructure helpers outside the core layer:

- `src/lib/operations/operation-prompt-grounding.ts`
- `src/lib/operations/operation-tool-evidence.ts`
- `src/lib/operations/operation-prompt-grounding-root.ts`
- `src/lib/operations/operation-prompt-grounding.test.ts`
- `src/lib/operations/operation-tool-evidence.test.ts`

Infrastructure owns:

- reading `OperationRepository` from `RepositoryFactory`;
- reading current persisted messages already loaded for stream preparation;
- extracting bounded tool evidence from `MessagePart[]`;
- formatting the prompt section;
- logging degradation when operation grounding cannot be loaded;
- redacting unsafe payload fields and truncating large JSON.

### Chat Integration

Modify:

- `src/lib/chat/stream-preparation.ts`
- `src/lib/chat/stream-pipeline.ts`
- `src/lib/chat/stream-route-handler.ts` only if the pipeline contract must pass
  new grounding metadata onward;
- `src/lib/operations/operation-intent-root.ts`
- `src/core/use-cases/operations/OperationIntent.ts` if the compiler input needs
  structured operation grounding.

Preferred shape:

1. `prepareStreamContext()` loads conversation messages as it does today.
2. It builds the context window.
3. It calls the operation grounding root with:
   - `conversationId`;
   - `userId`;
   - `role`;
   - current persisted messages;
   - latest user text;
   - current `ContextWindowGuard`;
   - now.
4. It adds a prompt section:
   - key: `operation_grounding`;
   - priority: `43`;
   - content: serialized server-owned grounding block;
   - payload: structured operation ids, statuses, event counts, and evidence
     refs.
5. It returns the structured grounding on `PreparedStreamContext`.
6. `maybeHandleOperationIntent()` passes the grounding summary into
   `buildOperationIntentCompilerInput()` so follow-up language like "check
   that restore" can be resolved without guessing.

The model-facing prompt text and the compiler-facing data should come from the
same structured grounding snapshot.

## Operation Grounding Contract

### Structured Snapshot

The grounding snapshot should include:

- `generatedAt`
- `conversationId`
- `status`
  - `available`
  - `empty`
  - `unavailable`
- `operations`
- `toolEvidence`
- `budget`
- `warnings`

Each operation entry should include:

- `operationId`
- `kind`
- `title`
- `status`
- `riskLevel`
- `revision`
- `currentStepId`
- `summary`
- `progress`
- `error`
- `latestEvents`
- `availableActions`
- `artifacts`
- `updatedAt`
- `groundingReason`
  - `active`
  - `mentioned`
  - `recent_failure`
  - `recent_completion`

Each event entry should include:

- `sequence`
- `type`
- `stepId`
- `createdAt`
- bounded `payloadSummary`

Each action entry should include, when the selected read model exposes that
field:

- `id`
- `actionType`
- `label`
- `enabled`
- `disabledReason`
- `riskLevel`
- `confirmPolicy`

Each tool evidence entry should include:

- `messageId`
- `toolInvocationId`
- `toolName`
- `evidenceKind`
  - `call`
  - `result`
  - `paired`
- `summary`
- `error`
- `relatedOperationId`
- `createdAt` or message timestamp if available.

Do not include raw secrets, full files, full archives, binary data, full HTML,
full logs, or unbounded provider output.

Empty grounding behavior:

- if no relevant operations exist and the user is asking ordinary chat, omit the
  `operation_grounding` prompt section;
- if no relevant operations exist and the latest user text asks about operation
  status, history, backup, restore, media workflow, factory work, or publish
  state, include a compact `empty` grounding block that says no current
  operation state was found for this conversation;
- if grounding could not be loaded due to an error, include the explicit
  `unavailable` block.

### Selection Rules

Include by default:

- active operations in the conversation with status:
  - `draft`
  - `awaiting_confirmation`
  - `queued`
  - `running`
  - `blocked`
- failed operations updated recently;
- succeeded/cancelled/expired operations only when:
  - explicitly mentioned by id or title in the latest user text;
  - they are the most recent operation in the conversation and the user asks
    status/history questions;
  - they have important artifacts created in the current thread.

Exclude by default:

- old succeeded operations not mentioned;
- old cancelled/expired operations not mentioned;
- operations from other conversations unless the future admin surface explicitly
  authorizes cross-conversation lookup;
- operations the current role cannot see.

Initial budgets:

- max operations: `6`;
- max active operations: `5`;
- max completed/recent operations: `2`;
- max latest events per operation: `5`;
- max artifacts per operation: `5`;
- max available actions per operation: `5`;
- max tool evidence entries: `8`;
- max serialized section characters: `5000`;
- max individual JSON summary characters: `800`.

If the section would exceed budget, drop least-relevant completed operations
first, then least-relevant tool evidence, then older events. Never drop the
current active operation's status, error, or latest event.

### Prompt Text Shape

Use a plain, server-owned block:

```text
[Server operation grounding]
This block is authoritative for operation state. Do not infer operation success,
failure, or available actions from chat text if it conflicts with this block.

Operation op_123 (restore_execute)
- title: Restore Appliance
- status: blocked
- revision: 3
- current step: restore.safety_backup
- error: BACKUP_EXECUTOR_MISSING - Backup executor binary unavailable.
- latest events:
  - #7 operation_status_changed at 2026-05-03T12:00:00.000Z: blocked
- available actions:
  - none
- artifacts:
  - none

Relevant tool evidence:
- generate_audio result toolu_1: failed - provider key missing.
```

If grounding cannot be loaded:

```text
[Server operation grounding]
Operation grounding is unavailable for this turn. Do not claim that an
operation completed, failed, or is ready unless the current message explicitly
contains trusted operation state.
```

## Truth Rules

The assistant must follow these rules:

- Ledger status beats chat text.
- Operation events beat tool result prose.
- Tool result evidence can explain what happened, but cannot mark an operation
  complete unless an operation event/status says so.
- If an action is not listed as available, the assistant must not tell the user
  to click it or imply it can be executed.
- If grounding is unavailable, the assistant must say it needs to check current
  operation state rather than guessing.
- If an operation is blocked, the assistant should state the blocker and
  remediation from the ledger.
- If an operation is running or queued, the assistant should say it is still in
  progress.

## Interaction With Phase 04

Phase 04 routes new operation-backed requests before normal tool exposure.
Phase 05 grounds continuation turns after an operation exists.

Examples:

- "Create a backup" -> Phase 04 creates/blocks `backup_create`.
- "What happened with that backup?" -> Phase 05 injects `backup_create` state
  so the normal assistant can answer from the ledger.
- "Can I execute the restore now?" -> Phase 04 may compile a new/continuing
  operation intent, but Phase 05 grounding must provide the current restore
  operation, safety backup state, blockers, and available actions.
- "Draft a post about the queue" -> normal chat/deferred job path. Explicit
  publish/release requests may become `content_publish` operations, but
  execution migration remains outside Phase 05.

The operation intent compiler input should be extended with a bounded
`operationGrounding` field. The deterministic compiler can remain conservative:
it should use grounding to clarify references, not to execute.

## Direct Turn Contract

`src/lib/chat/chat-turn.ts` has no durable conversation id. Phase 05 should not
try to bolt operation grounding onto direct turns.

Rules:

- direct-turn operation-backed requests remain rejected as in Phase 04;
- direct turns may continue for ordinary stateless chat;
- if a direct turn asks about operation state, return a safe message that the
  request requires the conversation/admin surface.

## Files To Modify

Expected new files:

- `src/core/use-cases/operations/OperationPromptGrounding.ts`
- `src/core/use-cases/operations/OperationPromptGrounding.test.ts`
- `src/lib/operations/operation-prompt-grounding.ts`
- `src/lib/operations/operation-tool-evidence.ts`
- `src/lib/operations/operation-prompt-grounding-root.ts`
- `src/lib/operations/operation-prompt-grounding.test.ts`
- `src/lib/operations/operation-tool-evidence.test.ts`

Expected modified files:

- `src/core/use-cases/operations/OperationReadModel.ts` if prompt grounding
  needs richer action, event, artifact, or error fields;
- `src/core/use-cases/operations/OperationIntent.ts`
- `src/adapters/OperationDataMapper.ts` if the read model contract is extended;
- `src/lib/operations/operation-intent-root.ts`
- `src/lib/chat/stream-preparation.ts`
- `src/lib/chat/stream-pipeline.ts`
- `src/lib/chat/stream-route-handler.ts` only if the `PreparedStreamContext`
  shape must be threaded explicitly;
- `src/lib/chat/prompt-runtime.ts` only if `PromptRuntimeRequest` needs a typed
  first-class `operationGrounding` field. Prefer `withSection()` first to avoid
  broad prompt runtime churn.
- `src/hooks/chat/chatSendPolicy.ts` only for tests or fallback summaries. Do
  not make client history the operation truth source.

Do not modify:

- backup/restore execution services;
- media workflow execution services;
- factory execution services;
- Rust executors;
- operation action dispatch semantics.

Those migrations belong to Phase 06 through Phase 08.

## Tests Required

Core tests:

- active restore operation appears in grounding snapshot;
- active backup/media/factory/content operations are selected before old
  completed operations;
- completed operation is summarized compactly when recent or mentioned;
- irrelevant old operations are excluded;
- failed and blocked operations include error and latest event;
- available actions are bounded and include disabled reason when exposed through
  snapshot data;
- prompt budget limits drop least-relevant data first;
- unavailable repository read returns an explicit unavailable grounding result;
- role visibility excludes operations the current role cannot see.

Infrastructure tests:

- tool calls and results are paired by `toolInvocationId`;
- latest failed tool result appears in tool evidence;
- large tool result payloads are summarized and truncated;
- secret-like fields are redacted;
- operation grounding prompt block states that ledger truth wins over chat text;
- prompt block does not say work succeeded unless the operation status is
  `succeeded`;
- empty operation list omits the prompt block for ordinary chat;
- empty operation list includes a compact `empty` prompt block for operation
  status/history questions.

Chat integration tests:

- active restore operation appears in the final backend system prompt;
- `operation_grounding` appears in `PromptRuntimeResult.sections`;
- latest failed tool result from persisted assistant message parts appears in
  operation grounding;
- completed old operation is excluded from the final prompt when not mentioned;
- prompt budget limits are enforced in route-level prompt assembly;
- operation intent short-circuit still runs before normal prompt tool exposure;
- normal chat pass-through still streams through the model;
- slash commands still bypass operation grounding/model streaming;
- math short-circuit still bypasses model streaming;
- fallback context includes a safe no-grounding warning if grounding cannot be
  loaded and the request continues.

Regression tests:

- `buildBackendHistory()` is not treated as the source of operation truth;
- no raw `tool_result` blob is dumped into the system prompt;
- no operation grounding code imports concrete backup/media/factory services;
- no route handler imports `OperationDataMapper` directly;
- prompt provenance records the operation grounding section key and payload
  references;
- direct turns remain unable to answer operation-backed requests without a
  conversation/admin surface.

Minimum verification commands:

```bash
npx vitest run \
  src/core/use-cases/operations/OperationPromptGrounding.test.ts \
  src/lib/operations/operation-prompt-grounding.test.ts \
  src/lib/operations/operation-tool-evidence.test.ts \
  src/lib/operations/operation-intent-ingress.test.ts \
  src/lib/chat/chat-turn.test.ts \
  tests/stream-pipeline.test.ts \
  tests/stream-pipeline.prompt-runtime-seam.test.ts \
  tests/chat/chat-stream-route.test.ts \
  tests/chat/chat-stream-route.prompt-runtime-seam.test.ts \
  tests/chat/chat-route.test.ts

npm run typecheck
npm run lint
```

Closeout QA greps:

```bash
rg -n "BackupSelfService|backup-self-service|media-workflow|FactoryDataMapper|ordo-backup|OperationDataMapper" \
  src/core/use-cases/operations/OperationPromptGrounding* \
  src/lib/operations/operation-prompt-grounding.ts \
  src/lib/operations/operation-tool-evidence.ts

rg -n "tool_result.*JSON.stringify|result_json|payload_json|secret|apiKey|password" \
  src/lib/operations/operation-prompt-grounding.ts \
  src/lib/operations/operation-tool-evidence.ts

git diff --check
```

Any `secret`, `apiKey`, or `password` matches in the second grep must be limited
to redaction key lists or redaction tests. Raw prompt serialization of those
fields is a failure.

## Negative And Edge Cases

The implementation must handle:

- no operations in the current conversation;
- multiple active operations in the same conversation;
- active restore blocked by missing safety backup or missing executor;
- active operation with no available actions;
- stale operation actions from an older revision;
- failed operation with latest event carrying error details;
- successful operation with artifacts;
- old successful operation not mentioned by the current user;
- user asks "what happened" without naming an operation;
- user mentions a short operation id prefix;
- tool result has no matching tool call;
- tool call has no result because stream failed;
- tool result contains a huge payload;
- tool result contains secret-like fields;
- operation repository read fails;
- prompt section exceeds budget;
- fallback context is used;
- anonymous or authenticated user asks about admin-only operation state;
- operation grounding conflicts with raw chat text.

## Pruning And Follow-On Work

Allowed pruning in Phase 05:

- remove ad hoc prompt snippets that describe operation status outside the
  operation grounding section;
- remove duplicate operation-status context builders if they exist after the
  new service lands;
- keep client `buildBackendHistory()` from carrying raw tool evidence.

Deferred pruning:

- legacy appliance backup `actionType: "tool"` links remain until Phase 06;
- media workflow prompt/tool evidence is fully mapped to operations in Phase 07;
- factory work-order prompt/tool evidence is fully mapped to operations in
  Phase 08;
- role-gated help/onboarding documentation surfaces remain Phase 09.

## QA Certification

QA result: implemented and verified.

What was checked:

- The current Phase 04 stream insertion point was verified in
  `src/lib/chat/stream-route-handler.ts`.
- The current prompt runtime supports request-owned sections through
  `PromptRuntimeBuilder.withSection()`.
- The current server context window omits tool evidence, so Phase 05 needs a
  dedicated operation grounding section.
- The current client send policy also drops raw tool evidence; Phase 05 should
  keep operation truth server-owned rather than relying on client history.
- The operation repository and read model already expose enough read APIs to
  build an initial grounding block.
- The doc explicitly requires read-model extension before richer action fields
  are used in prompt grounding.
- Existing operation intent and action dispatch contracts remain intact.
- No backup/restore, media, factory, or Rust execution migration is required in
  this phase.

Implementation evidence:

- Added `OperationPromptGrounding` as a core use case that selects visible,
  relevant operation state from `OperationRepository`.
- Extended `PromptGroundingOperationSummary` to expose title, risk, summary,
  progress, updated time, action metadata, and artifact metadata through the
  read-model contract instead of direct chat SQL reads.
- Added server-side tool evidence extraction that pairs persisted
  `tool_call`/`tool_result` parts, redacts unsafe fields, truncates large
  payloads, and treats tool evidence as supporting evidence only.
- Added `operation_grounding` prompt section formatting at priority `43` with
  structured provenance payload refs.
- Integrated operation grounding into primary stream preparation and fallback
  operation-state warnings.
- Threaded the structured grounding snapshot into operation intent compiler
  input for conservative follow-up reference resolution.
- Fresh QA tightened stream preparation to pass a deterministic `now` and the
  current context-window guard into the grounding root.
- Fresh QA corrected per-operation budget accounting so dropped events,
  actions, and artifacts are counted before truncation.
- Added focused tests for core selection/budgeting, prompt formatting, tool
  evidence extraction, and stream preparation integration.

Verification commands run:

```bash
npm run typecheck
npx vitest run \
  src/core/use-cases/operations/OperationPromptGrounding.test.ts \
  src/lib/operations/operation-prompt-grounding.test.ts \
  src/lib/operations/operation-tool-evidence.test.ts \
  src/lib/chat/stream-preparation.operation-grounding.test.ts \
  src/lib/operations/operation-intent-ingress.test.ts \
  src/lib/chat/chat-turn.test.ts \
  tests/stream-pipeline.test.ts \
  tests/stream-pipeline.prompt-runtime-seam.test.ts \
  tests/chat/chat-stream-route.test.ts \
  tests/chat/chat-stream-route.prompt-runtime-seam.test.ts \
  tests/chat/chat-route.test.ts
npm run lint
npx vitest run \
  src/adapters/OperationDataMapper.test.ts \
  'src/app/api/operations/[operationId]/actions/[actionId]/route.test.ts'
git diff --check
```

Fresh QA rerun on 2026-05-03:

- Phase 05 vitest set: 11 files, 103 tests passed.
- Additional operation mapper/action route compatibility tests: 2 files, 24
  tests passed.
- `npm run typecheck` passed.
- `npm run lint` exited 0 with pre-existing repository warnings only.
- `git diff --check` passed.

Closeout grep results:

- No `BackupSelfService`, `backup-self-service`, `media-workflow`,
  `FactoryDataMapper`, `ordo-backup`, or `OperationDataMapper` imports/matches
  in the core prompt grounding use case or prompt/tool evidence adapters.
- The raw prompt serialization grep only matched the redaction import in
  `operation-tool-evidence.ts`; no raw `tool_result`, `result_json`,
  `payload_json`, `apiKey`, or `password` prompt serialization was introduced.

## Exit Criteria

Phase 05 is complete when:

- final chat stream prompts include a bounded `operation_grounding` section when
  relevant operation state exists;
- active operation state, latest events, blockers, artifacts, and available
  actions are derived from the operation ledger;
- relevant persisted tool evidence is summarized and redacted;
- prompt provenance records the grounding section and structured refs;
- the operation intent compiler can receive bounded operation grounding for
  follow-up references;
- ordinary chat, slash commands, math short-circuit, and Phase 04 operation
  short-circuit behavior still pass;
- direct turns remain safely blocked from operation-backed state questions;
- all Phase 05 tests pass;
- the phase doc is updated to `Status: Implemented` with verification evidence
  and any deliberately deferred migration work.
