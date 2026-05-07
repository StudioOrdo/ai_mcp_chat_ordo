# Target Architecture: Composable Tool Operations

## Product Shape

Ordo should feel like an AgentOS, not a bag of chat functions. The user should
ask for an outcome. The system should compile that request into one of three
things:

1. a read-only answer using safe query capabilities,
2. a durable operation with visible state and buttons,
3. a clarifying question when the request is ambiguous or unsafe.

The LLM should not manually remember a multi-step workflow. It should select or
explain the workflow while deterministic code owns state, authorization,
actions, retries, artifacts, and failure handling.

## Layered Model

### 1. Capability Primitives

Primitive capabilities do one bounded thing:

- read: search corpus, list jobs, inspect runtime, list media assets
- write: update profile, set theme, set preference
- render: create chart, render graph, generate audio, generate image
- native I/O: create backup, validate archive, restore archive
- publish: draft, approve, publish, rollback

Every primitive has:

- canonical name,
- JSON schema,
- output schema or output hint,
- role policy,
- risk class,
- prompt exposure,
- execution target,
- idempotency rule,
- artifact policy,
- eval recipe.

The current `CapabilityDefinition` already covers much of this in
`src/core/capability-catalog/capability-definition.ts`. The missing pieces are
formal risk/idempotency/artifact/eval facets and a richer execution target than
`ToolDescriptor.executionMode`.

### 2. Operation Recipes

Recipes assemble primitives into durable work:

- `backup_create`
- `restore_execute`
- `media_workflow`
- `factory_work_order`
- `content_publish`
- `system_diagnostic`
- `tool_task`
- `help_flow`
- `onboarding_flow`

Recipes are not just prompt text. They are operation templates with typed steps,
required confirmations, expected artifacts, and terminal states.

Examples:

- A "create a narrated video" request becomes a `media_workflow` operation with
  asset discovery, audio generation, composition, status checks, and final
  artifact projection.
- A "publish this article" request becomes a `content_publish` operation with
  draft selection, QA, image selection, approval, publish, and rollback actions.
- A "build a product" request becomes a `factory_work_order` operation.

### 3. Conversation and Admin Surfaces

Chat messages and admin pages are projections. They should render from the
operation ledger and capability read models, not from one-off tool strings.

Required UI behavior:

- dangerous actions use buttons, not typed magic phrases,
- stale buttons are visibly disabled and fail safely if clicked,
- each operation card shows current state, next actions, artifacts, and latest
  evidence,
- every generated artifact can be inspected after the run,
- eval runs write durable review artifacts under `.runtime-logs/eval-artifacts`.

### 4. Runtime Targets

Execution targets should be first-class and consistently reflected in the
catalog, registry, operation plan, eval report, and admin health surface.

Current target vocabulary from the codebase:

- `host_ts`
- `deferred_job`
- `browser_wasm`
- `native_process`
- `mcp_stdio`
- `mcp_container`
- `remote_service`

Target architecture:

- TypeScript owns product policy, prompt grounding, route handlers, operation
  ledger writes, UI projection, and provider selection.
- Rust owns deterministic native execution where Node is fragile or wasteful.
- Browser/WASM owns local rendering where the browser is the right sandbox.
- MCP sidecars are adapter boundaries, not hidden application brains.

## Rust Strategy

Use Rust liberally where it improves determinism and resource discipline, but
keep it behind narrow command/result contracts.

### Keep In TypeScript

- capability catalog authoring,
- role and content policy,
- provider/model routing,
- operation state semantics,
- chat prompt grounding,
- React/admin UI,
- operation ledger persistence and reconciliation.

### Move Or Build In Rust

1. Backup/restore executor: already implemented and the reference pattern.
2. Media probe/executor: FFmpeg supervision, media metadata, clip validation,
   stream probing, file materialization, and final package validation.
3. Search/RAG engine: embedding inference and vector search, following
   `docs/_refactor/rust_projects/rag_architecture_spec.md`.
4. Runtime resource guard: disk, memory, permissions, process health, file locks.
5. Release/image verifier: binary presence, manifests, hashes, SBOM/provenance
   checks.
6. Artifact manifest verifier: local file existence, size, MIME, dimensions,
   duration, and optional checksum for safety-critical artifacts.

### Do Not Move To Rust

- the LLM-facing planner,
- business-specific workflows,
- operation state transition policy,
- role-specific assistant behavior,
- admin page composition.

Rust should make hard facts reliable. It should not become a second orchestrator.

## Prompt Surface Target

The prompt-visible tool list should be smaller than the internal capability
graph.

### Always Eligible For Prompt Exposure

- read-only queries,
- low-risk preference/profile updates,
- operation launchers,
- operation action/status surfaces,
- artifact listing/selecting.

### Usually Intent-Gated

- navigation,
- UI adjustment,
- runtime inspection,
- diagnostics,
- chart/graph generation when the user is really asking for a visual artifact.

### Usually Operator-Only

- admin search,
- logs,
- backup/restore,
- tool configuration,
- provider/admin configuration,
- role switching,
- system health mutations.

### Usually Internal-Only

- substeps in content production,
- intermediate QA/resolution steps,
- provider-specific image/audio prompt helpers,
- raw publish internals that bypass operation approval,
- any step that should happen only inside an operation recipe.

## Pruning Rules

1. If a prompt-visible tool is a substep of a durable operation, demote it to
   internal-only after the operation recipe passes evals.
2. If two tools differ only by product vocabulary, replace them with one
   primitive plus a recipe.
3. If a tool mutates data and can fail asynchronously, it must create or act on
   an operation.
4. If a tool returns an artifact, that artifact must enter the artifact ledger
   and be reusable by later operations.
5. If a tool requires provider credentials or native binaries, disabled/missing
   state must be visible before prompt execution.
6. If the model needs to call more than two tools in a fixed order, create an
   operation template or workflow eval for that flow.

## Testing Target

Testing should produce artifacts a human can inspect, not just green terminal
output.

Minimum eval artifact bundle:

- `report.json`: raw redacted machine report,
- `summary.md`: pass/fail summary,
- `scenario-*.md`: prompt, assistant answer, tool timeline, results, artifact
  IDs, and checkpoints,
- later: screenshots/media thumbnails when browser or media outputs are involved.

Test layers:

1. schema/unit tests for every primitive,
2. operation state/action tests for every recipe,
3. fixture-backed workflow evals for complex sequences,
4. live LLM dry-run evals for prompt/tool selection,
5. live artifact evals for media/audio/video behind explicit opt-in,
6. Docker appliance smoke that proves the same flows work in the single image.

