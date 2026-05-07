# 02 UI Surface Realignment: Implementation Phase Plan

Status: Draft spec

## Goal

Turn the UI surface realignment research into a sequence of small, reviewable
implementation phases that preserve the current working system while moving the
product toward the canonical IA.

## Current Code Grounding

Grounded in:

- `docs/_refactor/ordo/letters/refactor1.md`
- `docs/_business/ux/08-product-kernel-contract.md`
- `docs/_business/ux/09-canonical-ux-architecture.md`
- `docs/_business/ux/00-ux-north-star.md`
- `src/lib/shell/shell-navigation.ts`
- `src/components/governance/GovernanceSectionFrame.tsx`
- `src/core/entities/brief.ts`
- `src/core/entities/ordo-object.ts`
- `src/lib/briefs/brief-update-executor.ts`
- `src/lib/appliance/backup/backup-command-service.ts`
- surface loaders under `src/lib/**/load-*.ts`
- canonical owner/admin/public components under `src/components/**`

## Verified Current State

- The current codebase already has the main primitives needed for the
  realignment: shell registry, shared governance frame, durable brief entities,
  brief executor/reconciler, and backup command semantics.
- Several individual phases in `01c3ac` through `01c3ap` are already
  implemented and should be reused rather than restarted.
- Remaining work is mainly convergence, route cleanup, Knowledge Base, accepted
  offer lifecycle, and stricter no-fake-intelligence enforcement.

## Target Behavior

The target implementation should preserve this product loop:

```text
Source / QR / referral / content
-> visitor
-> conversation
-> human handoff when needed
-> offer
-> accepted offer
-> work / fulfillment
-> delivery
-> feedback
-> report
-> follow-up
```

All implementation phases must keep this shell:

- Public: Home, Offers, About, Feed only when public content exists.
- Owner: Conversations, Today, Studio, People, Offers, About, future Knowledge
  Base.
- Account: My Account, Affiliate Dashboard, theme toggle, Sign out.
- Admin: Admin, Jobs, System.

## Reuse / Move / Hide / Mock Decisions

- Reuse the shared frame and existing loaders wherever possible.
- Move donor UI into canonical surfaces before redirecting old routes.
- Hide donor/diagnostic routes from nav before deleting routes.
- Mock only placeholder read models that obey `07-placeholder-read-model-policy`.

## Proposed Implementation Phases

### Phase 02a: Route Registry And Shell Contract Lock

Scope:

- update stale target surfaces in `shell-navigation.ts`;
- enforce public/owner/account/admin route sets;
- assert no donor route leaks into nav;
- document Knowledge Base as future/disabled.

Primary tests:

- shell navigation tests;
- SiteNav, AccountMenu, AuthenticatedWorkRail, mobile menu tests.

### Phase 02b: Shared Frame Compliance Sweep

Scope:

- audit all canonical owner/admin surfaces against `GovernanceSectionFrame`;
- remove detail-level global totals;
- enforce mobile list/detail back behavior.

Primary tests:

- Governance frame consumer tests for Today, Studio, People, Offers, About,
  Account, System.

### Phase 02c: Conversations Selector Stabilization

Scope:

- make signed-in `/` Conversations use the second column as conversation
  selector;
- include Ordo as the active agent conversation and deterministic person
  handoff placeholder rows;
- keep anonymous `/` as public chat entry.

Primary tests:

- home page tests;
- ChatSurface tests;
- mobile hamburger/shell tests.

### Phase 02d: Today Brief Quality And Evidence Index

Scope:

- tighten Today brief copy and selected details;
- ensure decision rows use icons and one obvious next action;
- preserve owner-safe scrubbing.

Primary tests:

- Today brief read model and dashboard component tests.

### Phase 02e: Studio Consolidation And `/my/media` Retirement

Scope:

- move media selector/playback/deletion-safe affordances into Studio;
- redirect or hide `/my/media`;
- keep jobs-as-work in Studio and raw jobs in Admin/System.

Primary tests:

- Studio, media, jobs, route redirect/nav tests.

### Phase 02f: People, Referrals, And Affiliate Evidence Alignment

Scope:

- keep `/referrals` as affiliate dashboard;
- keep `/business/referrals/[referralCode]` as evidence detail;
- make People show referral/person/source motion without burying QR in Account.

Primary tests:

- BusinessWorkspace, ReferralsWorkspace, account menu, profile redirect tests.

### Phase 02g: Offers And Accepted Offer Lifecycle

Scope:

- enforce prices and public/private/draft/accepted/purchased state;
- introduce accepted-offer lifecycle read model without top-level nav;
- link accepted offers to People and Studio evidence.

Primary tests:

- Offers loader/component, People read model, Studio related refs.

### Phase 02h: Knowledge Base Surface

Scope:

- introduce owner/admin Knowledge Base read model;
- migrate Library/Training/Corpus donors into canonical surface;
- preserve role visibility.

Primary tests:

- content access, knowledge access, retrieval envelope, Knowledge Base loader.

### Phase 02i: System Sections And Backup/Restore Brief Parity

Scope:

- ensure System second column controls section selection;
- render linked page content for backups, restore plans, jobs, visibility,
  prompts, operations, keys;
- preserve admin-only diagnostics.

Primary tests:

- AdminSystemWorkspace, backup self-service, admin route role gates.

### Phase 02j: Brief Storage And Background Intelligence Closeout

Scope:

- wire any missing section briefs to durable request/result/reconcile semantics;
- enforce evidence manifests and visibility policy;
- add stale-surface scans.

Primary tests:

- brief entity, brief executor, reconciler, data mappers, section loader tests.

### Phase 02k: Public Surface Cleanup And Donor Route Redirects

Scope:

- route-level decisions for Blog, Journal, Library, Activity, Jobs,
  Operations, My Media;
- add redirects or explicit hidden/donor status where needed;
- final nav/static scan.

Primary tests:

- route pages, middleware/auth gates, shell nav, static scans.

### Phase 02l: UI Surface Realignment Closeout

Scope:

- end-to-end desktop/mobile QA across public, owner, account, admin;
- audit no fake intelligence;
- update route decision matrix and evidence docs.

Primary tests:

- focused unit/integration tests plus Playwright or browser screenshots for
  main routes.

## Positive Tests

- Each phase adds tests for the route/surface it changes.
- Shell nav remains stable after each phase.
- Owner surfaces keep chat-first and governance-layer semantics.
- Briefs are evidence-backed or limited with explicit limitations.
- Admin diagnostics stay role-gated.

## Negative Tests

- Donor routes do not leak back into primary nav.
- No implementation phase introduces fake metrics or sample production data.
- No selected object detail starts with global totals.
- No owner UI renders raw provider/job/log/payload internals.
- No private evidence leaks to public routes.

## Edge Tests

- Empty database/empty fixtures render limited states.
- Anonymous, owner, staff, and admin roles get different route availability.
- Mobile shell and list/detail behavior remains usable.
- Redirects preserve safe destination and do not loop.
- Background brief failure leaves prior brief intact.

## Acceptance Criteria

- The implementation sequence can be executed one phase at a time.
- Every phase has a bounded write scope and tests.
- Existing working surfaces are reused rather than rebuilt.
- Final state matches `refactor1.md` and the canonical UX contracts.

## Non-Goals

- No implementation in this spec package.
- No new business concepts outside the product kernel.
- No broad rewrite of routing or persistence.

## Required Commands

Each implementation phase should run its named tests plus:

```bash
npm run typecheck
npm run lint:css
npm run lint -- [all touched source/test files]
rg -n "My media|My conversations|My offers|My content|Activity|Operations|Factory|raw job|provider|payload|fake|sample|coming soon" src/app src/components src/lib docs/_business/ux docs/_refactor/ordo/phases
```

Closeout should additionally run the full focused surface set:

```bash
npx vitest run src/lib/shell/shell-navigation.test.ts src/components/SiteNav.test.tsx src/components/AuthenticatedWorkRail.test.tsx src/components/AccountMenu.test.tsx src/components/governance/GovernanceSectionFrame.test.tsx src/components/dashboard/UserDashboard.test.tsx src/components/studio/StudioWorkspace.test.tsx src/components/business/BusinessWorkspace.test.tsx src/components/offers/OfferSurfaces.test.tsx src/components/about/AboutSurfaces.test.tsx src/components/profile/ProfileSettingsPanel.test.tsx src/components/admin/system/AdminSystemWorkspace.test.tsx
```

## Closeout Evidence Required

- Updated route decision matrix.
- Phase-by-phase evidence log.
- Desktop and mobile screenshots for Home/Conversations, Today, Studio, People,
  Offers, About, Account, Referrals, System.
- Test output for all touched source.
- Static scan showing no donor/nav leaks, fake intelligence, private leaks, or
  raw diagnostics in owner/public UI.
