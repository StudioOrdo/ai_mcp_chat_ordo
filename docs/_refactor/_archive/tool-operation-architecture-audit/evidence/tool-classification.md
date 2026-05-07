# Tool Classification And Pruning Direction

This is the greenfield classification for the current tool/function surface. The
goal is not to delete useful behavior; it is to move behavior to the right layer.

Legend:

- `primitive`: bounded capability that can remain as a capability.
- `operation_launcher`: starts a durable operation recipe.
- `operation_action`: advances an existing operation.
- `internal_step`: should be called by deterministic operation code, not usually
  exposed directly to the model.
- `read_model`: safe projection/query.
- `extension`: optional pack capability that should be install/runtime gated.

| Tool | Current Family | Target Class | Direction |
| --- | --- | --- | --- |
| `adjust_ui` | core/ui | primitive | Keep intent-gated. |
| `admin_prioritize_leads` | admin | extension/read_model | Keep optional admin intelligence; expose through admin diagnostics or recipes. |
| `admin_prioritize_offer` | admin | extension/read_model | Same as admin intelligence. |
| `admin_search` | admin | extension/read_model | Operator-only admin query. |
| `admin_triage_routing_risk` | admin | extension/read_model | Same as admin intelligence. |
| `admin_web_search` | admin | extension/primitive | Optional MCP/web-search primitive; provider/network gated. |
| `approve_journal_post` | publishing | operation_action | Move under `content_publish` action policy. |
| `calculator` | core/math | primitive | Keep. |
| `cancel_appliance_restore` | admin | operation_action | Keep operator-only; operation button first. |
| `compose_blog_article` | publishing | internal_step | Demote behind `content_publish`. |
| `compose_media` | media | operation_launcher | Keep as media workflow launcher, not a simple inline tool. |
| `configure_backup_policy` | admin | operation_action | Keep operator-only; config operation/action. |
| `configure_tool_availability` | core/admin | operation_action | Keep operator-only; config operation/action. |
| `confirm_appliance_restore` | admin | operation_action | Keep operator-only; button/action only. |
| `create_appliance_backup` | admin | operation_launcher | Keep operator-only; operation-backed. |
| `draft_content` | publishing | internal_step | Demote behind content operation. |
| `execute_appliance_restore` | admin | operation_action | Keep operator-only; button/action only. |
| `generate_audio` | media | primitive | Keep provider-gated artifact primitive; workflow should consume artifact IDs. |
| `generate_blog_image` | publishing/media | internal_step | Move behind content/media artifact recipe. |
| `generate_blog_image_prompt` | publishing | internal_step | Demote; no direct prompt exposure. |
| `generate_chart` | media | primitive | Keep as artifact primitive; execution target should be browser/WASM-aware. |
| `generate_graph` | media | primitive | Keep as artifact primitive; execution target should be browser/WASM-aware. |
| `get_admin_affiliate_summary` | referrals | read_model | Keep role-gated. |
| `get_checklist` | corpus/content | read_model | Keep. |
| `get_corpus_summary` | corpus/content | read_model | Keep. |
| `get_current_page` | core/ui | read_model | Keep intent-gated. |
| `get_deferred_job_status` | core/job | read_model | Keep until fully replaced by operation status; then alias to operation/job read model. |
| `get_journal_post` | publishing | read_model | Keep for editorial surfaces. |
| `get_journal_workflow_summary` | publishing | read_model | Collapse into content operation read model when `content_publish` is complete. |
| `get_my_affiliate_summary` | referrals | read_model | Keep. |
| `get_my_job_status` | core/job | read_model | Keep until operation status supersedes. |
| `get_my_profile` | core/profile | read_model | Keep. |
| `get_my_referral_qr` | referrals | read_model | Keep. |
| `get_section` | corpus/content | read_model | Keep. |
| `inspect_runtime_context` | core/system | read_model | Keep intent-gated. |
| `inspect_runtime_logs` | admin | read_model | Operator-only; never default prompt. |
| `inspect_theme` | core/ui | read_model | Keep intent-gated. |
| `list_admin_referral_exceptions` | referrals | read_model | Keep role-gated. |
| `list_appliance_backups` | admin | read_model | Keep operator-only plus admin UI. |
| `list_available_pages` | core/ui | read_model | Keep intent-gated. |
| `list_conversation_media_assets` | media | read_model | Keep; critical artifact ledger primitive. |
| `list_deferred_jobs` | core/job | read_model | Keep admin/operator; eventually project through operation status. |
| `list_journal_posts` | publishing | read_model | Keep. |
| `list_journal_revisions` | publishing | read_model | Keep for editorial/admin surfaces. |
| `list_my_jobs` | core/job | read_model | Keep until operation status supersedes. |
| `list_my_referral_activity` | referrals | read_model | Keep. |
| `list_practitioners` | corpus/content | read_model | Keep if still product-relevant; otherwise move to corpus recipe. |
| `navigate_to_page` | core/ui | primitive | Keep intent-gated. |
| `prepare_appliance_restore` | admin | operation_launcher | Keep operator-only; starts restore operation. |
| `prepare_journal_post_for_publish` | publishing | operation_launcher | Fold into `content_publish`. |
| `produce_blog_article` | publishing | operation_launcher | Replace with generic `content_publish`/`content_create` recipe. |
| `produce_product` | admin/factory | operation_launcher | Keep as `factory_work_order` launcher. |
| `publish_content` | publishing | operation_action | Move under content operation action. |
| `publish_journal_post` | publishing | operation_action | Move under content operation action. |
| `qa_blog_article` | publishing | internal_step | Demote behind content operation. |
| `request_pre_restore_backup` | admin | operation_action | Keep operator-only; restore safety action. |
| `resolve_blog_article_qa` | publishing | internal_step | Demote behind content operation. |
| `restore_journal_revision` | publishing | operation_action | Keep through editorial operation/action. |
| `search_corpus` | corpus | primitive/read_model | Keep; Rust RAG target later. |
| `search_my_conversations` | conversation | primitive/read_model | Keep; Rust search target later if needed. |
| `search_relationship_memory` | conversation | primitive/read_model | Keep; Rust search target later if needed. |
| `select_journal_hero_image` | publishing/media | operation_action | Move under content operation action. |
| `set_preference` | core/profile | primitive | Keep low-risk mutation. |
| `set_theme` | core/ui | primitive | Keep low-risk mutation. |
| `submit_journal_review` | publishing | operation_action | Move under content operation action. |
| `update_journal_draft` | publishing | operation_action | Move under content operation action. |
| `update_journal_metadata` | publishing | operation_action | Move under content operation action. |
| `update_my_profile` | core/profile | primitive | Keep low-risk mutation. |
| `validate_appliance_backup` | admin | operation_action/read_model | Keep operator-only; operation-backed validation. |

## Highest-Value Pruning

First candidates to demote after replacement evals pass:

- `compose_blog_article`
- `qa_blog_article`
- `resolve_blog_article_qa`
- `generate_blog_image_prompt`
- `draft_content`
- direct publish tools that bypass a content operation approval path

Do not remove the behavior. Move it behind a typed `content_publish` operation
where the user sees a draft, QA result, selected image, publish button, rollback
action, and artifact ledger.

