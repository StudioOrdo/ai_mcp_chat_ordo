# Phase 01c3r: Content Campaign Performance Loop

Status: Implemented

Parent phase:

- `01c3-authenticated-workspace-tool-rail.md`

Depends on:

- `01c3q-tracked-links-qr-and-attribution.md`
- `docs/_business/ux/08-product-kernel-contract.md`

Blocks:

- `02-public-feed-contract-and-replacement.md`
- `05-campaign-pillars-and-kpi-loop.md`
- `07-content-campaign-workflow-text-audio.md`

## Goal

Connect content creation to business results.

The solopreneur should be able to see whether articles, audio, shorts, images,
QR codes, and offers are creating conversations, signups, offer choices, and
simulated purchases.

## Product Rule

Content is not finished when generated. Content is finished when it is
published, shareable, and measurable.

Chat is the operating interface. Studio and campaign UI govern production,
publication, provenance, and results.

The owner should be able to ask Ordo to research, draft, revise, QA, publish,
or repurpose content in conversation. The UI should prove the state of that
work: what was made, what review happened, what is public or private, what link
was shared, and what business motion followed.

The Studio produces assets. The business loop measures whether those assets
helped.

## Kernel Alignment

This phase implements the Content, Media, Campaign, Link, and Result portions
of the Product Kernel Contract.

Kernel objects affected:

- Content and Media are produced in Studio.
- Campaign groups related content, offers, and tracked links.
- Link measures sharing and attribution.
- Result turns visits, chats, signups, offer choices, and simulated purchases
  into owner-readable evidence.

Implementation gates:

1. Reuse Studio, asset catalog, media workflow, blog, journal, feed, and
   Ordo-card projectors before adding new content surfaces.
2. Apply existing content audience rules to public and private content.
3. Preserve provenance from source work to published content and media.
4. Advance Content To Result, Studio Provenance, and Dashboard Decision
   scenario tests.
5. Keep draft/private content out of public Feed.
6. Prefer one campaign/read-model surface over separate analytics pages for
   each media type.

## Current Code Grounding

### Studio And Asset Donors

- `src/components/studio/StudioWorkspace.tsx`
  - Current produced-work index.
- `src/core/platform/asset-catalog/AssetCatalogReader.ts`
  - Merges `user_files`, `materialization_records`, and `blog_assets`.
- `src/lib/ordo-cards/ordo-card-projectors.ts`
  - Projects asset catalog entries, jobs, media workflows, and operation cards.
- `src/app/studio/media/[assetId]/page.tsx`
  - Existing media detail route.
- `src/app/studio/workflows/[workflowId]/page.tsx`
  - Existing workflow detail route.

### Public Content Donors

- `src/app/feed/page.tsx`
  - Current public feed placeholder/surface.
- `src/app/blog/**`
  - Blog donor routes.
- `src/app/journal/**`
  - Journal donor routes.
- `blog_posts`, `blog_assets`, `blog_post_artifacts`
  - Durable content donors.

### Performance Donors

- `src/lib/referrals/referral-analytics.ts`
  - Referral outcomes and timeseries.
- `tracked_links` and `tracked_link_events`
  - Planned by `01c3q`.

### Campaign Donors

- `src/lib/referrals/campaign-presets.ts`
  - Existing code-side campaign presets for referral growth guidance.
- `src/lib/referrals/campaign-queue.ts`
  - Pending campaign coach payload queue.
- `src/app/api/campaign/context/route.ts`
  - Drains pending campaign coach context for the authenticated user.
- `src/core/entities/campaign.ts`
  - Current campaign variants are coach/referral oriented, not durable campaign
    performance objects.

Schema QA:

- This phase intentionally did not add durable campaign/content-pillar tables.
- Campaign performance is implemented as a read model over `blog_posts`,
  `blog_assets`, `blog_post_artifacts`, `offers`, `tracked_links`, and
  `tracked_link_events`, not as a fabricated analytics object.

## Target Concepts

Content objects:

- article,
- audio episode,
- short video,
- image/chart/graph,
- feed item,
- campaign asset.

Campaign objects:

- campaign/pillar,
- goal,
- related offer,
- related content,
- tracked links,
- results.

Performance:

- views/visits,
- QR scans,
- chats started,
- signups,
- offer choices,
- simulated purchases,
- top referrers/affiliates.

## Required Work

- Define durable content/publication state if existing blog/feed records cannot
  support it cleanly.
- Project published content into Ordo cards with performance metrics.
- Attach tracked links to published content.
- Group related content and offers under campaign/pillar objects.
- Add performance lenses to content and campaign details.
- Keep raw jobs/provenance available but secondary.
- Preserve public feed as the canonical public distribution surface.
- Use the existing content audience model for private/public content before
  creating another visibility system.

## Implementation Notes

Implemented in code:

- `src/lib/content/content-campaign-read-model.ts`
  - Builds owner-scoped content items and a default `content-performance`
    campaign from existing blog/content, offer, and tracked-link records.
  - Builds the public Feed read model from published `blog_posts` only.
  - Aggregates measured tracked-link events; zeroes are shown only when a
    real object exists with no events.
- `src/lib/tracked-links/tracked-link-service.ts`
  - Adds `createForContentItem`.
  - Allows public tracked links only for owner-scoped published content.
  - Continues to reject draft/private/internal routes.
- `src/app/api/tracked-links/route.ts`
  - Supports `targetKind: "content_item"`.
- `src/app/feed/page.tsx` and `src/app/feed/[slug]/page.tsx`
  - Feed now renders published content items and honest empty state.
  - Feed item detail remains public-only and does not expose provenance,
    provider payloads, jobs, or owner metrics.
- `src/lib/ordo-cards/ordo-card-projectors.ts`
  - Adds content and campaign cards.
  - Content cards show at most four metrics: links, visits, chats, signups.
  - Campaign cards group content, public offers, and tracked links.
- `src/lib/ordo-details/load-studio-object-detail.ts` and
  `src/lib/ordo-details/ordo-detail-projectors.ts`
  - Adds owner-scoped content and campaign detail routes/lenses.
  - Provenance exposes durable source references without raw payloads.
- `src/lib/studio/load-studio-workspace.ts` and
  `src/components/studio/StudioWorkspace.tsx`
  - Studio now includes content and campaign objects alongside media,
    workflow runs, and diagnostics.

Deferred:

- Durable campaign/pillar tables remain intentionally deferred.
- Private content sharing remains deferred to the private visibility/share
  phases.
- Media/campaign tracked-link validators remain deferred; this phase only adds
  dedicated published-content validators beyond public offers and public URLs.

## Positive Tests

- Published content card shows tracked link performance.
- Content detail shows provenance and performance lenses.
- Campaign groups multiple assets and an offer.
- Public feed item can be traced to source workflow/job.
- QR scan for content attributes to content and campaign.

## Negative Tests

- Draft content does not appear publicly.
- Private media asset cannot be tracked publicly.
- Performance metrics are not fabricated when no events exist.
- Regular user cannot view another user's campaign metrics.

## Edge Tests

- Content with no tracked link.
- Multiple tracked links for one content item.
- Content generated outside a workflow.
- Deleted/archived asset with retained performance history.
- Feed disabled/no public content.

## Exit Criteria

- Content, offer, QR, and people stages form one measurable loop.
- Studio work can be inspected from creation through publication and results.
- The owner can tell which effort is helping the business.

## QA Evidence

Evidence file:

- `docs/_refactor/ordo/evidence/phase-01c3r-content-campaign-performance-loop.md`
