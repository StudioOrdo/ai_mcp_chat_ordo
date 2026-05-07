# Phase 01c3m: Object-Centered UX Regression Closeout

Status: Implemented

Parent phase:

- `01c3-authenticated-workspace-tool-rail.md`

Depends on:

- `01c3k-studio-business-surface-consolidation.md`
- `01c3l-hitl-dashboard-and-ceo-command-loop.md`

QA reference:

- `docs/_business/ux/08-product-kernel-contract.md`
- `docs/_business/ux/01-language-and-vocabulary.md`
- `docs/_business/ux/03-interface-principles.md`
- `docs/_business/ux/architecture/12-capability-certification-and-complete-inventory.md`

Blocks:

- `01c3n-authenticated-route-and-left-rail-consolidation.md`

## Goal

Close the object-centered workspace UX refactor with evidence, stale-surface
cleanup, and regression coverage before admin/global/factory navigation grows
on top of the regular-user shell.

This phase is not a feature build. It is the proof phase that the owner-facing
product shape is coherent after phases `01c3h` through `01c3l`.

## Product Rule

This implemented closeout is the stable object-centered baseline before the
final solopreneur operating-loop consolidation.

Chat is the operating interface. Object-centered UI is the governance layer.

This closeout must prove that Dashboard, Studio, Business, object details,
Activity, Jobs, and donor routes support chat-driven work rather than becoming
the normal way a regular user operates Ordo. The UI should expose receipts,
status, provenance, privacy, and safe actions for work that conversation starts
or explains.

After this phase, a regular signed-in user should understand Ordo through:

- Dashboard,
- Studio,
- Business,
- Profile/Settings.

The current UX canon now names the final owner model:

- Today,
- Studio,
- People,
- Offers,
- Profile.

Do not treat the `Dashboard` and `Business` labels in this implemented phase as
the final vocabulary. They describe the code baseline that `01c3n` through
`01c3t` must refine into Today, People, and owner-managed Offers.

They should reach provenance, funnel, performance, jobs, activity, operations,
and logs by drilling into objects, cards, detail lenses, or diagnostics. They
should not have to learn every implementation subsystem as a top-level app.

## Start Gate

Do not start this closeout until these are true:

- `01c3k` has implemented `/studio` and `/business` root pages.
- `01c3k` has added `studio` and `business` shell routes.
- `01c3k` has demoted Jobs, My Media, Referrals, and Activity from the regular
  user's primary work rail.
- `01c3l` has made `/workspace` the HITL owner dashboard rather than a raw
  activity summary.
- `/studio/media/[assetId]`, `/studio/workflows/[workflowId]`,
  `/business/referrals/[referralCode]`,
  `/business/conversations/[conversationId]`, and `/operations/[operationId]`
  still pass their owner/role-scoped detail tests.

If any start-gate item fails, stop and finish the prerequisite phase. Do not
paper over missing Studio/Business/Dashboard behavior in the closeout.

## Current Code Grounding

### Current State After Closeout

As of implementation:

- `src/app/studio/page.tsx` exists and renders the Studio object index.
- `src/app/business/page.tsx` exists and renders the Business object index.
- `src/lib/shell/shell-navigation.ts` has an empty
  `CURRENT_OBJECT_CENTERED_SURFACE_GAPS` array.
- `AUTHENTICATED_WORK_RAIL_ROUTE_IDS` remains derived from
  `ACCOUNT_MENU_ROUTE_IDS`, but the regular-user route set is now:
  - `workspace-overview`,
  - `studio`,
  - `business`,
  - `profile`.
- Staff/admin users additionally see `operations-media`.
- Shell tests now assert that `/studio` and `/business` exist and that Jobs,
  Activity, My Media, and Referrals are not regular-user primary navigation.
- `src/components/dashboard/UserDashboard.tsx` renders `OrdoCard` projections
  from dashboard activity items and routes owner blocks toward Studio and
  Business.
- The 01c3l refresh now frames `/workspace` product copy as `Today` while the
  route id and historical shell label remain `workspace-overview` /
  `Dashboard` until `01c3n` owns the route-language consolidation.
- Dashboard cards expose `Ask Ordo` as the operating action on every rendered
  card and preserve conversation context when present.
- Browser shell coverage passes for public header/mobile surfaces and the
  updated `/jobs` donor Work Index, including explicit `Details` progressive
  disclosure instead of stale whole-card navigation.
- Browser coverage now includes a signed-in `/business` regression that proves
  shared `OrdoCard` copy actions do not violate React Server Component action
  boundaries on server-rendered workspace pages.

Implementation evidence:

- `docs/_refactor/ordo/evidence/phase-01c3m-object-centered-ux-regression-closeout.md`

### Implemented Foundations To Preserve

- `src/components/ordo-cards/OrdoCard.tsx`
  - Object-card renderer for progressive disclosure.
- `src/lib/ordo-cards/ordo-card-projectors.ts`
  - Projects jobs, media workflows, asset catalog entries, referrals, referral
    activity, business workflow contexts, activity items, and operations into
    `OrdoCard`.
  - Existing tests already guard against fake tracked links, fake provenance,
    raw `inputSnapshot` leaks, and role-inappropriate operation actions.
- `src/components/ordo-details/OrdoDetailLayout.tsx`
  - Shared detail layout with lenses, facts, timeline, related objects, actions,
    and diagnostic links.
- `src/lib/ordo-details/**`
  - Owner-scoped Studio and Business detail loaders/projectors.
- `src/app/studio/media/[assetId]/page.tsx`
- `src/app/studio/workflows/[workflowId]/page.tsx`
- `src/app/business/referrals/[referralCode]/page.tsx`
- `src/app/business/conversations/[conversationId]/page.tsx`
  - Detail routes already exist and must remain stable.
- `src/lib/activity/**`
- `src/components/activity/ActivityWorkspace.tsx`
- `src/components/AttentionInbox.tsx`
  - Durable activity, receipts, and attention inbox donors.
- `src/components/jobs/JobsWorkspace.tsx`
- `src/lib/jobs/load-user-jobs-workspace.ts`
  - Technical job/workflow diagnostic donor.
- `src/components/referrals/ReferralsWorkspace.tsx`
- `src/lib/referrals/load-referrals-workspace.ts`
  - Business-loop/referral donor.
- `src/components/dashboard/UserDashboard.tsx`
- `src/lib/dashboard/load-user-dashboard.ts`
  - CEO/HITL dashboard surface that summarizes attention, current work,
    recent outputs, business loop motion, system health, and the product-level
    `Ask Ordo` command path for each dashboard card.

### Tests Already In Place

Relevant existing tests include:

- `src/components/ordo-cards/OrdoCard.test.tsx`
- `src/lib/ordo-cards/ordo-card-projectors.test.ts`
- `src/components/ordo-details/OrdoDetailLayout.test.tsx`
- `src/lib/ordo-details/load-studio-object-detail.test.ts`
- `src/lib/ordo-details/load-business-object-detail.test.ts`
- `src/lib/ordo-details/ordo-detail-projectors.test.ts`
- `src/app/studio/media/[assetId]/page.test.tsx`
- `src/app/studio/workflows/[workflowId]/page.test.tsx`
- `src/app/business/referrals/[referralCode]/page.test.tsx`
- `src/app/business/conversations/[conversationId]/page.test.tsx`
- `src/lib/activity/activity-read-model.test.ts`
- `src/components/activity/ActivityWorkspace.test.tsx`
- `src/app/activity/page.test.tsx`
- `src/lib/dashboard/load-user-dashboard.test.ts`
- `src/components/dashboard/UserDashboard.test.tsx`
- `src/lib/jobs/load-user-jobs-workspace.test.ts`
- `src/components/jobs/JobsWorkspace.test.tsx`
- `src/lib/shell/shell-navigation.test.ts`
- `src/components/AuthenticatedWorkRail.test.tsx`
- `tests/shell-navigation-model.test.ts`
- `tests/shell-command-parity.test.ts`
- `tests/shell-command-parity.test.tsx`
- `tests/shell-acceptance.test.tsx`
- `tests/shell-visual-system.test.tsx`
- `tests/site-shell-composition.test.tsx`
- `tests/homepage-shell-ownership.test.tsx`

This phase should update and run that suite, plus any new Studio/Business/
Dashboard tests added by `01c3k` and `01c3l`.

## Closeout Invariants

### Navigation Invariants

- Regular signed-in primary work rail exposes only:
  - Dashboard,
  - Studio,
  - Business,
  - Profile.
- Admin/global routes are visible only to allowed roles.
- Jobs, My Media, Referrals, and Activity remain direct diagnostic/donor routes
  only.
- `JobsRail` and `AttentionInbox` remain utility controls, not page navigation.
- Public routes remain Home, Feed when content exists, Offers, and About.

### Object Index Invariants

- Dashboard summarizes and routes; it does not duplicate Studio or Business.
- Studio indexes produced work, in-motion work, media assets, content items,
  workflows, and raw job fallbacks only when no better object exists.
- Business indexes grounded referral/QR, referral activity, conversation-scoped
  business context, and offer visibility only where current code supports it.
- No generic people, campaigns, tracked links, or offer-conversion metrics are
  shown unless backed by storage and tests.
- Empty states are truthful and do not create fake work.

### Card And Detail Invariants

- Object indexes render `OrdoCard`, not one-off page cards.
- Cards have stable object identity:
  - media asset cards use media/asset ids,
  - workflow cards use workflow ids,
  - raw job cards use job ids only as workflow-run fallback objects,
  - referral cards use referral codes/events,
  - conversation cards use conversation ids.
- Cards do not use job ids as asset ids.
- Cards do not expose raw `inputSnapshot`, runtime logs, provider payloads, or
  admin-only actions to regular users.
- Every card primary action is one of:
  - open canonical detail,
  - open a safe diagnostic,
  - open/queue a confirmation-backed operation,
  - ask Ordo with explicit context.
- Detail lenses stay truthful:
  - missing media provenance says provenance is missing,
  - missing referral performance says performance is not recorded,
  - conversation business context does not pretend there is a people index,
  - diagnostic links are available but secondary.

### Role And Privacy Invariants

- Anonymous users redirect to `/login` for all private owner routes.
- Regular users cannot read another user's Studio asset, Studio workflow,
  Business referral, Business conversation, activity, or job detail.
- Staff/admin permissions stay explicit and tested.
- Public Feed/Offers/About do not leak private metrics or owner-only activity.

### Mobile And Visual Invariants

- Dashboard, Studio, Business, and detail pages work in one-column mobile
  layout at 320px and 360px.
- Desktop may use progressive disclosure, but it must not recreate the old
  two-column jobs console as the product mental model.
- Shell brand/top rail remains balanced after route consolidation.
- Bottom/mobile controls clear safe areas and do not overlap chat input.
- Reduced-motion users can use the shell without motion-dependent navigation.

## Required Work

### Static Stale Scans

Run stale scans and resolve anything that violates the invariants:

```bash
rg -n "AUTHENTICATED_WORK_RAIL_ROUTE_IDS|ACCOUNT_MENU_ROUTE_IDS|CURRENT_OBJECT_CENTERED_SURFACE_GAPS|plannedRoute: \"/studio\"|plannedRoute: \"/business\"" src/lib/shell tests
```

```bash
rg -n "My Jobs|Your Jobs|My Media|Referrals|Activity|Jobs" src/components/AuthenticatedWorkRail.tsx src/components/AccountMenu.tsx src/components/ShellWorkspaceMenu.tsx src/lib/shell tests
```

```bash
rg -n "/jobs\\?|/my/media|/referrals|/activity" src/components/dashboard src/app/workspace src/lib/dashboard src/app/studio src/app/business src/components/studio src/components/business tests
```

```bash
rg -n "inputSnapshot|provider log|runtime log|raw log|two-column|detail panel|opened in the detail panel" src/components src/lib src/app tests
```

```bash
rg -n "assetId.*job|jobId.*asset|job_.*asset|asset_.*job" src/lib/ordo-cards src/lib/ordo-details src/components src/app tests
```

These scans are not simple zero-match requirements. Some donor and diagnostic
references are legitimate. Each hit must be classified as:

- valid diagnostic/donor path,
- valid test fixture,
- stale user-facing copy,
- stale primary navigation,
- real bug.

Record the classification in the evidence doc.

### Test And Assertion Updates

Update tests so they assert the final product shape:

- Shell route tests assert Studio and Business exist and
  `CURRENT_OBJECT_CENTERED_SURFACE_GAPS` no longer lists them as missing.
- Command parity tests include Studio and Business and do not promote donor
  routes unless explicitly intended.
- Authenticated work rail tests assert Dashboard, Studio, Business, Profile.
- Account/menu/drawer tests demote Jobs, My Media, Referrals, and Activity.
- Dashboard tests assert HITL sections and safe action routes from `01c3l`.
- Studio tests assert object-card index behavior from `01c3k`.
- Business tests assert object-card index behavior from `01c3k`.
- OrdoCard and detail tests keep proving owner-scoped access, truthful empty
  states, and non-leaky provenance.

### Documentation Updates

Update documentation affected by the closeout:

- `docs/_refactor/ordo/phases/01c3-authenticated-workspace-tool-rail.md`
  - Mark 01c3h-m as completed once implementation is done.
- `docs/_refactor/ordo/phases/01c3h-object-centered-information-architecture.md`
  - Reflect final surface map.
- `docs/_refactor/ordo/phases/01c3i-ordo-card-system-and-progressive-disclosure.md`
  - Reflect final shared card usage.
- `docs/_refactor/ordo/phases/01c3j-object-detail-lenses-provenance-funnel-and-performance.md`
  - Reflect final index-to-detail routes.
- `docs/_refactor/ordo/phases/01c3k-studio-business-surface-consolidation.md`
  - Mark implemented and add evidence pointers.
- `docs/_refactor/ordo/phases/01c3l-hitl-dashboard-and-ceo-command-loop.md`
  - Mark implemented and add evidence pointers.
- `docs/_refactor/ordo/phases/01c3n-authenticated-route-and-left-rail-consolidation.md`
  - Continue from the stable object-centered baseline into the simplified
    solopreneur operating loop before admin/global work expands.

Create:

- `docs/_refactor/ordo/evidence/phase-01c3m-object-centered-ux-regression-closeout.md`

The evidence doc should list:

- current route map,
- current shell primary route set by role,
- stale-scan classification,
- changed tests,
- commands run,
- failures found and fixed,
- any deferred cleanup.

## Positive Tests

- Authenticated regular user can navigate:
  - `/workspace`,
  - `/studio`,
  - `/business`,
  - `/profile`.
- Dashboard cards open detail pages or safe HITL actions.
- Studio cards include produced and in-progress work without duplicate
  workflow/job rows.
- Business cards include grounded referral/QR/funnel/conversation objects.
- Detail pages expose provenance, funnel, performance, related, activity, and
  diagnostic links according to object kind.
- Activity and Jobs remain direct diagnostics, not primary product concepts.
- Direct links from older donor surfaces still land safely during migration.
- Mobile shell and dashboard work at 320px and 360px.

## Negative Tests

- Anonymous users cannot access private Dashboard, Studio, Business, detail, or
  activity surfaces.
- Regular users cannot access another user's assets, workflows, referrals,
  conversations, jobs, operations, or activity.
- Admin-only details and actions do not leak into regular user cards.
- Public Offers/Feed do not expose private metrics.
- Runtime logs, provider payloads, and raw job input snapshots are not promoted
  to user dashboard/cards.
- Destructive, restore, publish, retry, and other risky actions require
  confirmation.
- Generic people/campaign/tracked-link/offer-performance objects do not appear
  unless backed by storage and tests.

## Edge Tests

- Empty account.
- Account with only media.
- Account with only workflows/jobs.
- Account with only referrals.
- Account with only failed jobs.
- Account with mixed media, workflow, referral, and conversation objects.
- Referral disabled.
- Media asset with no producing job.
- Workflow with linked job ids but missing linked job snapshots.
- Business conversation with no lead/deal/referral context.
- Staff user.
- Admin user.
- Mobile 320px.
- Mobile 360px.
- Reduced motion.
- Feed disabled because there is no public content.

## Verification Commands

Use the repo scripts where possible:

```bash
npm run typecheck -- --pretty false
```

```bash
npm run lint -- \
  src/lib/shell/shell-navigation.ts \
  src/components/AuthenticatedWorkRail.tsx \
  src/components/dashboard/UserDashboard.tsx \
  src/components/ordo-cards/OrdoCard.tsx \
  src/components/ordo-details/OrdoDetailLayout.tsx
```

Run the focused object-centered suite:

```bash
npx vitest run \
  src/lib/shell/shell-navigation.test.ts \
  src/components/AuthenticatedWorkRail.test.tsx \
  src/components/AccountMenu.test.tsx \
  src/components/ShellWorkspaceMenu.test.tsx \
  tests/shell-navigation-model.test.ts \
  tests/shell-command-parity.test.ts \
  tests/shell-command-parity.test.tsx \
  tests/shell-acceptance.test.tsx \
  tests/shell-visual-system.test.tsx \
  tests/site-shell-composition.test.tsx \
  tests/homepage-shell-ownership.test.tsx \
  src/lib/ordo-cards/ordo-card-projectors.test.ts \
  src/components/ordo-cards/OrdoCard.test.tsx \
  src/lib/ordo-details/load-studio-object-detail.test.ts \
  src/lib/ordo-details/load-business-object-detail.test.ts \
  src/lib/ordo-details/ordo-detail-projectors.test.ts \
  src/components/ordo-details/OrdoDetailLayout.test.tsx \
  'src/app/studio/media/[assetId]/page.test.tsx' \
  'src/app/studio/workflows/[workflowId]/page.test.tsx' \
  'src/app/business/referrals/[referralCode]/page.test.tsx' \
  'src/app/business/conversations/[conversationId]/page.test.tsx' \
  src/lib/activity/activity-read-model.test.ts \
  src/components/activity/ActivityWorkspace.test.tsx \
  src/app/activity/page.test.tsx \
  src/lib/dashboard/load-user-dashboard.test.ts \
  src/components/dashboard/UserDashboard.test.tsx
```

Also run the new tests from `01c3k` and `01c3l`, expected to include:

```bash
npx vitest run \
  src/lib/studio/load-studio-workspace.test.ts \
  src/components/studio/StudioWorkspace.test.tsx \
  src/app/studio/page.test.tsx \
  src/lib/business/load-business-workspace.test.ts \
  src/components/business/BusinessWorkspace.test.tsx \
  src/app/business/page.test.tsx
```

If visual/shell styling changed during closeout, run:

```bash
npx playwright test \
  tests/browser-ui/home-shell-header.spec.ts \
  tests/browser-ui/mobile-public-reading.spec.ts \
  tests/browser-ui/jobs-page.spec.ts
```

Add or update browser coverage for `/workspace`, `/studio`, and `/business` if
the existing browser suite cannot inspect those final surfaces.

## Cleanup Rules

- Remove stale copy that describes Jobs as the main user product surface.
- Remove stale shell tests that preserve donor pages as primary navigation.
- Remove duplicate page-specific cards only after the shared `OrdoCard` tests
  cover the equivalent states.
- Keep diagnostic/admin job and operation views separated from regular user
  Studio.
- Keep donor routes until replacement parity is proven, then explicitly decide
  whether to redirect, hide, or delete them in a later cleanup phase.
- Do not delete donor routes just because they are no longer primary navigation.

## Exit Criteria

- Object-centered UX is documented, implemented, and regression-tested.
- Regular user primary navigation is Dashboard, Studio, Business, Profile.
- This is a historical closeout invariant for the implemented baseline; the
  final owner-facing vocabulary is governed by
  `docs/_business/ux/08-product-kernel-contract.md`.
- Dashboard, Studio, Business, object details, Activity, Jobs, and donor routes
  have intentional roles.
- Stale scans are classified and resolved or explicitly deferred.
- Tests prove role safety, object identity, progressive disclosure, truthful
  empty states, and mobile viability.
- Evidence exists in
  `docs/_refactor/ordo/evidence/phase-01c3m-object-centered-ux-regression-closeout.md`.
- `01c4` can add admin/global/factory navigation on top of a stable
  regular-user product shell.
