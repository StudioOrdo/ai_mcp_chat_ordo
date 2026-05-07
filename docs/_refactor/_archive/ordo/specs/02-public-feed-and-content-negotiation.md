# Spec 02: Public Feed And Content Negotiation

## Goal

Create `/feed` as the canonical public output stream. It should serve humans and
machines from the same public content model.

## Current Code To Use

- `src/core/entities/blog.ts` has post status and publishing fields.
- `src/core/use-cases/BlogPostRepository.ts` has `listPublished`,
  `findBySlug`, and admin operations.
- `src/components/journal/PublicJournalPages.tsx` renders current public
  journal pages.
- `src/app/journal/**` and `src/app/blog/**` are current public content routes.
- `tests/public-content-routes.test.ts` covers public metadata and SEO patterns.

## Required Work

- Add a `PublicFeedItem` projection over current `BlogPost` first.
- Add `/feed` HTML route.
- Add feed negotiation routes:
  - `/feed.xml`
  - `/feed.json`
  - `/feed/podcast.xml`
- Support initial kinds:
  - `article`
  - `audio_episode`
  - `short`
  - `release_note`
  - `field_note`
  - `case_study`
- Keep publish-by-default false. Only published content appears.
- Replace `/journal` and `/blog` as public product concepts. Because this is
  greenfield, delete or make the old public routes non-public once `/feed`
  covers their useful behavior.

## Cleanup After Replacement

- Remove `/journal` and `/blog` from navigation, sitemap priority, product copy,
  and command discovery once `/feed` is stable.
- Rename UI/admin copy from "blog" toward "feed" or "public content" where
  behavior is generic.

## Positive Tests

- Empty feed renders honest empty state.
- Published article appears on `/feed`, `/feed.xml`, and `/feed.json`.
- Draft/review/approved unpublished items do not appear.
- Canonical URLs use instance identity domain.

## Negative Tests

- Private/internal corpus, knowledge, and asset records never appear in public
  feed unless explicitly published as feed items.
- Feed routes do not require login.
- Invalid feed item kind is rejected before publish.

## Edge Tests

- Audio episode without audio enclosure appears as article/field note or remains
  unpublished.
- Feed handles zero hero image assets.
- Stale `/journal/[slug]` links fail visibly or are handled by an intentional
  route-deletion decision; do not preserve legacy behavior by default.
