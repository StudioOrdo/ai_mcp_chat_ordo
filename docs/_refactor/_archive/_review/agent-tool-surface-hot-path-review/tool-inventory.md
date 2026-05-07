# Tool Inventory And Initial Disposition

Generated from `projectAllCapabilityRuntimeStatics()` on May 1, 2026.

## Summary
| Metric | Count |
| --- | ---: |
| Catalog capabilities | 59 |
| Job-backed capabilities | 13 |
| Browser-runtime capabilities | 5 |
| MCP-exported capabilities | 6 |
| Inline presentation capabilities | 44 |
| Deferred presentation capabilities | 12 |
| Hybrid presentation capabilities | 1 |

## Bundle Counts
| Bundle | Count |
| --- | ---: |
| admin | 6 |
| affiliate | 4 |
| blog | 20 |
| calculator | 1 |
| conversation | 2 |
| corpus | 5 |
| job | 2 |
| media | 5 |
| navigation | 5 |
| profile | 5 |
| theme | 4 |

## Per-Tool Review
| Tool | Bundle | Roles | Presentation | Job | Browser | MCP | Targets | Review disposition |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `draft_content` | blog | ADMIN | deferred | yes | no | no |  | Merge/prune after journal workflow consolidation |
| `publish_content` | blog | ADMIN | deferred | yes | no | no |  | Merge/prune after journal workflow consolidation |
| `list_conversation_media_assets` | media | AUTHENTICATED, APPRENTICE, STAFF, ADMIN | inline | no | no | no |  | Keep |
| `generate_chart` | media | ALL | browser | no | yes | no |  | Merge media artifact generation path |
| `generate_graph` | media | ALL | browser | no | yes | no |  | Merge media artifact generation path |
| `generate_audio` | media | ALL | deferred | yes | no | no | mcpStdio | Keep |
| `compose_media` | media | AUTHENTICATED, APPRENTICE, STAFF, ADMIN | hybrid | yes | yes | no | nativeProcess | Keep |
| `admin_web_search` | admin | ADMIN | deferred | yes | no | yes | mcpStdio, mcpContainer | Keep MCP export, maintain catalog adapter guardrails |
| `calculator` | calculator | ALL | inline | no | no | no |  | Keep |
| `set_theme` | theme | ALL | inline | no | no | no |  | Refactor into profile/preferences boundary |
| `inspect_theme` | theme | ALL | inline | no | no | no |  | Refactor into profile/preferences boundary |
| `adjust_ui` | theme | ALL | inline | no | no | no |  | Refactor into profile/preferences boundary |
| `set_preference` | theme | AUTHENTICATED, APPRENTICE, STAFF, ADMIN | inline | no | no | no |  | Refactor into profile/preferences boundary |
| `get_current_page` | navigation | ALL | inline | no | no | no |  | Keep, but slim prompt exposure |
| `inspect_runtime_context` | navigation | ALL | inline | no | no | no |  | Keep, but slim prompt exposure |
| `list_available_pages` | navigation | ALL | inline | no | no | no |  | Keep, but slim prompt exposure |
| `navigate_to_page` | navigation | ALL | inline | no | no | no |  | Keep, but slim prompt exposure |
| `admin_search` | navigation | ADMIN | inline | no | no | yes | mcpStdio | Keep MCP export, maintain catalog adapter guardrails |
| `search_corpus` | corpus | ALL | inline | no | no | no |  | Refactor around search/read-model boundary |
| `get_section` | corpus | ALL | inline | no | no | no |  | Refactor around search/read-model boundary |
| `get_corpus_summary` | corpus | ALL | inline | no | no | no |  | Refactor around search/read-model boundary |
| `get_checklist` | corpus | ALL | inline | no | no | no |  | Refactor around search/read-model boundary |
| `list_practitioners` | corpus | ALL | inline | no | no | no |  | Refactor around search/read-model boundary |
| `search_relationship_memory` | conversation | AUTHENTICATED, APPRENTICE, STAFF, ADMIN | inline | no | no | no |  | Keep |
| `search_my_conversations` | conversation | AUTHENTICATED, APPRENTICE, STAFF, ADMIN | inline | no | no | no |  | Keep |
| `get_my_profile` | profile | AUTHENTICATED, APPRENTICE, STAFF, ADMIN | inline | no | no | no |  | Keep |
| `update_my_profile` | profile | AUTHENTICATED, APPRENTICE, STAFF, ADMIN | inline | no | no | no |  | Keep |
| `get_my_referral_qr` | profile | AUTHENTICATED, APPRENTICE, STAFF, ADMIN | inline | no | no | no |  | Keep if product-critical; otherwise hide from default prompt |
| `get_my_job_status` | profile | AUTHENTICATED, APPRENTICE, STAFF, ADMIN | inline | no | no | no |  | Refactor into one job query surface |
| `list_my_jobs` | profile | AUTHENTICATED, APPRENTICE, STAFF, ADMIN | inline | no | no | no |  | Refactor into one job query surface |
| `get_deferred_job_status` | job | ADMIN | inline | no | no | no |  | Refactor into one job query surface |
| `list_deferred_jobs` | job | ADMIN | inline | no | no | no |  | Refactor into one job query surface |
| `produce_product` | admin | ADMIN | deferred | yes | no | no |  | Keep |
| `admin_prioritize_leads` | admin | ADMIN | inline | no | no | yes | mcpStdio | Keep MCP export, maintain catalog adapter guardrails |
| `admin_prioritize_offer` | admin | ADMIN | inline | no | no | yes | mcpStdio | Keep MCP export, maintain catalog adapter guardrails |
| `admin_triage_routing_risk` | admin | ADMIN | inline | no | no | yes | mcpStdio | Keep MCP export, maintain catalog adapter guardrails |
| `inspect_runtime_logs` | admin | ADMIN | inline | no | no | yes | mcpStdio | Keep MCP export, maintain catalog adapter guardrails |
| `get_my_affiliate_summary` | affiliate | AUTHENTICATED, APPRENTICE, STAFF, ADMIN | inline | no | no | no |  | Keep if product-critical; otherwise hide from default prompt |
| `list_my_referral_activity` | affiliate | AUTHENTICATED, APPRENTICE, STAFF, ADMIN | inline | no | no | no |  | Keep if product-critical; otherwise hide from default prompt |
| `get_admin_affiliate_summary` | affiliate | ADMIN | inline | no | no | no |  | Keep if product-critical; otherwise hide from default prompt |
| `list_admin_referral_exceptions` | affiliate | ADMIN | inline | no | no | no |  | Keep if product-critical; otherwise hide from default prompt |
| `list_journal_posts` | blog | ADMIN | inline | no | no | no |  | Refactor/merge into work-order workflow |
| `get_journal_post` | blog | ADMIN | inline | no | no | no |  | Refactor/merge into work-order workflow |
| `list_journal_revisions` | blog | ADMIN | inline | no | no | no |  | Refactor/merge into work-order workflow |
| `get_journal_workflow_summary` | blog | ADMIN | inline | no | no | no |  | Refactor/merge into work-order workflow |
| `update_journal_metadata` | blog | ADMIN | inline | no | no | no |  | Refactor/merge into work-order workflow |
| `update_journal_draft` | blog | ADMIN | inline | no | no | no |  | Refactor/merge into work-order workflow |
| `submit_journal_review` | blog | ADMIN | inline | no | no | no |  | Refactor/merge into work-order workflow |
| `approve_journal_post` | blog | ADMIN | inline | no | no | no |  | Refactor/merge into work-order workflow |
| `publish_journal_post` | blog | ADMIN | inline | no | no | no |  | Refactor/merge into work-order workflow |
| `restore_journal_revision` | blog | ADMIN | inline | no | no | no |  | Refactor/merge into work-order workflow |
| `select_journal_hero_image` | blog | ADMIN | inline | no | no | no |  | Refactor/merge into work-order workflow |
| `generate_blog_image` | blog | ADMIN | deferred | yes | no | no |  | Refactor/merge into work-order workflow |
| `compose_blog_article` | blog | ADMIN | deferred | yes | no | no |  | Refactor/merge into work-order workflow |
| `qa_blog_article` | blog | ADMIN | deferred | yes | no | no |  | Refactor/merge into work-order workflow |
| `resolve_blog_article_qa` | blog | ADMIN | deferred | yes | no | no |  | Refactor/merge into work-order workflow |
| `generate_blog_image_prompt` | blog | ADMIN | deferred | yes | no | no |  | Refactor/merge into work-order workflow |
| `produce_blog_article` | blog | ADMIN | deferred | yes | no | no |  | Refactor/merge into work-order workflow |
| `prepare_journal_post_for_publish` | blog | ADMIN | deferred | yes | no | no |  | Refactor/merge into work-order workflow |

