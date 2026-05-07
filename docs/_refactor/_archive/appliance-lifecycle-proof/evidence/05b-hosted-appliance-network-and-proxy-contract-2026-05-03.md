# Phase 05B Evidence - Hosted Appliance Network And Proxy Contract

Date: 2026-05-03

## Scope

Phase 05B implemented the hosted reverse-proxy/public-origin contract for the
single Ordo appliance image.

## Contract Summary

- `compose.hosted.yaml` remains a one-service reverse-proxy template with
  `expose: "3000"` and no host `ports`.
- Hosted env contract is explicit:
  - `ORDO_HOSTED_MODE=reverse_proxy`
  - `ORDO_PUBLIC_ORIGIN=https://tenant.example.com`
  - `TRUST_PROXY_HEADERS=0`
  - `ALLOWED_ORIGINS=...`
- `src/lib/appliance/network/public-origin.ts` is the shared public-origin
  resolver.
- Referrals, root metadata, CSRF, and readiness consume the shared resolver.
- Hosted CSRF does not trust raw `Host`, `x-forwarded-host`, or
  `x-forwarded-proto` as canonical origin authority.
- Readiness includes a required `network` component and blocks hosted launch
  when the canonical public origin is missing, malformed, or non-HTTPS.

## Verification

Command:

```bash
npm test -- src/lib/appliance/network/public-origin.test.ts tests/csrf-origin-check.test.ts tests/health-probes.test.ts tests/health-routes.test.ts tests/hosted-network-contract.test.ts src/lib/referrals/referral-origin.test.ts src/app/layout.metadata.test.ts tests/env-centralization.test.ts src/lib/appliance/probes/appliance-probes.test.ts
```

Result:

```text
Test Files  9 passed (9)
Tests       56 passed (56)
```

Additional QA coverage added during closeout:

- malformed optional `ALLOWED_ORIGINS` entries do not disable the valid
  canonical hosted CSRF origin.

Command:

```bash
npm run typecheck
```

Result:

```text
tsc --noEmit completed successfully
```

Command:

```bash
npx eslint src/lib/appliance/network/public-origin.ts src/lib/appliance/network/public-origin.test.ts src/lib/appliance/probes/network-probe.ts tests/hosted-network-contract.test.ts src/lib/referrals/referral-origin.test.ts src/app/layout.metadata.test.ts
```

Result:

```text
completed successfully
```

Command:

```bash
npm test -- tests/referral-tracking.test.ts tests/seo-infrastructure.test.ts
```

Result:

```text
Test Files  2 passed (2)
Tests       66 passed (66)
```

Command:

```bash
docker compose -f compose.hosted.yaml config --services
```

Result:

```text
app
```

Regression command:

```bash
npm test -- tests/image-security-contract.test.ts tests/docker-runtime-contract.test.ts tests/docker-appliance-lifecycle.contract.test.ts tests/runtime-supervision-contract.test.ts
```

Result:

```text
Test Files  4 passed (4)
Tests       15 passed (15)
```

Combined compatibility/regression command:

```bash
npm test -- tests/image-security-contract.test.ts tests/docker-runtime-contract.test.ts tests/docker-appliance-lifecycle.contract.test.ts tests/runtime-supervision-contract.test.ts tests/referral-tracking.test.ts tests/seo-infrastructure.test.ts
```

Result:

```text
Test Files  6 passed (6)
Tests       81 passed (81)
```
