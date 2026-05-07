# Capability Map

## Current Catalog Shape
- 59 catalog capabilities.
- 13 job-backed capabilities.
- 5 browser-runtime capabilities.
- 6 catalog-owned MCP exports.
- 20 blog/journal capabilities.

Source review:
- `docs/_review/agent-tool-surface-hot-path-review/tool-inventory.md`

## Keep As Core User Services
These remain core product capabilities, but prompt visibility should still be
contextual.

| Capability | Product Office | Notes |
| --- | --- | --- |
| `search_corpus` | Knowledge Office | Main paid knowledge retrieval. |
| `get_section` | Knowledge Office | Exact source/citation fetch. |
| `search_my_conversations` | Customer Workspace | User history recall. |
| `search_relationship_memory` | Customer Workspace / Founder Coach | Personalized continuity. |
| `list_conversation_media_assets` | Media Studio / Asset Office | Asset continuity and reuse. |
| `generate_audio` | Media Studio | First-class personalized media. |
| `compose_media` | Media Studio | Main composition workflow. |
| `calculator` | Utility | Cheap deterministic utility. |
| `set_theme` | Identity & Access / Accessibility | Keep available to all users. |
| `adjust_ui` | Accessibility | Keep intent-gated for readability/accessibility. |
| `set_preference` | Identity & Access | Authenticated persistent preferences. |
| `get_my_profile` | Identity & Access | User state. |
| `update_my_profile` | Identity & Access | User-controlled profile. |
| `get_my_referral_qr` | Referral Office | Enabled for affiliates/users with referral feature. |
| `get_my_affiliate_summary` | Referral Office | User affiliate performance. |
| `list_my_referral_activity` | Referral Office | User affiliate detail. |
| `get_my_job_status` | Job Operations | Keep until job tool consolidation. |
| `list_my_jobs` | Job Operations | Keep until job tool consolidation. |

## Keep As Staff/Admin Services
| Capability | Product Office | Notes |
| --- | --- | --- |
| `admin_search` | Operations Desk | Admin/staff search depending policy. |
| `admin_web_search` | Operations Desk | Admin external research. |
| `admin_prioritize_leads` | Client Pipeline | Admin/staff operational use. |
| `admin_prioritize_offer` | Deal Desk | Admin/staff operational use. |
| `admin_triage_routing_risk` | Client Pipeline | Admin/staff operational use. |
| `get_admin_affiliate_summary` | Referral Office | Staff/admin affiliate performance. |
| `list_admin_referral_exceptions` | Referral Office | Staff/admin exception handling. |
| `inspect_runtime_logs` | Operations Desk | Admin only. |
| `get_deferred_job_status` | Job Operations | Admin until consolidation. |
| `list_deferred_jobs` | Job Operations | Admin until consolidation. |
| `produce_product` | Product Factory | Admin/factory production. |

## Contextual / Internal Candidates
| Capability | Recommendation |
| --- | --- |
| `inspect_runtime_context` | Intent-gated/operator. Useful but not default. |
| `inspect_theme` | Intent-gated helper, not default. |
| `list_available_pages` | UI/navigation helper; likely intent-gated. |
| `navigate_to_page` | Keep available where UI routing is useful. |
| `get_current_page` | Keep as context helper. |
| `generate_chart` | Keep as browser/runtime service; consider internal path behind media flow. |
| `generate_graph` | Keep as browser/runtime service; consider internal path behind media flow. |
| `get_corpus_summary` | Reassess after search/index phases. |
| `get_checklist` | Reassess after search/index phases. |
| `list_practitioners` | Reassess after search/index phases. |

## Blog / Journal Fragmentation
The blog bundle currently has 20 capabilities. This is too many for default
agent exposure.

Goal:
- preserve real production functions;
- stop showing step-level operations as normal tools;
- consolidate around work-order/read-model and product workflow surfaces.

Affected capabilities:
- `draft_content`
- `publish_content`
- `list_journal_posts`
- `get_journal_post`
- `list_journal_revisions`
- `get_journal_workflow_summary`
- `update_journal_metadata`
- `update_journal_draft`
- `submit_journal_review`
- `approve_journal_post`
- `publish_journal_post`
- `restore_journal_revision`
- `select_journal_hero_image`
- `generate_blog_image`
- `compose_blog_article`
- `qa_blog_article`
- `resolve_blog_article_qa`
- `generate_blog_image_prompt`
- `produce_blog_article`
- `prepare_journal_post_for_publish`

Do not delete blindly. First classify prompt exposure and move operational steps
behind product workflow contexts.

