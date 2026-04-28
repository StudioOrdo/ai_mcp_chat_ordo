# Phase 4 — Prompt Runtime Contracts And Invalidation

> Status: Complete
> Loop State: Exit criteria verified
> Goal: Freeze the effective prompt-runtime contract, governed mutation side effects, and provenance expectations across `chat_stream`, `direct_turn`, and `live_eval`.
> Prerequisites: Phase 0 complete

## Phase Intent

This phase is already landed. The prompt runtime is now an explicit contract instead of a diffuse collection of helpers, `policy.ts` is a compatibility wrapper over that runtime, governed prompt mutations have defined side effects, and prompt provenance can replay the effective prompt rather than only reporting slot lineage.

## Source Anchors To Refresh

- [../../../../src/lib/chat/prompt-runtime.ts](../../../../src/lib/chat/prompt-runtime.ts#L1)
- [../../../../src/lib/chat/policy.ts](../../../../src/lib/chat/policy.ts#L1)
- [../../../../src/lib/prompts/prompt-role-inventory.ts](../../../../src/lib/prompts/prompt-role-inventory.ts#L1)
- [../../../../src/lib/prompts/prompt-control-plane-service.ts](../../../../src/lib/prompts/prompt-control-plane-service.ts#L1)
- [../../../../src/lib/prompts/prompt-provenance-service.ts](../../../../src/lib/prompts/prompt-provenance-service.ts#L1)
- [../../../../src/lib/admin/prompts/admin-prompts.ts](../../../../src/lib/admin/prompts/admin-prompts.ts#L1)
- [../../../../src/lib/chat/stream-route-handler.ts](../../../../src/lib/chat/stream-route-handler.ts#L1)
- [../../../../src/lib/chat/stream-preparation.ts](../../../../src/lib/chat/stream-preparation.ts#L180)
- [../../../../src/lib/chat/chat-turn.ts](../../../../src/lib/chat/chat-turn.ts#L1)
- [../../../../src/lib/evals/live-runner.ts](../../../../src/lib/evals/live-runner.ts#L340)

## Drift Traps

- Do not add a prompt cache without documenting what invalidates it and which surfaces observe the refresh.
- Do not treat slot version history as a substitute for effective prompt provenance.
- Do not move fallback prompt text or overlays without updating the remaining config-ownership note below.
- Do not let role tool-surface changes drift away from prompt-manifest tests; `tests/helpers/role-tool-sets.ts` is part of the public-role contract now.

## Verified Current State

### Runtime Contract

- `prompt-runtime.ts` now defines the canonical `PromptRuntimeRequest` and `PromptRuntimeResult` contract.
- Every result carries `surface`, `text`, `effectiveHash`, `slotRefs`, `sections`, and `warnings`.
- Governed slot lineage is explicit through `slotRefs`, and effective prompt composition is explicit through `sections` ordered by priority.
- Request-time contributions are now first-class sections rather than ad hoc string concatenation: page context, tool manifest, user preferences, conversation summary, context-window guard, trusted referral context, routing metadata, task-origin handoff, and extra sections.
- `policy.ts` no longer owns prompt assembly logic; `createSystemPromptBuilder(...)` and `buildSystemPrompt(...)` delegate to the prompt runtime.

### Surface-To-Input Contract

| Surface | Primary caller | Request-time inputs beyond governed slots | Final prompt build point | Evidence |
| --- | --- | --- | --- | --- |
| `chat_stream` | [../../../../src/lib/chat/stream-route-handler.ts](../../../../src/lib/chat/stream-route-handler.ts#L31) plus [../../../../src/lib/chat/stream-preparation.ts](../../../../src/lib/chat/stream-preparation.ts#L189) | current pathname or page snapshot, user preferences for non-anonymous users, trusted referral context, conversation summary, routing snapshot, context-window guard, task-origin handoff, and the request-scoped tool manifest selected after routing | `finalizePreparedStreamContext(...)` calls `builder.buildResult()` only after request assembly hooks and final tool selection | `tests/stream-pipeline.prompt-runtime-seam.test.ts`, `tests/chat/chat-stream-route.prompt-runtime-seam.test.ts`, `tests/prompt-surface-contract.test.ts` |
| `direct_turn` | [../../../../src/lib/chat/chat-turn.ts](../../../../src/lib/chat/chat-turn.ts#L31) | user preferences for non-anonymous users and the full role-visible tool manifest | `executeDirectChatTurn(...)` calls `builder.buildResult()` before provider creation and attaches the result to tool execution context | `tests/prompt-surface-contract.test.ts`, `tests/core-policy.test.ts`, `tests/system-prompt-builder.test.ts` |
| `live_eval` | [../../../../src/lib/evals/live-runner.ts](../../../../src/lib/evals/live-runner.ts#L349) | optional current page snapshot, routing snapshot, and scenario-specific extra sections such as `live_eval_funnel_directive` | `buildLiveEvalSystemPrompt(...)` calls `builder.buildResult()` and returns compact provenance alongside the text | `tests/evals/eval-live-runner.test.ts`, `tests/prompt-surface-contract.test.ts` |

### Governed Slots And Remaining Config Influence

- Governed runtime roles are `ANONYMOUS`, `AUTHENTICATED`, `APPRENTICE`, `STAFF`, and `ADMIN`.
- Governed mutable slots are intentionally limited to `ALL/base` plus per-role `role_directive` slots. `ALL/role_directive` and role-specific `base` remain unsupported for mutation.
- Admin read surfaces expose `runtimeCoverage` as `db`, `fallback`, or `missing`, which lets the admin UI distinguish stored prompt content from runtime fallback behavior.
- Config still influences effective prompt text in two deliberate places:
	- fallback base prompt content comes from `ConfigIdentitySource` when `ALL/base` has no active database version
	- fallback role directives come from `ROLE_DIRECTIVES` when a role-specific `role_directive` has no active database version
- When the base slot falls back, instance-level identity name and personality overlays from config remain visible as explicit `identity_name_overlay` and `personality_overlay` warnings rather than silent prompt text.

### Mutation And Invalidation Contract

- `createVersion(...)` and `activateVersion(...)` only accept governed slots.
- Both mutation paths revalidate exactly two admin read paths today: `/admin/prompts` and the slot detail path returned by `getAdminPromptDetailPath(role, promptType)`.
- Activation also emits a `prompt_version_changed` conversation event for active conversations affected by the slot:
	- `ALL/base` targets every active conversation
	- `ANONYMOUS/role_directive` targets active anonymous conversations by `user_id LIKE 'anon_%'`
	- role-specific `role_directive` slots target active conversations for users with that role
- There is no shared prompt-output cache beyond the in-memory builder/runtime call path. The shipped invalidation rule is therefore about revalidating admin read surfaces and emitting conversation events, not clearing a cross-request prompt cache.

### Provenance And Replay Contract

- `recordPromptTurnProvenance(...)` persists compact prompt provenance per turn: `surface`, `effectiveHash`, compacted `slotRefs`, compacted `sections`, `warnings`, and the full replay context.
- `replayPromptTurnProvenanceRecord(...)` rebuilds the prompt through the same runtime and returns a structured drift diff rather than a raw string comparison only.
- `listPromptTurnAudits(...)` exposes record-plus-replay audit results for a conversation.
- `inspect_runtime_context` can return a redacted compact `promptRuntime` snapshot when called with `includePrompt: true`.
- The stream path records provenance only after final route-time tool selection and final prompt build, which means stored provenance matches the actual prompt surface seen by the model.
- Live eval stores compact prompt provenance in the final eval state, and direct-turn callers can observe the built prompt through the `onPromptBuilt` callback plus tool execution context.

### Current QA Notes

- The prompt contract is now backed by a broader verification bundle than the earlier narrow seam check because stale anonymous tool-surface tests were updated to match the live registry contract.
- The earlier 13-file seam bundle remains green, and the final broader Phase 4 confidence bundle now passes 22 of 22 files and 226 of 226 tests after reconciling stale route-test builder doubles and admin conversation prompt-provenance fixtures:

```bash
npm exec vitest run tests/core-policy.test.ts tests/referral-governance-qa.test.ts tests/prompt-runtime.test.ts tests/prompt-surface-contract.test.ts tests/prompt-control-plane.service.test.ts tests/prompt-control-plane-equivalence.test.ts tests/prompt-control-plane-read-parity.test.ts tests/system-prompt.test.ts tests/system-prompt-assembly.test.ts tests/system-prompt-builder.test.ts tests/admin-prompts-conversations.test.tsx tests/stream-pipeline.prompt-runtime-seam.test.ts tests/chat/chat-stream-route.prompt-runtime-seam.test.ts tests/evals/eval-live-runner.test.ts src/lib/prompts/prompt-provenance.test.ts src/adapters/PromptProvenanceDataMapper.test.ts src/lib/chat/chat-turn.test.ts src/app/api/chat/stream/route.test.ts src/core/use-cases/tools/inspect-runtime-context.tool.test.ts src/lib/admin/conversations/admin-conversations.test.ts src/lib/capabilities/shared/prompt-tool.test.ts src/core/capability-catalog/prompt-directive-unification.test.ts
```

## Suggested Verification Commands

```bash
npm exec vitest run tests/core-policy.test.ts tests/referral-governance-qa.test.ts tests/prompt-runtime.test.ts tests/prompt-surface-contract.test.ts tests/prompt-control-plane.service.test.ts tests/prompt-control-plane-equivalence.test.ts tests/prompt-control-plane-read-parity.test.ts tests/system-prompt.test.ts tests/system-prompt-assembly.test.ts tests/system-prompt-builder.test.ts tests/admin-prompts-conversations.test.tsx tests/stream-pipeline.prompt-runtime-seam.test.ts tests/chat/chat-stream-route.prompt-runtime-seam.test.ts tests/evals/eval-live-runner.test.ts src/lib/prompts/prompt-provenance.test.ts src/adapters/PromptProvenanceDataMapper.test.ts src/lib/chat/chat-turn.test.ts src/app/api/chat/stream/route.test.ts src/core/use-cases/tools/inspect-runtime-context.tool.test.ts src/lib/admin/conversations/admin-conversations.test.ts src/lib/capabilities/shared/prompt-tool.test.ts src/core/capability-catalog/prompt-directive-unification.test.ts
npm exec eslint tests/helpers/role-tool-sets.ts tests/core-policy.test.ts tests/system-prompt-assembly.test.ts
```

## Expected Evidence Artifacts

- A surface-to-input contract table for every prompt caller touched by this phase.
- Test output proving role tool-manifest expectations, prompt mutations, provenance replay, and admin read parity remain aligned.
- A documented invalidation rule stating exactly which admin surfaces revalidate and when `prompt_version_changed` events are emitted.
- A documented note for the remaining config-backed fallback and overlay prompt text.

## Scope Guardrails

- Do not broaden this phase into a full prompt-authoring UI rewrite.
- Do not treat config fallback removal as a prerequisite for prompt-runtime correctness.
- Do not change role policy semantics casually; prompt-manifest tests and role-tool expectations must move together.

## Implementation Record

- Date: 2026-04-12
- Files changed: `src/lib/chat/prompt-runtime.ts`, `src/lib/chat/policy.ts`, `src/lib/prompts/prompt-role-inventory.ts`, `src/lib/prompts/prompt-control-plane-service.ts`, `src/lib/prompts/prompt-provenance-service.ts`, `src/lib/admin/prompts/admin-prompts.ts`, `src/lib/chat/stream-route-handler.ts`, `src/lib/chat/stream-preparation.ts`, `src/lib/chat/chat-turn.ts`, `src/lib/evals/live-runner.ts`, and the associated prompt-contract tests.
- Summary of what landed: prompt assembly moved behind an explicit runtime contract, all three prompt surfaces now build through that runtime, governed slot mutations gained defined revalidation and conversation-event side effects, and prompt provenance now records replayable effective prompt metadata.
- Deviations from the original plan: the shipped system documents that no shared cross-request prompt cache exists yet, so invalidation is defined in terms of admin-path revalidation and conversation events rather than cache eviction.

## Post-Implementation QA

- [x] Refresh current prompt input surfaces and runtime callers.
- [x] Refresh current prompt control-plane mutation flow.
- [x] Refresh current provenance storage and replay behavior.
- [x] Run the broadened prompt-runtime verification bundle.
- [x] Run changed-file diagnostics for the refreshed prompt-policy tests.
- [x] Confirm prompt behavior, invalidation, and provenance rules are explicit in this packet.

## Exit Criteria

- Prompt inputs are explicit across `chat_stream`, `direct_turn`, and `live_eval`.
- Governed mutation side effects are defined and observable.
- Prompt provenance explains effective prompt assembly rather than only slot lineage.

## Handoff

- What the next phase should now assume: prompt assembly is a stable contract surface with explicit request inputs, explicit role-governed slots, and replayable provenance.
- What remains unresolved: config-backed fallback prompt content still exists by design, and there is still no shared cross-request prompt cache to invalidate.
- What docs need updating: keep this packet, the status board, and the roadmap aligned whenever prompt surfaces, governed slots, or prompt-manifest role contracts change.
