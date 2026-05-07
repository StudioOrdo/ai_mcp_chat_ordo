# Phase Plan

This plan assumes greenfield cleanup: no legacy data contract is protected unless
it is still required by tests or the current product surface.

## Phase 00 - Baseline And Inventory

Goal: make the current tool surface inspectable.

Deliverables:

- registry inventory by owner, category, execution mode, prompt exposure, and
  operation coverage,
- list of tools that are primitives, recipes, internal steps, or legacy shims,
- live dry-run coverage artifact bundle,
- workflow coverage artifact bundle for media, publishing, factory, backup, and
  admin diagnostics.

Acceptance:

- every registered prompt-visible tool appears in the inventory,
- every complex workflow has a fixture-backed eval,
- eval artifacts are written under `.runtime-logs/eval-artifacts`.

## Phase 01 - Capability Contract Normalization

Goal: upgrade `CapabilityDefinition` so the catalog can fully describe the
runtime contract.

Add facets for:

- `risk`: read, low mutation, costly mutation, destructive, credentialed,
- `idempotency`: required, optional, none,
- `artifactPolicy`: none, reads artifacts, writes artifacts, consumes artifacts,
- `operationPolicy`: read-only, operation-launcher, operation-action,
  internal-step,
- `evalPolicy`: unit, dry-run live, workflow fixture, live artifact.

Acceptance:

- no capability has implicit risk,
- no mutation tool lacks idempotency policy,
- no artifact-producing capability lacks artifact policy,
- tests fail if a new capability omits required facets.

## Phase 02 - Execution Target Unification

Goal: remove the `inline | deferred` blind spot.

Unify registry, catalog, operation planning, and health around:

- `host_ts`,
- `deferred_job`,
- `browser_wasm`,
- `native_process`,
- `mcp_stdio`,
- `mcp_container`,
- `remote_service`.

Acceptance:

- `compose_media`, `generate_chart`, and `generate_graph` no longer appear as
  simple inline tools in eval inventory,
- operation cards and admin health can show the real target,
- missing target prerequisites disable or block the operation before execution.

## Phase 03 - Primitive/Recipe Split

Goal: separate tools that do one thing from product workflows.

Work:

- classify current tools into primitive, recipe launcher, operation action,
  internal step, and legacy shim,
- demote internal publishing steps from default prompt exposure,
- keep product intent through operation templates rather than one-off tool
  instructions,
- preserve admin/staff editorial access through admin pages and operation cards.

Acceptance:

- "blog article" is a content publishing recipe, not a pile of prompt-visible
  substeps,
- media video creation is a media workflow operation,
- factory product creation is a factory work order operation,
- every demoted tool remains reachable through deterministic operation code if
  still needed.

## Phase 04 - Operation Recipe Library

Goal: make reusable workflows explicit.

Create recipe definitions for:

- `content_publish`,
- `media_workflow`,
- `factory_work_order`,
- `backup_create`,
- `restore_execute`,
- `system_diagnostic`,
- `tool_task`.

Each recipe defines:

- allowed roles,
- required confirmations,
- steps,
- action buttons,
- artifact inputs/outputs,
- retry/cancel behavior,
- eval scenarios.

Acceptance:

- the LLM can request a recipe but cannot bypass recipe validation,
- operation actions drive execution,
- the conversation projects state from the ledger.

## Phase 05 - Rust Runtime Expansion

Goal: move deterministic hard-state workloads out of Node where it materially
improves reliability.

Implement in this order:

1. media probe/executor boundary,
2. artifact manifest verifier,
3. resource guard,
4. release/image verifier,
5. Rust RAG/vector engine.

Acceptance:

- Rust returns structured command results,
- TypeScript reconciles every result into operation state,
- missing binaries and native errors become visible health/operation state,
- Docker image contains all required binaries and contract tests prove it.

## Phase 06 - Durable Conversation Eval Artifacts

Goal: use tests as reviewable product evidence.

Work:

- expand `src/lib/evals/eval-artifacts.ts` to include screenshots and media
  metadata,
- add scenario-level `conversation.md`,
- add `tool-calls.jsonl`,
- add `operation-timeline.json`,
- add `artifact-ledger.json`,
- add `human-review.md`.

Acceptance:

- every complex eval leaves an artifact bundle a human can review,
- failures include the exact checkpoint, prompt, tool call, operation state, and
  artifact evidence,
- eval artifacts never leak secrets.

## Phase 07 - Tool Surface Pruning

Goal: reduce model-visible complexity after replacements are proven.

Prune or demote:

- publishing internals after `content_publish` is complete,
- legacy command wrappers superseded by operation recipes,
- duplicate admin commands that can be one `tool_task` or `system_diagnostic`
  recipe,
- one-off media helpers superseded by media primitives and recipes.

Acceptance:

- prompt-visible tool count drops without losing product functionality,
- admin/staff users retain appropriate power through pages and buttons,
- all removed/demoted surfaces have passing replacement evals.

## Phase 08 - Appliance And Release Gate

Goal: prove the standardized tool architecture works in the single-image
appliance.

Acceptance:

- Docker lifecycle smoke runs the eval subset,
- release evidence includes tool inventory, operation recipe inventory, Rust
  binary inventory, and eval artifact paths,
- platform deployment can reason about feature availability from catalog state.

