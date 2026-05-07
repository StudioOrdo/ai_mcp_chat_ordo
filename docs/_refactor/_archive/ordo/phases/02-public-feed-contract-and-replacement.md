# Phase 02: Public Feed Contract And Replacement

Status: Planned

Related specs:

- `../specs/02-public-feed-and-content-negotiation.md`

## Goal

Create `/feed` and feed format projections over current blog/journal donor code,
then remove blog/journal as public product concepts.

This phase follows Phase 01: the public shell is `Home`, `Feed`, `Offers`, and
`About`. There is no public library and no legacy user base requiring old
blog/journal route preservation.

## Current Code To Research

- `src/core/entities/blog.ts`
- `src/core/use-cases/BlogPostRepository.ts`
- `src/components/journal/PublicJournalPages.tsx`
- `src/app/journal/**`
- `src/app/blog/**`
- `tests/public-content-routes.test.ts`
- `src/lib/admin/attribution/admin-attribution.ts`

## Required Work

- Define `PublicFeedItem` projection over `BlogPost`.
- Add `/feed` route.
- Add `/feed.xml`, `/feed.json`, and `/feed/podcast.xml` stubs or initial
  implementations.
- Remove `/journal` and `/blog` from public navigation, sitemap priority,
  command discovery, and product copy if Phase 01 has not already done so.
- Delete or make non-public the old public routes once `/feed` covers their
  useful behavior.

## Tests

Positive:

- published post appears on feed.
- feed XML/JSON exclude drafts.
- empty feed is honest.

Negative:

- unpublished content never appears.
- private/internal corpus, knowledge, and asset entries are not included unless
  explicitly published as feed items.

Edge:

- post without hero image.
- post without published date.
- stale `/journal` or `/blog` links fail visibly or route through an intentional
  non-public replacement decision, not silent product compatibility.

## Cleanup

- Rename public-facing "journal" and "blog" copy toward `feed` or `public
  content` where behavior is generic.
- Leave internal/admin donor code only when a later phase still needs it.

## Exit Criteria

- `/feed` is canonical for new public content.
- Blog/journal are no longer canonical public routes.
