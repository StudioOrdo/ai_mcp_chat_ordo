# Phase 8 — Core-Pack Separation And Heavy Runtime Externalization

> Status: In Progress
> Loop State: The first ownership cut is live in code, the admin-intelligence pack now prefers sidecar execution across its exported tools including `admin_search`, `compose_media` now has a first planner-declared local `native_process` pilot ahead of deferred fallback, the operations MCP server uses a registry instead of a switchboard, the deferred-job registry plus handler assembly and startup contract now derive from catalog-backed job metadata, and the legacy blog/book/books/corpus route families are deleted; the remaining work is broader pack/runtime adoption beyond these first cuts
> Goal: Define the solopreneur core, separate extension packs from it, and move heavy runtimes out of the main app container.
> Prerequisites: Phase 7 close enough that execution-target rules are stable

## Phase Intent

This phase is where the platform stops being a cleaned-up monolith and becomes the actual target shape: a smaller durable host core, explicit extension packs, and heavyweight execution living outside the main web host.

The main shift is not adding another abstraction. The main shift is choosing the canonical product shape and deleting compatibility or legacy surfaces that only exist to preserve an older system model.

## Source Anchors To Refresh

- [../../target-state.md](../../target-state.md#L1)
- [../../subsystems/execution-targets.md](../../subsystems/execution-targets.md#L1)
- [../../../../src/core/capability-catalog/catalog.ts](../../../../src/core/capability-catalog/catalog.ts#L1)
- [../../../../src/lib/chat/tool-composition-root.ts](../../../../src/lib/chat/tool-composition-root.ts#L1)
- [../../../../src/lib/jobs/deferred-job-handlers.ts](../../../../src/lib/jobs/deferred-job-handlers.ts#L1)
- [../../../../src/lib/media/ffmpeg/server/ffmpeg-server-executor.ts](../../../../src/lib/media/ffmpeg/server/ffmpeg-server-executor.ts#L1)
- [../../../../src/lib/media/ffmpeg/media-execution-router.ts](../../../../src/lib/media/ffmpeg/media-execution-router.ts#L1)
- [../../../../src/hooks/chat/useBrowserCapabilityRuntime.ts](../../../../src/hooks/chat/useBrowserCapabilityRuntime.ts#L1)
- [../../../../src/frameworks/ui/chat/registry/capability-presentation-registry.ts](../../../../src/frameworks/ui/chat/registry/capability-presentation-registry.ts#L1)
- [../../../../src/frameworks/ui/chat/plugins/system/resolve-system-card.ts](../../../../src/frameworks/ui/chat/plugins/system/resolve-system-card.ts#L1)
- [../../../../src/frameworks/ui/RichContentRenderer.tsx](../../../../src/frameworks/ui/RichContentRenderer.tsx#L1)
- [../../../../src/lib/config/env.ts](../../../../src/lib/config/env.ts#L1)
- [../../../../src/lib/config/env-config.ts](../../../../src/lib/config/env-config.ts#L1)
- [../../../../src/adapters/RepositoryFactory.ts](../../../../src/adapters/RepositoryFactory.ts#L1)
- [../../../../mcp/operations-server.ts](../../../../mcp/operations-server.ts#L1)
- [../../../../compose.yaml](../../../../compose.yaml#L1)
- [../../../../Dockerfile](../../../../Dockerfile#L1)

## Drift Traps

- Declaring a core-versus-pack split without actually changing runtime ownership.
- Keeping compatibility layers because they are familiar rather than because they protect current product value.
- Moving FFmpeg or another heavy runtime without preserving the host-owned job, artifact, and policy contracts.
- Treating Rust or Swift adoption as a finish line instead of a runtime choice justified by one concrete workload.

## Pre-Implementation QA Gate

- [x] Refresh the current tool-family map.
- [x] Refresh the current deployment and container assumptions.
- [x] Refresh the current FFmpeg and heavy-runtime story.
- [x] Choose the first core-versus-pack cut and first heavy-runtime extraction target.

## Verified Current State

### Capability Inventory

The current catalog contains 56 capabilities across 7 families in [../../../../src/core/capability-catalog/catalog.ts](../../../../src/core/capability-catalog/catalog.ts#L1).

| Family | Count | Modes | Notes |
| --- | --- | --- | --- |
| `system` | 15 | `inline` | stable shell, diagnostics, jobs, and admin-lite tools |
| `search` | 7 | `inline` | knowledge, conversation, and admin research tools |
| `profile` | 6 | `inline` | user state and personal referral views |
| `theme` | 3 | `inline` | shell theming and UI adjustment |
| `journal` | 12 | `inline`, `deferred` | editorial workflow surface |
| `editorial` | 8 | `deferred` | staged blog production pipeline |
| `artifact` | 4 | `hybrid`, `browser` | media, graph, chart, and audio generation |

### Proposed Core Versus Pack Ownership

#### Standard Host Core

This is now explicit in [../../../../src/core/capability-catalog/capability-ownership.ts](../../../../src/core/capability-catalog/capability-ownership.ts#L1).

Keep these in the durable host core because they are low-dependency, broadly useful, and directly tied to shell, state, or observability:

- `calculator`
- `get_current_page`
- `inspect_runtime_context`
- `list_available_pages`
- `navigate_to_page`
- `get_checklist`
- `search_corpus`
- `get_section`
- `get_corpus_summary`
- `search_my_conversations`
- `set_preference`
- `get_my_profile`
- `update_my_profile`
- `set_theme`
- `inspect_theme`
- `adjust_ui`
- `get_my_job_status`
- `list_my_jobs`
- `get_deferred_job_status`
- `list_deferred_jobs`

#### First Extension Packs

These families are now explicitly grouped as extension packs in [../../../../src/core/capability-catalog/capability-ownership.ts](../../../../src/core/capability-catalog/capability-ownership.ts#L1):

- Publishing pack: the full `editorial` plus `journal` families
- Media pack: `compose_media`, `generate_chart`, `generate_graph`, `generate_audio`
- Referral and affiliate pack: `get_my_referral_qr`, `get_my_affiliate_summary`, `list_my_referral_activity`, `get_admin_affiliate_summary`, `list_admin_referral_exceptions`
- Admin intelligence pack: `admin_web_search`, `admin_search`, `admin_prioritize_leads`, `admin_prioritize_offer`, and `admin_triage_routing_risk`

### Legacy And Compatibility Surface To Remove

For a greenfield target, these should be treated as deletion work rather than protected compatibility:

#### Safe To Delete Early

- The `navigate` legacy alias in [../../../../src/frameworks/ui/chat/registry/capability-presentation-registry.ts](../../../../src/frameworks/ui/chat/registry/capability-presentation-registry.ts#L1) is removed.
- Deprecated `API__*` environment aliases in [../../../../src/lib/config/env.ts](../../../../src/lib/config/env.ts#L1) and [../../../../src/lib/config/env-config.ts](../../../../src/lib/config/env-config.ts#L1) are removed.
- The legacy web-search transcript block renderer in [../../../../src/frameworks/ui/RichContentRenderer.tsx](../../../../src/frameworks/ui/RichContentRenderer.tsx#L1) is removed.
- Compatibility snapshot routing in [../../../../src/frameworks/ui/chat/plugins/system/resolve-system-card.ts](../../../../src/frameworks/ui/chat/plugins/system/resolve-system-card.ts#L1) is removed, and the old compatibility card file is deleted.
- Legacy route entrypoints under [../../../../src/app/blog/page.tsx](../../../../src/app/blog/page.tsx#L1), [../../../../src/app/blog/[slug]/page.tsx](../../../../src/app/blog/[slug]/page.tsx#L1), [../../../../src/app/book/[chapter]/page.tsx](../../../../src/app/book/[chapter]/page.tsx#L1), [../../../../src/app/books/page.tsx](../../../../src/app/books/page.tsx#L1), [../../../../src/app/books/[book]/[chapter]/page.tsx](../../../../src/app/books/[book]/[chapter]/page.tsx#L1), and the `corpus` redirect family under [../../../../src/app/corpus/page.tsx](../../../../src/app/corpus/page.tsx#L1) if there is no migration obligation
- The legacy route entrypoints under the old `blog`, `book`, `books`, and `corpus` public families are now deleted from the app surface.

#### Replace Before Delete

- The remaining explicit per-tool deferred-job executor wiring in [../../../../src/lib/jobs/deferred-job-handler-factories.ts](../../../../src/lib/jobs/deferred-job-handler-factories.ts#L1), with [../../../../src/lib/jobs/deferred-job-handlers.ts](../../../../src/lib/jobs/deferred-job-handlers.ts#L1) now reduced to dependency assembly, canonical tool iteration, and startup validation
- The manual operations MCP server switchboard in [../../../../mcp/operations-server.ts](../../../../mcp/operations-server.ts#L1) is now replaced by a registry-backed tool map, but the broader process still remains one shared sidecar.
- Approved raw-DB seams still called legacy in [../../../../src/adapters/RepositoryFactory.ts](../../../../src/adapters/RepositoryFactory.ts#L54)
- The placeholder admin breadcrumb implementation note in [../../../../src/components/admin/AdminBreadcrumb.tsx](../../../../src/components/admin/AdminBreadcrumb.tsx#L3) should be resolved by turning it into a real canonical component, not a lingering sprint stub

### Heavy Runtime Blockers

The biggest Phase 8 runtime extraction target was media execution, and the first extraction is now live.

- `compose_media` now dispatches from the host-owned deferred worker to [../../../../src/lib/media/server/media-worker-client.ts](../../../../src/lib/media/server/media-worker-client.ts#L1) instead of instantiating FFmpeg directly in [../../../../src/lib/jobs/deferred-job-handlers.ts](../../../../src/lib/jobs/deferred-job-handlers.ts#L1).
- The dedicated media runtime now lives behind [../../../../scripts/media-worker-server.ts](../../../../scripts/media-worker-server.ts#L1), [../../../../src/lib/media/server/compose-media-worker-runtime.ts](../../../../src/lib/media/server/compose-media-worker-runtime.ts#L1), [../../../../Dockerfile.media](../../../../Dockerfile.media#L1), and the `media-worker` service in [../../../../compose.yaml](../../../../compose.yaml#L1).
- The worker now persists governed user-file assets and returns `primaryAssetId` artifacts instead of leaking a host-local `outputPath` envelope.
- The FFmpeg executor is still used, but now as the implementation detail of the worker runtime rather than of the main app host.

For a clean finish, the next runtime work is no longer choosing whether `compose_media` should be the first media pilot. That first pilot now exists: the admin-intelligence export surface defaults to sidecar-first execution for `admin_web_search`, `admin_search`, `admin_prioritize_leads`, `admin_prioritize_offer`, and `admin_triage_routing_risk`, while `compose_media` now auto-discovers a local `native_process` target through [../../../../src/lib/capabilities/local-external-target-inventory.ts](../../../../src/lib/capabilities/local-external-target-inventory.ts#L1) and [../../../../scripts/compose-media-native-target.ts](../../../../scripts/compose-media-native-target.ts#L1) before falling back to `deferred_job`. `generate_audio`, `generate_chart`, and `generate_graph` already behave like browser accelerators, so the remaining media work is broadening this first native pilot into a fuller non-host runtime family rather than debating the target family from scratch.

## Current QA Notes

- Phase 7 execution-target work is structurally ready for Phase 8: host, deferred, browser, MCP stdio, MCP container, native process, and remote service targets now exist behind one planner contract.
- The remaining Phase 8 work is not another abstraction pass. It is ownership and runtime cleanup. The deferred-job surface is now mostly reduced to intentional custom executors behind [../../../../src/lib/jobs/deferred-job-handler-factories.ts](../../../../src/lib/jobs/deferred-job-handler-factories.ts#L1), so the next meaningful work is broader pack/runtime adoption rather than more plumbing cleanup.
- The current repo can now describe the target shape honestly: the first ownership cut exists in code, a dedicated media runtime exists, and the remaining work is the broader reduction of manual seams and additional pack/runtime adoption.
- The current repo can now describe the next extraction honestly too: the first exported admin-intelligence tools now prefer the operations or web-search sidecar by default rather than host execution.

## Expected Evidence Artifacts

- A written core-versus-pack ownership list that names the standard host tools and the first extension packs.
- A deletion log for compatibility or legacy surfaces that were removed because the project is now canonical rather than migratory.
- Targeted media and execution-target test output proving heavy runtime extraction did not break the host contract.
- A deployment diff showing `compose_media` no longer depends on FFmpeg inside or beside the main Next.js host.
- A short native-runtime pilot note naming the first workload that should become `native_process` or `remote_service`.
- A targeted test bundle showing `compose_media` now prefers the planner-declared local native target before governed deferred fallback when browser execution is unavailable.

## Detailed Implementation Plan

1. Freeze the canonical host core.
	- Mark the host-core tool list in catalog or adjacent ownership docs.
	- Mark the remaining families as extension packs rather than first-party default runtime surface.
2. Delete the compatibility tax.
	- Remove legacy route aliases, transcript compatibility rendering, env aliases, and tool aliases that do not protect current business data.
	- Replace sprint stubs with canonical components or remove them.
3. Externalize heavy media execution.
	- Move `compose_media` off the host-owned FFmpeg server executor path.
	- Keep job state, artifact ownership, and policy in the host; move only execution.
4. Reduce the remaining manual seams.
	- Replace the manual deferred-job handler table and manual MCP operations dispatcher with more derived runtime ownership.
5. Extend the first post-pilot pack runtime.
	- Broaden the media pack beyond the first `compose_media` native target and decide whether the next step stays local-native or moves to a containerized media family.
6. Choose the next real production `native_process` or `remote_service` workload after `compose_media`.
	- Prefer another backend-heavy, isolated workload rather than a shell-facing utility.

## Scope Guardrails

- Do not keep legacy entrypoints just because they once existed.
- Do not externalize every heavy system at once; move `compose_media` first.
- Do not keep compatibility rendering if the data model can be migrated or dropped.
- Do not adopt Rust or Swift before naming the exact workload that justifies it.

## Post-Implementation QA

- [x] Run targeted runtime, deployment, and capability tests.
- [x] Run changed-file diagnostics.
- [x] Confirm the core-versus-pack split is explicit in docs and code.
- [x] Confirm at least one heavy runtime no longer depends on the main app container.
- [x] Confirm the legacy or compatibility surface has a net deletion count rather than a net expansion.

## Exit Criteria

- The standard first-party host tool set is explicitly defined.
- Extension packs have an explicit runtime and ownership model.
- `compose_media` or another heavyweight workload no longer depends on FFmpeg in the main Next.js host.
- Legacy aliases, compatibility renderers, and greenfield-unnecessary redirects are removed.
- The platform has a credible first production-owned `native_process` target and a clear next workload after it.

## Handoff

- What the next implementation loop should now assume: Phase 7 execution-target contracts are ready; the open work is selecting the canonical product surface and deleting non-canonical seams.
- What remains unresolved: the next pack or native-runtime adoption beyond the first `compose_media` media pilot plus the first admin-intelligence extraction wave, and any future reduction of the small set of intentional custom deferred-job executors if a stronger runtime model emerges.
- What docs need updating: [./status-board.md](./status-board.md#L1), [../refactor-roadmap.md](../refactor-roadmap.md#L1), and [../target-state.md](../target-state.md#L1) should stay aligned as the ownership cut and deletion work land.
