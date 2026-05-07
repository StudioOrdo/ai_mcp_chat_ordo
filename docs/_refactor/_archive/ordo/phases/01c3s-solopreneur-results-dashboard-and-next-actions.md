# Phase 01c3s: Solopreneur Results Dashboard And Next Actions

Status: Implemented

Parent phase:

- `01c3-authenticated-workspace-tool-rail.md`

Depends on:

- `01c3p-people-customer-stage-and-funnel-cards.md`
- `01c3q-tracked-links-qr-and-attribution.md`
- `01c3r-content-campaign-performance-loop.md`
- `docs/_business/ux/08-product-kernel-contract.md`

Blocks:

- `01c3t-solopreneur-operating-loop-closeout.md`

## Goal

Make the dashboard answer the amateur business owner's real questions:

- Did my effort get results?
- What is not working?
- Who is helping me?
- Who needs follow-up?
- What should I ask Ordo to do next?

## Product Rule

The dashboard is not a metrics wall. It is a decision surface.

Chat is the operating interface. Today governs decisions and results.

The owner should not have to operate analytics, jobs, people, offers, and
content as separate tools to know what to do. Today should show the governed
evidence and provide safe paths back to chat, object detail, confirmation, or a
single next action.

Every dashboard item should lead to one of:

- approve,
- follow up,
- revise,
- publish,
- share,
- inspect,
- ask Ordo to continue.

## Kernel Alignment

This phase implements Today as the owner cockpit in the Product Kernel
Contract.

Kernel objects affected:

- Activity becomes attention and next action.
- Work becomes running/ready/blocked status.
- Person, Offer, Content, Link, Campaign, and Result become plain business
  evidence.
- Admin diagnostics stay out of the owner cockpit.

Implementation gates:

1. Reuse `UserDashboard`, `load-user-dashboard`, activity read models, referral
   analytics, and Ordo-card projectors before adding new dashboard state.
2. Translate jobs, notifications, activity receipts, referrals, offer status,
   content performance, and people stages into business language.
3. Never fabricate ROI, revenue, conversion, or recommendation evidence.
4. Advance New Owner, Studio Provenance, Content To Result, and Dashboard
   Decision scenario tests.
5. Collapse notification/job utilities into Today and object detail actions.
6. Treat mobile Today as the primary layout, not a smaller desktop dashboard.

## Current Code Grounding

- `src/components/dashboard/UserDashboard.tsx`
  - Current owner dashboard and card sections.
- `src/lib/dashboard/load-user-dashboard.ts`
  - Current dashboard read model based on activity and referrals.
- `src/lib/activity/activity-read-model.ts`
  - Activity/attention donor.
- `src/lib/ordo-cards/ordo-card-projectors.ts`
  - Object card donor.
- `src/components/AttentionInbox.tsx`
  - Current attention donor to fold into dashboard/rail counts.
- `src/lib/referrals/referral-analytics.ts`
  - Business-pulse donor.
- New donors from `01c3o` through `01c3r`:
  - offers,
  - people/customer stages,
  - tracked links,
  - content/campaign performance.

Naming bridge:

- Current route/code names are still `/workspace`, `UserDashboard`, and
  Dashboard.
- Product-facing navigation and copy should move toward Today once
  `01c3n` has consolidated the rail.
- Do not create a second dashboard route just to rename it. Rename labels and
  tests first; route migration should be explicit if it happens.

Schema QA:

- The current dashboard can read activity and referral evidence.
- Offer, tracked-link, people-stage, and campaign-performance evidence only
  becomes available after `01c3o` through `01c3r` land.
- Those backing read models now exist, so Today may show visits, chats, offer
  choices, simulated purchases, people follow-ups, content result cards, and
  weak signals.
- Today still must not mention revenue, ROI, or declare a winning campaign
  without durable purchase/result evidence.

## Target Dashboard Sections

### Do Today

Approval and follow-up queue:

- publish offer,
- approve content,
- follow up with interested person,
- retry failed production,
- review campaign that is not converting.

### Making Progress

Active system work:

- content generation,
- audio/video assembly,
- research,
- workflow runs,
- QA loops.

### Results

Plain business movement:

- QR scans,
- chats started,
- signups,
- offers chosen,
- simulated purchases,
- top-performing content,
- top affiliate/referral source.

### Not Working

Truthful weak signals:

- traffic with no chat,
- chats with no signup,
- offer views with no choice,
- content produced but never published,
- QR shared but no scans.

### Ask Ordo

Contextual commands:

- "Revise this offer."
- "Create another post like the winner."
- "Follow up with these people."
- "Make a QR code for this offer."
- "Explain why this campaign is not converting."

## Required Work

- Build a results-oriented dashboard read model.
- Convert attention/jobs/referrals/content/offers into business language.
- Add compact KPI cards tied to object details.
- Add next-action cards with provenance/evidence.
- Add "ask Ordo about this" action payloads.
- Keep metrics truthful when the system has little data.
- Make the mobile dashboard first-class.

## Implementation Notes

Implemented in code:

- `src/lib/dashboard/load-user-dashboard.ts`
  - Reuses the existing activity/referral dashboard sources.
  - Adds owner-scoped people, offer, and content campaign donors.
  - Builds truthful result metrics from referral overview,
    `tracked_link_events`, people stages, and `offer_events`.
  - Builds result cards, weak-signal cards, next-action cards, and Ask Ordo
    prompt payloads without adding another dashboard route.
- `src/components/dashboard/UserDashboard.tsx`
  - Reframes the existing `/workspace` dashboard as Today.
  - Presents the mobile-first order: Do Today, Making Progress, Ready To
    Inspect, Results, Not Working, Business Loop, Ask Ordo, and health.
  - Keeps chat as the operating path by adding Ask Ordo actions to cards and a
    contextual Ask Ordo section.
  - Avoids raw job ids, provider details, revenue, or ROI claims in owner copy.
- Existing cards/projectors remain the governance primitive:
  - people cards come from `projectPersonToOrdoCard`;
  - offer cards come from `projectOfferToOrdoCard`;
  - content/campaign/link cards come from 01c3r projectors;
  - activity cards still come from `projectActivityItemToOrdoCard`.

Deferred:

- Durable revenue/order events remain deferred.
- Private proposal grants remain deferred.
- Campaign/pillar authoring remains deferred.
- Media/campaign tracked-link validators remain deferred.
- The route remains `/workspace`; product labels use Today until a dedicated
  route migration phase decides otherwise.

## Positive Tests

- Dashboard shows pending approvals.
- Dashboard shows top content/tracked link result.
- Dashboard shows people needing follow-up.
- Dashboard shows an offer conversion stage summary.
- Dashboard action links to object detail or safe chat/action.

## Negative Tests

- Dashboard does not show raw job ids as primary copy.
- Dashboard does not invent ROI/revenue without events.
- Admin-only metrics are hidden from regular users.
- Destructive/publish actions require confirmation.

## Edge Tests

- New user with no data.
- User with only content and no people.
- User with only referrals and no offers.
- User with many weak signals.
- Offline/EventSource unavailable.

## Exit Criteria

- The owner can tell what worked, what did not, and what to do next.
- Dashboard language is business-first, not system-first.
- Every result or recommendation links back to evidence.

## QA Evidence

Evidence file:

- `docs/_refactor/ordo/evidence/phase-01c3s-solopreneur-results-dashboard-and-next-actions.md`
