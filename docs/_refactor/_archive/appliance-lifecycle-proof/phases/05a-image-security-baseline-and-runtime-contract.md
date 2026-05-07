# Phase 05A - Image Security Baseline And Runtime Contract

Status: complete

## Goal

Define and enforce the production appliance image security baseline.

This phase makes the current single-image runtime explicit, testable, and safe
to put behind a reverse proxy without requiring operators to remember security
flags.

Scope is intentionally limited to the image and container runtime contract. Do
not implement Traefik orchestration, tenant provisioning, billing, or platform
control-plane behavior here.

## Current Code Grounding

Ground this phase in:

- `Dockerfile`
  - builds one app image from `node:22.22.2-alpine`.
  - installs `ffmpeg`.
  - copies `.next`, `node_modules`, `public`, `docs`, `release`, `config`,
    `scripts`, `mcp`, `src`, and Rust `bin/ordo-backup`.
  - runs as non-root `nextjs`.
  - exposes port `3000`.
  - declares `/app/.data` as the durable volume.
  - does not define a Dockerfile-level `HEALTHCHECK`; compose owns the current
    healthcheck.
- `compose.yaml`
  - now has one `app` service.
  - builds the same `Dockerfile` with `ORDO_NODE_VERSION`.
  - uses `read_only: true`.
  - uses `security_opt: no-new-privileges:true`.
  - uses `cap_drop: ALL`.
  - mounts `./.data:/app/.data`.
  - uses tmpfs for `/tmp`, `/app/.runtime-logs`, and `/app/.next/cache`.
  - still publishes `3000:3000`, which is correct for local compose but not
    the hosted Traefik path.
  - has no `privileged`, `network_mode: host`, `pid: host`, `ipc: host`,
    `devices`, `extra_hosts`, or Docker socket mount.
  - has no explicit tmpfs size/noexec/nosuid/nodev options yet.
  - has no `pids_limit`, memory limits, CPU limits, or log rotation yet; those
    belong primarily to 05F.
- `scripts/start-server.mjs`
  - owns single-writer process lock.
  - supervises deferred jobs, media worker, Rust backup executor, and scheduler.
  - expects `DATA_DIR` to be writable.
- Existing tests
  - `tests/docker-runtime-contract.test.ts` already asserts the one-service
    compose wrapper, durable `/app/.data`, `ffmpeg`, Rust executor packaging,
    and no default media sidecar.
  - `tests/docker-appliance-lifecycle.contract.test.ts` asserts no
    `Dockerfile.media`, no `media-worker` service, no `MEDIA_WORKER_URL`, and
    no `depends_on`.
  - `tests/runtime-supervision-contract.test.ts` asserts compose remains on the
    single-image path.
  - `tests/image-security-contract.test.ts` now asserts hosted compose,
    allowed writable paths, forbidden privilege knobs, and direct port absence
    in hosted mode.
- Phase 05 evidence:
  - local smoke proof exists.
  - Docker image build proof is still blocked by local host disk pressure.

## QA Findings Closed

The implementation closed these concrete gaps:

1. Hosted compose template.
   - Local compose correctly publishes `3000:3000`.
   - Hosted reverse-proxy mode now uses `expose: ["3000"]` and no `ports`.
2. Full hardening contract.
   - Tests now cover forbidden fields: `privileged`, host namespaces,
     `extra_hosts`, device mounts, Docker socket mounts, extra capabilities,
     and sidecars.
3. Writable path allowlist.
   - Tests now assert the exact allowed `volumes` and `tmpfs` entries for local
     and hosted compose.
4. Runtime user assertion.
   - Tests now assert `Dockerfile` keeps `USER nextjs`.
5. Resource limits remain out of scope.
   - Memory, CPU, pids, log rotation, and tmpfs sizing are important, but they
     remain Phase 05F scope.

## Implemented Contract

Phase 05A created a formal image security contract with tests that fail if the
appliance regresses.

The implemented contract is:

- one app image
- one app service by default
- non-root runtime user
- read-only root filesystem in compose
- no Linux capabilities
- no privilege escalation
- writable paths are only:
  - `/app/.data`
  - `/tmp`
  - `/app/.runtime-logs`
  - `/app/.next/cache`
- hosted mode does not publish host ports directly
- local mode may publish `3000:3000`
- no required sidecars
- no required external database, queue, search, cron, object storage, or backup
  service

Implemented files:

```text
compose.hosted.yaml
tests/image-security-contract.test.ts
README.md
docs/_refactor/appliance-lifecycle-proof/evidence/05a-image-security-baseline-2026-05-03.md
```

`compose.hosted.yaml` is a hardened template for one instance behind a reverse
proxy:

- `expose: ["3000"]`
- no `ports`
- same security flags as local compose
- same durable `/app/.data` mount
- no live Traefik labels
- no coupling to live `ordostudio.com` routing

Current hosted compose security shape:

```yaml
services:
  app:
    image: kaw393939/studioordo:latest
    build:
      context: .
      dockerfile: Dockerfile
      args:
        NODE_VERSION: ${ORDO_NODE_VERSION:-22.22.2}
    restart: unless-stopped
    stop_grace_period: 15s
    read_only: true
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    tmpfs:
      - /tmp
      - /app/.runtime-logs
      - /app/.next/cache
    volumes:
      - ${ORDO_DATA_DIR:-./.data}:/app/.data
      - ${ORDO_CONFIG_DIR:-./config}:/app/config:ro
    expose:
      - "3000"
    environment:
      NODE_ENV: production
      PORT: 3000
      HOSTNAME: "0.0.0.0"
      DATA_DIR: /app/.data
      STUDIO_ORDO_DB_PATH: /app/.data/local.db
```

The hosted template intentionally duplicates the local environment block rather
than using YAML anchors. The goal is operator readability for non-expert
solopreneur deployments.

## Implementation Completed

1. Added `compose.hosted.yaml`.
   - Copied the single app service shape from `compose.yaml`.
   - Replaced `ports` with `expose`.
   - Used `${ORDO_DATA_DIR:-./.data}` and `${ORDO_CONFIG_DIR:-./config}` so a
     future platform can mount per-instance paths.
   - Kept security flags identical to local compose.
2. Added `tests/image-security-contract.test.ts`.
   - Reads `Dockerfile`, `compose.yaml`, and `compose.hosted.yaml`.
   - Asserts `Dockerfile` uses `USER nextjs`, `EXPOSE 3000`, and
     `VOLUME ["/app/.data"]`.
   - Asserts both compose templates have one `app` service and no sidecars.
   - Asserts both compose templates include `read_only: true`,
     `no-new-privileges:true`, and `cap_drop: ALL`.
   - Asserts both compose templates include only approved writable paths:
     `/app/.data`, `/tmp`, `/app/.runtime-logs`, `/app/.next/cache`, and
     read-only `/app/config`.
   - Asserts hosted compose has `expose: "3000"` and does not have `ports`.
   - Asserts local compose has `ports: "3000:3000"`.
   - Asserts forbidden fields are absent: `privileged`, `network_mode: host`,
     `pid: host`, `ipc: host`, `devices`, `extra_hosts`,
     `/var/run/docker.sock`, `cap_add`, default sidecars, and `depends_on`.
3. Updated the README Docker section.
   - Local compose remains simple.
   - Hosted reverse-proxy deployments point at `compose.hosted.yaml`.
   - Direct port publication is documented as local-only.
4. Recorded evidence.
   - Evidence lives at
     `../evidence/05a-image-security-baseline-2026-05-03.md`.
   - Evidence does not include secrets, env dumps, or host-private absolute
     paths.

## SOLID/Clean/GOF Notes

- Single Responsibility: this phase defines runtime safety, not platform
  provisioning.
- Contract Test: Docker and compose security posture is enforced as a stable
  contract.
- Open/Closed: hosted compose can extend local compose behavior without
  weakening local development.

## Positive Use Cases

- Local compose remains easy: `docker compose up`.
- Hosted compose exposes only internal port `3000` to a reverse proxy network.
- Container starts as non-root with the same app image.
- Backups, SQLite, and uploaded files stay inside `/app/.data`.

## Negative Use Cases

- Reintroducing a sidecar fails tests.
- Reintroducing `privileged: true` fails tests.
- Reintroducing capabilities fails tests.
- Publishing direct host ports in hosted compose fails tests.
- Adding writable root paths outside the allowed list fails tests.

## Edge Use Cases

- A future Next.js runtime cache path needs writes.
- `ffmpeg` needs `/tmp` for media work.
- Hosted operator wants direct port publication for debugging.
- Docker is unavailable in CI.
- Compose field ordering changes but semantic contract remains the same.
- Hosted platform later injects Traefik labels.

## Out Of Scope

- Traefik automation or live `ordostudio.com` routing.
- Tenant lifecycle/provisioning.
- Billing or waitlist behavior.
- SBOM/signing/scanning; that is 05E.
- CPU/memory/pids/log limit tuning; that is 05F.
- Removing `src`, `scripts`, or `mcp` from the image; that is 05C.

## Exit Criteria Met

- Local and hosted compose contracts exist and are documented.
- Tests assert non-root, read-only, no capabilities, no privilege escalation,
  one-service runtime, and allowed writable paths.
- Hosted compose uses `expose`, not `ports`.
- `npm test -- tests/image-security-contract.test.ts` passes.
- Existing Docker contract tests still pass:
  - `npm test -- tests/docker-runtime-contract.test.ts tests/docker-appliance-lifecycle.contract.test.ts tests/runtime-supervision-contract.test.ts`
- Phase evidence records the exact security posture.

## QA Certification

Reviewed: 2026-05-03

Decision: implemented and verified.

The implementation stayed within the intended image/runtime security scope. It
added the hosted compose template, a strict image security contract test, and
operator documentation without broadening into resource limits, release
provenance, image minimization, or Traefik platform work.

## Implementation Closeout

Completed: 2026-05-03

Implemented files:

- `compose.hosted.yaml`
- `tests/image-security-contract.test.ts`
- `README.md`
- `docs/_refactor/appliance-lifecycle-proof/evidence/05a-image-security-baseline-2026-05-03.md`

Verified contract:

- `Dockerfile` keeps the single-image non-root runtime baseline.
- `compose.yaml` keeps the local one-service hardened runtime while publishing
  `3000:3000` for development.
- `compose.hosted.yaml` keeps the hosted one-service hardened runtime and uses
  `expose: "3000"` without direct host port publication.
- Both compose templates keep `read_only: true`,
  `security_opt: no-new-privileges:true`, `cap_drop: ALL`, durable
  `/app/.data`, read-only `/app/config`, and tmpfs runtime scratch paths.
- Forbidden runtime fields remain absent: privileged mode, host namespaces,
  `extra_hosts`, device mounts, Docker socket mounts, capability additions,
  default sidecars, and `depends_on`.

Verification commands:

- `npm test -- tests/image-security-contract.test.ts tests/docker-runtime-contract.test.ts tests/docker-appliance-lifecycle.contract.test.ts tests/runtime-supervision-contract.test.ts`
  - passed: 4 files, 15 tests
- `npm run typecheck`
  - passed
- `npx eslint tests/image-security-contract.test.ts`
  - passed
- `docker compose config --services`
  - passed: `app`
- `docker compose -f compose.hosted.yaml config --services`
  - passed: `app`

Evidence:

- `../evidence/05a-image-security-baseline-2026-05-03.md`

Known carry-forward:

- Full production image rebuild/smoke remains outside this 05A contract pass and
  belongs to the broader image/release gates because local Docker storage has
  previously been constrained.
- Resource limits, tmpfs sizing, log rotation, and disk-pressure posture remain
  Phase 05F.
