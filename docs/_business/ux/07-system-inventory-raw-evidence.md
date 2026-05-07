# System Inventory Raw Evidence

Evidence date: 2026-05-04.

This file preserves the inventory used by the UX canon. It is intentionally
more mechanical than the other UX docs so future work can refresh the product
story without re-discovering the same surfaces.

Scope: local codebase inspection only. No production telemetry was inspected.

Commands used during this pass:

- `find docs/_business/ux -maxdepth 1 -type f -name '*.md' -print | sort`
- `rg -n "roleVisibility|OperationVisibility|visibility" src/core src/lib src/components -g '*.ts' -g '*.tsx'`
- `rg -n "ContentAudience|canUserAccessAudience|allowedAudiences|audience" src/lib src/core src/adapters src/app/admin -g '*.ts' -g '*.tsx'`
- `sed -n '1,220p' src/lib/access/content-access.ts`
- `sed -n '1,180p' src/core/entities/corpus.ts`
- `sed -n '1,220p' src/lib/config/defaults.ts`
- `sed -n '460,490p' src/lib/db/tables.ts`
- `sed -n '1,120p' src/core/entities/blog-asset.ts`
- `sed -n '50,130p' src/core/entities/operation.ts`

## Public And Authenticated Routes

User-facing route groups currently present:

| Route group | Existing routes | UX disposition | Confidence |
| --- | --- | --- | --- |
| Public core | `/`, `/offers`, `/about`, `/feed` | Keep. Feed remains conditional. | High |
| Public legacy/donor | `/blog`, `/journal`, `/library`, `/books`, `/book/[chapter]` | Hide from public nav; reuse data behind Feed/Studio/Corpus. | Medium |
| Referral entry | `/r/[code]` | Keep. This is a core QR/trust entry point. | High |
| Authenticated operator | `/workspace`, `/studio`, `/business`, `/profile` | Keep, with `/business` language evolving toward People. | High |
| Donor diagnostics | `/jobs`, `/activity`, `/my/media`, `/referrals`, `/operations`, `/operations/media` | Fold into Today/Studio/People/Admin; keep as diagnostic links where needed. | High |
| Admin | `/admin/**` | Keep behind admin rail. | High |

Primary route contract file:

- `src/lib/shell/shell-navigation.ts`

## Role And Content Visibility Evidence

`src/core/entities/user.ts` defines these roles:

- `ANONYMOUS`
- `AUTHENTICATED`
- `APPRENTICE`
- `STAFF`
- `ADMIN`

`src/lib/access/content-access.ts` defines these content audiences:

- `public`
- `member`
- `account`
- `premium`
- `apprentice`
- `staff`
- `admin`

Audience access is enforced or projected in:

- `src/adapters/FileSystemCorpusRepository.ts`
- `src/core/platform/knowledge-access/KnowledgeAccessService.ts`
- `src/lib/chat/retrieval-envelope.ts`
- `src/adapters/SQLiteVectorStore.ts`
- `src/adapters/InMemoryVectorStore.ts`
- `src/app/admin/content-visibility/page.tsx`
- `src/app/admin/training/page.tsx`
- `src/core/use-cases/GetChapterInteractor.ts`
- `src/core/use-cases/LibrarySearchInteractor.ts`

Card/activity visibility is also present through:

- `src/lib/activity/activity-types.ts`
- `src/lib/activity/activity-taxonomy.ts`
- `src/lib/ordo-cards/ordo-card-types.ts`
- `src/app/api/notifications/feed/route.ts`

This is strong evidence that role-gated public/private content should reuse the
existing audience model where possible.

## Capability Families

Current capability families:

| Family | Current capability examples | UX meaning |
| --- | --- | --- |
| Admin | backup/restore, tool availability, offer priority, lead priority, routing risk, runtime logs, web search | Admin governance and diagnostics. |
| Affiliate | affiliate summary, referral activity, admin affiliate analytics | Trust Ledger and People metrics. |
| Blog/journal | draft, publish, QA, resolve QA, hero image, revisions | Content workflow donor. |
| Conversation | relationship memory, transcript recall | Relationship continuity. |
| Corpus | search corpus, sections, summaries, checklists, practitioners | Librarian/research support. |
| Job | job status and list jobs | Work state donor. |
| Media | list assets, chart, graph, audio, compose media | Studio production engine. |
| Navigation/theme/profile | pages, route navigation, theme, profile, referral QR | Shell and account utilities. |

Primary code anchors:

- `src/core/capability-catalog/families/*capabilities.ts`
- `src/core/capability-catalog/runtime-tool-binding.ts`
- `src/core/use-cases/tools/**`

## Durable Data Sources

Important existing tables:

| Table | UX use |
| --- | --- |
| `conversations` | Relationship and work origin. Includes referral, lane, detected need, recommended next step. |
| `messages`, `conversation_events` | Conversation timeline and provenance context. |
| `relationship_memory_records` | Goals, preferences, commitments, and relationship continuity. |
| `job_requests`, `job_events` | Background work state and execution history. |
| `media_workflows`, `media_workflow_steps`, `media_workflow_events` | Higher-level media runs and final artifacts. |
| `operations`, `operation_steps`, `operation_events`, `operation_actions`, `operation_artifacts` | Governed work, approvals, risk, and artifacts. |
| `materialization_records` | Source/output/evidence refs for produced or reused artifacts. |
| `user_files` | Stored media and files. |
| `blog_posts`, `blog_assets`, `blog_post_revisions`, `blog_post_artifacts` | Content production and publishing donor. |
| `referrals`, `referral_events` | QR/referral attribution and trust milestones. |
| `lead_records`, `deal_records`, `consultation_requests`, `training_path_records` | Business relationship and offer/service outcomes. |
| `activity_receipts` | User attention state. |
| `prompt_bindings`, `prompt_provenance_records` | Prompt/context evidence. |
| `factory_work_orders`, `factory_stage_runs`, `factory_outputs` | Heavy work order donor. |

`blog_posts.status` currently represents draft/published state.
`blog_assets.visibility` currently represents draft/published asset visibility.
These are content visibility donors, not a full private-content model.

## Offer Evidence

Current offer anchors:

- `src/app/offers/page.tsx`
- `config/services.json`
- `src/lib/config/defaults.ts`
- `ServiceOffering` fields: `id`, `name`, `description`, `lane`,
  `estimatedPrice`, `estimatedHours`

Evidence conclusion: public offer rendering and price fields exist, but durable
owner-created offers, private offers, recipient binding, and purchase state are
gaps.

## Existing UX Components Worth Reusing

| Component/read model | Reuse |
| --- | --- |
| `AppShell` | Top-level shell and route mode separation. |
| `SiteNav` | Public brand/nav frame. |
| `AuthenticatedWorkRail` | Current work rail donor; needs left-rail/mobile redesign. |
| `PublicRouteLinks` | Public nav and mobile dock donor. |
| `ChatSurface` | Conversation-first home and floating assistant. |
| `ChatPresenter` | Structured message projection. |
| `OperationActionConfirmationDialog` | Protected action confirmation. |
| `UserDashboard` | Today donor. |
| `StudioWorkspace` | Production object index donor. |
| `BusinessWorkspace` | People/trust donor. |
| `OrdoCard` | Object card foundation. |
| `ordo-card-projectors` | Bridges raw records into cards. |
| `ordo-details` | Detail/lens donor. |
| `AttentionInbox` | Attention badge/inbox donor. |
| `JobsRail` | Job status donor, but not a primary UX pattern. |

## Current Naming Mismatches

| Current label | UX issue | Preferred direction |
| --- | --- | --- |
| Business | Too abstract for relationship work. | People, with business metrics inside. |
| Jobs | Implementation word. | Work, Runs, or diagnostics only. |
| Activity | Too generic. | Today, attention, history, or timeline. |
| My Media | Fragmented from Studio. | Studio. |
| Referrals | Too narrow for trust/people surface. | People with QR/referral card. |
| Media Ops | Admin/diagnostic language. | Admin only. |
| Library | Confuses public site with corpus/asset storage. | Corpus internally, Feed publicly, Studio for assets. |

## Archeology Conclusion

The codebase does not need a new parallel UX system. It needs a disciplined
renaming and consolidation pass:

1. Keep the existing durable write models.
2. Build read models that project them into obvious user objects.
3. Use cards for summary and details/lenses for inspection.
4. Move diagnostics behind admin or provenance links.
5. Make the public site small and intentional.
6. Reuse `ContentAudience` and `roleVisibility` for role-gated content.
7. Add the missing durable public/private offer model instead of stretching
   static config further.
