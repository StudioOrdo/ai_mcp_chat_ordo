# Phase 05D Evidence - Secrets And First Boot Hardening

Date: 2026-05-03

Status: complete

## Implementation Summary

Phase 05D was implemented against the single-image appliance contract.

Completed changes:

- Added explicit install state resolution based on credentialed admin ownership,
  not provider-key presence.
- Added hosted first-boot token enforcement with canonical origin gating before
  install setup or key-validation side effects.
- Updated install check, setup, validate-keys, install page, welcome page, and
  install wizard to consume the safe install-state DTO.
- Added shared direct env and `_FILE` secret resolution for runtime secrets.
- Added file-backed provider config source reporting and operator locking for
  file-backed secrets in admin key management.
- Added `_FILE` secret env schema coverage, including `ELEVENLABS_API_KEY`.
- Removed Dockerfile build-time provider secret placeholder envs.
- Added local and hosted compose secret-file contracts without weakening the
  05A image hardening posture.
- Added shared recursive secret redaction for logs, runtime audit, diagnostics,
  and backup audit metadata.
- Added appliance security health projection for unsafe hosted internal runtime
  token posture without exposing token values or file paths.

## Files Added

- `src/lib/appliance/install/install-state.ts`
- `src/lib/appliance/install/install-token.ts`
- `src/lib/appliance/probes/security-probe.ts`
- `src/lib/config/secret-source.ts`
- `src/lib/observability/secret-redaction.ts`
- `src/app/api/install/check/route.test.ts`
- `src/lib/appliance/install/install-state.test.ts`
- `src/lib/appliance/install/install-token.test.ts`
- `src/lib/config/secret-source.test.ts`

## Key Files Updated

- `Dockerfile`
- `compose.yaml`
- `compose.hosted.yaml`
- `src/adapters/UserDataMapper.ts`
- `src/app/api/install/check/route.ts`
- `src/app/api/install/setup/route.ts`
- `src/app/api/install/validate-keys/route.ts`
- `src/app/install/InstallWizard.tsx`
- `src/app/install/page.tsx`
- `src/app/welcome/page.tsx`
- `src/lib/ai/providers/provider-config-service.ts`
- `src/lib/ai/providers/provider-settings-service.ts`
- `src/lib/ai/providers/types.ts`
- `src/lib/appliance/health-facade.ts`
- `src/lib/appliance/health-types.ts`
- `src/lib/appliance/backup/backup-command-validation.ts`
- `src/lib/config/ConfigurationService.ts`
- `src/lib/config/env-config.ts`
- `src/lib/config/env.ts`
- `src/lib/diagnostics/redaction.ts`
- `src/lib/observability/logger.ts`
- `src/lib/observability/runtime-audit-log.ts`
- `tests/env-centralization.test.ts`
- `tests/image-runtime-bundle-contract.test.ts`
- `tests/image-security-contract.test.ts`

## Verification

Focused 05D tests:

```bash
npm test -- src/lib/appliance/install/install-state.test.ts src/lib/appliance/install/install-token.test.ts src/lib/config/secret-source.test.ts src/app/api/install/setup/route.test.ts src/app/api/install/validate-keys/route.test.ts src/app/api/install/check/route.test.ts src/lib/ai/providers/provider-config-service.test.ts src/lib/diagnostics/redaction.test.ts tests/env-centralization.test.ts tests/image-runtime-bundle-contract.test.ts tests/image-security-contract.test.ts
```

Result: passed, 11 files, 57 tests.

Adjacent provider, admin, and health tests:

```bash
npm test -- src/app/admin/system/keys/KeysManager.test.tsx src/app/api/admin/system/keys/route.test.ts src/lib/ai/providers/provider-settings-service.test.ts src/lib/ai/providers/provider-diagnostics.test.ts tests/health-probes.test.ts tests/health-routes.test.ts tests/hosted-network-contract.test.ts
```

Result: passed, 7 files, 35 tests.

Install-route regression tests:

```bash
npm test -- src/app/install/InstallWizard.test.tsx src/app/api/install/setup/route.test.ts src/app/api/install/validate-keys/route.test.ts src/app/api/install/check/route.test.ts
```

Result: passed, 4 files, 13 tests.

Full required focused 05D verification:

```bash
npm test -- src/lib/appliance/install/install-state.test.ts src/lib/appliance/install/install-token.test.ts src/lib/config/secret-source.test.ts src/app/api/install/setup/route.test.ts src/app/api/install/validate-keys/route.test.ts src/app/api/install/check/route.test.ts src/app/install/InstallWizard.test.tsx src/app/admin/system/keys/KeysManager.test.tsx src/app/api/admin/system/keys/route.test.ts src/lib/ai/providers/provider-config-service.test.ts src/lib/ai/providers/provider-settings-service.test.ts src/lib/ai/providers/provider-diagnostics.test.ts src/lib/diagnostics/redaction.test.ts tests/env-centralization.test.ts tests/image-runtime-bundle-contract.test.ts tests/image-security-contract.test.ts tests/hosted-network-contract.test.ts tests/health-probes.test.ts tests/health-routes.test.ts
```

Result: passed, 19 files, 94 tests.

Full repository test suite:

```bash
npm test
```

Result: passed, 717 files, 5123 tests passed, 2 skipped.

TypeScript:

```bash
npm run typecheck
```

Result: passed.

Focused lint:

```bash
npx eslint src/lib/appliance/install/install-state.ts src/lib/appliance/install/install-token.ts src/lib/config/secret-source.ts src/lib/observability/secret-redaction.ts src/app/api/install/setup/route.ts src/app/api/install/validate-keys/route.ts src/app/install/InstallWizard.tsx src/lib/ai/providers/provider-config-service.ts src/lib/ai/providers/provider-settings-service.ts tests/image-security-contract.test.ts tests/image-runtime-bundle-contract.test.ts
```

Result: passed.

Compose:

```bash
docker compose config --services
docker compose -f compose.hosted.yaml config --services
```

Result: both returned `app`.

Docker build:

```bash
docker build --target runner -t studioordo:phase05d-qa .
```

Result: passed.

Docker build notes:

- No `SecretsUsedInArgOrEnv` warning appeared for provider or install-token
  names after removing Dockerfile secret-shaped placeholder envs.
- The build still emitted unrelated Next/Turbopack warnings for a broad file
  pattern in `src/lib/user-files.ts` and an unexpected file in the NFT list
  from `next.config.ts`.

Runner image inspection:

```bash
docker run --rm --entrypoint sh studioordo:phase05d-qa -lc 'set -eu; test -x /app/bin/ordo-backup; test -d /app/docs/_corpus; test -f /app/release/manifest.json; test ! -e /app/docs/_refactor; test ! -e /app/docs/_review; env | grep -E "^(ANTHROPIC_API_KEY|OPENAI_API_KEY)=" && exit 1 || true; echo ok'
```

Result: `ok`.

## Exit Criteria Review

- First boot is locked by admin ownership, not provider-key configuration:
  satisfied.
- Seeded non-credentialed admin fixtures cannot lock first boot: satisfied.
- Hosted first boot requires a one-time token before the first admin exists:
  satisfied.
- Hosted install mutations enforce canonical origin plus first-boot token before
  side effects: satisfied.
- Install check exposes a safe install-state DTO: satisfied.
- Secret file support exists for provider keys, internal runtime secrets, push
  private key, and install token: satisfied.
- Compose and `env-config` agree on advertised secret envs: satisfied.
- Admin key UI treats file-backed provider keys as operator locked: satisfied.
- Health and diagnostics expose configured/source/status only: satisfied.
- Shared runtime redaction protects logs and audit JSONL: satisfied.
- Dockerfile no longer declares secret-shaped placeholder env values:
  satisfied.
- Compose supports file-backed secrets without weakening the 05A hardening
  contract: satisfied.
- Positive, negative, and edge tests pass: satisfied.

## Residual Notes

05D intentionally does not add Traefik automation, platform tenant
provisioning, reset-token behavior, external secret-manager integration, or
SQLite encryption. Those remain outside this phase.
