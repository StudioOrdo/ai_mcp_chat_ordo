# Implementation Sequence And Test Plan

Status: Draft plan

Evidence date: 2026-05-05

## Phase Order

### Phase A: Shell Contract

Implement:

- Ordo Chat first in main nav,
- desktop left rail cleanup,
- mobile hamburger main menu,
- account menu cleanup,
- `Factory` visible label changed to `Jobs`,
- shared shell alignment tokens.

Primary docs:

- `01-chat-first-shell-and-mobile-menu.md`
- `05-account-profile-referrals-preferences.md`

### Phase B: Shared Section Layout

Implement:

- shared section layout primitives,
- shared second-column selector,
- shared mobile back-to-list behavior,
- base route section brief state,
- selected object detail state.

Primary docs:

- `02-global-section-brief-and-second-column-pattern.md`
- `07-clean-architecture-and-shared-components.md`

### Phase C: Today Conversion

Implement:

- Today read model with explicit intents:
  - decide,
  - watch,
  - inspect,
  - learn,
  - fix.
- Today brief on `/workspace`.
- second column as evidence index, preserving search/filter/list behavior.
- selected Today item detail with why, evidence, recommended action, and
  source links.
- icon-led rows keyed to decision intent, not just object kind.
- remove stacked dashboard blocks from the main pane.
- ensure succeeded/completed objects are not labeled `Decision` unless they
  still require owner action.

Primary docs:

- `02-global-section-brief-and-second-column-pattern.md`
- `06-brief-generation-and-background-intelligence.md`
- `09-today-brief-and-decision-surface.md`

### Phase D: Studio/Media/Jobs Consolidation

Implement:

- media preview inside Studio selected media detail,
- related job/workflow/conversation links,
- remove My media from account menu,
- keep `/my/media` donor/compat route,
- selected media detail without global storage totals.

Primary docs:

- `03-studio-media-jobs-consolidation.md`

### Phase E: Offers Conversion

Implement:

- Offers brief,
- second-column offer selector,
- selected offer detail,
- price and visibility governance,
- public/private/draft safety.

Primary docs:

- product kernel,
- existing offer phase docs,
- `02-global-section-brief-and-second-column-pattern.md`

### Phase F: System/Admin Conversion

Implement:

- System second-column sections,
- System brief,
- Backups section table,
- Restore Plans section,
- Jobs section,
- admin diagnostics role gates.

Primary docs:

- `04-system-admin-jobs-backups-restore.md`

### Phase G: Brief Intelligence Foundation

Implement:

- durable brief model,
- evidence refs,
- refresh/update events,
- stale/failure states.
- command/result/reconcile pattern modeled after backup and restore.
- evidence manifest for generated briefs.
- prior-brief preservation on generation failure.
- admin-visible failure diagnostics without owner-surface leaks.

Primary docs:

- `06-brief-generation-and-background-intelligence.md`
- `04-system-admin-jobs-backups-restore.md`
- `07-clean-architecture-and-shared-components.md`
- `10-brief-executor-pattern-from-rust-backup-restore.md`

### Phase H: Brief Executor Hardening

Implement after the first durable brief model exists:

- brief update request table or operation-backed job contract,
- schema-versioned brief update payload,
- leased executor semantics,
- audit/activity events,
- artifact/result payload,
- reconciler that projects completed brief updates into section read models,
- stale/expired running update recovery.

Primary docs:

- `06-brief-generation-and-background-intelligence.md`
- `10-brief-executor-pattern-from-rust-backup-restore.md`
- Rust backup crate:
  - `crates/ordo-backup/src/command_store.rs`,
  - `crates/ordo-backup/src/native_contract.rs`,
  - `src/lib/appliance/backup/backup-restore-operation-reconciler.ts`.

## Required Test Layers

### Unit/Component

- shell navigation route resolution,
- account menu route filtering,
- second-column selector rendering,
- mobile detail back behavior,
- media preview component states,
- backup table and restore plan states.

### Loader/Read Model

- Studio read model includes media, workflow, job, content, campaign.
- People read model derives stages from evidence.
- Today read model produces intent-based items and brief evidence.
- System read model includes backups and restore plan summaries.
- Offers read model respects public/private/draft visibility.
- Brief read model exposes as-of time, evidence refs, limitations, and
  recommended action.

### Playwright/Route

- desktop shell alignment smoke test,
- mobile hamburger and account menu,
- People list-to-detail,
- Studio media selected detail,
- Today selected decision,
- Account referral mobile drill-in,
- Admin System Backups section.

### Static Scans

Owner surfaces should not show:

- raw provider keys,
- raw logs,
- job ids as primary headings,
- `Factory` in visible navigation,
- `My media` in account menu,
- public links to private/draft content or offers.
- dashboard blocks repeating selected object categories on section detail pages.
- Today `Decision` labels for completed work that does not need owner action.

Public nav should not show:

- Jobs,
- Activity,
- Library,
- Referrals,
- Operations,
- Blog,
- Journal,
- System.

### Accessibility

- rail and menu keyboard navigation,
- mobile hamburger focus trap,
- account menu focus behavior,
- second-column filter sheet focus,
- timeline/list semantics,
- minimum mobile target size.

## QA Protocol For Each Implementation Phase

Pass 1:

1. run phase tests,
2. run focused related tests,
3. run typecheck/lint where relevant,
4. inspect against product kernel,
5. fix every issue found.

Pass 2:

1. rerun phase tests,
2. rerun focused related tests,
3. run static scans,
4. verify privacy/access boundaries,
5. update docs/evidence if fixes changed behavior.

## Open Risks

- Some sections may need a shared layout extraction before page-specific fixes
  are stable.
- Media detail needs careful reuse of preview logic without bringing page-level
  quota UX into Studio.
- System backup/restore is powerful and should not be visually simplified in a
  way that weakens safety.
- Mobile shell behavior can regress existing route tests if the old bottom rail
  assumptions remain in tests.
- Section briefs need durable evidence storage before they can become truly
  adaptive.
- Brief generation can become hand-wavy if it is implemented as prompt text in
  components instead of a durable request/result/reconcile pipeline.
- Today can regress into a dashboard if the main pane is allowed to render every
  bucket from the second column.
