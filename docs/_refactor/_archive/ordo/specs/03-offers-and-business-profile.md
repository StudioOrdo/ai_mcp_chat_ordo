# Spec 03: Offers And Business Profile

## Goal

Create `/offers` and a canonical public business profile projection. Offers are
the visitor-facing "what can happen next" surface.

## Current Code To Use

- `src/lib/config/defaults.ts` defines `InstanceIdentity`,
  `InstanceServices`, and `ServiceOffering`.
- `src/lib/config/instance.ts` loads identity and services JSON.
- `src/lib/config/ConfigurationService.ts` resolves env and SQLite-backed
  settings.
- `src/core/use-cases/tools/admin-prioritize-offer.tool.ts` already reasons
  over offer opportunities.
- `src/core/entities/operator-transition.ts` has `OperatorOfferRef`.
- `src/app/about/page.tsx` already uses identity/story copy.

## Required Work

- Add `/offers` route backed by current services config.
- Add `BusinessProfile` read model from identity config.
- Add a public JSON projection for business profile and offers.
- Keep copy simple, concrete, and non-pushy.
- Define eventual migration path from config-only offerings to admin-managed
  SQLite offers if needed.

## Cleanup After Replacement

- Remove hard-coded offer copy from public pages once config-backed offers exist.
- Consolidate offer wording between `/offers`, anonymous chat, admin offer
  prioritization, and agent-readable public profile.

## Positive Tests

- `/offers` renders configured offerings.
- Empty offerings render a no-offers-yet state.
- Public JSON projection includes only public-safe fields.

## Negative Tests

- Admin-only pricing notes, routing risk, lead triage, and internal strategy do
  not appear in public offer JSON.
- Invalid service config fails validation through existing config schema.

## Edge Tests

- Booking disabled hides booking CTA.
- Missing optional URLs do not render broken links.
- Offer lane `both`, `organization`, and `individual` all render correctly.

