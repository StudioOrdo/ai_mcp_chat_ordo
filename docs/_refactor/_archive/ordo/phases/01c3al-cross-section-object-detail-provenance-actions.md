# Phase 01c3al: Cross-Section Object Detail, Provenance, And Actions

Status: Implemented

Parent phase:

- `01c3-authenticated-workspace-tool-rail.md`

Depends on:

- `01c3ae-shared-governance-section-framework.md`
- at least two migrated sections from `01c3af` through `01c3ak`
- `docs/_business/ux/09-canonical-ux-architecture.md`

Blocks:

- `01c3ao-canonical-ux-regression-closeout.md`

## Goal

Standardize selected object detail across Today, Studio, People, Offers,
Account, and System.

Every selected object should answer:

1. What is it?
2. Why does it matter?
3. What is the current state?
4. What should happen next?
5. What evidence/trail/provenance supports it?
6. What admin diagnostics exist, if authorized?

## Current Code Grounding

- `src/components/ordo-cards/OrdoCard.tsx`
- `src/lib/ordo-cards/ordo-card-projectors.ts`
- `src/core/entities/ordo-object.ts`
- `src/lib/ordo-details/**`
- `src/components/business/BusinessWorkspace.tsx`
- `src/components/studio/StudioWorkspace.tsx`
- `src/components/dashboard/UserDashboard.tsx`
- `src/components/offers/**`
- `src/app/admin/**`

Implementation grounding:

- `src/components/ordo-details/OrdoDetailLayout.tsx`
  - Renders the shared object detail header, badges, header facts, primary
    actions, source links, evidence links, lens sections, timeline, and related
    cards.
  - No longer renders legacy `diagnosticHref` directly. Admin diagnostics
    render only through the explicit `adminDiagnostic` model field.
- `src/lib/ordo-details/ordo-detail-types.ts`
  - Defines reusable detail badges, owner-safe detail links, and the admin
    diagnostic link contract.
- `src/lib/ordo-details/ordo-detail-projectors.ts`
  - Projects media, workflow, content, campaigns, referrals, people,
    conversations, offers, and System sections into the shared detail model.
  - Keeps raw job and operation hrefs out of owner-safe source/evidence links
    unless the caller explicitly marks admin diagnostics as authorized.
- `src/lib/ordo-details/load-studio-object-detail.ts`
  - Passes the current viewer's staff/admin diagnostic permission into Studio
    media and workflow details.
- `src/lib/offers/load-offers-workspace.ts`
  - Adds the shared offer detail read model to owner offer objects without
    replacing the existing offer UI in this pass.

## Required Work

Create shared detail primitives for:

- object detail header,
- facts row,
- status/visibility/stage badges,
- primary action bar,
- related/source links,
- provenance trail,
- relationship trail,
- performance summary,
- admin diagnostic link.

Implementation status:

- **Done.** `OrdoDetailLayout` now has shared primitives for badges, header
  facts, primary actions, source/evidence links, timeline rendering, lens
  sections, related cards, and explicit admin diagnostic links.
- **Done.** Offer and System section detail projectors were added.
- **Done.** Media and workflow details hide raw job detail cards from regular
  owner details and expose admin diagnostics only when the loader identifies a
  staff/admin viewer.

Rules:

- Provenance belongs to work, media, content, offers, and campaigns.
- Relationship Trail belongs to people, conversations, referrals, and deals.
- Performance belongs to content, offers, links, campaigns, and relationship
  motion.
- Admin diagnostics are visible only when authorized.
- One selected object owns the main pane.

## Tests

Positive:

- media detail links to source work/provenance.
- person detail links to relationship trail and conversation.
- offer detail links to source conversation/event and visibility.
- system detail links to admin diagnostics.

Negative:

- regular owner object detail does not expose raw provider logs or raw job ids
  as primary copy.
- unauthorized users cannot access admin diagnostic links.

Edge:

- object with missing provenance renders a limitation state.
- related object missing/unauthorized renders quiet unavailable copy.

## Non-Goals

- Do not implement every possible lens fully.
- Do not replace all OrdoCard projectors in one pass unless required.
- Do not invent new metrics.

## Closeout Evidence Required

- Shared detail component/read-model contract.
- Cross-section before/after examples.
- Access boundary tests.

Evidence:

- `docs/_refactor/ordo/evidence/phase-01c3al-cross-section-object-detail-provenance-actions.md`

## Implementation Notes

- Added `backup`, `restore_plan`, and `system` to the object-kind contract so
  System/backup objects can use the same object detail vocabulary as Studio,
  People, Offers, and Account.
- Added the `visibility` detail lens so offer/public-private governance can be
  represented without overloading performance or provenance.
- Extended `OrdoObjectDetailModel` with:
  - `badges`;
  - `headerFacts`;
  - `primaryActions`;
  - `sourceLinks`;
  - `provenanceLinks`;
  - `adminDiagnostic`.
- `OrdoDetailLayout` now renders the shared detail contract and sanitizes
  diagnostic source refs in facts and timelines.
- Media and workflow projectors keep `/jobs` links in durable refs for
  provenance continuity, but they do not render as normal owner links.
- Offer details now expose visibility, provenance/event trail, tracked-link
  performance when measured, and related QR/tracked links.
- System section details now expose admin diagnostics only when explicitly
  authorized by the caller.

## QA Status

QA pass 1 checks:

- `npx vitest run src/components/ordo-details/OrdoDetailLayout.test.tsx src/lib/ordo-details/ordo-detail-projectors.test.ts src/core/entities/ordo-object.test.ts src/lib/offers/load-offers-workspace.test.ts src/components/offers/OfferSurfaces.test.tsx`
- `npx vitest run src/lib/ordo-details/load-studio-object-detail.test.ts src/lib/ordo-details/load-business-object-detail.test.ts src/components/studio/StudioWorkspace.test.tsx src/components/business/BusinessWorkspace.test.tsx src/components/admin/system/AdminSystemWorkspace.test.tsx src/lib/dashboard/today-brief-read-model.test.ts src/components/ordo-cards/OrdoCard.test.tsx`
- `npm run typecheck`
- focused ESLint over touched files.
- static scans for direct `detail.diagnosticHref` rendering and owner-facing raw
  job/provider leakage.

QA pass 1 found and fixed:

- Layout test needed to account for the same owner-safe “Producing work” label
  appearing in both the evidence links and provenance lens.
- Workflow diagnostic expectation was stale after admin diagnostics were routed
  to the existing diagnostic jobs URL.
- Public offer source links originally deduped against the owner offer source;
  the public offer source ref now has a distinct source id.
- Studio loader tests needed the new diagnostic-permission argument.
- Focused lint found an unused helper; it was removed.

QA pass 2 repeated focused tests, typecheck, lint, and static scans after the
fixes. No additional implementation issues were found.
