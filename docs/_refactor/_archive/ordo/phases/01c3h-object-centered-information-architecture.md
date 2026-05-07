# Phase 01c3h: Object-Centered Information Architecture

Status: Implemented

Parent phase:

- `01c3-authenticated-workspace-tool-rail.md`

Depends on:

- `01c3g-activity-dashboard-regression-closeout.md`

## Goal

Ground and implement the signed-in information architecture around business
objects instead of implementation pages.

The solopreneur should not have to think in terms of jobs, notifications,
workflow tables, media tables, referral logs, and operations. They should see
the things they care about first, then drill into provenance, funnel context,
performance, related objects, and AI/HITL actions.

## Product Rule

Ordo is object-centered.

Every important object has:

- a card,
- a detail view or direct detail route plan,
- related objects,
- provenance, funnel, or performance context,
- AI/HITL actions,
- an activity timeline for auditability.

Jobs, operations, activity events, and runtime diagnostics are evidence. They
remain durable and inspectable, but they are not the CEO's primary navigation
model.

## Current Code Findings

### Route Model

`src/lib/shell/shell-navigation.ts` now exposes these regular signed-in primary
routes:

- `workspace-overview` -> `/workspace`, labeled `Dashboard`.
- `studio` -> `/studio`, labeled `Studio`.
- `business` -> `/business`, labeled `Business`.
- `profile` -> `/profile`, labeled `Profile`.
- `operations-media` -> `/operations/media`, staff/admin only.

`Jobs`, `Activity`, `My Media`, and `Referrals` now remain direct donor or
diagnostic routes rather than regular-user primary navigation.

Closeout evidence:

- `docs/_refactor/ordo/evidence/phase-01c3m-object-centered-ux-regression-closeout.md`

### Authenticated Rail

`src/components/AuthenticatedWorkRail.tsx` resolves routes through
`resolveAuthenticatedWorkRailRoutes(user)`, renders route labels directly, and
still mounts:

- `JobsRail`,
- `AttentionInbox`.

This is the right component to update once the route disposition is final. For
01c3h, record the target route grouping and avoid premature JSX churn.

### Dashboard Donor

`src/components/dashboard/UserDashboard.tsx` already has the correct rough
shape:

- Needs attention,
- Current work,
- Recent outputs,
- Business loop,
- System health.

However, it renders `ActivityCard` items and links directly to `/activity`,
`/jobs`, `/my/media`, and `/referrals`. That means the dashboard is currently
activity-block based, not object-card based.

`src/lib/dashboard/load-user-dashboard.ts` loads dashboard blocks from
`ActivityReadModel` plus `ReferralAnalyticsService.getOverview()`. It filters
recent outputs from completed `job`, `media_workflow`, and `operation` activity.
That is a useful donor, but the final dashboard should load `OrdoCard` buckets:

- `needs_attention`,
- `in_motion`,
- `produced`,
- `business_loop`.

### Activity Donor

`src/lib/activity/activity-taxonomy.ts` currently defines these source kinds:

- `job`,
- `job_event`,
- `media_workflow`,
- `operation`,
- `operation_event`,
- `referral_milestone`,
- `browser_push_delivery`,
- `runtime_audit_log`,
- `provider_log`,
- `route_metric`,
- `mcp_process_log`,
- `admin_signal`.

Only jobs, media workflows, referral milestones, and operations are currently
projected into user activity by `src/lib/activity/activity-read-model.ts`.

This is a good event/evidence layer. It is not yet a complete business-object
layer because it has no first-class object source kinds for:

- `media_asset`,
- `content_item`,
- `person`,
- `offer`,
- `tracked_link`,
- `campaign`,
- `conversation`.

Do not overload `ActivityItem` to solve that. Keep activity as the ledger and
add object-card projection above it in `01c3i`.

### Activity Projectors

`src/lib/activity/activity-projectors.ts` currently maps:

- jobs to `/jobs?jobId=...`,
- media workflows to `/my/media?assetId=...` when a final artifact exists, or
  `/jobs?workflowId=...` while in progress,
- referral milestones to `/referrals`,
- operations to `/operations/:operationId`.

These links expose current implementation surfaces. The object-centered route
plan should eventually map:

- produced assets/content to Studio detail,
- people/referrals/leads to Business detail,
- operations/jobs to provenance or diagnostic detail.

### Asset Donor

`src/core/platform/asset-catalog/AssetCatalogReader.ts` merges:

- user files,
- materialization records,
- blog assets.

`src/core/entities/asset-catalog.ts` already has the right metadata for asset
cards:

- `assetId`,
- `kind`,
- `status`,
- `label`,
- `mimeType`,
- `conversationId`,
- `producedByJobId`,
- `materializationKey`,
- dimensions/duration.

This should be the first donor for `media_asset` and later `content_item`
cards. It is still read-only and does not include public feed metrics.

### Business/Person Donor

`src/core/platform/business-workflow/BusinessWorkflowContextReader.ts` and
`BusinessWorkflowContextProjector.ts` already project conversation-centered
business context:

- lead,
- consultation,
- deal,
- training path,
- referral,
- referral events,
- notification events,
- recommended action.

This is the best donor for `person`, `lead`, `conversation`, and funnel-detail
cards. It is conversation-scoped today, so a later Business read model may need
an index by user/account rather than requiring a known conversation id.

### Referral/QR Donor

`src/lib/referrals/referral-analytics.ts` already projects:

- introductions,
- started chats,
- registrations,
- qualified opportunities,
- credit status,
- timeseries,
- pipeline,
- outcomes.

`src/components/referrals/ReferralsWorkspace.tsx` already exposes QR/share
tools, referral copy, link copy, QR download, and funnel metrics.

`src/app/r/[code]/page.tsx`, `src/app/api/referral/[code]/route.ts`, and
`src/app/api/qr/[code]/route.ts` currently support referral-code QR only.
There is not yet a generic tracked-link/QR model for any URL or object.

### Durable Data Sources

`src/lib/db/tables.ts` already contains durable donors for this phase:

- `user_files`,
- `referrals`,
- `referral_events`,
- `blog_posts`,
- `blog_assets`,
- `blog_post_artifacts`,
- `blog_post_revisions`,
- `job_requests`,
- `job_events`,
- `materialization_records`,
- `activity_receipts`,
- `operations`,
- `operation_steps`,
- `operation_events`,
- `operation_actions`,
- `operation_artifacts`.

Known missing durable primitives:

- generic `tracked_links`,
- generic tracked-link events,
- first-class `campaigns`,
- first-class feed item metrics,
- first-class offer performance/conversion events,
- object-card read-model storage.

Do not add all of these in 01c3h. This phase defines the IA and source map.

## Target IA

### Public

- Home/chat.
- Offers.
- About.
- Feed only when public content exists.

Public visitors should not see the internal corpus/library, private asset
catalog, private workflows, jobs, operations, prompts, or activity receipts.

### Authenticated Primary Surfaces

- Dashboard: today's decision queue and business pulse.
- Studio: produced work, work in progress, content, media, workflow runs, and
  review states.
- Business: people, referrals, QR/tracked links, offers, campaigns, and funnel
  outcomes.
- Profile/Settings: account, identity, referral/profile settings, and business
  configuration that belongs to the signed-in user.
- Admin: role-gated global, factory, system, and diagnostic control.

### Supporting/Diagnostic Surfaces

These remain directly addressable during migration:

- `/activity` for audit ledger and receipt diagnostics.
- `/jobs` for work/job diagnostics and transitional work index.
- `/my/media` for media-library diagnostics and direct asset inspection.
- `/referrals` for current QR/referral workspace until Business absorbs it.
- `/operations/**` for operation detail/provenance.
- `/admin/**` for staff/admin global control.

The route model should mark these as secondary or diagnostic once Studio and
Business are implemented.

## Route Disposition

| Current route | Current product role | Target role |
| --- | --- | --- |
| `/workspace` | Dashboard | Keep as Dashboard and convert blocks to object cards later. |
| `/jobs` | Work/job index | Demote to diagnostic/secondary after Studio exists. |
| `/activity` | Activity ledger | Demote to audit/secondary; link from cards and details. |
| `/my/media` | Media library | Donor for Studio; keep direct route until Studio parity passes. |
| `/referrals` | Referral + QR workspace | Donor for Business; keep direct route until Business parity passes. |
| `/profile` | User/account context | Keep as Profile/Settings. |
| `/operations/**` | Operation detail/admin surface | Keep as provenance/diagnostic detail; role-gated as today. |
| `/operations/media` | Staff/admin media ops | Keep staff/admin; do not put in regular user Studio by default. |
| `/offers` | Public offers | Keep public; internal offer management belongs in Business later. |
| `/feed` | Public output stream | Keep public and content-gated in nav. |

## Object Taxonomy And Source Ownership

| Object kind | User lens | Existing donors | Known gap |
| --- | --- | --- | --- |
| `media_asset` | Provenance/performance | `AssetCatalogReader`, `user_files`, `blog_assets`, `materialization_records`, media workflows | Needs Studio card projector and detail route. |
| `content_item` | Provenance/distribution/performance | `blog_posts`, `blog_post_artifacts`, `blog_assets`, future feed phase | Feed metrics and content-object route not finished. |
| `workflow_run` | Progress/provenance | `media_workflows`, operations, jobs, factory donors | Needs user-facing workflow card separate from raw job card. |
| `operation` | Confirmation/provenance | `operations`, `operation_steps`, `operation_actions`, `operation_artifacts` | Already durable; needs object-card projection. |
| `person` | Funnel/conversation | `BusinessWorkflowContextReader`, leads, deals, consultations, referrals, `people-read-model` | Derived person index exists after 01c3p; governed merge/split actions remain future work. |
| `offer` | Funnel/performance | durable `offers`, `offer_events`, `config/services.json` fallback, `/offers` | Durable offer object exists after 01c3o; private grants/performance attribution remain future work. |
| `tracked_link` | QR/performance | referral QR/link routes and referral events | Generic tracked links do not exist yet. |
| `campaign` | KPI loop | referral campaign presets, attribution donors, `trust-distribution` refs | Durable campaign/pillar model pending later phase. |
| `conversation` | Source context/history | conversations, business workflow context, chat search/restore donors | Needs object relationship projection, not new chat route. |

## Detail Lens Defaults

- Produced things (`media_asset`, `content_item`, `workflow_run`) default to
  `Provenance`.
- People and opportunities (`person`, lead/referral/deal projections) default
  to `Funnel`.
- Offers, tracked links, campaigns, and published feed items default to
  `Performance`.
- Operations default to `Actions/Provenance`.
- Conversations default to `History/Related`.

All detail views should expose Activity as an audit lens, but Activity should
not be the default lens unless the object is itself diagnostic.

## UX Direction

Use progressive disclosure:

1. Dashboard shows compact decision cards.
2. Studio and Business show searchable/filterable object-card indexes.
3. A card opens the object detail.
4. Detail reveals the right lens first.
5. Jobs, operations, activity, and logs are available from provenance/audit
   links.

Desktop can use icon + label navigation. Mobile should use a compact Work sheet
or bottom pattern with fewer primary destinations. Avoid reintroducing a hidden
left menu as the only way to find work.

## Implementation Boundaries

This phase may update docs and route/navigation contracts. It should not:

- add large new schemas,
- replace all pages,
- rewrite media/referral/job internals,
- collapse donor routes before replacement tests exist.

The concrete implementation should begin in `01c3i` with an `OrdoCard`
read-model contract and projectors.

## Required Work

- [x] Update the IA spec and route disposition to the current code state.
- [x] Mark Dashboard, Studio, Business, Profile/Settings, and Admin as the target
  signed-in primary surfaces.
- [x] Mark Jobs, Activity, My Media, Referrals, and Operations as donor,
  secondary, or diagnostic surfaces.
- [x] Define object taxonomy and source ownership.
- [x] Define default detail lenses.
- [x] Record known schema/read-model gaps without implementing them yet.
- [x] Update dependent phase docs if their dependency or route assumptions conflict
  with this IA.

## Implemented Artifacts

- `src/lib/shell/shell-navigation.ts`
  - Adds `OrdoObjectKind`, `OrdoDetailLens`, `ObjectCenteredSurface`, and
    `ShellRouteDisposition` contracts.
  - Adds `ORDO_OBJECT_KIND_CONTRACTS` for `media_asset`, `content_item`,
    `workflow_run`, `operation`, `person`, `offer`, `tracked_link`,
    `campaign`, and `conversation`.
  - Adds `targetSurface`, `routeDisposition`, `objectKinds`, and
    `diagnosticFor` metadata to shell routes.
  - Marks `/workspace` as the current Dashboard primary surface.
  - Marks `/jobs` and `/my/media` as Studio donors.
  - Marks `/referrals` as a Business donor.
  - Marks `/activity` and job/operation diagnostics as diagnostic evidence.
  - Records `/studio` and `/business` as planned surface gaps through
    `CURRENT_OBJECT_CENTERED_SURFACE_GAPS` without adding routes prematurely.
- `src/lib/shell/shell-navigation.test.ts`
  - Adds object-centered IA contract coverage.
  - Verifies every non-legacy route has a surface/disposition.
  - Verifies current donor routes map to the target IA.
  - Verifies all object kinds have grounded contracts and default lenses.
  - Verifies `/studio` and `/business` are planned gaps, not claimed live
    routes.
  - Verifies every donor route named by a planned surface gap still resolves to
    a current shell route.

## Implementation Decisions

- This phase intentionally does not add `/studio` or `/business` routes. Those
  belong to `01c3k` after `OrdoCard` and object detail contracts exist.
- `ActivityItem` remains the event/evidence model. The object-card read model
  starts in `01c3i`; this phase only makes the IA contract explicit.
- `operations-media` remains staff/admin diagnostic scope and is not exposed as
  regular user Studio.
- Generic tracked links, campaigns, offer performance events, and feed metrics
  are recorded as gaps, not implemented schemas.

## Positive Tests

- [x] The IA maps every current signed-in route to a target role.
- [x] Every target object kind has at least one current donor or an explicit known
  gap.
- [x] Dashboard/Studio/Business/Profile/Admin terms have non-overlapping meanings.
- [x] Direct diagnostic routes remain preserved.
- [x] Feed remains public-content gated.

## Negative Tests

- [x] Jobs are not described as the primary user object.
- [x] Notifications are not treated as a standalone product area.
- [x] Runtime logs are not promoted to regular user navigation.
- [x] Media is not treated as a disconnected file manager.
- [x] Generic tracked-link/campaign tables are not claimed to exist.
- [x] Staff/admin media ops are not exposed as regular user Studio by default.

## Edge Tests

- [x] New user with no objects.
- [x] User with only completed jobs.
- [x] User with produced media and no public feed.
- [x] User with referral events but no registered lead.
- [x] User with an operation requiring confirmation.
- [x] User with private media and public offer/feed routes.
- [x] Admin/staff users with global operations.

These edge cases are covered at the IA contract level in this phase. Concrete
card/detail rendering edge coverage belongs to `01c3i` through `01c3m`.

## Validation

- `npm test -- --run src/lib/shell/shell-navigation.test.ts tests/shell-navigation-model.test.ts`
  - 2 files, 22 tests passed.
- `npm test -- --run src/components/AuthenticatedWorkRail.test.tsx src/components/AppShell.test.tsx src/components/ShellWorkspaceMenu.test.tsx src/components/SiteNav.test.tsx tests/shell-acceptance.test.tsx tests/shell-brand.test.tsx tests/shell-command-parity.test.ts tests/shell-command-parity.test.tsx tests/site-shell-composition.test.tsx tests/shell-visual-system.test.tsx`
  - 10 files, 74 tests passed.
- `npx eslint src/lib/shell/shell-navigation.ts src/lib/shell/shell-navigation.test.ts tests/shell-navigation-model.test.ts`
  - Passed.
- `npm run typecheck`
  - Passed.

## Exit Criteria

- [x] The object-centered IA is documented and grounded in current code.
- [x] Route disposition is explicit enough for shell-navigation changes in later
  phases.
- [x] Future phases can implement cards and detail lenses without reopening the
  navigation philosophy.
