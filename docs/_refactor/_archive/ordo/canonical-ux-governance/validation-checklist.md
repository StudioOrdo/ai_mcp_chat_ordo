# Canonical UX Governance Validation Checklist

Status: Planned
Date: 2026-05-05

## Package-Level Checks

- Ordo Chat is first in authenticated owner navigation.
- Public nav shows only Home/brand, Offers, About, and conditional Feed.
- Account menu contains User info, My Referrals, Preferences, and Sign out.
- System is not in the account menu; it is role-gated in admin navigation.
- Factory is not a visible top-level product label; Jobs is the admin label.
- Today, Studio, People, Offers, Account, and System use the same section
  layout model.
- Base section routes render briefs.
- Selected object routes render one selected detail without global totals at
  the top.
- Second columns are evidence/object selectors, not dashboards.
- Mobile uses hamburger navigation and list-to-detail back behavior.
- Regular owner UI does not expose raw job ids, provider keys, logs, command
  payloads, or diagnostic nouns.
- Admin/System can still inspect diagnostics and backup/restore safety flows.
- Briefs are evidence-backed and do not invent metrics.
- Failed brief generation preserves the prior brief.

## Required Test Layers

- Shell route resolution and role gates.
- Account menu route filtering and theme toggle.
- Shared section layout unit/component tests.
- Loader/read-model tests for Today, Studio, Offers, Account, and System.
- Mobile list/detail tests for People, Account, Today, Studio, and System.
- Static scans for stale owner UI terms and private leaks.
- Accessibility checks for icon labels, focus state, filter sheets, menus, and
  touch target size.
- Backup/restore section tests for table, restore plan, confirmation phrase,
  safety backup, and role gates.
- Brief request/result/reconcile tests when brief infrastructure is added.

## Required Closeout Evidence

Each phase must update or add evidence under `../evidence/` with:

- code anchors verified before editing;
- files changed;
- tests run;
- QA pass 1 issues and fixes;
- QA pass 2 issues and fixes;
- remaining risks or deferred work;
- screenshots or browser evidence when visual/mobile behavior changes.

## Static Scan Targets

Owner/public UI must not newly expose:

- `Factory`
- `Operation` as primary copy
- `Job` as primary owner copy
- `Activity receipt`
- `Provider log`
- `Command payload`
- `My media`
- `My conversations`
- `My offers`
- `My content`
- raw job ids as headings
- private/draft/public link mismatches
