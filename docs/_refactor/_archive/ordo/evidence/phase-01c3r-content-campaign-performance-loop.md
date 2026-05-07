# Phase 01c3r Evidence: Content Campaign Performance Loop

Status: Implemented

Evidence date: 2026-05-05

## Product Contract

Governing contract:

- `docs/_business/ux/08-product-kernel-contract.md`

Invariant:

- Chat is the operating interface.
- UI surfaces are the governance layer.

This phase keeps creation in chat/tool flows and uses Feed, Studio cards, and
detail lenses to govern what was published, shared, measured, and traced.

## Code Changes

Content and campaign read model:

- `src/core/entities/content-campaign.ts`
- `src/lib/content/content-campaign-read-model.ts`
- `src/lib/content/content-campaign-read-model.test.ts`

Tracked content links:

- `src/lib/tracked-links/tracked-link-service.ts`
- `src/lib/tracked-links/tracked-link-service.test.ts`
- `src/app/api/tracked-links/route.ts`
- `src/app/api/tracked-links/route.test.ts`

Public Feed:

- `src/app/feed/page.tsx`
- `src/app/feed/[slug]/page.tsx`
- `src/app/feed/[slug]/page.test.tsx`
- `tests/public-content-routes.test.ts`

Studio cards and details:

- `src/lib/ordo-cards/ordo-card-types.ts`
- `src/lib/ordo-cards/ordo-card-projectors.ts`
- `src/lib/ordo-cards/ordo-card-projectors.test.ts`
- `src/lib/ordo-cards/index.ts`
- `src/lib/ordo-details/ordo-detail-routes.ts`
- `src/lib/ordo-details/ordo-detail-projectors.ts`
- `src/lib/ordo-details/ordo-detail-projectors.test.ts`
- `src/lib/ordo-details/load-studio-object-detail.ts`
- `src/lib/ordo-details/load-studio-object-detail.test.ts`
- `src/lib/ordo-details/index.ts`
- `src/app/studio/content/[contentId]/page.tsx`
- `src/app/studio/content/[contentId]/page.test.tsx`
- `src/app/studio/campaigns/[campaignId]/page.tsx`
- `src/app/studio/campaigns/[campaignId]/page.test.tsx`
- `src/lib/studio/load-studio-workspace.ts`
- `src/lib/studio/load-studio-workspace.test.ts`
- `src/components/studio/StudioWorkspace.tsx`
- `src/components/studio/StudioWorkspace.test.tsx`

Contract metadata:

- `src/core/entities/ordo-object.ts`
- `docs/_refactor/ordo/phases/01c3r-content-campaign-performance-loop.md`
- `docs/_business/ux/architecture/06-studio-media-assets-and-content-production.md`
- `docs/_business/ux/architecture/12-capability-certification-and-complete-inventory.md`
- `docs/_business/ux/05-product-story-reuse-map.md`

## Behavior Implemented

- Published content appears in Feed.
- Draft content stays out of Feed.
- Feed item pages are public and buyer-facing only.
- Owner Studio includes content and campaign cards.
- Content detail shows Overview, Provenance, Performance, Related, and
  Activity lenses.
- Campaign detail groups content, public offers, and tracked links.
- Published content can receive dedicated tracked links/QR codes.
- Content link visits, chats, signups, choices, and simulated purchases roll up
  from durable `tracked_link_events`.
- No durable campaign table was added; the campaign is a read model.

## QA Pass 1

Issue found:

- `tracked_link_events.chat_started` test data referenced a conversation that
  had not been seeded, causing a foreign-key failure.

Fix:

- Seeded the durable conversation before appending the `chat_started` event in
  `src/lib/content/content-campaign-read-model.test.ts`.

Issue found:

- `projectContentCampaignToOrdoDetail` used `projectOfferToOrdoCard` through
  the card barrel, but the barrel did not export it.

Fix:

- Exported `projectOfferToOrdoCard` from `src/lib/ordo-cards/index.ts`.

Focused rerun:

- `npx vitest run src/lib/content/content-campaign-read-model.test.ts src/lib/ordo-details/ordo-detail-projectors.test.ts`
- `npx vitest run src/lib/content/content-campaign-read-model.test.ts src/lib/tracked-links/tracked-link-service.test.ts src/app/api/tracked-links/route.test.ts src/lib/ordo-cards/ordo-card-projectors.test.ts src/lib/ordo-details/ordo-detail-projectors.test.ts src/lib/ordo-details/load-studio-object-detail.test.ts src/lib/studio/load-studio-workspace.test.ts src/components/studio/StudioWorkspace.test.tsx tests/public-content-routes.test.ts 'src/app/feed/[slug]/page.test.tsx' 'src/app/studio/content/[contentId]/page.test.tsx' 'src/app/studio/campaigns/[campaignId]/page.test.tsx'`

Result:

- Passed. Full focused rerun covered 12 files and 79 tests.

Typecheck:

- `npm run typecheck`

Result:

- Passed.

Lint:

- `npm run lint`

Result:

- Initially failed on two phase-owned unused imports in
  `src/lib/content/content-campaign-read-model.ts`.
- After removing those imports, lint exited with no errors. The remaining
  warnings are pre-existing repository warnings outside this phase scope.

## QA Pass 2

Focused rerun:

- `npx vitest run src/lib/content/content-campaign-read-model.test.ts src/lib/tracked-links/tracked-link-service.test.ts src/app/api/tracked-links/route.test.ts src/lib/ordo-cards/ordo-card-projectors.test.ts src/lib/ordo-details/ordo-detail-projectors.test.ts src/lib/ordo-details/load-studio-object-detail.test.ts src/lib/studio/load-studio-workspace.test.ts src/components/studio/StudioWorkspace.test.tsx tests/public-content-routes.test.ts 'src/app/feed/[slug]/page.test.tsx' 'src/app/studio/content/[contentId]/page.test.tsx' 'src/app/studio/campaigns/[campaignId]/page.test.tsx'`

Result:

- Passed. Full focused rerun covered 12 files and 79 tests.

Typecheck:

- `npm run typecheck`

Result:

- Passed.

Stale surface scan:

- `rg -n "Feed is not yet connected|full public content read model|content performance and content/media/campaign-specific tracked-link|phase 01c3q offer/public-URL|No durable campaign/content-pillar table exists today|generic offer/public-URL link foundation|feed item model for article/audio/short variants" docs/_business/ux docs/_refactor/ordo/phases src`

Result:

- No matches.

Leak/product-drift scans:

- `rg -n -g '!*.test.*' -g '!*.spec.*' "provider_log|runtime_audit_log|metadata_json|inputSnapshot|resultEnvelope|providerModel|sourcePrompt|api[_-]?key|secret|job_events|job_event|raw provider|raw log|raw payload|raw job" src/lib/content src/app/feed 'src/app/studio/content' 'src/app/studio/campaigns' src/lib/ordo-details/ordo-detail-projectors.ts src/lib/ordo-details/load-studio-object-detail.ts`
- `rg -n -g '!*.test.*' -g '!*.spec.*' "provider_log|runtime_audit_log|metadata_json|inputSnapshot|resultEnvelope|providerModel|sourcePrompt|api[_-]?key|secret|raw provider|raw log|raw payload|raw job" src/lib/ordo-cards/ordo-card-projectors.ts src/components/studio src/lib/studio/load-studio-workspace.ts src/app/studio/page.tsx`

Result:

- New content/feed/campaign surfaces do not expose raw provider payloads,
  secrets, source prompts, private metrics, or raw logs.
- The broad shared-card scan still finds pre-existing generic job/result and
  provider-log source mapping code in `src/lib/ordo-cards/ordo-card-projectors.ts`.
  That code maps diagnostic-only provider/runtime activity away from regular
  cards and was not introduced by this phase.

QA pass 2 fixes:

- None required after the focused rerun, typecheck, and scans.
