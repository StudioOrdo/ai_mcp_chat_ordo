# Phase 01c3k: Studio And Business Surface Consolidation

Status: Implemented

Parent phase:

- `01c3-authenticated-workspace-tool-rail.md`

Depends on:

- `01c3h-object-centered-information-architecture.md`
- `01c3i-ordo-card-system-and-progressive-disclosure.md`
- `01c3j-object-detail-lenses-provenance-funnel-and-performance.md`

Followed by:

- `01c3l-hitl-dashboard-and-ceo-command-loop.md`
- `01c3m-object-centered-ux-regression-closeout.md`

## Goal

Collapse the signed-in product into a small number of durable owner surfaces:

- Dashboard,
- Studio,
- Business,
- Profile/Settings,
- Admin for permitted users.

This phase should make the app feel like a coherent operating surface instead
of a collection of task-specific pages. Jobs, media, referrals, notifications,
and activity remain available, but they stop being the primary way a
solopreneur has to understand Ordo.

## Implementation Note

Implemented by the 01c3m closeout work:

- `/studio` root page, loader, component, and tests now exist.
- `/business` root page, loader, component, and tests now exist.
- The regular-user shell route set is Dashboard, Studio, Business, Profile.
- Donor routes remain directly accessible for diagnostics and migration.
- Evidence:
  `docs/_refactor/ordo/evidence/phase-01c3m-object-centered-ux-regression-closeout.md`.

## Product Rule

The user does not manage implementation artifacts. The user manages the
business.

- Use Dashboard for decisions, interruptions, and the next thing the owner
  should care about.
- Use Studio for work Ordo is producing or has produced.
- Use Business for people, offers, QR/referral links, conversations, and funnel
  outcomes.
- Use Activity for the audit ledger and diagnostics.
- Keep admin/global tooling behind admin or staff access.

Do not add a top-level page every time the system adds a new object kind. Route
new object kinds into Studio, Business, Dashboard, Admin, or Activity according
to the object-centered contract.

## Route Decision

Implement these canonical signed-in owner routes:

- `/workspace`
  - Keep as Dashboard.
  - This is the mobile-first owner decision queue.
- `/studio`
  - Add as the canonical produced-work and in-motion work index.
  - It owns media assets, content items, media workflows, workflow runs, and
    user-visible job-backed work.
- `/business`
  - Add as the canonical business-loop index.
  - It owns referral links, referral activity, people-like conversation objects,
    offers visibility, and funnel/account outcomes that exist in current code.
- `/profile`
  - Keep as account/profile/settings.
- `/activity`
  - Keep as a direct diagnostic/audit ledger route, but demote from the primary
    signed-in rail.

Keep these donor routes directly accessible during this phase:

- `/jobs`
- `/my/media`
- `/referrals`
- `/operations/media`
- `/operations/[operationId]`

Do not remove donor pages in this phase. The implementation should consolidate
the primary navigation first, then later phases can decide whether donor routes
become redirects, admin diagnostics, or are deleted.

## Current Code Grounding

### Shell And Navigation

- `src/lib/shell/shell-navigation.ts`
  - Now promotes the regular-user owner routes:
    - `workspace-overview` -> `/workspace`
    - `studio` -> `/studio`
    - `business` -> `/business`
    - `operations-media` -> `/operations/media` for staff/admin
    - `profile` -> `/profile`
  - `jobs`, `activity`, `my-media`, and `referrals` remain direct donor or
    diagnostic routes, but they are no longer regular-user primary navigation.
  - `CURRENT_OBJECT_CENTERED_SURFACE_GAPS` is empty.
- `src/components/AuthenticatedWorkRail.tsx`
  - Uses `resolveAuthenticatedWorkRailRoutes(user)` and renders the signed-in
    route set in desktop and mobile work controls.
  - Also hosts `JobsRail` and `AttentionInbox` utilities. Those utilities
    should remain work utilities, not primary route labels.
- Shell tests now assert the owner route set and reject donor routes as
  regular-user primary navigation.

### Dashboard Donor

- `src/app/workspace/page.tsx`
  - Loads the signed-in owner dashboard.
- `src/lib/dashboard/load-user-dashboard.ts`
  - Builds attention, current work, recent outputs, business-loop, and system
    health blocks from activity and referral donors.
- `src/components/dashboard/UserDashboard.tsx`
  - Dashboard block links point toward `/studio` and `/business`.
  - Dashboard activity items are projected into shared `OrdoCard` objects.
  - Do not fully redesign the HITL dashboard here. `01c3l` owns the deeper CEO
    command loop and review queue.

### Studio Donors

- `src/app/jobs/page.tsx`
- `src/lib/jobs/load-user-jobs-workspace.ts`
- `src/components/jobs/JobsWorkspace.tsx`
  - This is the strongest donor for `/studio`.
  - It already has search, status filters, buckets, selected-item state,
    pagination, job history, linked media workflows, and single-column work
    index behavior from phase `01c3e`.
- `src/lib/media/workflows/media-workflow-read-model.ts`
  - Provides `listUserWorkflows` and
    `filterPrimaryJobSnapshotsForWorkflows`.
  - Reuse the existing helper to prevent Studio from showing the same work
    twice as both a media workflow and a raw job card.
- `src/app/my/media/page.tsx`
- `src/lib/media/user-media.ts`
- `src/components/media/UserMediaWorkspace.tsx`
  - This is the current user media donor.
  - It lists `UserFile` records with filters, quota, preview URLs, and delete
    eligibility.
  - It is not yet using the asset catalog as the canonical media index.
- `src/core/platform/asset-catalog/AssetCatalogReader.ts`
  - Supports `findByAssetId`, `listConversationAssets`, and
    `listReusableMediaAssets`.
  - `listReusableMediaAssets` is conversation-scoped. There is no user-wide
    `listUserAssets` reader yet.
  - The implementation should add a user-wide asset catalog read path if
    feasible. If that is too large for the first pass, `/studio` may reuse
    `loadUserMediaWorkspace` as a transitional donor, but the spec should mark
    that as a temporary bridge.
  - If `listUserAssets` is added, ground it in the existing owner-scoped
    repositories already used by the reader, especially `UserFileDataMapper`
    and `BlogAssetRepository.listByUser`.
- `src/lib/ordo-cards/ordo-card-projectors.ts`
  - Already has projectors for jobs, media workflows, and asset catalog
    entries:
    - `projectJobSnapshotToOrdoCard`
    - `projectMediaWorkflowToOrdoCard`
    - `projectAssetCatalogEntryToOrdoCard`
  - Media workflow cards already route to `/studio/workflows/[workflowId]`.
  - Asset cards already route to `/studio/media/[assetId]`.
  - Raw job cards still route to `/jobs?jobId=...`, which is acceptable for
    raw technical job objects until every job can be mapped to a workflow or
    asset.

### Business Donors

- `src/app/referrals/page.tsx`
- `src/lib/referrals/load-referrals-workspace.ts`
- `src/components/referrals/ReferralsWorkspace.tsx`
  - This is the current business-loop donor.
  - It loads profile referral state, QR URL, overview, timeseries, pipeline,
    and recent referral activity.
- `src/lib/ordo-cards/ordo-card-projectors.ts`
  - Already has business card projectors:
    - `projectReferralLinkToOrdoCard`
    - `projectReferralActivityToOrdoCard`
    - `projectBusinessWorkflowContextToOrdoCard`
  - Referral cards now route to `/business/referrals/[referralCode]`.
  - Business workflow context cards now route to
    `/business/conversations/[conversationId]`.
- `src/core/platform/business-workflow/BusinessWorkflowContextReader.ts`
  - Current business context is conversation-scoped.
  - There is no broad people index or generic funnel object index yet.
- `src/app/offers/page.tsx`
  - Current offers are public-site content, not an internal offer performance
    model.
  - `/business` may link to public offers and show offer visibility state, but
    it must not invent offer conversion metrics that do not exist yet.

### Object Detail Layer

Phase `01c3j` already implemented canonical detail surfaces:

- `/studio/media/[assetId]`
- `/studio/workflows/[workflowId]`
- `/business/referrals/[referralCode]`
- `/business/conversations/[conversationId]`
- `/operations/[operationId]`

This phase should add the missing index surfaces that lead into those detail
surfaces.

## Target Information Architecture

### Primary Signed-In Rail

The primary signed-in work rail should expose:

- Dashboard -> `/workspace`
- Studio -> `/studio`
- Business -> `/business`
- Profile -> `/profile`
- Admin -> `/admin` for admins only

Staff/admin diagnostic routes can remain available in account menus or admin
navigation, but regular users should not see Jobs, My Media, Referrals, or
Activity as primary rail concepts.

### Utility Controls

Keep the utility controls separate from page navigation:

- `JobsRail` remains the live work utility for active/deferred jobs.
- `AttentionInbox` remains the owner notification/attention utility.
- Activity remains a direct audit view reachable from cards, utility menus, and
  diagnostic links.

### Studio Surface

`/studio` should be an object-card index over:

- in-motion media workflows,
- raw user-visible jobs that do not yet have a better object,
- produced media assets,
- content assets when they exist,
- failed or blocked work that needs attention.

Required user controls:

- search,
- bucket filter:
  - `needs_attention`
  - `in_motion`
  - `produced`
  - `published` when content publishing exists
  - `history`
- kind filter:
  - media asset,
  - content item,
  - workflow run,
  - job-backed work,
- pagination or "load more" using the existing donor limits.

The visual unit should be `OrdoCard`, not a page-specific one-off card.

### Business Surface

`/business` should be an object-card index over:

- referral/QR link,
- referral activity,
- conversation-scoped business workflow context when available,
- public offer visibility/link state,
- funnel/pipeline summaries that are backed by current referral analytics.

Required user controls:

- search,
- object filter:
  - QR/referral link,
  - people/conversations,
  - offers,
  - funnel activity,
- "needs attention" and "recent" views where current data supports them.

Do not add a generic person, campaign, tracked-link, or offer-conversion model
in this phase unless it is already backed by current storage. The current
grounded business loop is referral/QR plus conversation-scoped business
context.

## Read Models To Add

### Studio Read Model

Create:

- `src/lib/studio/load-studio-workspace.ts`
- `src/lib/studio/studio-workspace-types.ts` if useful.

The loader should:

- require a signed-in user id from the route,
- parse query params for search, bucket, kind, and pagination,
- load media workflows through `getMediaWorkflowReadModel().listUserWorkflows`,
- load user jobs through `getJobStatusQuery().listUserJobSnapshots`,
- avoid duplicate workflow-linked jobs with
  `filterPrimaryJobSnapshotsForWorkflows`,
- load media assets through either:
  - a new user-wide `AssetCatalogReader.listUserAssets` path, preferred, or
  - `loadUserMediaWorkspace` as a temporary bridge,
- project every item into `OrdoCard`,
- sort `needs_attention` and `in_motion` before completed history,
- return a stable empty state when no work exists.

If a user-wide asset catalog method is added, keep it owner-scoped and covered
by negative permission tests. It must not expose another user's files or
blog assets.

### Business Read Model

Create:

- `src/lib/business/load-business-workspace.ts`
- `src/lib/business/business-workspace-types.ts` if useful.

The loader should:

- require a signed-in user id from the route,
- load referral workspace data through `loadReferralsWorkspace`,
- project the active referral/QR link with `projectReferralLinkToOrdoCard`,
- project recent referral activity with `projectReferralActivityToOrdoCard`,
- include current referral analytics summary and pipeline data,
- include public offer link/visibility state only if backed by existing public
  offer code,
- include conversation-scoped business workflow cards only if a safe existing
  user-scoped list API exists. If it does not exist, record that as a future
  gap rather than faking a people index.

## Pages And Components To Add

Add:

- `src/app/studio/page.tsx`
- `src/components/studio/StudioWorkspace.tsx`
- `src/app/business/page.tsx`
- `src/components/business/BusinessWorkspace.tsx`

Prefer shared components where this reduces real duplication:

- `OrdoCard` for cards,
- a small shared filter/search strip if Studio and Business need the same
  control pattern,
- existing status/progress helpers from jobs only if they remain generic.

Do not move unrelated admin code into these surfaces.

## Shell Updates

Update `src/lib/shell/shell-navigation.ts`:

- Add route id `studio`:
  - label: `Studio`
  - href: `/studio`
  - target surface: `studio`
  - disposition: `primary`
  - object kinds: `media_asset`, `content_item`, `workflow_run`
  - signed-in account/footer visibility
  - command visible.
- Add route id `business`:
  - label: `Business`
  - href: `/business`
  - target surface: `business`
  - disposition: `primary`
  - object kinds: `person`, `offer`, `tracked_link`, `campaign`,
    `conversation`
  - signed-in account/footer visibility
  - command visible.
- Update `AUTHENTICATED_WORK_RAIL_ROUTE_IDS` to the owner mental model:
  - `workspace-overview`
  - `studio`
  - `business`
  - `profile`
  - permitted admin routes where appropriate.
- Demote these donor routes from account/work-rail visibility:
  - `jobs`
  - `my-media`
  - `referrals`
  - `activity`
- Keep donor routes in `SHELL_ROUTES` with direct access and diagnostics, but
  remove command visibility unless a test/product reason requires a direct
  command.
- Resolve or rewrite `CURRENT_OBJECT_CENTERED_SURFACE_GAPS` so it no longer
  claims `/studio` and `/business` roots are missing.

Update:

- footer groups,
- nav drawer groups,
- command/search route projections,
- active route helpers,
- mobile work sheet route assertions.

## Dashboard Updates

Keep `/workspace` as the owner decision queue, but update destination links:

- Current work -> `/studio?bucket=in_motion`
- Recent outputs -> `/studio?bucket=produced`
- Failed/blocked work -> `/studio?bucket=needs_attention`
- Business loop -> `/business`
- Referral card -> `/business`
- Raw audit history -> `/activity`

Do not make `/workspace` a duplicate of Studio or Business. Dashboard should
summarize and route; Studio and Business should inspect.

## Tests To Update

Known current tests that will need updates or new assertions:

- `src/lib/shell/shell-navigation.test.ts`
- `src/components/AuthenticatedWorkRail.test.tsx`
- `src/components/AccountMenu.test.tsx`
- `src/components/ShellWorkspaceMenu.test.tsx`
- `tests/shell-navigation-model.test.ts`
- `tests/shell-command-parity.test.ts`
- `tests/shell-command-parity.test.tsx`
- `tests/shell-acceptance.test.tsx`
- `tests/shell-visual-system.test.tsx`
- `tests/site-shell-composition.test.tsx`
- `tests/homepage-shell-ownership.test.tsx`
- `tests/admin-shell-and-concierge.test.tsx`

Known current assertions to intentionally change:

- `src/lib/shell/shell-navigation.test.ts` currently expects `/studio` and
  `/business` to be absent and present only in
  `CURRENT_OBJECT_CENTERED_SURFACE_GAPS`.
- `tests/shell-command-parity.test.ts` and
  `tests/shell-command-parity.test.tsx` currently assert command ids do not
  contain `studio`.
- `src/components/AuthenticatedWorkRail.test.tsx`,
  `src/components/AccountMenu.test.tsx`, and
  `src/components/ShellWorkspaceMenu.test.tsx` currently expect direct Jobs,
  My Media, and Referrals route labels in signed-in navigation.

Add focused tests for:

- `src/lib/studio/load-studio-workspace.test.ts`
- `src/components/studio/StudioWorkspace.test.tsx`
- `src/app/studio/page.test.tsx`
- `src/lib/business/load-business-workspace.test.ts`
- `src/components/business/BusinessWorkspace.test.tsx`
- `src/app/business/page.test.tsx`

## Positive Tests

- Signed-in desktop rail exposes Dashboard, Studio, Business, and Profile.
- Signed-in mobile work sheet exposes the same primary owner route set.
- Staff/admin still get permitted admin/global surfaces without regular users
  seeing them.
- `/studio` renders Ordo cards from current workflow/job/media donors.
- `/studio` cards route to:
  - `/studio/media/[assetId]` for assets,
  - `/studio/workflows/[workflowId]` for media workflows,
  - `/jobs?jobId=...` only for raw job objects without a better object route.
- `/business` renders the active referral/QR card and recent referral activity.
- `/business` cards route to:
  - `/business/referrals/[referralCode]`,
  - `/business/conversations/[conversationId]` when business workflow context
    exists.
- Dashboard links route into `/studio`, `/business`, and `/activity` according
  to object purpose.
- Direct donor routes remain accessible by URL during the transition.

## Negative Tests

- Anonymous users cannot access `/studio` or `/business`; they redirect to
  `/login`, matching the current `/workspace`, `/jobs`, `/my/media`, and
  `/referrals` page behavior.
- Regular users do not see admin Media Ops or global operations in Studio or
  Business.
- Jobs, My Media, Referrals, and Activity do not reappear as primary rail
  labels for regular signed-in users.
- Public Offers does not leak internal funnel metrics.
- Business does not show fake people, fake campaigns, fake tracked links, or
  fake offer conversion data when those models are not backed by storage.
- Studio does not expose assets owned by another user.
- Business does not expose referral or conversation context owned by another
  user.

## Edge Tests

- User has no jobs, workflows, or media.
- User has jobs but no media workflow.
- User has a media workflow with linked jobs and a final asset.
- User has generated media unattached to a conversation.
- User has failed or blocked work.
- User has referral enabled but no activity.
- User has referral disabled.
- User has referral activity but no current QR link.
- Staff/admin user sees admin entry points without polluting regular owner
  navigation.
- Mobile safe-area layout still preserves chat input and bottom controls.

## Implementation Order

1. Add read-model tests for Studio and Business.
2. Implement `loadStudioWorkspace` over current donors.
3. Implement `loadBusinessWorkspace` over current donors.
4. Add `/studio` and `/business` pages with Ordo-card indexes.
5. Update shell route definitions and rail groupings.
6. Update command/search parity and shell tests.
7. Update dashboard links toward Studio and Business.
8. Run focused unit tests.
9. Run typecheck and a shell/navigation test slice.
10. Capture evidence in a new evidence doc if implementation changes are
    substantial.

## Verification Commands

Use the repo's available test runner names if they differ locally, but the
implementation should cover at least:

```bash
npx vitest run \
  src/lib/studio/load-studio-workspace.test.ts \
  src/components/studio/StudioWorkspace.test.tsx \
  src/app/studio/page.test.tsx \
  src/lib/business/load-business-workspace.test.ts \
  src/components/business/BusinessWorkspace.test.tsx \
  src/app/business/page.test.tsx \
  src/lib/shell/shell-navigation.test.ts \
  src/components/AuthenticatedWorkRail.test.tsx \
  tests/shell-navigation-model.test.ts \
  tests/shell-command-parity.test.ts \
  tests/shell-command-parity.test.tsx
```

```bash
npm run typecheck -- --pretty false
```

If UI styling changes in the shell or mobile rail, also run the relevant
browser/mobile shell tests.

## Non-Goals

- Do not delete `/jobs`, `/my/media`, `/referrals`, or `/activity` yet.
- Do not create a generic CRM or people index unless current storage supports
  it safely.
- Do not invent offer conversion metrics.
- Do not move admin/global Media Ops into the regular user Studio.
- Do not fully redesign the HITL dashboard. That belongs to `01c3l`.
- Do not change public homepage/feed/offers behavior in this phase except for
  route links that need to remain coherent.

## Exit Criteria

- The signed-in owner navigation has fewer primary surfaces.
- `/studio` and `/business` exist and are backed by current code, not mocked
  product concepts.
- Existing donor pages are secondary, diagnostic, or transitional.
- Ordo cards provide a consistent path from index -> object detail -> provenance
  or funnel/performance lens.
- The app can add more tools without adding another top-level page for each
  tool.
