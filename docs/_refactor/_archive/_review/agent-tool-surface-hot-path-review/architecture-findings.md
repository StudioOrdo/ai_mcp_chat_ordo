# Architecture Findings

## 1. The Catalog Is The Right Control Plane
The current architecture has converged around `CAPABILITY_CATALOG` and
`CapabilityRuntime`. This is the right direction.

Good current patterns:
- Presentation descriptors derive from the catalog.
- Job capabilities derive from the catalog.
- MCP exports derive from the catalog and route through adapter guardrails.
- Chat tool bundles now register catalog-bound capabilities by bundle.

Keep this. Do not introduce new per-surface registries unless they are
projections from the catalog.

## 2. Tool Count Is Too High For The Product Shape
The catalog has 59 capabilities. That is too many for a default agent prompt and
too many for fast model selection in hot paths.

The largest issue is the blog/journal surface:
- 20 tools are in the blog bundle.
- Many are step-level workflow mutations.
- The model is being asked to choose internal workflow steps instead of asking
  for a product-level outcome.

Recommended direction:
- Collapse blog/journal commands around a work-order workflow/read model.
- Keep detailed operations available to admin UI or explicit operator mode.
- Do not expose every mutation as a default agent tool.

## 3. Job Status Tools Are Duplicated By Audience
Current tools:
- `get_my_job_status`
- `list_my_jobs`
- `get_deferred_job_status`
- `list_deferred_jobs`

This is conceptually one job query boundary with role-scoped projection. The
agent should not need separate tools for self vs admin job reads. The runtime
can infer scope from role and input.

Recommended direction:
- Replace with `get_job_status` and `list_jobs`, or one `query_jobs` tool with
  strict role-scoped filters.
- Keep route/UI read models separate if needed.
- Remove profile-bundle ownership of job tools.

## 4. Theme, Preference, And Profile Are Split Artificially
Current tools:
- `set_theme`
- `inspect_theme`
- `adjust_ui`
- `set_preference`
- `get_my_profile`
- `update_my_profile`

These are all user preference/profile operations. The split makes sense for UI
commands, but not necessarily for LLM tool exposure.

Recommended direction:
- Keep low-level commands internally.
- Expose fewer agent tools, likely `get_my_profile` and `update_my_profile`
  with preference/theme fields if the product wants the agent to manage these.
- Hide `inspect_theme` and `adjust_ui` unless there is a concrete user workflow.

## 5. Corpus Tools Are Read-Model Fragmented
Current tools:
- `search_corpus`
- `get_section`
- `get_corpus_summary`
- `get_checklist`
- `list_practitioners`

These should be reviewed after Phase 02 search index execution. The core issue
is whether these are true user intents or convenience views over one search/read
model.

Recommended direction:
- Keep `search_corpus`.
- Keep `get_section` if citations/deep links require exact section fetch.
- Consider moving summary/checklist/practitioner listing into typed search
  result modes or product-specific read models.

## 6. Media Is Close To The Right Shape
Current media tools are much cleaner than blog/journal:
- `compose_media`
- `generate_audio`
- `generate_chart`
- `generate_graph`
- `list_conversation_media_assets`

Remaining concern:
- `generate_chart` and `generate_graph` are separate browser tools with similar
  artifact lifecycle needs.

Recommended direction:
- Keep `compose_media` and `generate_audio`.
- Consider a unified `generate_visual_artifact` internal path for chart/graph
  execution while preserving user-facing labels if needed.
- Keep `list_conversation_media_assets` because it supports asset continuity.

## 7. MCP Export Cutover Is In Good Shape
The catalog-owned MCP surface is now explicit and guarded:
- `admin_web_search`
- `admin_search`
- `admin_prioritize_leads`
- `admin_prioritize_offer`
- `admin_triage_routing_risk`
- `inspect_runtime_logs`

Recommended direction:
- Keep these.
- Do not add manual operations-server handlers for catalog-owned tools.
- Keep exact adapter coverage tests.
- Consider whether standalone MCP servers such as `mcp/admin-web-search-server.ts`
  are still product-critical after operations-sidecar convergence.

## 8. Legacy Bundle Helpers Can Probably Be Removed
`src/lib/chat/tool-bundles/bundle-registration.ts` still exports generic
`createRegisteredToolBundle` and `registerToolBundle` helpers. The production
path now uses catalog-bound bundles.

Recommended direction:
- Confirm only tests or dead paths use the generic helpers.
- Delete generic helpers if no production bundle needs them.
- Keep `createCatalogBoundToolBundle` and `registerCatalogBoundToolBundle`.

## 9. Prompt Exposure Needs A Budget
Not every executable tool should be prompt-visible by default.

Recommended direction:
- Add an explicit catalog facet for prompt exposure, or extend `promptHint` into
  a prompt policy facet.
- Separate:
  - executable by role
  - visible in default prompt
  - visible only after user intent/classifier match
  - internal/UI-only
- This will reduce hot-path model confusion without deleting useful internal
  capabilities.

## 10. The Main Cleanup Principle
The system should converge to this pattern:

1. Product intent tool.
2. Catalog-owned schema and policy.
3. Runtime binding resolves execution target.
4. Read model projects state.
5. UI presenter renders state.

Avoid:
- one tool per internal mutation;
- one registry per surface unless generated from catalog;
- prompt-visible diagnostic tools;
- compatibility aliases without a deletion date.

