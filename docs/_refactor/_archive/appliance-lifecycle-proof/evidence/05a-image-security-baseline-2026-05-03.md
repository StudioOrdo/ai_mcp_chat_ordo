# Phase 05A Evidence - Image Security Baseline

Date: 2026-05-03

## Scope

Phase 05A formalized the single-image appliance security contract for local and
hosted Docker Compose launch modes.

## Files

- `compose.hosted.yaml`
  - added hosted reverse-proxy template
  - keeps one `app` service
  - uses the same app image and Dockerfile as local compose
  - uses `expose: "3000"` instead of host `ports`
  - mounts durable data at `/app/.data`
  - mounts config read-only
  - keeps `read_only: true`, `no-new-privileges:true`, and `cap_drop: ALL`
- `tests/image-security-contract.test.ts`
  - asserts Dockerfile non-root runtime contract
  - asserts local compose hardening and strict writable path allowlist
  - asserts hosted compose hardening, strict writable path allowlist, and no
    direct host port publication
  - asserts forbidden runtime privilege fields and sidecars stay absent
- `README.md`
  - documents local compose versus hosted reverse-proxy compose usage
- `docs/_refactor/appliance-lifecycle-proof/phases/05a-image-security-baseline-and-runtime-contract.md`
  - updated with implementation closeout
- `docs/_refactor/appliance-lifecycle-proof/phases/README.md`
  - updated phase status

## Security Contract

The Phase 05A contract now enforces:

- one production app image
- one default compose service
- non-root Dockerfile runtime user
- read-only root filesystem in compose
- no additional Linux capabilities
- no privilege escalation
- no host namespace usage
- no host alias injection through `extra_hosts`
- no device mounts
- no Docker socket mount
- no default sidecars
- local compose may publish `3000:3000`
- hosted compose must not publish host ports directly
- writable runtime paths are limited to:
  - `/app/.data`
  - `/tmp`
  - `/app/.runtime-logs`
  - `/app/.next/cache`
  - `/app/config` as a read-only mount

## Verification

Command:

```bash
npm test -- tests/image-security-contract.test.ts tests/docker-runtime-contract.test.ts tests/docker-appliance-lifecycle.contract.test.ts tests/runtime-supervision-contract.test.ts
```

Result:

```text
Test Files  4 passed (4)
Tests       15 passed (15)
```

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
npx eslint tests/image-security-contract.test.ts
```

Result:

```text
completed successfully
```

Command:

```bash
docker compose config --services
```

Result:

```text
app
```

Command:

```bash
docker compose -f compose.hosted.yaml config --services
```

Result:

```text
app
```

## Notes

No production image rebuild was run for this phase. The phase changed compose
runtime contracts, tests, and documentation only. Full image build and smoke
evidence remains part of the broader Phase 05/05E/06 release gates because this
machine previously hit host and Docker storage pressure during full image work.
