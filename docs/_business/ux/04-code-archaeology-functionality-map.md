# Code Archaeology Functionality Map

This map records the useful functionality already present in the codebase and
how it can support the Ordo product story.

The important discovery: Ordo already has many of the right primitives. The
next UX work should compose and rename them before inventing more surfaces.

Disposition meanings:

- **Keep**: use directly.
- **Reframe**: keep the code, change the product language or placement.
- **Hide**: remove from primary navigation, keep available through details or
  admin.
- **Prune candidate**: investigate removal after a donor replacement exists.
- **Gap**: needed for product shape, not yet sufficiently implemented.

Confidence:

- **High**: code path and tests were found.
- **Medium**: code path exists but product fit needs validation.
- **Low**: inferred from naming or partial evidence.

## Public Shell And Site

| Existing code | What it does | Product value | Disposition | Confidence |
| --- | --- | --- | --- | --- |
| `src/app/page.tsx` | Renders embedded chat as the homepage. | Conversation-first public entry. | Keep | High |
| `src/app/offers/page.tsx` | Renders configured service offerings from `config/services.json`. | Public selling surface exists. | Keep and expand | High |
| `src/app/about/page.tsx` | Explains Ordo and open-source positioning. | Public context. | Reframe around solo operator and humane mission | High |
| `src/app/feed/page.tsx` | Placeholder public feed. | Future public content outlet. | Keep conditional | Medium |
| `src/lib/shell/shell-navigation.ts` | Defines route visibility, dispositions, object surfaces, feed gate. | Route contract already exists. | Keep as source of truth | High |
| `src/components/public/PublicRouteLinks.tsx` | Resolves public nav and mobile dock. | Conditional nav foundation. | Keep public nav minimal | High |

## Conversation And Action Surface

| Existing code | What it does | Product value | Disposition | Confidence |
| --- | --- | --- | --- | --- |
| `src/frameworks/ui/ChatSurface.tsx` | Embedded/floating chat shell. | Conversation is already central. | Keep | High |
| `src/frameworks/ui/useChatSurfaceState.tsx` | Routes action links, tool sends, job actions, operation confirmations. | Chat can drive real UI actions. | Keep and harden | High |
| `src/adapters/ChatPresenter.ts` | Projects rich messages, suggestions, actions, job/workflow status. | Conversation can show structured results. | Keep and expand cards | High |
| `src/frameworks/ui/RichContentRenderer.test.tsx` | Tests operation card and action link rendering. | Safety coverage for chat actions. | Expand | High |

## Cards, Objects, And Details

| Existing code | What it does | Product value | Disposition | Confidence |
| --- | --- | --- | --- | --- |
| `src/core/entities/ordo-object.ts` | Defines object kinds, detail lenses, and surfaces. | Strong foundation for object-centered UX. | Keep | High |
| `src/components/ordo-cards/OrdoCard.tsx` | Generic object card with metrics, preview, actions. | Reusable card system. | Keep and refine | High |
| `src/lib/ordo-cards/ordo-card-projectors.ts` | Projects jobs, workflows, assets, referrals, activity, operations into cards. | Bridges raw systems into user objects. | Keep and expand | High |
| `src/lib/ordo-details/**` | Detail route helpers and lens loading. | Detail/provenance foundation. | Keep | Medium |

## Visibility And Access Control

| Existing code | What it does | Product value | Disposition | Confidence |
| --- | --- | --- | --- | --- |
| `src/lib/access/content-access.ts` | Defines `ContentAudience` and role/tier access rules. | Core public/private/role-gated content contract. | Keep as authority | High |
| `src/adapters/FileSystemCorpusRepository.ts` | Loads manifest/section audience labels and validates them. | Corpus can carry role-gated content. | Keep | High |
| `src/core/platform/knowledge-access/KnowledgeAccessService.ts` | Denies inaccessible sections and filters accessible sections. | Search/help can respect roles. | Keep | High |
| `src/lib/chat/retrieval-envelope.ts` | Builds allowed audience filters for chat retrieval. | Chat can ground answers by viewer access. | Keep | High |
| `src/adapters/SQLiteVectorStore.ts` and `src/adapters/InMemoryVectorStore.ts` | Filter vector records by allowed audiences. | Search layer supports visibility. | Keep | High |
| `src/app/admin/content-visibility/page.tsx` | Audits corpus audience labels against role reachability. | Admin visibility proof. | Keep admin only | High |
| `roleVisibility` on cards/activity | Limits projected object visibility by role. | Activity/cards can stay role-aware. | Keep and standardize | High |

Current content audiences: `public`, `member`, `account`, `premium`,
`apprentice`, `staff`, and `admin`.

## Today, Activity, And Attention

| Existing code/table | What it does | Product value | Disposition | Confidence |
| --- | --- | --- | --- | --- |
| `src/components/dashboard/UserDashboard.tsx` | Shows attention, current work, recent outputs, business loop, health. | Today surface already exists. | Reframe as CEO daily brief plus evidence index | High |
| `src/lib/dashboard/load-user-dashboard.ts` | Loads activity buckets and referral overview. | Good read model for next actions. | Keep and simplify | High |
| `src/lib/activity/activity-taxonomy.ts` | Separates projectable user activity from diagnostics. | Strong boundary between user and admin state. | Keep | High |
| `src/lib/activity/activity-types.ts` | Activity item and receipt contract. | Read/ack/dismiss/pin foundation. | Keep architecture, hide wording | High |
| `activity_receipts` | Stores read/ack/dismiss/pin. | Enables attention inbox. | Keep | High |

## Studio, Media, And Production

| Existing code/table | What it does | Product value | Disposition | Confidence |
| --- | --- | --- | --- | --- |
| `src/components/studio/StudioWorkspace.tsx` | Lists production objects with filters/search/pagination. | Studio surface exists. | Keep and simplify | High |
| `src/lib/studio/load-studio-workspace.ts` | Projects jobs, media workflows, and files into Studio cards. | Jobs and media can converge. | Keep | High |
| `src/lib/media/workflows/media-workflow-read-model.ts` | Canonical media workflow state with steps, final artifact, linked jobs, operation actions. | Strong workflow/provenance primitive. | Keep as Run/Work details | High |
| `src/core/capability-catalog/families/media-capabilities.ts` | Generate chart, graph, audio; compose media with governed asset IDs. | Core demo loop for research-to-media. | Keep as flagship capability | High |
| `src/lib/media/**` | FFmpeg/browser/server composition, preflight, source rehydration, captions, metadata. | Deep media production foundation. | Hide complexity | High |
| `user_files` | Stores user media/files with conversation IDs and hashes. | Asset library primitive. | Keep behind Studio | High |
| `media_workflows`, `media_workflow_steps`, `media_workflow_events` | Durable media workflow state. | Provenance and progress. | Keep | High |

## People, Trust, And Business Motion

| Existing code/table | What it does | Product value | Disposition | Confidence |
| --- | --- | --- | --- | --- |
| `src/components/business/BusinessWorkspace.tsx` | Shows referral QR and business loop. | Current donor surface for People. | Reframe as People/Results | High |
| `src/lib/business/load-business-workspace.ts` | Loads referral workspace and recent activity into cards. | First People read model. | Keep and expand | High |
| `src/lib/referrals/referral-analytics.ts` | Calculates introductions, chats, registered, qualified, credit status. | QR/referral KPI foundation. | Keep | High |
| `src/lib/referrals/referral-milestones.ts` | Converts referral events into human milestones. | Narrative event layer. | Reuse in Relationship Trail | High |
| `referrals`, `referral_events` | Store referral/QR attribution and milestones. | Core analog-to-digital trust loop. | Keep and generalize | High |
| `lead_records`, `deal_records`, `consultation_requests`, `training_path_records` | Store business relationship and sales/service outcomes. | Funnel foundation exists. | Project into People cards | Medium |
| `relationship_memory_records` | Stores goals/preferences/commitments with evidence. | Relationship continuity. | Use in person details | High |
| `src/core/platform/business-workflow/**` | Projects conversation, lead, deal, referral, job notifications into workflow context. | Business context layer exists. | Reuse | Medium |
| `src/core/platform/operator-transition/**` | Projects user mode/status/recommended action. | Onboarding and first motion foundation. | Use for first offer/share | Medium |

## Offers

| Existing code/table | What it does | Product value | Disposition | Confidence |
| --- | --- | --- | --- | --- |
| `config/services.json` | Static offering configuration. | Public offer page can render offers now. | Keep as seed/import format | High |
| `src/lib/config/defaults.ts` | Defines `ServiceOffering` with `estimatedPrice` and `estimatedHours`. | Price support exists structurally. | Keep as donor | High |
| `src/app/offers/page.tsx` | Public offer cards. | Visitor selling surface exists. | Improve copy, CTA, and prices | High |
| `admin_prioritize_offer` capability | Helps admin choose which offer/message to push. | Strategic offer signal exists. | Keep admin/staff | Medium |

Gap: no durable offer table, normal owner-facing offer creation flow, private
offer visibility, customer-specific offer state, or purchase simulation exists
yet.

## Content, Feed, And Editorial QA

| Existing code/table | What it does | Product value | Disposition | Confidence |
| --- | --- | --- | --- | --- |
| `blog_posts` | Stores drafts/published posts with author/publisher fields. | Content production donor. | Reframe as content/feed pipeline | High |
| `blog_assets` | Stores hero assets with `draft`/`published` visibility. | Content asset visibility donor. | Keep and generalize | High |
| `blog_post_revisions`, `blog_post_artifacts` | Store revisions and artifacts. | QA/provenance donor. | Keep | High |
| `src/core/capability-catalog/families/blog-capabilities.ts` | Draft, QA, resolve QA, hero image prompt/image, publish journal posts. | QA loop exists for written content. | Generalize | High |
| `src/app/feed/page.tsx` | Public feed placeholder. | Public publishing destination. | Connect to real published content | Medium |
| `src/app/admin/journal/**` | Admin editorial tooling. | Donor for content management. | Hide from owner UX | Medium |

Gap: published feed is public-only today. Private content should use
`ContentAudience` or person/account-specific access before appearing in
authenticated surfaces.

## Knowledge, Research, And Recall

| Existing code | What it does | Product value | Disposition | Confidence |
| --- | --- | --- | --- | --- |
| `src/core/capability-catalog/families/corpus-capabilities.ts` | Corpus search/sections/summary/checklists/practitioners. | Internal knowledge support. | Keep as Librarian behavior | High |
| `src/core/capability-catalog/families/conversation-capabilities.ts` | Relationship memory and transcript recall. | Continuity and recall. | Use in chat and details | High |
| `src/core/use-cases/tools/admin-web-search.tool.ts` | Web search for admin. | Research primitive exists. | Owner-safe research workflow needed | Medium |
| `src/core/platform/knowledge-access/**` | Role-aware knowledge search. | Content access control foundation. | Keep | High |

## Operations, Governance, And Safety

| Existing code/table | What it does | Product value | Disposition | Confidence |
| --- | --- | --- | --- | --- |
| `operations`, `operation_steps`, `operation_events`, `operation_actions`, `operation_artifacts` | Durable governed work. | Critical reliability foundation. | Keep | High |
| `src/core/use-cases/operations/OperationIntentRouter.ts` | Validates and routes operation intent. | Protects complex requests. | Keep | High |
| `src/core/use-cases/operations/OperationPromptGrounding.ts` | Grounds active operations into prompts. | Prevents agent hallucination and lost state. | Keep | High |
| `src/lib/operations/operation-action-dispatch-root.ts` | Dispatches protected actions. | Safe buttons in chat/details. | Keep | High |
| `src/lib/appliance/**`, `crates/**` | Backup/restore/appliance proof. | Trust and self-hosting confidence. | Admin only | High |

## Current Product Gaps

These are the gaps to close before the UX feels coherent:

1. Durable offers: owner can create/edit/price offers in chat and UI.
2. Private offers: selected people/accounts can receive tailored offers.
3. People index: relationship objects need a real user/account read model, not
   only referral cards.
4. Relationship Trail: conversations, referrals, leads, deals, and follow-ups
   need one coherent timeline.
5. Generic tracked links: phase 01c3q added public-offer and owned-public-URL
   tracking; content/media/campaign-specific validators and rollups remain.
6. Content performance: feed items need download/view/listen/click metrics.
7. Public feed data: feed page should render real published content and stay
   hidden when empty.
8. Private content: role-gated and person-specific content needs owner-facing
   creation, sharing, and retrieval.
9. Owner-friendly content workflow: blog/journal admin tools need
   Studio-facing content cards.
10. Clear admin separation: jobs, notifications, diagnostics, and system health
    need to move out of the regular top-right clutter.
11. Better onboarding: operator transition/profile data should drive the first
    offer, first QR share, and first content loop.

## Prune Or Hide Candidates

Do not delete immediately. First classify each as donor, diagnostic, or legacy.

| Surface | Direction |
| --- | --- |
| `/jobs` | Hide from main nav; keep as diagnostic linked from provenance. |
| `/activity` | Hide from main nav; fold into Today/Studio/People. |
| `/my/media` | Fold into Studio; remove from primary account menu. |
| `/referrals` | Fold into People, unless kept as diagnostic. |
| `/blog`, `/journal`, `/library` | Remove from public nav. Use Feed/Studio/Corpus instead. |
| top-right jobs/bell icons | Collapse into Today and left rail badges. |
| right nav drawer | Replace with left rail/admin rail and mobile hamburger controls. |
