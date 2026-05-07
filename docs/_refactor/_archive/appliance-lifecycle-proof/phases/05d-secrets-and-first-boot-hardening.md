# Phase 05D - Secrets And First Boot Hardening

Status: complete

## Goal

Make the single-image appliance safe to launch publicly before and after first
setup.

This phase closes the remaining gap between the hardened image contract from
05A, the hosted reverse-proxy contract from 05B, and the minimized runtime
bundle from 05C:

- local launch stays simple
- hosted launch cannot be anonymously initialized by accident
- provider and internal secrets can be supplied through mounted secret files
- install state is governed by admin ownership, not provider-key presence
- health, diagnostics, logs, evidence, and admin read models never leak secret
  values or secret file paths

This phase does not implement the future Ordo Studio platform control plane,
tenant provisioning, Traefik automation, billing, or reset-token operations.

## Current Code Grounding

### Install And First Boot

- `src/app/api/install/setup/route.ts`
  - currently blocks setup through `ConfigurationService.isSystemInitialized()`.
  - currently creates the admin after provider settings are saved.
  - currently allows an existing matching user to remain in place without
    guaranteeing that user is an admin.
  - currently sets `lms_session_token` directly after install.
  - currently has no hosted install token policy.
  - currently has no install-specific public mutation guard beyond the broad
    request origin behavior.
- `src/app/api/install/validate-keys/route.ts`
  - currently blocks validation through `ConfigurationService.isSystemInitialized()`.
  - currently has no hosted install token policy.
- `src/app/api/install/check/route.ts`
  - currently only ensures the DB schema and returns `{ ready: true }`.
  - it does not report install state, hosted token requirements, or lock status.
- `src/app/install/page.tsx`
  - redirects away from install through `ConfigurationService.isSystemInitialized()`.
- `src/app/welcome/page.tsx`
  - also uses `ConfigurationService.isSystemInitialized()` to decide installed
    state.
- `src/app/install/InstallWizard.tsx`
  - supports the provider/admin setup flow.
  - has no one-time hosted install token input.

### Configuration And Provider Secrets

- `src/lib/config/ConfigurationService.ts`
  - resolves direct environment variables first, then SQLite
    `system_settings`.
  - `isSystemInitialized()` currently means
    `ProviderConfigService.resolveSelectedIntelligenceProviderConfig().apiKey.configured`.
  - this is not a valid appliance first-boot lock because a restored instance
    can have an admin without a provider key, and a hosted instance can have a
    provider key before any admin exists.
- `src/lib/ai/providers/provider-config-service.ts`
  - resolves provider config from direct env, SQLite, or defaults.
  - `ProviderConfigSource` is currently `env | sqlite | default | missing`.
  - there is no file-backed secret source.
- `src/lib/ai/providers/provider-redaction.ts`
  - removes raw secret values but exposes `last4`.
  - `last4` is acceptable for an admin key-management screen only if the
    diagnostic and health surfaces use a stricter projection.
- `src/lib/ai/providers/provider-diagnostics.ts`
  - already reports configured/source/model/provider without raw secret values.
- `src/lib/appliance/probes/provider-probe.ts`
  - reports booleans and provider metadata without raw secret values.
- `src/lib/config/env-config.ts`
  - validates direct provider secret envs:
    `ANTHROPIC_API_KEY`, `API__ANTHROPIC_API_KEY`, `OPENAI_API_KEY`,
    `API__OPENAI_API_KEY`, `DEEPSEEK_API_KEY`, `MEDIA_WORKER_SHARED_SECRET`,
    and push secrets.
  - does not currently validate `ELEVENLABS_API_KEY`, even though both compose
    files pass it to the runtime.
  - validates 05B hosted env:
    `ORDO_HOSTED_MODE`, `ORDO_PUBLIC_ORIGIN`, `TRUST_PROXY_HEADERS`, and
    `ALLOWED_ORIGINS`.
  - does not validate `_FILE` secret envs or `ORDO_INSTALL_TOKEN`.
- `src/lib/config/env.ts`
  - `getInternalRuntimeServiceToken()` defaults to
    `local-dev-runtime-token` when no env value exists. That fallback must stay
    local-only and must be surfaced or blocked in hosted production.

### Admin Key Management

- `src/app/api/admin/system/keys/route.ts`
  - requires admin access.
  - returns redacted provider settings.
  - persists SQLite-backed provider settings.
- `src/app/admin/system/keys/KeysManager.tsx`
  - shows env-backed secrets as operator locked.
  - needs to treat file-backed secrets the same way.

### Docker And Runtime Bundle

- `Dockerfile`
  - Phase 05C now copies only `docs/_corpus` and `release/manifest.json`.
  - the builder stage still declares:
    - `ENV ANTHROPIC_API_KEY=docker-build-placeholder`
    - `ENV OPENAI_API_KEY=docker-build-placeholder`
  - Docker build emits `SecretsUsedInArgOrEnv` warnings for those placeholder
    names. 05D must remove the need for secret-shaped Dockerfile `ENV` values.
- `compose.yaml`
  - local compose still passes provider secrets as direct environment variables.
  - this is acceptable for local alpha, but `_FILE` must be supported as the
    hosted-safe path.
- `compose.hosted.yaml`
  - inherits 05A hardening: one service, read-only root filesystem,
    no-new-privileges, all capabilities dropped, writable `.data` only through
    the durable volume plus tmpfs runtime paths.
  - inherits 05B hosted network env.
  - currently passes direct secret envs and has no secret-file example.

### Logging, Audit, And Redaction

- `src/lib/observability/logger.ts`
  - serializes context and errors into pino logs without a shared secret
    redaction pass.
- `src/lib/observability/runtime-audit-log.ts`
  - normalizes audit context but does not redact by secret-like key.
- `src/lib/diagnostics/redaction.ts`
  - redacts diagnostics payloads and bearer tokens.
  - its current secret key pattern is exact-match oriented and does not cover
    common nested names like `accessToken`, `refreshToken`,
    `WEB_PUSH_VAPID_PRIVATE_KEY`, or `ANTHROPIC_API_KEY`.
  - it is not the shared logging/audit redaction contract yet.
- `src/lib/appliance/backup/backup-command-validation.ts`
  - has backup-specific audit metadata redaction.
  - this proves the pattern, but it should not remain the only runtime audit
    redaction path.
- `scripts/scan-secrets.mjs`
  - exists for repository scanning and should remain part of release hygiene,
    but runtime logging must protect itself independently.

## QA Findings To Close

1. First-boot lock is coupled to provider-key presence.
   - This can lock a brand-new hosted instance before an admin exists if the
     platform injects a provider key.
   - This can reopen or misroute a restored instance if provider keys are
     intentionally removed.
2. Install check does not expose install state.
   - The UI cannot distinguish local setup, hosted token-required setup, locked
     setup, and DB failure.
3. Hosted install has no one-time token gate.
   - A reverse-proxy hosted instance with empty `.data` can expose setup to the
     public internet.
4. Public install mutations need an explicit first-boot guard.
   - Setup is intentionally unauthenticated before the first admin exists.
   - Hosted setup must therefore combine the 05B origin contract with the
     first-boot token contract.
5. Provider secrets have no file-backed source.
   - Hosted deployments must choose between direct env secrets and SQLite
     storage.
6. Dockerfile still contains secret-shaped placeholder `ENV` names.
   - Phase 05C Docker QA proved the image builds, but Docker correctly warns
     that these look like secrets.
7. Redaction is fragmented.
   - Diagnostics and backup audit have separate redaction.
   - General logs and runtime audit logs can still receive unredacted
     secret-like keys from future callers.
8. Admin read models and health projections need source-aware file-secret
   behavior.
   - File-backed secrets should be operator locked like env secrets.
   - Health must never include raw values, file paths, or secret suffixes.

## Design Contract

### 1. Explicit Install State Resolver

Create a dedicated install state module, for example:

```text
src/lib/appliance/install/install-state.ts
```

The resolver owns first-boot state and replaces
`ConfigurationService.isSystemInitialized()` for install and welcome flows.

Install state is based on administrative ownership, not provider keys:

```text
uninitialized
token_required
ready_for_setup
initialized_locked
blocked
```

Rules:

- `initialized_locked` means at least one credentialed admin owner exists.
- provider key presence must not lock install by itself.
- missing provider keys must not reopen install when an admin exists.
- `blocked` means the database or user/role store cannot be inspected.
- restored backups with an admin remain locked even if provider settings are
  missing, disabled, or file-mounted later.
- seeded fixture users must not count as ownership unless they have a usable
  password hash or another explicit owner credential.
- current seeds create `usr_admin` with `role_admin` and no password hash; 05D
  must either remove that seeded admin for greenfield installs or make the
  resolver ignore non-credentialed seed users.
- the resolver returns a DTO safe for the install UI:

```ts
interface InstallStateView {
  state: "uninitialized" | "token_required" | "ready_for_setup" | "initialized_locked" | "blocked";
  hostedMode: "local" | "reverse_proxy";
  ownerConfigured: boolean;
  setupAllowed: boolean;
  installTokenRequired: boolean;
  message?: string;
}
```

Implementation must update:

- `src/app/api/install/check/route.ts`
- `src/app/api/install/setup/route.ts`
- `src/app/api/install/validate-keys/route.ts`
- `src/app/install/page.tsx`
- `src/app/welcome/page.tsx`
- tests that currently mock `ConfigurationService.isSystemInitialized()`

`ConfigurationService.isSystemInitialized()` should either be removed from these
flows or deprecated to delegate to the new install-state resolver. Do not keep
two definitions of "installed".

The cleanest implementation is a small repository/query method that answers
"does a credentialed admin owner exist?" directly from `users`, `user_roles`,
and `roles`. Do not infer this from display roles returned by auth session
helpers.

### 2. Hosted One-Time Install Token

Add a hosted setup token policy, for example:

```text
ORDO_INSTALL_TOKEN
ORDO_INSTALL_TOKEN_FILE
```

Rules:

- local mode may allow setup with no token.
- `ORDO_HOSTED_MODE=reverse_proxy` with no admin requires an install token.
- the token can be supplied by request body field or `X-Ordo-Install-Token`.
- token comparison must be constant-time after normalization.
- token values and token file paths must never be logged, returned, stored, or
  included in health metadata.
- token validation only applies before the first admin exists.
- after admin exists, setup and install-key validation remain locked regardless
  of token correctness.
- the install token is not a reset token. Reset remains out of scope.

The install UI should show a token field only when `/api/install/check` reports
`installTokenRequired: true`.

### 3. Public Install Mutation Guard

Install setup and install-key validation are unauthenticated before the first
admin exists. In hosted mode, they must be protected by both:

- the 05B canonical origin contract
- the 05D one-time install token contract

Rules:

- local mode keeps the current frictionless development path.
- hosted mode rejects mutating install requests from disallowed origins.
- hosted mode rejects missing, malformed, or invalid setup tokens before any
  provider settings or admin records are written.
- validation and setup should use one shared guard so they cannot drift.
- rejected responses must not reveal whether a submitted token was close,
  partially correct, or backed by a specific file.

### 4. File-Backed Secret Loader

Add one shared secret source resolver, for example:

```text
src/lib/config/secret-source.ts
```

It should support direct env and `_FILE` env without duplicating file-read logic
through provider modules.

Initial supported secret keys:

```text
ANTHROPIC_API_KEY
API__ANTHROPIC_API_KEY
OPENAI_API_KEY
API__OPENAI_API_KEY
DEEPSEEK_API_KEY
ELEVENLABS_API_KEY
MEDIA_WORKER_SHARED_SECRET
WEB_PUSH_VAPID_PRIVATE_KEY
ORDO_INSTALL_TOKEN
```

Also add `ELEVENLABS_API_KEY` to `env-config` or remove it from compose if it is
not a supported runtime secret. Keeping it only in compose creates a false
operator contract.

Resolution order:

1. direct env value
2. `_FILE` env file contents
3. SQLite setting, where applicable
4. default or missing

This order preserves existing local and production behavior while allowing
hosted secret mounts.

File secret rules:

- trim one trailing newline and surrounding whitespace.
- blank files count as missing.
- missing/unreadable files produce actionable diagnostics without including the
  raw path in public health.
- source is reported as `file`, not `env`.
- secret file paths are never exposed through health, admin JSON, logs, audit,
  or evidence.
- file reads may be synchronous for existing synchronous provider config
  resolution, but the implementation must isolate that decision inside the
  secret source adapter.
- for hosted production, default development secrets such as
  `local-dev-runtime-token` must be reported as unsafe and blocked or degraded
  by readiness according to risk.

Update provider types:

```ts
type ProviderConfigSource = "env" | "file" | "sqlite" | "default" | "missing";
```

Admin key UI behavior:

- `env` and `file` sources are operator locked.
- file-backed fields should display `source: file` and configured/missing only.
- admin UI may keep `last4` for manually-entered SQLite/admin keys if existing
  tests require it, but health/evidence diagnostics must not expose `last4`.

### 5. Remove Build-Time Secret Placeholder Env

Remove Dockerfile builder-stage secret-shaped placeholder envs:

```Dockerfile
ENV ANTHROPIC_API_KEY=docker-build-placeholder
ENV OPENAI_API_KEY=docker-build-placeholder
```

If `next build` requires provider keys, fix the application build path so
provider clients are not instantiated with required runtime secrets during the
build. Do not replace these with `ARG` values or differently named fake
secrets.

Exit condition:

- Docker build does not emit `SecretsUsedInArgOrEnv` for provider key names.
- static image contract tests fail if those placeholder envs are reintroduced.

### 6. Compose Secret Mount Contract

Keep direct env support for simple local alpha, but add hosted-safe secret file
examples.

Expected hosted shape:

```yaml
services:
  app:
    environment:
      ANTHROPIC_API_KEY_FILE: /run/secrets/anthropic_api_key
      OPENAI_API_KEY_FILE: /run/secrets/openai_api_key
      DEEPSEEK_API_KEY_FILE: /run/secrets/deepseek_api_key
      ORDO_INSTALL_TOKEN_FILE: /run/secrets/ordo_install_token
    secrets:
      - anthropic_api_key
      - openai_api_key
      - deepseek_api_key
      - ordo_install_token
```

The final compose contract must respect 05A:

- root filesystem remains read-only.
- secret mounts are read-only.
- no additional sidecar is required.
- no Docker socket or privileged mount is introduced.
- no secret value appears in Traefik labels or compose labels.

### 7. Shared Runtime Redaction

Create or promote one shared runtime redaction helper, for example:

```text
src/lib/observability/secret-redaction.ts
```

The redactor must recursively redact object keys matching secret-like material:

```text
secret
token
password
passwd
cookie
authorization
bearer
session
api_key
apikey
private_key
access_key
refresh
```

It must also redact bearer tokens embedded in strings.

Apply it to:

- `src/lib/observability/logger.ts`
- `src/lib/observability/runtime-audit-log.ts`
- backup audit redaction, either by delegating to the shared helper or by
  keeping backup-specific wrappers over the shared helper
- diagnostics where compatible with existing `src/lib/diagnostics/redaction.ts`

Do not redact safe operational fields such as provider id, model name, source,
configured boolean, or status.

### 8. Health And Diagnostics Projection

Health, readiness, admin process diagnostics, and evidence may report:

- `configured: true | false`
- `source: env | file | sqlite | default | missing`
- provider id
- model id
- optional capability status
- hosted install state
- install token required boolean
- unsafe default internal secret status, without the default secret value

They must not report:

- raw secret values
- secret file paths
- install token values
- session cookies
- bearer tokens
- provider key suffixes on health/evidence surfaces
- default development runtime token values

## SOLID/Clean/GOF Notes

- Single Responsibility: install state belongs in one appliance install module,
  not in provider configuration.
- Adapter: direct env, file secret, and SQLite secret sources sit behind one
  resolver.
- State Machine: first boot is explicit and testable instead of inferred.
- Strategy: local and hosted first-boot policies are separate runtime
  strategies selected by the 05B hosted-mode contract.
- Facade: install routes and pages consume a safe install-state facade instead
  of querying users, providers, and env independently.
- Chain Of Responsibility: install mutation requests pass through origin,
  first-boot state, and token guards before side effects.
- Fail Closed: hosted setup without a valid first-boot token is blocked until
  an admin exists.
- Open/Closed: future platform-issued setup credentials can plug into the token
  policy without changing provider settings or auth internals.

## Positive Use Cases

- Local developer runs `docker compose up`, opens `/install`, and completes
  setup without a hosted token.
- Hosted platform launches an empty `.data` instance with
  `ORDO_HOSTED_MODE=reverse_proxy`, `ORDO_PUBLIC_ORIGIN`, and
  `ORDO_INSTALL_TOKEN_FILE`; anonymous setup is blocked until the token is
  supplied.
- Seeded fixture users do not accidentally mark the appliance initialized.
- Provider keys can be mounted as Docker secrets and show as operator locked in
  admin settings.
- OpenAI remains optional; missing OpenAI key disables image/audio/search
  features without blocking chat when another intelligence provider is
  configured.
- A restored instance with an admin remains locked even when provider keys are
  rotated or temporarily missing.

## Negative Use Cases

- A hosted empty instance without an install token cannot create the first
  admin.
- A hosted install POST from a disallowed origin cannot mutate setup state.
- A valid install token cannot reopen setup after an admin exists.
- A provider key in env or SQLite cannot mark the system initialized when no
  admin exists.
- Raw provider keys, install tokens, file paths, cookies, bearer tokens, and
  session material do not appear in logs, audit JSONL, health JSON, diagnostics,
  evidence, or admin process output.
- Missing secret files produce actionable errors without leaking the path to
  public health.
- Dockerfile secret-shaped placeholder envs cannot return.

## Edge Use Cases

- `.data` exists with provider settings but no admin.
  - setup should remain allowed locally and token-gated in hosted mode.
- `.data` contains only seeded `usr_admin` without a password hash.
  - setup should still be treated as unowned.
- `.data` exists with an admin but no provider key.
  - install remains locked; admin can configure providers after login.
- an existing matching user is present during install.
  - setup must either promote that user to admin intentionally or fail with a
    clear error. Silent non-admin success is not acceptable.
- `ORDO_INSTALL_TOKEN_FILE` points to a blank file.
  - hosted setup remains token-required and blocked.
- both `ANTHROPIC_API_KEY` and `ANTHROPIC_API_KEY_FILE` are set.
  - direct env wins to preserve current behavior; diagnostics report `env`.
- secret file content includes a trailing newline.
  - value resolves correctly after trimming.
- hosted instance is accessed through an invalid public origin.
  - 05B network readiness continues to block readiness independently of setup
    token behavior.
- local `.env.local` is present in development.
  - direct env behavior remains unchanged.

## Out Of Scope

- platform-issued tenant provisioning
- Traefik label automation
- billing or slot management
- password reset
- install reset token
- external secret managers beyond Docker/file mounts
- encrypting SQLite-stored provider settings
- changing backup archive formats

## Implementation Order

1. Add install-state resolver and tests.
2. Move install/welcome routes and pages off
   `ConfigurationService.isSystemInitialized()`.
3. Add hosted install token resolver and public install mutation guard tests.
4. Add install UI token handling.
5. Add shared file-backed secret loader and env schema entries.
6. Integrate file-backed secrets into provider config and admin key UI.
7. Remove Dockerfile build placeholder secret envs and add regression tests.
8. Add compose `_FILE`/secret examples while preserving local direct env.
9. Add shared redaction helper and wire logs/audit/diagnostics.
10. Update health/readiness/admin diagnostics projections.
11. Record evidence and update this phase doc after implementation.

## Required Tests

Add or update focused tests for:

- install-state resolver:
  - no admin/no provider
  - seeded admin with no password hash does not count as ownership
  - no admin/provider env exists
  - admin exists/no provider
  - admin exists/provider missing after restore
  - DB inspection failure
- install routes:
  - setup allowed locally before admin
  - setup blocked after admin
  - validate-keys blocked after admin
  - hosted setup requires token before admin
  - hosted setup accepts valid token before admin
  - hosted setup rejects invalid/missing token before admin
  - hosted setup rejects disallowed origin before side effects
  - install validation uses the same hosted guard as setup
  - token cannot reopen setup after admin
  - existing user is handled intentionally
- install UI:
  - token field appears only when check reports token required
  - locked state redirects or renders a locked message
- secret source:
  - direct env resolves
  - `_FILE` resolves
  - direct env beats `_FILE`
  - blank file is missing
  - unreadable file yields safe actionable diagnostics
  - file path is not exposed in public DTOs
  - `ELEVENLABS_API_KEY` env contract is either supported or removed from
    compose
  - hosted production reports unsafe default internal runtime token behavior
- provider config:
  - provider source includes `file`
  - file source is operator locked in admin UI
  - health does not expose raw values, file paths, or `last4`
- Docker and compose:
  - Dockerfile has no secret-shaped placeholder `ENV`
  - compose templates support `_FILE` env names
  - hosted compose keeps 05A hardening
- redaction:
  - logs redact secret-like keys recursively
  - runtime audit logs redact secret-like keys recursively
  - bearer tokens embedded in strings are redacted
  - backup audit redaction still passes

Required verification commands after implementation:

```bash
npm test -- src/lib/appliance/install/install-state.test.ts
npm test -- src/lib/appliance/install/install-token.test.ts
npm test -- src/lib/config/secret-source.test.ts
npm test -- src/app/api/install/setup/route.test.ts
npm test -- src/app/api/install/validate-keys/route.test.ts
npm test -- src/app/api/install/check/route.test.ts
npm test -- src/app/admin/system/keys/KeysManager.test.tsx
npm test -- tests/image-security-contract.test.ts tests/hosted-network-contract.test.ts tests/image-runtime-bundle-contract.test.ts
npm run typecheck
docker compose config --services
docker compose -f compose.hosted.yaml config --services
docker build --target runner -t studioordo:phase05d-qa .
```

Docker build QA must check for absence of `SecretsUsedInArgOrEnv` warnings for
provider or install token names.

## Exit Criteria

- First boot is locked by admin ownership, not provider-key configuration.
- Seeded non-credentialed admin fixtures cannot lock first boot.
- Hosted first boot requires a one-time token before the first admin exists.
- Hosted install mutations enforce canonical origin plus first-boot token before
  side effects.
- Install check exposes a safe install-state DTO.
- Secret file support exists for provider keys, internal runtime secrets, push
  private key, and install token.
- Compose and `env-config` agree on every advertised secret env.
- Admin key UI treats file-backed provider keys as operator locked.
- Health and diagnostics expose configured/source/status only.
- Shared runtime redaction protects logs and audit JSONL.
- Dockerfile no longer declares secret-shaped placeholder env values.
- Compose supports file-backed secrets without weakening the 05A hardening
  contract.
- Positive, negative, and edge tests pass.
- Evidence is recorded under `../evidence/05d-secrets-and-first-boot-hardening-YYYY-MM-DD.md`.

## QA Certification

Reviewed: 2026-05-03

Decision: implemented and verified.

The phase now covers the actual current-code risks:

- install lock incorrectly depends on provider-key presence
- seeded non-credentialed admin rows can confuse ownership checks
- hosted first boot needs token and origin gating before side effects
- provider/internal secrets need shared direct-env and `_FILE` resolution
- compose and `env-config` currently disagree on `ELEVENLABS_API_KEY`
- Dockerfile has secret-shaped build placeholder envs
- runtime log/audit redaction is fragmented
- health/admin/evidence projections need a stricter no-secret contract

The implementation contract is intentionally scoped to the single-image
appliance. It does not require Traefik automation, platform provisioning,
external secret managers, reset tokens, or SQLite encryption.

## Implementation Closeout

Completed: 2026-05-03

Evidence:

- `../evidence/05d-secrets-and-first-boot-hardening-2026-05-03.md`

Implemented code paths:

- install state now resolves through `src/lib/appliance/install/install-state.ts`
  and is based on credentialed admin ownership, not provider-key presence.
- hosted first boot now gates install mutations through shared token and origin
  checks in `src/lib/appliance/install/install-token.ts`.
- install setup, validation, check, install page, welcome page, and install UI
  now consume the safe install-state contract.
- direct env and `_FILE` secret resolution now share
  `src/lib/config/secret-source.ts`.
- provider config can report `file` source and admin key management treats file
  secrets as operator locked.
- Dockerfile build-time provider secret placeholders were removed.
- local and hosted compose files now advertise `_FILE` secret mounts while
  preserving direct env support for local development.
- logs, runtime audit, diagnostics, and backup audit now share recursive secret
  redaction behavior.
- appliance health now includes a security probe for hosted unsafe internal
  runtime token posture without exposing token values or file paths.

Verification summary:

- focused 05D tests passed.
- adjacent provider/admin/health tests passed.
- full repository test suite passed: 717 files, 5123 tests passed, 2 skipped.
- `npm run typecheck` passed.
- `docker compose config --services` passed.
- `docker compose -f compose.hosted.yaml config --services` passed.
- `docker build --target runner -t studioordo:phase05d-qa .` passed.
- runner image inspection confirmed `bin/ordo-backup`, `docs/_corpus`, and
  `release/manifest.json` are present; refactor/review docs and provider secret
  env values are absent.
