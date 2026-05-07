# Phase 05B - Hosted Appliance Network And Proxy Contract

Status: complete

## Goal

Prepare the single Ordo appliance image to run safely behind a reverse proxy
without implementing the Ordo Studio platform control plane yet.

The completed phase gives one containerized instance a governed network and
public-origin contract:

- local users can still run `docker compose up`
- hosted users can run the same image behind Traefik or another reverse proxy
- the app has one canonical browser-facing origin
- spoofed forwarding headers do not change security decisions or generated
  public URLs
- readiness explains hosted launch misconfiguration

This phase does not implement Traefik automation, tenant provisioning, billing,
or the future `ordostudio.com` instance manager.

## Implemented Contract

Phase 05B builds on completed Phase 05A:

- `compose.hosted.yaml`
  - still keeps one `app` service.
  - still uses `expose: "3000"` and no direct host `ports`.
  - now includes hosted network env:
    - `ORDO_HOSTED_MODE: ${ORDO_HOSTED_MODE:-reverse_proxy}`
    - `ORDO_PUBLIC_ORIGIN: ${ORDO_PUBLIC_ORIGIN:-}`
    - `TRUST_PROXY_HEADERS: ${TRUST_PROXY_HEADERS:-0}`
    - `ALLOWED_ORIGINS: ${ALLOWED_ORIGINS:-}`
- `src/lib/appliance/network/public-origin.ts`
  - owns public-origin resolution.
  - prefers `ORDO_PUBLIC_ORIGIN`.
  - preserves `PUBLIC_SITE_ORIGIN` and `NEXT_PUBLIC_SITE_ORIGIN` as
    compatibility aliases.
  - preserves local development fallback to `http://localhost:${PORT}`.
  - preserves production local fallback to `https://${instance.domain}`.
  - requires HTTPS when `ORDO_HOSTED_MODE=reverse_proxy`.
  - normalizes pathful origins to `.origin` with a warning.
  - dedupes `ALLOWED_ORIGINS`.
- `src/lib/security/origin-check.ts`
  - uses the shared public-origin contract.
  - preserves local host-based origin matching in local mode.
  - hosted mode accepts only canonical public origin plus explicit
    `ALLOWED_ORIGINS`.
  - does not trust `x-forwarded-host` or `x-forwarded-proto` as origin
    authority.
- `src/lib/referrals/referral-origin.ts`
  - delegates public referral URL generation to the shared resolver.
  - preserves its public API.
- `src/app/layout.tsx`
  - uses the shared resolver for `metadataBase` and Open Graph URL.
- `src/lib/config/env-config.ts`
  - validates the hosted network env keys.
- Appliance health/readiness
  - includes a required `network` health component.
  - blocks hosted readiness when public origin is missing, malformed, or not
    HTTPS.
  - keeps local mode non-blocking for optional public-origin issues.

## CSRF Rules

Local mode preserves existing development behavior:

- exact `Origin` match against `Host`
- exact `ALLOWED_ORIGINS` entries

Hosted `reverse_proxy` mode:

- exact `Origin` match against canonical public origin
- exact `Origin` match against explicit `ALLOWED_ORIGINS`
- no implicit acceptance based only on raw request `Host`
- no implicit acceptance based on `x-forwarded-host` or `x-forwarded-proto`
- absent `Origin` keeps current compatibility behavior; stricter no-origin
  mutation policy remains Phase 05D scope if needed

## Health Rules

- `network` is a required probe.
- Local mode:
  - invalid optional public origin reports degraded or warning-level
    diagnostics, not a local-development block.
- Hosted `reverse_proxy` mode:
  - missing public origin blocks readiness.
  - malformed public origin blocks readiness.
  - non-HTTPS public origin blocks readiness.
  - pathful public origin resolves to origin and emits a warning.

## Files Changed

- `compose.hosted.yaml`
- `README.md`
- `src/app/layout.tsx`
- `src/app/layout.metadata.test.ts`
- `src/lib/appliance/health-facade.ts`
- `src/lib/appliance/health-types.ts`
- `src/lib/appliance/network/public-origin.ts`
- `src/lib/appliance/network/public-origin.test.ts`
- `src/lib/appliance/probes/appliance-probes.test.ts`
- `src/lib/appliance/probes/network-probe.ts`
- `src/lib/config/env-config.ts`
- `src/lib/referrals/referral-origin.ts`
- `src/lib/referrals/referral-origin.test.ts`
- `src/lib/security/origin-check.ts`
- `tests/csrf-origin-check.test.ts`
- `tests/env-centralization.test.ts`
- `tests/health-probes.test.ts`
- `tests/health-routes.test.ts`
- `tests/hosted-network-contract.test.ts`
- `docs/_refactor/appliance-lifecycle-proof/evidence/05b-hosted-appliance-network-and-proxy-contract-2026-05-03.md`

## SOLID/Clean/GOF Notes

- Single Responsibility: public-origin resolution lives in one domain module;
  proxy, referrals, metadata, and health consume it.
- Adapter: reverse proxy headers stay in request/proxy adapters and never become
  global truth.
- Strategy: local direct-port mode and hosted reverse-proxy mode are explicit
  runtime strategies.
- Fail Fast: hosted mode with missing or invalid canonical origin is visible in
  readiness before users trust generated links.
- Open/Closed: future Traefik labels and platform routing can be added around
  the same public-origin contract without rewriting app security logic.

## Positive Use Cases

- One appliance instance runs behind Traefik with TLS terminated outside the app
  container.
- Hosted URLs, referral links, and metadata use `ORDO_PUBLIC_ORIGIN`.
- Direct local compose still works with `http://localhost:3000`.
- Health/readiness is reachable from inside the Docker network.
- Reverse proxy can route to service `app` on port `3000`.

## Negative Use Cases

- Spoofed `x-forwarded-host` cannot change generated public URLs.
- Spoofed `x-forwarded-host` cannot bypass CSRF in hosted mode.
- Hosted mode without `ORDO_PUBLIC_ORIGIN` is surfaced by readiness.
- Hosted mode with `http://` public origin is surfaced by readiness.
- Direct host ports remain absent in hosted compose.

## Edge Use Cases

- Tenant domain changes.
- `ORDO_PUBLIC_ORIGIN` includes a trailing slash or path.
- Localhost development without TLS.
- Reverse proxy sends partial or malformed forwarding headers.
- App is accessed directly by container IP while hosted mode is enabled.
- Existing installs still use `PUBLIC_SITE_ORIGIN`.

## Out Of Scope

- Live Traefik labels.
- `ordostudio.com` instance orchestration.
- Tenant provisioning.
- TLS certificate automation.
- Rate limiting and WAF behavior.
- Resource limits and failure posture; that remains Phase 05F.
- Secrets and first-boot install lock hardening; that remains Phase 05D.

## Exit Criteria Met

- `compose.hosted.yaml` exposes the hosted network env contract and still uses
  `expose`, not `ports`.
- A shared public-origin resolver exists.
- Referrals and metadata use the shared resolver.
- CSRF/origin checks use canonical hosted origin behavior without breaking local
  development.
- Readiness reports hosted missing/invalid public origin.
- Env validation includes the hosted network env keys.
- Appliance health includes a `network` component.
- Tests cover positive, negative, and edge cases for public-origin resolution,
  hosted CSRF behavior, referral URL generation, metadata origin,
  readiness/network health, env validation, and hosted compose env contract.
- No Traefik platform automation is implemented.

## QA Certification

Reviewed: 2026-05-03

Decision: implemented and verified.

Evidence:

- `../evidence/05b-hosted-appliance-network-and-proxy-contract-2026-05-03.md`
