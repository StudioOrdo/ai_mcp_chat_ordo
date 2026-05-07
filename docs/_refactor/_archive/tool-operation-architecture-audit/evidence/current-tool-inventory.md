# Current Tool Inventory Evidence

Captured from the current codebase on 2026-05-03.

## Commands Run

```bash
npm test -- --run tests/evals/eval-artifacts.test.ts tests/evals/tool-workflow-coverage-eval.test.ts tests/evals/tool-coverage-eval.test.ts
node -r tsx/cjs - <<'NODE'
const { getToolComposition } = require('./src/lib/chat/tool-composition-root');
const { resolveToolCoverageCases } = require('./src/lib/evals/tool-coverage');
const { getCapabilityOwnership } = require('./src/core/capability-catalog/capability-ownership');
const registry = getToolComposition().registry;
const cases = resolveToolCoverageCases({ registry });
const rows = cases.map((item) => ({
  name: item.toolName,
  category: item.category,
  mode: item.executionMode,
  exposure: item.promptExposure,
  owner: (() => {
    const own = getCapabilityOwnership(item.toolName);
    return own ? own.kind === 'pack' ? own.packId : 'core' : 'unknown';
  })(),
}));
NODE
```

## Test Evidence

The local eval harness tests passed:

- `tests/evals/eval-artifacts.test.ts`
- `tests/evals/tool-coverage-eval.test.ts`
- `tests/evals/tool-workflow-coverage-eval.test.ts`

The workflow evals now write durable artifacts through
`src/lib/evals/eval-artifacts.ts`. A live run can produce inspectable
conversation artifacts with:

```bash
EVAL_LIVE_ENABLED=true npm run eval:live-tool-workflows -- --artifact-dir .runtime-logs/eval-artifacts/tool-workflows
EVAL_LIVE_ENABLED=true npm run eval:live-tools -- --artifact-dir .runtime-logs/eval-artifacts/tool-coverage
```

## Current Prompt Tool Counts

The local registry inventory observed 66 prompt-addressable cases from
`resolveToolCoverageCases`.

The live workflow smoke loaded the provider-enabled registry and observed 69
registered tools:

```bash
EVAL_LIVE_ENABLED=true npm run eval:live-tool-workflows -- --scenario chart-graph-reusable-visuals-fixture --artifact-dir .runtime-logs/eval-artifacts/tool-workflows-smoke
```

Result:

- `Live tool workflow coverage: 1/1 passed`
- `Registry tools: 69`
- Artifact bundle:
  `.runtime-logs/eval-artifacts/tool-workflows-smoke/2026-05-04T02-07-24-636Z`

The difference is environment-dependent registration. The target architecture
should treat this as another reason to make provider/tool availability explicit
in catalog health and eval reports.

By ownership:

- `core`: 23
- `admin_intelligence`: 16
- `publishing`: 19
- `media`: 4
- `referrals`: 4

By category:

- `system`: 31
- `content`: 28
- `ui`: 6
- `math`: 1

By registry execution mode:

- `inline`: 57
- `deferred`: 9

By prompt exposure:

- `default_prompt`: 47
- `operator_only`: 13
- `intent_gated`: 6

## Current Tool Shape

Core tools:

- `adjust_ui`
- `calculator`
- `configure_tool_availability`
- `get_checklist`
- `get_corpus_summary`
- `get_current_page`
- `get_deferred_job_status`
- `get_my_job_status`
- `get_my_profile`
- `get_my_referral_qr`
- `get_section`
- `inspect_runtime_context`
- `inspect_theme`
- `list_available_pages`
- `list_deferred_jobs`
- `list_my_jobs`
- `list_practitioners`
- `navigate_to_page`
- `search_corpus`
- `search_my_conversations`
- `search_relationship_memory`
- `set_preference`
- `set_theme`
- `update_my_profile`

Admin intelligence tools:

- `admin_prioritize_leads`
- `admin_prioritize_offer`
- `admin_search`
- `admin_triage_routing_risk`
- `cancel_appliance_restore`
- `configure_backup_policy`
- `confirm_appliance_restore`
- `create_appliance_backup`
- `execute_appliance_restore`
- `inspect_runtime_logs`
- `list_appliance_backups`
- `prepare_appliance_restore`
- `produce_product`
- `request_pre_restore_backup`
- `validate_appliance_backup`

Publishing tools:

- `approve_journal_post`
- `compose_blog_article`
- `draft_content`
- `generate_blog_image_prompt`
- `get_journal_post`
- `get_journal_workflow_summary`
- `list_journal_posts`
- `list_journal_revisions`
- `prepare_journal_post_for_publish`
- `produce_blog_article`
- `publish_content`
- `publish_journal_post`
- `qa_blog_article`
- `resolve_blog_article_qa`
- `restore_journal_revision`
- `select_journal_hero_image`
- `submit_journal_review`
- `update_journal_draft`
- `update_journal_metadata`

Media tools:

- `compose_media`
- `generate_chart`
- `generate_graph`
- `list_conversation_media_assets`

Referral tools:

- `get_admin_affiliate_summary`
- `get_my_affiliate_summary`
- `list_admin_referral_exceptions`
- `list_my_referral_activity`

## Concrete Findings

1. The architecture has two different grains of tool mixed together.
   `search_corpus` and `list_conversation_media_assets` are primitives.
   `produce_blog_article` and `produce_product` are recipes. Internal
   publishing steps are still visible as standalone tools.

2. The operation kernel is strong enough to absorb product recipes. Backup,
   restore, media workflow, factory work order, help, and onboarding already
   have operation grounding in `docs/_refactor/agentos-operation-kernel`.

3. Registry execution mode is too shallow. `ToolDescriptor.executionMode` is
   only `inline | deferred`, while capability presentation already knows about
   `browser` and `hybrid`. That mismatch makes `compose_media`,
   `generate_chart`, and `generate_graph` appear simpler than they are.

4. Media is the clearest test case. The critical workflow is not one tool; it
   is asset discovery, generation, status polling, composition, status polling,
   and durable artifact projection. The workflow eval now captures exactly that.

5. Publishing is over-exposed. A prompt-visible "blog" surface should become a
   `content_publish` operation recipe assembled from smaller capabilities.
   Blog-specific internals should become internal steps unless the user is in a
   staff/admin editorial workspace.

6. Rust should be expanded where determinism, file I/O, native probing, or
   resource discipline matter. Backup/restore is the reference implementation.
