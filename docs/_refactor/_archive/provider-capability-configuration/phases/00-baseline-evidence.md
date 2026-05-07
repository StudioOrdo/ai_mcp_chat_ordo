# Phase 00 - Baseline Evidence

## Goal

Record current provider/config behavior before changing it.

Status: `complete`

Evidence:

- [Phase 00 Baseline Evidence - 2026-05-02](../evidence/00-baseline-evidence-2026-05-02.md)

## QA Verdict

This phase is required before implementation and is now closed by the linked
baseline evidence note.

The existing code already proves the core drift:

- Install/admin validation hard-codes `claude-3-haiku-20240307`.
- Runtime provider helpers still read raw env instead of the SQLite-backed
  `ConfigurationService`.
- Install persists only API keys, not provider/model/base URL/capability
  choices.
- Admin health/key pages read raw env and can disagree with SQLite settings.
- Tool configuration is static-file based, process-cached, and has no runtime
  admin/conversation control plane.
- Role prompt hints are assembled from the static capability catalog instead of
  the effective tool manifest.
- OpenAI-backed tools are statically registered even when OpenAI is missing.

## Steps

1. Inventory production source reads of `ANTHROPIC_*`, `OPENAI_API_KEY`,
   `getAnthropic*`, `getOpenaiApiKey`, `new Anthropic`, and `new OpenAI`.
2. Record hard-coded model defaults and validation models.
3. Record install/admin request and persistence payloads.
4. Record tools registered with and without `OPENAI_API_KEY`.
5. Record admin system page output for env-backed and SQLite-backed config.
6. Record current `config/tools.json` behavior and cache boundaries.
7. Record current prompt-hint assembly path for tool-specific directives.

## Baseline Capture Commands

Run these before code changes and paste the relevant output into the evidence
section below.

```bash
rg -n "claude-3-haiku|ANTHROPIC_|OPENAI_API_KEY|getAnthropic|getOpenaiApiKey|new Anthropic|new OpenAI|API__ANTHROPIC|API__OPENAI|AI_PROVIDER|ANTHROPIC_MODEL|ANTHROPIC_BASE_URL|OPENAI_MODEL" src mcp scripts config compose.yaml README.md --glob '!*.map'
```

```bash
rg -n "generate_audio|generate_blog_image|admin_web_search|web-search|tts|OpenAI" src/lib/chat src/core/capability-catalog src/app/api mcp --glob '!*.map'
```

```bash
rg -n "system_settings|ConfigurationService|getConfig|getValue|setValue|ANTHROPIC|OPENAI|api key|api_key" src/lib/config src/app/api/install src/app/api/admin/system src/app/admin/system --glob '!*.map'
```

```bash
rg -n "config/tools|DEFAULT_TOOLS|validateTools|getInstanceTools|resetConfigCache|_resetToolComposition|projectAllCapabilityRuntimeStatics|assembleRoleDirective|promptHintsByRole" src config docs/_refactor --glob '!*.map'
```

Record provider-backed tool registration with OpenAI unset:

```bash
npx tsx -e "import { getCorpusRepository } from './src/adapters/RepositoryFactory'; import { createToolRegistry, _resetToolComposition } from './src/lib/chat/tool-composition-root'; import { getSearchHandler } from './src/lib/chat/search-pipeline'; delete process.env.OPENAI_API_KEY; _resetToolComposition(); const registry=createToolRegistry(getCorpusRepository(), getSearchHandler()); console.log(registry.getToolNames().filter((name)=>['generate_audio','generate_blog_image','admin_web_search'].includes(name)).sort().join('\n'));"
```

Record whether role prompt hints mention provider/admin tools independently of
effective registry state:

```bash
npx tsx -e "import { assembleRoleDirective } from './src/core/entities/role-directive-assembler'; const directive=assembleRoleDirective('ADMIN'); for (const name of ['admin_web_search','generate_audio','generate_blog_image','inspect_runtime_logs']) { console.log(name + '=' + directive.includes(name)); }"
```

Record static tool config behavior with a temporary disabled tool:

```bash
tmpdir="$(mktemp -d)"
printf '{"disabled":["admin_web_search"]}\n' > "$tmpdir/tools.json"
CONFIG_DIR="$tmpdir" npx tsx -e "import { getCorpusRepository } from './src/adapters/RepositoryFactory'; import { createToolRegistry, _resetToolComposition } from './src/lib/chat/tool-composition-root'; import { getSearchHandler } from './src/lib/chat/search-pipeline'; import { assembleRoleDirective } from './src/core/entities/role-directive-assembler'; _resetToolComposition(); const registry=createToolRegistry(getCorpusRepository(), getSearchHandler()); console.log('registry_has_admin_web_search=' + registry.getToolNames().includes('admin_web_search')); console.log('directive_mentions_admin_web_search=' + assembleRoleDirective('ADMIN').includes('admin_web_search'));"
rm -rf "$tmpdir"
```

Record the current catalog ownership/tool classification:

```bash
npx tsx -e "import { CAPABILITY_CATALOG } from './src/core/capability-catalog/catalog'; import { getCapabilityOwnership } from './src/core/capability-catalog/capability-ownership'; const rows=Object.values(CAPABILITY_CATALOG).map((def)=>{ const owner=getCapabilityOwnership(def.core.name); return [def.core.name, def.core.category, Array.isArray(def.core.roles)?def.core.roles.join(','):def.core.roles, owner?.kind + (owner?.packId ? ':' + owner.packId : ''), def.core.label].join('\t'); }).sort(); console.log(rows.join('\n'));"
```

## Expected Current Baseline

These are the expected findings before implementation:

- `claude-3-haiku-20240307` appears in install and admin validation routes.
- `src/lib/config/env.ts` is the main env-only helper source for provider key
  and model reads.
- `config/tools.json` is empty and only supports static `enabled`/`disabled`
  arrays.
- `admin_web_search`, `generate_audio`, and `generate_blog_image` are registered
  when `OPENAI_API_KEY` is unset.
- Disabling a tool through static config removes it from the registry but does
  not remove catalog-sourced prompt hints for that tool.
- Runtime directives are assembled through
  `projectAllCapabilityRuntimeStatics()`, not through the effective registry.

## Current Evidence To Record

### Hard-Coded Validation Model

- `src/app/api/install/validate-keys/route.ts` validates Anthropic with
  `claude-3-haiku-20240307`.
- `src/app/api/admin/system/keys/route.ts` validates Anthropic with
  `claude-3-haiku-20240307`.

Removal target:

- Replace both route-local SDK calls with the shared provider validation service
  from Phase 04.

### Env-Only Runtime Helpers

- `src/lib/config/env.ts` reads `ANTHROPIC_API_KEY`,
  `API__ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `API__OPENAI_API_KEY`, and
  `ANTHROPIC_MODEL` directly from `process.env`.
- `getAnthropicModel()` defaults to `claude-haiku-4-5`.
- `getModelFallbacks()` currently contains Claude-only fallback candidates.

Removal target:

- Keep compatibility wrappers only after they delegate to the new effective
  provider config resolver.

### SQLite Config Exists But Runtime Bypasses It

- `src/lib/config/ConfigurationService.ts` already resolves env first and then
  SQLite `system_settings`.
- `src/app/api/install/setup/route.ts` persists `ANTHROPIC_API_KEY` and
  `OPENAI_API_KEY` only.
- Chat, summarization, blog production, health, admin diagnostics, TTS, web
  search, generated-image harness, and MCP sidecars still use env helpers or raw
  env.

Removal target:

- Runtime provider call sites should consume the effective resolver, not raw
  `process.env` or route-local config reads.

### Install/Admin Payload Drift

- `src/app/install/InstallWizard.tsx` collects only `anthropicKey`,
  `openAiKey`, `adminEmail`, and `adminPassword`.
- `src/app/api/install/setup/route.ts` persists only the two provider keys.
- `src/app/admin/system/keys/KeysManager.tsx` updates only Anthropic/OpenAI
  keys.
- Admin key presence in `src/app/admin/system/keys/page.tsx` checks raw env.

Removal target:

- Expand install/admin payloads to include provider, model, base URL, and
  capability toggles while preserving key-only update behavior.

### Admin Health Drift

- `src/app/admin/system/page.tsx` displays `ANTHROPIC_MODEL`,
  `ANTHROPIC_API_KEY`, and `OPENAI_API_KEY` from raw env.
- `src/lib/admin/processes.ts` reports OpenAI and Anthropic model diagnostics
  through env helpers.
- `src/lib/health/probes.ts` declares readiness from env-only Anthropic helper
  calls.

Removal target:

- Health/admin views should report effective config, config source, and
  optional capability status.

### OpenAI-Backed Tool Availability Drift

- `src/lib/chat/tool-composition-root.ts` registers all tool bundles and only
  applies static `config/tools.json` enabled/disabled lists.
- `src/core/capability-catalog/families/media-capabilities.ts` statically
  declares `generate_audio`.
- `src/core/capability-catalog/families/blog-capabilities.ts` statically
  declares `generate_blog_image`.
- `src/core/capability-catalog/families/admin-capabilities.ts` statically
  declares `admin_web_search`.

Removal target:

- Phase 07 must add dynamic capability availability pruning before prompt/tool
  manifests are built, while keeping direct route/job guards.

### General Tool Configuration Drift

- `config/tools.json` exists but is currently empty.
- `src/lib/config/defaults.ts` defines `DEFAULT_TOOLS` as an empty object.
- `src/lib/config/instance.schema.ts` validates only `enabled` and `disabled`
  arrays.
- `src/lib/config/instance.ts` caches file-backed instance config for the
  process lifetime.
- `src/lib/chat/tool-composition-root.ts` caches the composed registry for the
  process lifetime.
- `src/core/entities/role-directive-assembler.ts` reads prompt hints from all
  capability runtime statics, not from the effective registry.
- Static `config/tools.json` can remove a tool from the registry, but prompt
  hints can still mention that tool because directive assembly does not consume
  effective availability.

Removal target:

- Add a runtime tool control plane before provider-specific pruning. Static
  `config/tools.json` should become one policy layer, not the only tool
  availability surface.

## Required Baseline Proofs

- Source check proves `claude-3-haiku-20240307` exists before Phase 04 and is
  absent after Phase 04.
- Source check proves `getAnthropicApiKey`, `getAnthropicModel`, and
  `getOpenaiApiKey` are used by runtime call sites before Phase 06 and are
  either removed or compatibility-wrapped after Phase 06.
- Registry evidence records whether `generate_audio`, `generate_blog_image`,
  and `admin_web_search` appear in the runtime tool registry with
  `OPENAI_API_KEY` unset.
- Registry evidence records whether `config/tools.json` changes require cache
  reset/restart and whether prompt hints still mention disabled tools.
- Tool classification evidence records current core/pack ownership so Phase 01
  can deliberately choose core default, default optional, provider-gated
  optional, and business-feature optional groups.
- Admin health evidence records raw-env display before Phase 08 and effective
  config/source display after Phase 08.

## Code Anchors

- `src/lib/config/env.ts`
- `src/lib/config/ConfigurationService.ts`
- `src/lib/config/env-config.ts`
- `src/lib/config/defaults.ts`
- `src/lib/config/instance.schema.ts`
- `src/lib/config/instance.ts`
- `src/app/install/InstallWizard.tsx`
- `src/app/api/install/validate-keys/route.ts`
- `src/app/api/install/setup/route.ts`
- `src/app/api/admin/system/keys/route.ts`
- `src/app/admin/system/keys/page.tsx`
- `src/app/admin/system/keys/KeysManager.tsx`
- `src/app/admin/system/page.tsx`
- `src/lib/admin/processes.ts`
- `src/lib/health/probes.ts`
- `src/lib/chat/provider-policy.ts`
- `src/lib/chat/tool-composition-root.ts`
- `src/lib/chat/tool-bundle-composition.ts`
- `src/lib/chat/runtime-manifest.ts`
- `src/lib/chat/stream-route-handler.ts`
- `src/lib/chat/chat-turn.ts`
- `src/lib/chat/conversation-root.ts`
- `src/lib/blog/blog-production-root.ts`
- `src/app/api/tts/route.ts`
- `src/app/api/web-search/route.ts`
- `src/app/api/e2e/media/generated-image/route.ts`
- `src/lib/audio/audio-generation-service.ts`
- `src/core/capability-catalog/families/admin-capabilities.ts`
- `src/core/capability-catalog/families/blog-capabilities.ts`
- `src/core/capability-catalog/families/media-capabilities.ts`
- `src/core/capability-catalog/capability-ownership.ts`
- `src/core/entities/role-directive-assembler.ts`
- `src/core/platform/capability-runtime/CapabilityRuntime.ts`
- `mcp/admin-web-search-server.ts`
- `mcp/generate-audio-server.ts`

## Evidence Recording Template

Use this structure when closing Phase 00:

```text
Evidence captured at: <timestamp>
Git revision: <sha or working tree note>

Provider env/helper inventory:
<summary and command output link>

Hard-coded validation model:
<summary and command output link>

Install/admin persistence payloads:
<summary and command output link>

Runtime tool registry with OPENAI_API_KEY unset:
<summary and command output link>

Static config disabled-tool behavior:
<summary and command output link>

Prompt-hint assembly behavior:
<summary and command output link>

Tool ownership/classification:
<summary and command output link>

Admin health/key display drift:
<summary and command output link>

Phase 01 inputs:
- Protected tools:
- Core default tools:
- Default optional tools:
- Provider-gated optional tools:
- Business-feature optional tools:
```

## Implementation Gate

Do not begin Phase 01 until Phase 00 has:

- the current baseline command output saved or summarized,
- a list of removal targets attached to the code anchors above,
- a clear baseline for the static tool configuration layer and prompt-hint
  leakage risk,
- a current tool ownership/classification snapshot for Phase 01 defaults,
- at least one source-level check that fails if
  `claude-3-haiku-20240307` disappears before Phase 04 closeout, and
- a clear statement of which OpenAI-backed tools are currently registered when
  `OPENAI_API_KEY` is absent.

## Done

- [x] Current drift is documented with code anchors.
- [x] Removal targets are listed.
- [x] Baseline tests or source checks prove the current hard-coded model exists.
- [x] Runtime tool registry behavior is recorded with `OPENAI_API_KEY` unset.
- [x] Static tool config caching and prompt-hint assembly behavior are
      documented.
- [x] Tool ownership/classification snapshot is recorded for Phase 01.
- [x] Admin health/key display drift is recorded for raw env vs SQLite-backed
      config.
