# 02 UI Surface Realignment: Placeholder Read Model Policy

Status: Draft spec

## Goal

Define when placeholder read models are acceptable and how they must be labeled.
Placeholders must be honest, deterministic, replaceable, and impossible to
mistake for live intelligence.

## Current Code Grounding

Current anchors:

- `src/components/governance/GovernanceSectionFrame.tsx`
- `src/core/entities/brief.ts`
- `src/lib/briefs/brief-update-executor.ts`
- `src/lib/dashboard/today-brief-read-model.ts`
- `src/lib/offers/load-offers-workspace.ts`
- `src/lib/about/load-about-workspace.ts`
- `src/lib/admin/system/load-admin-system-workspace.ts`
- `src/lib/studio/load-studio-workspace.ts`
- `src/lib/business/load-business-workspace.ts`
- `src/components/referrals/ReferralsWorkspace.tsx`
- `docs/_business/ux/09-canonical-ux-architecture.md`

## Verified Current State

- `SectionBriefPanel` has a limited/empty brief pathway.
- `createDeterministicBriefDraft` creates a limited brief when no evidence is
  available.
- Public offers can use configured/static offer data.
- Referral workspace correctly says when affiliate access is not enabled.
- Some surfaces use metric cards that can look like live intelligence unless
  the copy explicitly says they are counts from durable evidence.

## Target Behavior

A placeholder read model is allowed only if all conditions are true:

1. It is deterministic.
2. It is generated from no private or fake live data.
3. It says what is missing.
4. It has a clear replacement path.
5. It does not create fake trends, revenue, conversion, performance, or ranking.
6. It does not change business state.
7. It is tested as a placeholder.

Required placeholder fields:

```ts
{
  status: "limited" | "empty" | "not_configured";
  title: string;
  summary: string;
  limitations: string[];
  recommendedAction?: { label: string; href: string; prompt?: string };
  replacementSource: string;
}
```

Copy rules:

- Use "No evidence yet", "Not configured", "No public content yet", or
  "Limited because..." copy.
- Avoid "performing", "trending", "qualified", "recommended", or "intelligent"
  unless evidence exists.

## Reuse / Move / Hide / Mock Decisions

- Reuse existing limited brief behavior for empty briefs.
- Reuse configured offers as public static offer data, but label their source in
  owner/admin surfaces.
- Hide placeholders from public nav if they would create a false promise.
- Mock route rows only as design fixtures in tests, never as production facts.

## Positive Tests

- Empty brief renders limitations.
- Placeholder read model has stable output for stable input.
- Placeholder recommended actions route to chat or a canonical setup surface.
- Public empty states avoid live-intelligence claims.
- Tests assert placeholder status values.

## Negative Tests

- Placeholders do not include random values, dates from `Date.now()` in client
  render, fake trends, fake revenue, fake counts, or fake users.
- Public placeholders do not imply private data exists.
- Owner placeholders do not expose admin/provider/job details.

## Edge Tests

- Null evidence renders limited/empty placeholder.
- Partial evidence renders only supported claims and limitations for missing
  sources.
- Admin placeholder can link to System diagnostics; owner placeholder cannot.
- A hidden donor route may render 404 instead of a placeholder if no product
  value exists.

## Acceptance Criteria

- Every placeholder is deliberately classified.
- Placeholder status is visible to tests.
- No placeholder is indistinguishable from live intelligence.
- Replacement path is documented next to each placeholder.

## Non-Goals

- No LLM-generated placeholder copy.
- No fake avatars, fake people, fake revenue, or fake performance data in
  production.
- No new data storage.

## Required Commands

```bash
npx vitest run src/components/governance/GovernanceSectionFrame.test.tsx src/lib/briefs/brief-update-executor.test.ts src/components/offers/OfferSurfaces.test.tsx src/components/about/AboutSurfaces.test.tsx src/components/referrals/ReferralsWorkspace.test.tsx
npm run typecheck
npm run lint -- src/components/governance/GovernanceSectionFrame.tsx src/lib/briefs/brief-update-executor.ts src/components/offers/OfferSurfaces.tsx src/components/about/AboutSurfaces.tsx src/components/referrals/ReferralsWorkspace.tsx
rg -n "fake|dummy|sample|placeholder|coming soon|trend|revenue|conversion|qualified" src/app src/components src/lib
```

## Closeout Evidence Required

- Placeholder inventory by surface.
- Tests proving deterministic empty/limited behavior.
- Static scan of fake/sample/live-intelligence terms.
- Screenshots of any user-visible placeholder states.
