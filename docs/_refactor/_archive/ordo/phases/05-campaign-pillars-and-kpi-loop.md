# Phase 05: Campaign Pillars And KPI Loop

Status: Planned

Related specs:

- `../specs/04-campaign-pillars-and-referral-kpis.md`

## Goal

Connect public content and referral QR flows into a minimal campaign/pillar/KPI
model.

## Current Code To Research

- `src/lib/db/tables.ts` referral tables.
- `src/app/referrals/**`
- `src/app/r/[code]/**`
- `src/app/api/referral/**`
- `src/app/api/qr/[code]/route.ts`
- `src/lib/referrals/campaign-presets.ts`
- `src/lib/admin/attribution/admin-attribution.ts`

## Required Work

- Define campaign and content pillar contracts.
- Add projection over existing referrals and attribution.
- Add basic KPI read model.
- Associate feed items with campaign/pillar where available.

## Tests

Positive:

- referral visit increments KPI once.
- feed item attribution can be read by admin.

Negative:

- duplicate referral event does not double-count.
- private campaign details are not public.

Edge:

- campaign without feed item.
- feed item without campaign.
- referral without registered user.

## Cleanup

- Do not replace campaign presets until durable campaign records exist.

## Exit Criteria

- Core QR/referral loop is measurable against public output.

