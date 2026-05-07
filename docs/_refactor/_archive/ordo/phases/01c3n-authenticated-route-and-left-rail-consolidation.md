# Phase 01c3n: Authenticated Route And Left Rail Consolidation

Status: Implemented

Parent phase:

- `01c3-authenticated-workspace-tool-rail.md`

Depends on:

- `01c3m-object-centered-ux-regression-closeout.md`
- `docs/_business/ux/08-product-kernel-contract.md`

Blocks:

- `01c3o-conversational-and-ui-offer-creation.md`
- `01c3p-people-customer-stage-and-funnel-cards.md`
- `01c4-admin-global-factory-navigation-rail.md`

## Goal

Replace the current signed-in navigation stack with one obvious owner
workspace model.

The solopreneur should not see public nav, a horizontal work rail, a workspace
drawer, job utilities, notification utilities, and admin shortcuts competing
for attention. They should see a small workspace rail that answers:

- What needs my attention?
- What work is Ordo producing?
- Who responded?
- What am I selling?
- Where are settings/admin controls?

## Product Rule

Navigation should teach the product.

Chat is the operating interface. Navigation is governance navigation.

The signed-in rail should not read like a toolbox. It should take the owner to
the governance surfaces that prove what chat did, what needs approval, who is
involved, what is public or private, and what result was created.

The primary signed-in product is:

- Today,
- Studio,
- People,
- Offers,
- Profile.

Admin-only/global tooling moves to a left vertical rail with icon-first
navigation, not a top-right drawer.

Jobs, notifications, activity, operations, and logs are evidence layers. They
surface as badges, card provenance, detail lenses, or admin diagnostics.

## Kernel Alignment

This phase implements the navigation portion of the Product Kernel Contract.

Kernel objects affected:

- Activity and Result move into Today.
- Work and Media move into Studio.
- Person and Link move into People.
- Offer moves into Offers.
- Staff/admin governance moves out of owner navigation.

Implementation gates:

1. Reuse `src/lib/shell/shell-navigation.ts`, `AppShell`, `SiteNav`,
   `AuthenticatedWorkRail`, `JobsRail`, and `AttentionInbox` before inventing
   new shell state.
2. Absorb `/jobs`, `/activity`, `/my/media`, `/referrals`, and
   `/operations/media` as donor routes, not owner-primary routes.
3. Preserve public visibility rules: Home, Offers, About, conditional Feed.
4. Advance the New Owner and Dashboard Decision scenario tests.
5. Hide the right workspace drawer from regular owner navigation.
6. Keep admin/global controls role-gated and visually separate.

## Current Code Grounding

### Shell And Route Donors

- `src/lib/shell/shell-navigation.ts`
  - Current regular signed-in route resolution is Dashboard, Studio, Business,
    Profile.
  - `ACCOUNT_MENU_ROUTE_IDS` includes `operations-media`, but role visibility
    filters it to staff/admin.
  - Jobs, Activity, My Media, Referrals, and Operations Media are already marked
    donor/diagnostic/staff-admin in the shell model.
  - `SHELL_NAV_DRAWER_GROUPS` still preserves the old drawer grouping.
- `src/components/AppShell.tsx`
  - Renders `SiteNav` and `AuthenticatedWorkRail` across document-flow routes.
- `src/components/SiteNav.tsx`
  - Public top rail still includes `ShellWorkspaceMenu` in the account/actions
    region.
- `src/components/ShellWorkspaceMenu.tsx`
  - Current top-right drawer combines workspace links, admin links, mode/status
    copy, and sign-out.
- `src/components/AuthenticatedWorkRail.tsx`
  - Current horizontal route rail also mounts `JobsRail` and `AttentionInbox`.
- `src/frameworks/ui/jobs-rail/JobsRail.tsx`
  - Current jobs utility drawer.
- `src/components/AttentionInbox.tsx`
  - Current notification/attention utility panel.

### Product Donors

- `src/components/dashboard/UserDashboard.tsx`
  - Current owner dashboard.
- `src/components/studio/StudioWorkspace.tsx`
  - Current produced-work/workflow index.
- `src/components/business/BusinessWorkspace.tsx`
  - Current business-loop/referral index.
- `src/lib/ordo-cards/ordo-card-projectors.ts`
  - Current card projections for jobs, workflows, assets, referrals, business
    contexts, activity, and operations.

## Implementation Result

Implemented on 2026-05-05.

The signed-in shell now follows the Product Kernel Contract invariant:

- chat remains the operating interface;
- the authenticated UI is governance navigation;
- owner navigation is Today, Studio, People, Offers, Profile;
- admin/global controls are visually separate in the same left rail;
- Jobs, Activity, My Media, Referrals, and Media Ops remain donor/direct
  diagnostic routes, not regular owner-primary navigation.

Code changes landed in:

- `src/lib/shell/shell-navigation.ts`
  - changed owner route labels to Today and People;
  - added Offers to the signed-in owner route set;
  - split regular owner rail routes from admin/global rail routes.
- `src/components/SiteNav.tsx`
  - removed the top-right `ShellWorkspaceMenu` from normal public and signed-in
    primary navigation.
- `src/components/AppShell.tsx`
  - wraps signed-in owner routes in the authenticated rail layout.
- `src/components/AuthenticatedWorkRail.tsx`
  - replaced the horizontal route rail plus separate jobs/attention utilities
    with one responsive left/bottom rail;
  - maps jobs and attention read models into rail badges;
  - renders staff/admin routes in a separate admin group.
- `src/app/styles/shell.css`
  - adds the desktop left rail and mobile bottom dock treatment.
- `src/components/business/BusinessWorkspace.tsx`
  - updates owner-facing copy to People while preserving `/business` as the
    compatibility route.
- `src/app/business/page.tsx`, `src/app/workspace/page.tsx`,
  `src/components/dashboard/UserDashboard.tsx`
  - update page metadata/labels to People and Today where owner-facing.

Browser acceptance tests were updated so they no longer preserve the retired
workspace drawer as an expected surface.

## Target IA

### Public Header

Anonymous/public users see:

- brand,
- Offers,
- About,
- Feed only when public content exists,
- Login/Register.

No authenticated drawer should appear for anonymous users.

### Signed-In Desktop

Signed-in users see a left vertical rail:

- Today,
- Studio,
- People,
- Offers,
- Profile.

Route naming bridge:

- Today maps to current `/workspace` and `workspace-overview` until the route
  label is renamed.
- People maps to current `/business` until a redirect-safe route rename exists.
- Offers may initially point to `/offers` or a People/Business offers bucket
  until `01c3o` adds durable owner offers. The rail must not imply durable
  owner offers exist before that phase lands.

Badges:

- Today: total owner attention count.
- Studio: active/failed produced-work count.
- People: leads/conversations/follow-up count.
- Offers: draft/attention/conversion count.

### Signed-In Mobile

Mobile should use a compact bottom workspace dock or a clear one-row workspace
switcher. It should not open the current implementation-heavy workspace drawer.

### Staff/Admin

Staff/admin users see an additional admin/global rail group:

- Admin,
- Factory/Operations,
- System.

Do not place these in the public top rail or top-right hamburger.

## Required Work

- Rename the user-facing business surface from generic `Business` to clearer
  workspace concepts where appropriate:
  - People,
  - Offers,
  - or Business as a grouped parent only if the left rail remains compact.
- Preserve `/business` as a compatibility route unless a redirect and test
  migration is explicitly included.
- Remove `ShellWorkspaceMenu` from the normal signed-in top rail.
- Replace `AuthenticatedWorkRail` horizontal desktop links with the new
  desktop rail primitive.
- Move `JobsRail` and `AttentionInbox` counts into rail badges and dashboard
  blocks.
- Keep direct routes for diagnostics while removing them from normal visible
  owner navigation.
- Preserve account/profile/sign-out access through Profile or a minimal account
  popover, not a workspace drawer.
- Keep public header centered and visually quiet.

## Positive Tests

- Anonymous header shows only public links and auth links.
- Signed-in regular user sees Today, Studio, People/Business, Offers, Profile.
- Staff/admin user sees admin/global rail entries.
- Rail badges reflect attention/jobs/business counts from existing read models.
- Mobile signed-in navigation fits at 320px and 360px.

## Negative Tests

- Regular user does not see `/jobs`, `/activity`, `/my/media`, `/referrals`,
  or `/operations/media` as primary navigation.
- Top-right drawer is not visible as the primary workspace switcher.
- Jobs and notifications do not appear as standalone top-right icons.
- Admin routes do not appear for regular users.

## Edge Tests

- Empty new user.
- User with active jobs but no business events.
- User with referral activity but no produced work.
- Admin with many admin/system badges.
- EventSource unavailable for live jobs.

## Exit Criteria

- The signed-in shell has one obvious navigation model.
- Utility/event counts are integrated into product surfaces.
- Admin/global controls are visually and conceptually separate from regular
  owner work.
- The owner no longer has to understand Jobs, Activity, Notifications, and
  Operations as top-level apps.

## QA Evidence

Canonical evidence file:

- `docs/_refactor/ordo/evidence/phase-01c3n-authenticated-route-and-left-rail-consolidation.md`

QA pass 1 found and fixed:

- `AuthenticatedWorkRail` rendered duplicate desktop and mobile link sets in
  the DOM. Fixed by making a single responsive rail body, which improves
  accessibility and eliminates ambiguous route links.
- `AuthenticatedWorkRail` tests produced React act warnings from an async
  attention-count fetch. Fixed by making the badge-fetch assertion explicit and
  keeping non-badge tests on a pending fetch stub.
- Browser acceptance specs still asserted the old top-right workspace drawer.
  Fixed them to assert the new no-drawer public header and authenticated
  governance rail.
- Browser admin specs used `/api/auth/switch`, which is correctly forbidden for
  non-admin users in production-mode Playwright. Fixed the spec by promoting
  the registered Playwright user directly in the test database.
- Browser People spec still asserted the stale `Growth and relationship loop`
  heading. Fixed it to assert `People and relationship loop`.

QA pass 2 reran the phase suites, focused lint/typecheck/stylelint, focused
Playwright browser coverage, and stale-surface scans. All required checks
passed.
