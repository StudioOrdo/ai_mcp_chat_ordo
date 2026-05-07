# Phase 01c3l Evidence: HITL Dashboard And CEO Command Loop

Generated: 2026-05-05

## Result

Status: Implemented

The owner dashboard remains `/workspace`, but its product role is now explicit:
chat is the operating interface and the dashboard is the governance queue for
chat-driven work.

## Code Grounding

- `src/components/dashboard/UserDashboard.tsx`
  - Renders the owner dashboard sections.
  - Projects durable `ActivityItem` records through shared `OrdoCard` models.
  - Adds a dashboard-level `Ask Ordo` secondary action to every rendered card.
  - Preserves existing conversation context when a projected activity already
    has a conversation link.
  - Caps secondary actions to the shared card-contract limit of three.
- `src/lib/dashboard/load-user-dashboard.ts`
  - Loads needs-attention, running, produced, and business-loop activity.
  - Filters produced output to projectable work/media/operation activity.
  - Keeps activity-read failures in a limited owner-safe system-health state.
- `src/components/ordo-cards/OrdoCard.tsx`
  - Renders object cards with one primary action and secondary actions.
- `src/lib/ordo-cards/ordo-card-projectors.ts`
  - Maps activity buckets to card buckets:
    `needs_attention`, `in_motion`, `produced`, `business_loop`.
- `docs/_business/ux/08-product-kernel-contract.md`
  - Governing product contract for this implementation.

## Implementation

- Changed the dashboard hero eyebrow to `Today`.
- Reframed dashboard summary copy as a governance queue for chat-driven work.
- Added a dashboard projection helper that converts source-level conversation
  actions into a product-level `Ask Ordo` action.
- Preserved referral milestone behavior:
  - primary action opens `/business`,
  - referral diagnostic remains secondary evidence,
  - `Ask Ordo` remains available when conversation context exists.
- Added focused component tests proving:
  - all four dashboard object buckets render,
  - every card has `Ask Ordo`,
  - `Ask Ordo` preserves conversation context,
  - raw `Open conversation` is not the dashboard-facing command label,
  - raw job ids and provider/runtime logs do not appear in dashboard copy.
- Fixed the product-kernel heading order so the navigation contract is not
  nested under the interface/governance section.

## QA Pass 1

Result: Passed after one command-scope correction.

Commands:

```bash
npm run test -- src/components/dashboard/UserDashboard.test.tsx src/lib/dashboard/load-user-dashboard.test.ts
```

Result: passed, 2 files, 9 tests.

```bash
npm run test -- src/components/ordo-cards/OrdoCard.test.tsx src/lib/ordo-cards/ordo-card-projectors.test.ts
```

Result: passed, 2 files, 18 tests.

```bash
npm run typecheck -- --pretty false
```

Result: passed.

```bash
npm run lint -- src/components/dashboard/UserDashboard.tsx src/components/dashboard/UserDashboard.test.tsx src/components/ordo-cards/OrdoCard.tsx docs/_business/ux/08-product-kernel-contract.md
```

Result: exited successfully, but ESLint warned that the markdown contract file
is ignored because no markdown lint configuration is supplied.

Fix:

```bash
npm run lint -- --max-warnings 0 src/components/dashboard/UserDashboard.tsx src/components/dashboard/UserDashboard.test.tsx src/components/ordo-cards/OrdoCard.tsx
```

Result: passed.

## QA Pass 2

Result: Passed.

Commands:

```bash
npm run test -- src/components/dashboard/UserDashboard.test.tsx src/lib/dashboard/load-user-dashboard.test.ts src/components/ordo-cards/OrdoCard.test.tsx src/lib/ordo-cards/ordo-card-projectors.test.ts
```

Result: passed, 4 files, 27 tests.

```bash
npm run test -- tests/core-policy.test.ts tests/job-visibility-solid.test.ts
```

Result: passed, 2 files, 24 tests.

```bash
npm run typecheck -- --pretty false
```

Result: passed.

```bash
npm run lint -- --max-warnings 0 src/components/dashboard/UserDashboard.tsx src/components/dashboard/UserDashboard.test.tsx src/components/ordo-cards/OrdoCard.tsx
```

Result: passed.

Static scans:

```bash
rg -n "runtime audit|provider log|raw log|inputSnapshot|opened in the detail panel|Open conversation|Your Jobs|My Jobs|My Media|Referrals" src/components/dashboard src/lib/dashboard src/components/ordo-cards --glob '!*.test.ts' --glob '!*.test.tsx'
```

Result: no matches.

```bash
rg -n "job_[A-Za-z0-9_:-]+|asset_[A-Za-z0-9_:-]+|provider|runtime|log" src/components/dashboard src/lib/dashboard --glob '!*.test.ts' --glob '!*.test.tsx'
```

Result: no matches.

```bash
rg -n "fake|placeholder|dummy|sample|TODO|Math\\.random|random" src/components/dashboard src/lib/dashboard src/components/ordo-cards --glob '!*.test.ts' --glob '!*.test.tsx'
```

Result: no matches.

```bash
rg -n "Ask Ordo|Today|governance queue|Navigation Contract|Interface And Governance Contract" docs/_refactor/ordo/phases/01c3l-hitl-dashboard-and-ceo-command-loop.md docs/_business/ux/08-product-kernel-contract.md docs/_refactor/ordo/evidence/phase-01c3l-hitl-dashboard-and-ceo-command-loop.md
```

Result: expected documentation hits only.

QA result: no fake metrics, ungrounded claims, private leaks, or raw
job/log/provider details found in regular owner dashboard production code.
