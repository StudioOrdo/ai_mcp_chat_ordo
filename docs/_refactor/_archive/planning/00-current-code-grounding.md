# Current Code Grounding

Status: Research notes

Evidence date: 2026-05-05

## Goal

Document the code that already exists so the next refactor reuses and reframes
working pieces instead of inventing parallel systems.

## Governing Product Contract

`docs/_business/ux/08-product-kernel-contract.md` says:

- chat is the operating interface,
- UI surfaces are the governance layer,
- owner navigation is Today, Studio, People, Offers, About,
- profile and user-owned account details live in the account menu,
- admin/system diagnostics must not compete with the owner operating surfaces.

## Shell Anchors

Current shell files:

- `src/components/AppShell.tsx`
- `src/components/SiteNav.tsx`
- `src/components/AuthenticatedWorkRail.tsx`
- `src/components/AccountMenu.tsx`
- `src/components/ShellWorkspaceMenu.tsx`
- `src/components/ShellNavDrawer.tsx`
- `src/components/shell/ShellBrand.tsx`
- `src/lib/shell/shell-navigation.ts`
- `src/app/styles/shell.css`

Current behavior:

- `SiteNav` renders the brand, public route links, and account menu.
- `SiteNav` no longer renders the older drawer/workspace menu.
- `AuthenticatedWorkRail` renders owner rail links plus admin rail links.
- `AuthenticatedWorkRail` currently starts with Today, not Ordo Chat.
- `AuthenticatedWorkRail` maps `operations-media` to the visible label
  `Factory`.
- `AccountMenu` still exposes `my-media` and `my-qr-referral`.
- `shell-navigation.ts` defines account routes, owner rail routes, admin rail
  routes, route dispositions, and route visibility.

Important current route arrays:

- `AUTHENTICATED_WORK_RAIL_ROUTE_IDS`
  - `workspace-overview`
  - `studio`
  - `business`
  - `offers`
  - `business-about`
- `AUTHENTICATED_ADMIN_RAIL_ROUTE_IDS`
  - `admin-dashboard`
  - `operations-media`
  - `admin-system`
- `ACCOUNT_MENU_ROUTE_IDS`
  - `profile`
  - `my-media`
  - `my-qr-referral`

Gap:

- The shell does not have a first-class `Ordo Chat` owner rail item.
- Mobile currently behaves more like a bottom rail than a clear hamburger-driven
  main menu.
- Account menu still contains surfaces that should be governed in Studio or
  account/profile.
- Admin route names are partly implementation language, especially `Factory`.

## Today Anchors

Current files:

- `src/app/workspace/page.tsx`
- `src/components/dashboard/UserDashboard.tsx`
- `src/lib/dashboard/load-user-dashboard.ts`

Current behavior:

- Today now has a second-column selector, search, filter sheet, selectable item
  rows, object query state, and mobile list/detail behavior.
- `UserDashboard.tsx` builds Today selection rows from decisions, current work,
  outputs, results, weak signals, and business-loop items.
- `load-user-dashboard.ts` already gathers the useful source data: activity
  buckets, people, offers, content campaign performance, referral overview,
  weak signals, result cards, and next-action cards.
- The main pane still renders stacked dashboard blocks: current work, recent
  outputs, results, weak signals, business loop, Ask Ordo, and system health.
- Selected Today detail still renders generic `OrdoCard` detail copy instead of
  a decision/brief-specific object detail.

Gap:

- Today should keep the second-column selector pattern but replace the main
  dashboard stream with a concise Today Brief.
- Today items should be projected by a read model, not assembled ad hoc inside
  the React component.
- The model needs explicit intent: decide, watch, inspect, learn, or fix.
- A completed/succeeded object should not be labeled as a decision unless it
  still needs an owner decision.
- System work belongs on Today only when it needs owner/admin attention; raw
  backup, restore, job, or operation details belong in System.

## People Anchors

Current files:

- `src/app/business/page.tsx`
- `src/components/business/BusinessWorkspace.tsx`
- `src/lib/business/load-business-workspace.ts`
- `src/lib/business/people-read-model.ts`

Current behavior:

- People is the best current example of the target pattern.
- It has a search/filter second column.
- It has a selected person detail.
- It includes relationship facts, relationship trail, relationship settings,
  evidence-derived stage, and conversation links.

Use as the pattern source for:

- search plus filter icon,
- compact selector rows,
- selected-state treatment,
- detail pane,
- mobile drill-in behavior,
- evidence-first wording.

Gap:

- People still needs polish, but its structure is the model for other sections.

## Studio Anchors

Current files:

- `src/app/studio/page.tsx`
- `src/components/studio/StudioWorkspace.tsx`
- `src/lib/studio/load-studio-workspace.ts`

Current behavior:

- Studio already has a second-column selector.
- Studio already projects workflows, jobs, media assets, content items, and
  campaigns into object cards.
- `loadStudioWorkspace` already joins multiple sources into a Studio read model.
- Studio summary counts include total, attention, in motion, produced,
  workflows, assets, content, and campaigns.
- Studio has filters for status buckets and object kinds.

Gap:

- The selected media detail does not yet inherit the rich preview/player
  capabilities from the dedicated media page.
- Media and job/workflow provenance need to be presented together.
- The base Studio route should show a brief, while selecting an object should
  show one object detail. Global totals should not dominate every selected
  object view.

## Dedicated Media Anchors

Current files:

- `src/app/my/media/page.tsx`
- `src/components/media/UserMediaWorkspace.tsx`
- `src/lib/media/user-media.ts`

Current behavior:

- Dedicated media page loads user media, quota summary, filters, previews, and
  deletion eligibility.
- `UserMediaWorkspace` has mature preview logic for image, video, audio, chart,
  graph, and document media.
- Audio/video/image preview behavior is valuable.
- Storage/quota and deletion logic is valuable.

Gap:

- `My media` is the wrong primary user-facing surface.
- Media belongs in Studio because media is work Ordo produced or stores under
  governance.
- The dedicated page should become a donor implementation or redirect, not a
  top-level account destination.

## Account/Profile Anchors

Current files:

- `src/app/profile/page.tsx`
- `src/components/profile/ProfileSettingsPanel.tsx`
- `src/lib/profile/profile-service.ts`

Current behavior:

- Profile already uses a second-column account pattern.
- Sections are:
  - User info
  - Referral code
  - Preferences
- Referral code includes QR and link behavior.
- Preferences include in-development-like personal settings and notification
  controls.

Gap:

- Account menu should collapse to account/profile and My Referrals.
- Preferences and profile should remain in the same account surface.
- Mobile selection must drill into the selected account section with a clear
  back affordance.

## Offers Anchors

Current files:

- `src/app/offers/page.tsx`
- `src/components/offers/OfferSurfaces.tsx`
- `src/lib/offers/load-offers-workspace.ts`
- `src/lib/offers/offer-service.ts`

Current behavior:

- Offers are already a kernel object in the product contract.
- Offers need public/private/draft behavior and prices.
- Current work has been moving toward conversational and UI offer creation.

Gap:

- Offers should use the same section brief and second-column selector pattern.
- Private offers must not leak to public visitors.
- Offer creation should be chat-first, with UI governance for review,
  visibility, price, and send/publish actions.

## System/Admin Anchors

Current files:

- `src/app/admin/page.tsx`
- `src/app/admin/system/page.tsx`
- `src/app/admin/system/backups/page.tsx`
- `src/app/admin/system/backups/BackupSelfServiceManager.tsx`
- `src/app/admin/system/keys/page.tsx`
- `src/app/admin/system/operations/page.tsx`
- `src/app/admin/system/tools/page.tsx`
- `src/lib/appliance/backup/*`
- `src/app/api/admin/system/backups/*`
- `src/app/api/admin/system/restore-plans/*`

Current behavior:

- `/admin` already has a second-column-like section selector:
  Overview, System health, Pipeline, Conversations, Content, Jobs.
- `/admin/system` uses older stacked admin cards for health, providers,
  capabilities, referral diagnostics, tools, and active workers.
- `/admin/system/backups` has a capable backup and restore manager.
- Backup manager already supports:
  - create backup,
  - automatic backup policy,
  - recent backup list,
  - validate backup,
  - prepare restore,
  - restore plans,
  - confirmation phrase,
  - safety backup,
  - execute restore,
  - cancel restore.
- Rust backup execution lives in `crates/ordo-backup` and uses a mature
  command/result/reconcile pattern:
  - Node/TypeScript writes validated `system_commands` rows.
  - Rust claims pending daemon commands with a lease.
  - Rust validates payloads, stages filesystem work, writes audit events,
    records artifacts and metrics, and marks structured native results.
  - TypeScript reconciles system command results back into operation steps,
    artifacts, actions, and statuses.

Gap:

- Admin/System should use the same section selector and detail model.
- Backups and Restore need to become a first-class System section.
- `Factory` should become `Jobs` in user-visible admin navigation.
- Deep diagnostics can use implementation language, but owner UI cannot.
- Brief generation should copy the backup/restore pattern: explicit request,
  validated payload, durable execution, artifacts, evidence refs, audit events,
  and reconciliation into owner-safe read models.

## Test Anchors To Use During Refactor

Search areas:

- `tests/**/*.spec.ts`
- `tests/**/*.test.ts`
- `src/**/*.test.tsx`
- Playwright tests for public shell, business workspace, profile, studio, admin.

Needed test categories:

- shell route visibility and role gates,
- mobile menu and back affordances,
- account menu contents,
- second-column selection routes,
- section overview route behavior,
- Studio media preview and provenance,
- System backups/restore role gates and confirmation flow,
- owner UI scan for raw job/log/provider leaks.
