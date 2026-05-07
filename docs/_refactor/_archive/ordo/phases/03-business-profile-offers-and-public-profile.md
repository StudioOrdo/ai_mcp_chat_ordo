# Phase 03: Business Profile, Offers, And Public Profile

Status: Planned

Related specs:

- `../specs/03-offers-and-business-profile.md`
- `../specs/10-agent-ready-business-views.md`

## Goal

Add `/offers` and a public-safe machine-readable business profile projection.

This phase assumes Phase 01 removed public library/journal concepts from the
public shell. Offers and feed are the only public business-output destinations.

## Current Code To Research

- `src/lib/config/defaults.ts`
- `src/lib/config/instance.ts`
- `src/lib/config/instance.schema.ts`
- `src/lib/config/ConfigurationService.ts`
- `src/app/about/page.tsx`
- `src/core/use-cases/tools/admin-prioritize-offer.tool.ts`

## Required Work

- Render `/offers` from existing services config.
- Define `BusinessProfile` read model from identity config.
- Add public JSON profile endpoint.
- Ensure no admin-only strategy leaks.
- Ensure the public profile does not expose corpus, private assets, internal
  workflow routes, or old library/journal route names.

## Tests

Positive:

- configured offering renders on `/offers`.
- no offerings produces empty state.
- public profile includes identity, feed, offers, public URLs.

Negative:

- no prompts, secrets, admin tools, or private settings in public profile.
- no corpus, private asset, old `/library`, old `/journal`, or old `/blog`
  route is advertised.
- invalid offering config is rejected.

Edge:

- booking disabled.
- missing optional logo/social URLs.

## Cleanup

- Consolidate hard-coded about/offers copy into config-backed helpers where
  practical.

## Exit Criteria

- Public humans and public agents read the same safe offer/profile facts.
