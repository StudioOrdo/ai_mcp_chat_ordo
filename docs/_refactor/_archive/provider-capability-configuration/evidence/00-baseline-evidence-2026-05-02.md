# Phase 00 Baseline Evidence - 2026-05-02

Evidence captured at: `2026-05-02T04:48:53Z`

Git revision: `c99b37a514fa9610aaae1e4c2ee72abfa37f36de`

Working tree note:

- `docs/_refactor/provider-capability-configuration/` is untracked and contains
  the refactor package being prepared.
- Existing untracked review/debug docs are present and unrelated to runtime
  behavior.

## Provider Env And Helper Inventory

Command:

```bash
rg -n "claude-3-haiku|ANTHROPIC_|OPENAI_API_KEY|getAnthropic|getOpenaiApiKey|new Anthropic|new OpenAI|API__ANTHROPIC|API__OPENAI|AI_PROVIDER|ANTHROPIC_MODEL|ANTHROPIC_BASE_URL|OPENAI_MODEL" src mcp scripts config compose.yaml README.md --glob '!*.map'
```

Findings:

- `README.md` and `compose.yaml` document Anthropic as chat config and OpenAI as
  optional media/image/audio config.
- `compose.yaml` defaults `ANTHROPIC_MODEL` to `claude-haiku-4-5`.
- `src/lib/config/env.ts` is the main env-only helper source:
  - `getAnthropicApiKey()`
  - `getOpenaiApiKey()`
  - `getAnthropicModel()`
  - Anthropic timeout/retry helpers
  - Claude-only `getModelFallbacks()`
- Runtime callers still use env helpers:
  - `src/lib/chat/stream-route-handler.ts`
  - `src/lib/chat/chat-turn.ts`
  - `src/lib/chat/conversation-root.ts`
  - `src/lib/blog/blog-production-root.ts`
  - `src/lib/audio/audio-generation-service.ts`
  - `src/lib/capabilities/shared/web-search-tool.ts`
  - `src/app/api/tts/route.ts`
  - `src/app/api/e2e/media/generated-image/route.ts`
  - `mcp/admin-web-search-server.ts`

## Hard-Coded Validation Model

The deprecated validation model is present in two install/admin routes:

```text
src/app/api/install/validate-keys/route.ts:46
model: "claude-3-haiku-20240307"

src/app/api/admin/system/keys/route.ts:42
model: "claude-3-haiku-20240307"
```

Phase 04 removal target:

- Replace both route-local SDK validation calls with shared provider validation
  that uses the selected provider/model.

## Install/Admin Persistence Payloads

Command:

```bash
rg -n "system_settings|ConfigurationService|getConfig|getValue|setValue|ANTHROPIC|OPENAI|api key|api_key" src/lib/config src/app/api/install src/app/api/admin/system src/app/admin/system --glob '!*.map'
```

Findings:

- `src/lib/config/ConfigurationService.ts` resolves env first, then SQLite
  `system_settings`.
- `src/app/api/install/setup/route.ts` persists only:
  - `ANTHROPIC_API_KEY`
  - `OPENAI_API_KEY`
- `src/app/api/admin/system/keys/route.ts` updates only:
  - `ANTHROPIC_API_KEY`
  - `OPENAI_API_KEY`
- `src/app/admin/system/keys/page.tsx` checks raw env for configured key state.
- `src/app/admin/system/page.tsx` displays raw env for:
  - `ANTHROPIC_MODEL`
  - `ANTHROPIC_API_KEY`
  - `OPENAI_API_KEY`

Phase 05/08 removal target:

- Install/admin provider UI must persist provider/model/base URL/capability
  toggles.
- Admin system/key views must display effective config and source, not raw env.

## Runtime Tool Registry With OpenAI Unset

Command:

```bash
npx tsx -e "import { getCorpusRepository } from './src/adapters/RepositoryFactory'; import { createToolRegistry, _resetToolComposition } from './src/lib/chat/tool-composition-root'; import { getSearchHandler } from './src/lib/chat/search-pipeline'; delete process.env.OPENAI_API_KEY; _resetToolComposition(); const registry=createToolRegistry(getCorpusRepository(), getSearchHandler()); console.log(registry.getToolNames().filter((name)=>['generate_audio','generate_blog_image','admin_web_search'].includes(name)).sort().join('\n'));"
```

Output:

```text
admin_web_search
generate_audio
generate_blog_image
```

Finding:

- OpenAI-backed tools are registered even when `OPENAI_API_KEY` is unset.

Phase 07 removal target:

- Provider-backed capability availability must feed the general tool policy
  before prompt/tool schemas are built.

## Static Config Disabled-Tool Behavior

Command:

```bash
tmpdir="$(mktemp -d)"
printf '{"disabled":["admin_web_search"]}\n' > "$tmpdir/tools.json"
CONFIG_DIR="$tmpdir" npx tsx -e "import { getCorpusRepository } from './src/adapters/RepositoryFactory'; import { createToolRegistry, _resetToolComposition } from './src/lib/chat/tool-composition-root'; import { getSearchHandler } from './src/lib/chat/search-pipeline'; import { assembleRoleDirective } from './src/core/entities/role-directive-assembler'; _resetToolComposition(); const registry=createToolRegistry(getCorpusRepository(), getSearchHandler()); console.log('registry_has_admin_web_search=' + registry.getToolNames().includes('admin_web_search')); console.log('directive_mentions_admin_web_search=' + assembleRoleDirective('ADMIN').includes('admin_web_search'));"
rm -rf "$tmpdir"
```

Output:

```text
registry_has_admin_web_search=false
directive_mentions_admin_web_search=true
```

Findings:

- Static `config/tools.json` can remove a tool from the registry.
- Prompt hints still mention the disabled tool because role directives are
  assembled from catalog runtime statics, not effective availability.

Phase 01 removal target:

- Runtime registry and prompt-hint assembly must consume the same effective tool
  policy.

## Prompt-Hint Assembly Behavior

Command:

```bash
npx tsx -e "import { assembleRoleDirective } from './src/core/entities/role-directive-assembler'; const directive=assembleRoleDirective('ADMIN'); for (const name of ['admin_web_search','generate_audio','generate_blog_image','inspect_runtime_logs']) { console.log(name + '=' + directive.includes(name)); }"
```

Output:

```text
admin_web_search=true
generate_audio=false
generate_blog_image=false
inspect_runtime_logs=true
```

Findings:

- Admin directives mention `admin_web_search` and `inspect_runtime_logs` through
  catalog prompt hints.
- The prompt-hint path is independent of effective runtime registry state.

## Static Tool Configuration Path

Command:

```bash
rg -n "config/tools|DEFAULT_TOOLS|validateTools|getInstanceTools|resetConfigCache|_resetToolComposition|projectAllCapabilityRuntimeStatics|assembleRoleDirective|promptHintsByRole" src config docs/_refactor --glob '!*.map'
```

Findings:

- `config/tools.json` currently contains `{}`.
- `src/lib/config/defaults.ts` defines `DEFAULT_TOOLS: InstanceTools = {}`.
- `src/lib/config/instance.schema.ts` validates only `enabled` and `disabled`
  arrays.
- `src/lib/config/instance.ts` caches file-backed config and exposes
  `resetConfigCache()` for tests.
- `src/lib/chat/tool-composition-root.ts` caches the composed tool registry and
  exposes `_resetToolComposition()` for tests.
- `src/core/entities/role-directive-assembler.ts` loops over
  `projectAllCapabilityRuntimeStatics()`.

Phase 01 removal target:

- Static file config remains an operator override, but SQLite-backed runtime
  tool settings and prompt-aware effective availability become the product
  control plane.

## Tool Ownership And Classification Snapshot

Command:

```bash
npx tsx -e "import { CAPABILITY_CATALOG } from './src/core/capability-catalog/catalog'; import { getCapabilityOwnership } from './src/core/capability-catalog/capability-ownership'; const rows=Object.values(CAPABILITY_CATALOG).map((def)=>{ const owner=getCapabilityOwnership(def.core.name); return [def.core.name, def.core.category, Array.isArray(def.core.roles)?def.core.roles.join(','):def.core.roles, owner?.kind + (owner?.packId ? ':' + owner.packId : ''), def.core.label].join('\t'); }).sort(); console.log(rows.join('\n'));"
```

Summary:

- Total tools: `55`.
- Core tools: `21`.
- Extension pack tools:
  - `admin_intelligence`: `6`
  - `media`: `5`
  - `publishing`: `19`
  - `referrals`: `4`

### Phase 01 Inputs

Protected tools:

- `inspect_runtime_context`
- `inspect_runtime_logs`
- `inspect_theme`
- `set_theme`
- `adjust_ui`
- future `configure_tool_availability`

Core default tools:

- `adjust_ui`
- `calculator`
- `get_checklist`
- `get_corpus_summary`
- `get_current_page`
- `get_deferred_job_status`
- `get_my_job_status`
- `get_my_profile`
- `get_section`
- `inspect_runtime_context`
- `inspect_theme`
- `list_available_pages`
- `list_deferred_jobs`
- `list_my_jobs`
- `list_practitioners`
- `navigate_to_page`
- `search_corpus`
- `set_preference`
- `set_theme`
- `update_my_profile`

Default optional tools:

- `compose_media`
- `generate_chart`
- `generate_graph`
- `get_my_affiliate_summary`
- `get_my_referral_qr`
- `list_conversation_media_assets`
- `list_my_referral_activity`
- `search_my_conversations`
- `search_relationship_memory`

Provider-gated optional tools:

- `admin_web_search`
- `generate_audio`
- `generate_blog_image`

Business-feature optional tools:

- `admin_prioritize_leads`
- `admin_prioritize_offer`
- `admin_search`
- `admin_triage_routing_risk`
- `approve_journal_post`
- `compose_blog_article`
- `draft_content`
- `generate_blog_image_prompt`
- `get_admin_affiliate_summary`
- `get_journal_post`
- `get_journal_workflow_summary`
- `inspect_runtime_logs`
- `list_admin_referral_exceptions`
- `list_journal_posts`
- `list_journal_revisions`
- `prepare_journal_post_for_publish`
- `produce_blog_article`
- `produce_product`
- `publish_content`
- `publish_journal_post`
- `qa_blog_article`
- `resolve_blog_article_qa`
- `restore_journal_revision`
- `select_journal_hero_image`
- `submit_journal_review`
- `update_journal_draft`
- `update_journal_metadata`

Note:

- `get_my_referral_qr` is currently classified as core by
  `capability-ownership.ts`, but Phase 01 should decide whether referral QR
  belongs in default optional or referrals.
- `inspect_runtime_logs` is currently `admin_intelligence`; Phase 01 should
  decide whether it is protected/admin recovery or business-feature optional.

## Admin Health/Key Display Drift

Findings:

- `src/app/admin/system/page.tsx` displays provider keys/model from raw
  `process.env`.
- `src/app/admin/system/keys/page.tsx` determines configured provider state
  from raw `process.env`.
- `src/lib/admin/processes.ts` reports OpenAI capability config through
  `getOpenaiApiKey()` and Anthropic model through `getAnthropicModel()`.
- `src/lib/health/probes.ts` reports readiness by calling
  `getAnthropicApiKey()` and `getAnthropicModel()`.

Phase 08 removal target:

- Admin health, key pages, and probes should report effective provider/tool
  state and source.

## Phase 00 Closeout

All Phase 00 evidence requirements are satisfied.

Residual risk:

- The evidence records summaries and key outputs rather than full raw command
  output for the large `rg` inventories. The source anchors are specific enough
  for Phase 01 and later implementation QA.
