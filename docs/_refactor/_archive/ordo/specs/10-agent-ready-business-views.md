# Spec 10: Agent-Ready Business Views

## Goal

Prepare Ordo sites for humans and agents to see different governed views of the
same business.

## Current Code To Use

- `src/lib/access/content-access.ts` for audience gating.
- `src/core/capability-catalog/*` for public/private capability metadata.
- `src/lib/shell/shell-navigation.ts` for public route metadata.
- `src/lib/config/defaults.ts` and `src/lib/config/instance.ts` for identity.
- Operation kernel docs and code for action safety.

## Required Work

- Add public machine-readable site profile:
  - business identity,
  - public offers,
  - public feed links,
  - public-safe capabilities,
  - contact/request paths,
  - policy statements.
- Plan future A2A card/adapter as a protocol projection.
- Keep A2A out of core domain.
- Define trusted-agent boundary but do not expose private operations yet.

## Cleanup After Replacement

- Remove ad hoc public metadata endpoints if canonical profile covers them.
- Ensure public agent profile and human pages share business profile data.

## Positive Tests

- Public profile includes feed and offers.
- Public profile excludes admin/internal capabilities.
- Internal corpus, knowledge, assets, and old library route names are omitted
  from public profile.

## Negative Tests

- Public profile never exposes prompts, logs, keys, private memory, operations,
  or private workflow runs.
- Unknown agent request path returns safe unsupported response.

## Edge Tests

- No offers configured still returns valid profile.
- Feed empty still returns feed URL and no item list.
- Future A2A adapter can be added without changing core business objects.
