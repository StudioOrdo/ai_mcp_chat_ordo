# Phase 10: Agent-Ready Business Views

Status: Planned

Related specs:

- `../specs/10-agent-ready-business-views.md`

## Goal

Expose safe machine-readable public views of the same business without exposing
private operations or tools.

## Current Code To Research

- `src/lib/access/content-access.ts`
- `src/core/capability-catalog/*`
- `src/lib/shell/shell-navigation.ts`
- `src/lib/config/instance.ts`
- public feed/offers/profile implementations from prior phases.

## Required Work

- Add `/.well-known/ordo.json` or equivalent public profile.
- Add public-safe capability and request path projection.
- Document future A2A adapter boundary.
- Keep A2A as edge protocol, not core domain.

## Tests

Positive:

- profile includes public feed/offers/capabilities.
- internal corpus, knowledge, and asset catalogs are omitted.

Negative:

- private operations, prompts, logs, keys, and admin tools excluded.
- old public `/library`, `/journal`, and `/blog` routes are not advertised.

Edge:

- empty feed/offers still valid.
- unknown protocol path safe-fails.

## Cleanup

- Remove duplicate public metadata endpoints where canonical profile replaces
  them.

## Exit Criteria

- Ordo site has a public agent-readable business profile.
