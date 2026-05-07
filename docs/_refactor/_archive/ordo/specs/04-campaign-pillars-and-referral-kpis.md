# Spec 04: Campaign Pillars And Referral KPIs

## Goal

Promote QR/referral and content strategy into a simple campaign model that
connects public output to solopreneur business outcomes.

## Current Code To Use

- `src/lib/db/tables.ts` has `referrals` and `referral_events`.
- `src/app/referrals/**`, `src/app/r/[code]/**`, `src/app/api/referral/**`,
  and `src/app/api/qr/[code]/route.ts` implement referral/QR flows.
- `src/lib/referrals/campaign-presets.ts` has starter campaign plans.
- `src/lib/referrals/campaign-queue.ts` queues campaign coach cards.
- `src/lib/admin/attribution/admin-attribution.ts` links published journal
  posts to sourced conversations, leads, deals, and revenue.
- `src/core/entities/trust-distribution.ts` contains campaign refs.

## Required Work

- Define `Campaign` and `ContentPillar` contracts.
- Start with read/projection adapters over current referral and journal/blog
  donor attribution data, then project metrics to feed items.
- Track basic KPIs:
  - QR visits,
  - referral conversations,
  - account signups,
  - feed views,
  - audio downloads,
  - leads,
  - conversions.
- Keep QR affiliate/referral in core product scope.

## Cleanup After Replacement

- Replace transient campaign coach queue as durable campaign state where needed.
- Retire campaign presets that cannot be measured.

## Positive Tests

- Referral scan creates/refers event and can be attributed to a campaign.
- Published feed item can be associated with campaign/pillar.
- Admin KPI view reports counts without double-counting idempotent events.

## Negative Tests

- Anonymous visitors cannot see other users' campaign details.
- Duplicate referral event idempotency keys do not inflate metrics.
- Deleted/unpublished feed items do not count as active public output.

## Edge Tests

- Referral exists without registered user.
- Campaign exists before any feed item is published.
- Feed item has metrics but no referral attribution.
