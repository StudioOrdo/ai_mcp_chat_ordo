# Phase 05E - Release Supply Chain And Image Provenance

Status: complete

## Goal

Make the single-image appliance releasable with reproducible evidence:

- source and lockfile identity
- Node and Rust toolchain identity
- image build proof
- image digest proof
- runtime bundle and hardening contract proof
- secret hygiene proof
- SBOM and vulnerability scan proof when local tools are available
- Docker smoke proof when Docker is healthy
- optional signing and attestation hooks without blocking local alpha

This phase is about release trust for the appliance image. It is not about
feature behavior, Traefik orchestration, tenant provisioning, billing, or the
future Ordo Studio instance control plane.

## Current Code Grounding

### Completed Phase Inputs

05E builds directly on the completed 05x image work:

- Phase 05A
  - `compose.hosted.yaml` defines the hardened hosted reverse-proxy shape.
  - `tests/image-security-contract.test.ts` protects non-root runtime,
    read-only root filesystem, capability drop, no privileged/host namespaces,
    no Docker socket, and hosted `expose` without direct `ports`.
- Phase 05B
  - `src/lib/appliance/network/public-origin.ts` owns canonical public-origin
    resolution.
  - `tests/hosted-network-contract.test.ts`, `tests/csrf-origin-check.test.ts`,
    `tests/health-probes.test.ts`, and `tests/health-routes.test.ts` protect
    hosted origin/readiness behavior.
- Phase 05C
  - `Dockerfile` now copies only the approved runtime bundle:
    `node_modules`, `package.json`, `tsconfig.json`, `next.config.ts`,
    `.next`, `public`, `docs/_corpus`, `release/manifest.json`, `config`,
    `scripts`, `mcp`, `src`, and `bin/ordo-backup`.
  - `tests/image-runtime-bundle-contract.test.ts` protects the runner copy
    list and host-only exclusions.
- Phase 05D
  - Dockerfile provider-key placeholder envs were removed.
  - `compose.yaml` and `compose.hosted.yaml` now support `_FILE` secret
    mounts.
  - runtime redaction is centralized in
    `src/lib/observability/secret-redaction.ts`.
  - install setup is governed by credentialed admin ownership and hosted
    install token/origin checks.

05E must compose these contracts. It should not duplicate their assertions in
new ad hoc scripts where existing tests already own the rule.

### Current Release Commands

Current `package.json` scripts already provide pieces of the release ladder:

- `npm run native:check`
  - verifies native Node runtime compatibility for `better-sqlite3` and `tsx`.
- `npm run validate:env`
  - validates runtime env shape.
- `npm run scan:secrets`
  - runs `scripts/scan-secrets.mjs` over tracked files.
- `npm run typecheck`
  - runs `tsc --noEmit`.
- `npm run lint:strict`
  - runs ESLint with zero warnings.
- `npm run test`
  - runs the Vitest suite.
- `npm run build`
  - runs `next build` after `build:search-index`.
- `npm run release:prepare`
  - runs build and `scripts/generate-release-manifest.mjs`.
- `npm run release:verify`
  - validates `release/manifest.json` through
    `scripts/validate-release-manifest.mjs`.
- `npm run runtime:inventory`
  - writes runtime inventory evidence.
- `npm run release:evidence`
  - writes aggregated release evidence through
    `scripts/generate-release-evidence.ts`.
- `npm run appliance:smoke:local`
  - runs the local lifecycle smoke path.
- `npm run appliance:smoke:docker`
  - runs the Docker build availability smoke path.

There is no single release command today that combines these with Docker image
digest capture, SBOM, vulnerability scan, image inspection, optional signing, and
phase-local evidence output.

### Current Release Evidence Code

- `scripts/generate-release-manifest.mjs`
  - writes `release/manifest.json` with app name, package version, short git
    SHA, branch, build timestamp, and Node version.
  - does not include Rust version, Docker image tag/digest, base image digest,
    lockfile hashes, SBOM path, scan path, or smoke evidence path.
- `scripts/validate-release-manifest.mjs`
  - checks only required metadata keys in `release/manifest.json`.
- `scripts/generate-release-evidence.ts`
  - aggregates existing QA, runtime integrity, health, canary, and manual
    checks.
  - is broader product release evidence, not image-specific provenance.
- `src/lib/admin/processes.ts`
  - reads `release/manifest.json` for admin diagnostics.
  - 05E should avoid breaking that stable manifest shape; image provenance can
    be a sibling artifact instead of overloading the runtime manifest.

### Current Appliance Smoke Harness

- `scripts/run-appliance-lifecycle-smoke.ts`
  - supports `APPLIANCE_SMOKE_MODE=local`, `docker`, and
    `compose-single-image`.
- `src/lib/appliance/verification/lifecycle-smoke.ts`
  - local mode proves SQLite/data-boundary/backup/restore/scheduler behavior.
  - Docker mode currently checks Docker availability and builds an image.
  - `compose-single-image` mode checks `docker compose config --services`.
  - Docker mode records image tag but not image digest.
  - Docker mode does not currently run a container, inspect the runner contents,
    verify health endpoints inside the image, or remove the temporary image.
- `src/lib/appliance/verification/docker-lifecycle-adapter.ts`
  - wraps Docker availability, image build, and compose service inspection.
  - does not yet provide image inspect, digest capture, run/exec, SBOM/scan
    adapters, or cleanup helpers.

05E should extend this harness only where the proof belongs to the appliance
image. It should not turn the lifecycle smoke harness into a general release
orchestrator if a separate release gate script is cleaner.

### Current Docker And Runtime Bundle

- `Dockerfile`
  - uses `ARG NODE_VERSION=22.22.2`.
  - builds from `node:${NODE_VERSION}-alpine`.
  - has a Rust builder stage using `rust:1-alpine`.
  - the checked-in `rust-toolchain.toml` pins the Rust toolchain to `1.81.0`;
    05E must record the actual `rustc --version` used by the build rather than
    assuming the Docker base image tag is the toolchain version.
  - builds `ordo-backup` with `cargo build --release -p ordo-backup`.
  - installs `ffmpeg`.
  - runs as non-root `nextjs`.
  - exposes `3000` and declares `/app/.data` as a volume.
  - copies `release/manifest.json` into the runner, so the manifest must exist
    before a release build.
- `.dockerignore`
  - excludes local data, env files, tests, `.git`, coverage, Playwright
    artifacts, logs, JSONL, and broad Markdown.
  - includes only `README.md` and `docs/_corpus` runtime Markdown.
- `compose.yaml`
  - local single-service app, direct `3000:3000`, hardened security settings,
    `.data` volume, config read-only mount, and tmpfs runtime paths.
- `compose.hosted.yaml`
  - hosted single-service app, no direct `ports`, `expose: "3000"`, same
    hardening, hosted origin env, and Docker secret-file examples.

### Current Rust Supply Chain

- `Cargo.toml`
  - workspace includes `crates/*`.
  - release profile uses `opt-level = 3`, LTO, one codegen unit,
    `panic = "abort"`, and strip.
- `crates/ordo-backup/Cargo.toml`
  - package is `publish = false`.
  - dependencies include `rusqlite` with bundled SQLite, `zip`, `chrono`,
    `clap`, `uuid`, `serde`, `sha2`, and `walkdir`.
- `Cargo.lock`
  - present and must be part of release provenance.
- `rust-toolchain.toml`
  - pins Rust `1.81.0` with `rustfmt` and `clippy`.
- `deny.toml`
  - configured for `cargo-deny` style license/advisory/source policy.
  - There is no `package.json` script yet for `cargo test`, `cargo clippy`,
    `cargo fmt --check`, or `cargo deny`.
  - QA on 2026-05-03 found `cargo test -p ordo-backup` and
    `cargo clippy -p ordo-backup -- -D warnings` pass, but
    `cargo fmt --check` currently fails on formatting diffs in the backup
    crate. 05E must close that before treating Rust supply-chain checks as
    passing.

05E should include Rust checks in the release gate, but scanner/tool
availability should be treated explicitly so local development is not blocked by
missing optional tools.

### Current Secret And Evidence Posture

- `scripts/scan-secrets.mjs`
  - scans tracked files for common OpenAI/Anthropic key patterns.
  - It is intentionally lightweight and not a full entropy scanner.
  - QA on 2026-05-03 found the current command fails on tracked
    historical/test fixture strings:
    - `docs/_archive/_specs-pre-factory-2026-04-27/management/spec-19-managed-hosting-token-metering.md`
    - `src/lib/config/ConfigurationService.test.ts`
  - 05E must either remove/neutralize those fixture strings or add a narrow,
    documented fixture allowlist before treating secret hygiene as passing.
- 05D runtime redaction prevents logs/audit/health from leaking token values or
  file paths.
- 05E evidence must not write env dumps, Docker secret values, provider key
  suffixes, secret file paths, cookies, bearer tokens, or host-private absolute
  paths.
- Evidence may safely include tool versions, image tag/digest, lockfile hashes,
  base image references, SBOM/scan artifact paths, command names, pass/fail
  status, and sanitized stderr summaries.

## QA Findings To Close

1. Image release provenance is not represented as a first-class artifact.
   - Existing `release/manifest.json` is app/runtime metadata, not image
     provenance.
2. No command captures the built image digest.
   - A release can build an image without recording the exact immutable image
     that passed checks.
3. No release artifact records lockfile hashes.
   - `package-lock.json` and `Cargo.lock` are present but not hashed into
     evidence.
4. No release artifact records Rust version or backup executor build identity.
   - The image now includes Rust, so Node-only manifest evidence is
     incomplete.
5. SBOM and vulnerability scanning are not integrated.
   - Optional tools may exist locally, but no stable adapter contract captures
     available/unavailable/failure states.
6. Docker build failures are not classified.
   - Host Docker issues such as low disk, Docker Desktop unavailable, or daemon
     unreachable should be reported as environment-blocked, not product-passed.
7. Docker smoke currently builds but does not inspect the runner image.
   - 05D manually inspected the image for `bin/ordo-backup`, `docs/_corpus`,
     `release/manifest.json`, absence of refactor/review docs, and absence of
     provider env values. This should become a repeatable release gate.
8. Temporary image cleanup is not part of the harness.
   - Release QA should avoid accumulating large local images during repeated
     appliance work.
9. Existing broad product `release:evidence` should not be overloaded.
   - Image provenance needs a focused artifact while still referencing product
     release evidence when available.
10. Existing `npm run scan:secrets` is currently blocked by tracked fixture
    strings.
    - This is not a runtime leak by itself, but it means the release gate cannot
      claim secret hygiene until the fixture policy is fixed.
11. Existing `cargo fmt --check` is currently blocked by Rust formatting drift.
    - Rust tests and clippy pass, but the release gate cannot claim Rust
      hygiene until formatting is corrected.

## Design Contract

### 1. Add An Appliance Image Release Gate

Add a script such as:

```text
scripts/run-appliance-image-release.ts
```

and a package command such as:

```json
"appliance:release": "tsx scripts/run-appliance-image-release.ts"
```

The script is the release gate orchestrator. It should call existing commands
where they already own behavior, instead of reimplementing their logic.

Required default gate sequence:

1. collect source/toolchain metadata
2. run native/runtime checks
3. run secret scan
4. run typecheck
5. run focused image contract tests
6. run Rust checks
7. generate/verify release manifest
8. build Docker image
9. inspect image contents and runtime user
10. capture image digest
11. generate SBOM if a supported SBOM tool is available
12. run vulnerability scan if a supported scanner is available
13. run Docker smoke if Docker is available
14. write image provenance evidence
15. remove temporary local image unless explicitly preserved

The full `npm test` suite may be supported through a flag, for example
`--full-test`, but should not be required for the first 05E implementation
because 05D already proved the full suite. The release gate must always run the
focused image/security/proxy/secret tests that protect the image contract.

### 2. Evidence Artifact Shape

Write evidence under:

```text
docs/_refactor/appliance-lifecycle-proof/evidence/
```

Recommended artifact names:

```text
05e-release-supply-chain-and-image-provenance-YYYY-MM-DD.json
05e-release-supply-chain-and-image-provenance-YYYY-MM-DD.md
```

The machine-readable artifact should include:

```ts
interface ApplianceImageReleaseEvidence {
  phase: "05e-release-supply-chain-and-image-provenance";
  status: "passed" | "failed" | "environment_blocked" | "incomplete";
  generatedAt: string;
  git: {
    revision: string | null;
    branch: string | null;
    dirty: boolean;
  };
  toolchains: {
    node: string;
    npm: string | null;
    rustc: string | null;
    cargo: string | null;
    docker: string | null;
  };
  source: {
    packageLockSha256: string | null;
    cargoLockSha256: string | null;
    dockerfileSha256: string | null;
    rustToolchainSha256: string | null;
    composeSha256: string | null;
    hostedComposeSha256: string | null;
  };
  image: {
    tag: string;
    id: string | null;
    digest: string | null;
    baseImages: string[];
    sizeBytes: number | null;
    user: string | null;
    exposedPorts: string[];
    labels: Record<string, string>;
  };
  gates: Array<{
    name: string;
    command: string;
    status: "passed" | "failed" | "skipped" | "environment_blocked";
    durationMs: number;
    summary: string;
    artifactPath?: string;
  }>;
  sbom: {
    tool: "syft" | "docker-sbom" | "docker-scout" | "unavailable";
    status: "generated" | "skipped" | "failed";
    artifactPath: string | null;
    summary: string;
  };
  vulnerabilityScan: {
    tool: "trivy" | "grype" | "docker-scout" | "unavailable";
    status: "passed" | "failed" | "skipped";
    artifactPath: string | null;
    critical: number | null;
    high: number | null;
    summary: string;
  };
  signing: {
    tool: "cosign" | "unavailable";
    status: "signed" | "skipped" | "failed";
    artifactPath: string | null;
    summary: string;
  };
  warnings: string[];
  blockers: string[];
}
```

The Markdown artifact should be human-readable and contain the same pass/fail
facts without raw env, raw secrets, secret file paths, or host-private absolute
paths.

### 3. Tool Adapter Contract

Implement scanner/signing tool support as adapters selected by local
availability:

- SBOM preference order:
  - `syft`
  - `docker sbom`
  - `docker scout sbom`
  - unavailable/skipped
- vulnerability scan preference order:
  - `trivy image`
  - `grype`
  - `docker scout cves`
  - unavailable/skipped
- signing/attestation:
  - `cosign` if explicitly enabled
  - skipped by default for local alpha

Rules:

- Missing optional SBOM/scan/signing tools should not crash the script.
- Missing SBOM should mark status `incomplete` unless the command is run with a
  documented local-development flag such as `--allow-missing-scanners`.
- Critical vulnerabilities should fail the release gate by default.
- High vulnerabilities should fail by default unless explicitly waived through a
  checked-in waiver file or command-line flag that is recorded in evidence.
- Scanner output files must live outside the runner image. They are release
  artifacts, not appliance runtime files.

### 4. Docker Image Build And Inspect Contract

Build with an explicit tag, defaulting to a local timestamp/revision tag:

```text
studioordo:05e-<git-sha-or-date>
```

Support an override:

```text
APPLIANCE_RELEASE_IMAGE_TAG=...
```

After build:

- inspect image id
- inspect repo digest when available
- record image size
- record configured user
- record exposed ports
- record labels
- inspect runner contents through a short `docker run --entrypoint sh` command:
  - `/app/bin/ordo-backup` exists and is executable
  - `/app/docs/_corpus` exists
  - `/app/release/manifest.json` exists
  - `/app/docs/_refactor` is absent
  - `/app/docs/_review` is absent
  - provider secret env values are not baked into image env
- preserve 05A/05C test ownership for static Dockerfile/compose assertions.

The inspect command must not print full environment values. It should only
assert absence/presence and return a compact status string.

### 5. Docker Failure Classification

Classify Docker failures before writing evidence:

- `environment_blocked`
  - Docker daemon unavailable
  - Docker Desktop unhealthy
  - no space left on device
  - network pull failure for base image
  - permission denied to Docker socket
- `failed`
  - Dockerfile syntax error
  - build step fails because app build/test/Rust build fails
  - image inspection fails because expected runtime files are missing
  - hosted/local compose contract tests fail

Do not report environment-blocked Docker as a passed release. The evidence must
make the distinction explicit.

### 6. Rust Release Checks

Add Rust release gates:

```bash
cargo fmt --check
cargo test -p ordo-backup
cargo clippy -p ordo-backup -- -D warnings
```

If `cargo deny` is installed, run:

```bash
cargo deny check
```

If `cargo deny` is not installed:

- record it as skipped or incomplete.
- do not pretend license/advisory checks passed.

Add package scripts if useful:

```json
"rust:fmt": "cargo fmt --check",
"rust:test": "cargo test -p ordo-backup",
"rust:clippy": "cargo clippy -p ordo-backup -- -D warnings",
"rust:deny": "cargo deny check"
```

### 7. Relationship To Existing Release Evidence

Keep `release/manifest.json` as the small runtime manifest consumed by admin
diagnostics.

Add image provenance as a separate artifact rather than adding large scan/SBOM
payloads into `release/manifest.json`.

Optional integration:

- `scripts/generate-release-evidence.ts` may include a pointer to the latest
  05E image provenance artifact later.
- The first 05E implementation can stand alone if it writes phase evidence and
  updates this phase doc.

Important build-order rule:

- `npm run release:prepare` currently runs a host `next build` and then writes
  `release/manifest.json`.
- The Docker release build also runs `next build` inside the image builder
  stage.
- 05E should not require two Next builds only to create the manifest. Add a
  narrow package script such as
  `"release:manifest": "node scripts/generate-release-manifest.mjs"` or call
  the generator directly, then run `npm run release:verify` before Docker
  build.
- Keep existing `release:prepare` behavior for compatibility unless a later
  phase deliberately changes the broader release workflow.

### 8. Cleanup And Disk Hygiene

The release gate should remove temporary images by default after evidence is
written:

```bash
docker rmi <temporary-tag>
```

Support a preservation flag:

```text
--keep-image
```

Do not prune Docker volumes, build cache, or unrelated images inside the release
script. Broad pruning is an operator maintenance action, not a release gate.

## SOLID/Clean/GOF Notes

- Single Responsibility: image provenance lives in an appliance release module,
  not in broad product release evidence or lifecycle backup smoke code.
- Facade: one CLI script exposes the release gate while delegating to existing
  tests, release scripts, Docker, Rust, and scanner adapters.
- Adapter: SBOM, vulnerability scanning, signing, Docker inspect, and command
  execution are pluggable tool adapters.
- Strategy: local alpha can allow missing optional scanners; formal release can
  require them.
- Chain Of Responsibility: gates run in order and stop/mark blocked based on
  explicit policy.
- Fail Fast: missing critical prerequisites fail before publishing.
- Evidence Builder: command results are normalized into a stable evidence DTO
  and rendered to JSON plus Markdown.
- Open/Closed: Cosign/GitHub Actions/registry publishing can be added without
  changing the evidence schema or Docker hardening contracts.

## Positive Use Cases

- Maintainer runs one command and receives a release evidence file explaining
  exactly what image was built and checked.
- Local Docker build succeeds and the script records image id, digest when
  available, size, runtime user, exposed port, lockfile hashes, and smoke
  status.
- Syft or Docker SBOM exists locally, so the release gate writes an SBOM
  artifact and records its path.
- Trivy, Grype, or Docker Scout exists locally, so the release gate writes scan
  output and blocks on critical vulnerabilities.
- Rust backup executor checks pass before the image is treated as releasable.
- Temporary local release image is removed after evidence is written.

## Negative Use Cases

- `release/manifest.json` is missing or stale and release verification fails.
- `package-lock.json` or `Cargo.lock` is missing and the release gate fails.
- Docker daemon is unavailable and evidence records `environment_blocked`.
- Docker build fails because Next or Rust build fails and evidence records
  `failed`.
- Image inspection finds `/app/docs/_refactor` or provider key env values in the
  runner image and release fails.
- Critical vulnerability scan findings fail the release unless an explicit
  recorded waiver is supplied.
- Missing SBOM/scanner tooling marks the release incomplete unless a local alpha
  flag records that the omission was accepted.

## Edge Use Cases

- Docker Desktop is available but low on disk.
- Base image pull fails because network is unavailable.
- Docker build succeeds but repo digest is unavailable because the image has not
  been pushed.
- Scanner output formats differ by tool version.
- `cargo deny` is not installed even though `deny.toml` exists.
- Worktree is dirty during local alpha evidence generation.
- Build is run from CI with no access to local `.env.local`.
- Image tag points at an existing local image.
- Full test suite is intentionally skipped for a fast local candidate release.

## Out Of Scope

- automatic registry publish
- GitHub Actions workflow creation
- mandatory Cosign signing for all local alpha builds
- Sigstore key management
- Traefik/Ordo Studio platform deployment
- tenant lifecycle provisioning
- Docker cache pruning or volume cleanup
- rewriting the Next/Rust build system
- replacing broad product `release:evidence`

## Implementation Order

1. Fix current `npm run scan:secrets` fixture hygiene.
   - Prefer replacing fake key strings with non-matching fixture values.
   - If an allowlist is needed, keep it explicit, narrow, and documented in
     evidence.
2. Fix current Rust formatting drift so `cargo fmt --check` passes.
3. Add release evidence domain types and renderer for 05E.
4. Add shared command runner helpers or reuse the existing appliance command
   runner with sanitized summaries.
5. Add source/toolchain metadata collection:
   - git revision, branch, dirty status
   - Node/npm versions
   - Rust/cargo versions
   - Docker version
   - SHA-256 hashes for `package-lock.json`, `Cargo.lock`, `Dockerfile`,
     `rust-toolchain.toml`, `compose.yaml`, and `compose.hosted.yaml`
6. Add Rust package scripts or direct release-gate commands.
7. Add focused image gate command list:
   - `npm run native:check`
   - `npm run validate:env`
   - `npm run scan:secrets`
   - `npm run typecheck`
   - focused image/security/network/secret tests
   - Rust fmt/test/clippy and optional deny
   - release manifest generation through a narrow manifest command or direct
     `scripts/generate-release-manifest.mjs` invocation
   - `npm run release:verify`
8. Add Docker build, inspect, digest, and cleanup adapters.
9. Add optional SBOM, vulnerability scan, and signing adapters.
10. Add CLI flags:
   - `--full-test`
   - `--allow-missing-scanners`
   - `--skip-sign`
   - `--sign`
   - `--keep-image`
   - `--tag <image-tag>`
11. Add `npm run appliance:release`.
12. Add tests for evidence classification, command planning, optional-tool
    handling, Docker failure classification, and secret-safe rendering.
13. Run the release gate locally and record evidence.
14. Update this phase doc with implementation closeout.

## Required Tests

Add or update focused tests for:

- evidence DTO:
  - passed status with required gates and image digest
  - failed status with app/Rust/test blocker
  - environment-blocked status with Docker daemon or disk failure
  - incomplete status when SBOM/scanner tools are missing without override
  - secret-safe Markdown rendering
- command planning:
  - default gate includes focused image/security/network/secret tests
  - `--full-test` includes full `npm test`
  - local alpha flag allows missing scanners but records warning
  - formal/default policy marks missing scanners incomplete
- source metadata:
  - lockfile hashes are stable SHA-256 strings
  - missing lockfile is a blocker
  - dirty worktree is recorded without failing local alpha by default
- Docker adapter:
  - daemon unavailable classified as `environment_blocked`
  - low disk stderr classified as `environment_blocked`
  - Dockerfile/app build error classified as `failed`
  - image inspect captures user, exposed ports, id, size, and digest when
    available
  - image runner assertion command does not print env values
  - cleanup runs unless `--keep-image` is set
- tool adapters:
  - Syft/Docker SBOM unavailable path
  - Trivy/Grype/Docker Scout unavailable path
  - critical vulnerability count blocks release
  - Cosign skipped by default and signed only when explicitly enabled
- package scripts:
  - `appliance:release` exists
  - Rust check scripts exist or release gate invokes the commands directly

Required verification commands after implementation:

```bash
npm test -- tests/image-security-contract.test.ts tests/hosted-network-contract.test.ts tests/image-runtime-bundle-contract.test.ts tests/docker-appliance-lifecycle.contract.test.ts tests/appliance-lifecycle-smoke.test.ts tests/release-manifest.test.ts
npm test -- src/lib/appliance/release/appliance-image-release.test.ts tests/appliance-image-release-cli.test.ts
npm run typecheck
npm run scan:secrets
cargo fmt --check
cargo test -p ordo-backup
cargo clippy -p ordo-backup -- -D warnings
node scripts/generate-release-manifest.mjs
npm run release:verify
docker compose config --services
docker compose -f compose.hosted.yaml config --services
npm run appliance:release -- --allow-missing-scanners
```

If Docker is unavailable, `npm run appliance:release -- --allow-missing-scanners`
must still write evidence with `environment_blocked` and must not be presented
as a passed release.

## Exit Criteria

- A single `npm run appliance:release` command exists.
- `npm run scan:secrets` passes without broad hidden allowlists.
- `cargo fmt --check` passes.
- The command writes JSON and Markdown evidence under
  `docs/_refactor/appliance-lifecycle-proof/evidence/`.
- Evidence records git, Node, npm, Rust, cargo, Docker, lockfile hashes, image
  tag, image id, image digest when available, base image references, image size,
  runtime user, exposed ports, gate statuses, SBOM status, vulnerability status,
  signing status, warnings, and blockers.
- Docker build and image inspect are part of the release gate.
- Runner image inspection proves required runtime files exist and host-only docs
  and provider secret env values are absent.
- Docker environment blockers are distinguished from product failures.
- Optional scanner/signing tools are handled through explicit adapters and
  evidence statuses.
- Critical vulnerability findings block release by default.
- Rust fmt/test/clippy checks are included; `cargo deny` is run when available
  and otherwise recorded as skipped/incomplete.
- Temporary release images are removed unless explicitly preserved.
- Evidence remains secret-safe and path-safe.
- Tests cover positive, negative, and edge cases.

## QA Certification

Reviewed: 2026-05-03

Decision: implemented and verified.

The phase is now grounded in the current codebase and the completed 05A-05D
contracts. The recommended implementation is a focused appliance image release
gate, not a rewrite of the existing broad product release evidence system.

QA adjustments made before certification:

- corrected Rust Docker grounding to `rust:1-alpine` plus
  `rust-toolchain.toml`, with evidence required to record actual `rustc`
  output.
- replaced the implied `npm run release:prepare` dependency with a narrow
  manifest-generation requirement so 05E does not force a duplicate host
  `next build` before Docker build.
- recorded the current secret-scan fixture failure as an implementation item so
  05E cannot falsely claim secret hygiene.
- recorded current Rust formatting drift as an implementation item so 05E
  cannot falsely claim Rust release hygiene.
- kept broad product `release:evidence` out of the implementation path while
  allowing a future pointer to image provenance.

## Implementation Closeout

Completed: 2026-05-03

Evidence:

- `../evidence/05e-release-supply-chain-and-image-provenance-2026-05-03.md`
- `../evidence/05e-release-supply-chain-and-image-provenance-2026-05-03.json`

Implemented files:

- `src/lib/appliance/release/appliance-image-release.ts`
- `src/lib/appliance/release/appliance-image-release.test.ts`
- `scripts/run-appliance-image-release.ts`
- `tests/appliance-image-release-cli.test.ts`
- `package.json`

Hygiene fixes completed:

- neutralized tracked fake secret strings so `npm run scan:secrets` passes.
- formatted the Rust backup crate so `cargo fmt --check` passes.

Release gate implemented:

- `npm run appliance:release`
- `npm run release:manifest`
- `npm run rust:fmt`
- `npm run rust:test`
- `npm run rust:clippy`
- `npm run rust:deny`

The release gate now records:

- git revision, branch, and dirty-worktree status
- Node, npm, Rust, cargo, and Docker versions
- SHA-256 hashes for lockfiles and image contract files
- image tag, image id, digest when available, size, user, exposed ports, labels,
  and base image references
- command gate statuses
- SBOM status
- vulnerability scan status
- signing status
- warnings and blockers

The implemented Docker runner assertion verifies:

- `/app/bin/ordo-backup` exists and is executable
- `/app/docs/_corpus` exists
- `/app/release/manifest.json` exists
- `/app/docs/_refactor` is absent
- `/app/docs/_review` is absent
- provider and install secret env values are not baked into the image env

Verification summary:

- focused 05E tests passed: 8 files, 24 tests.
- new release tests passed: 2 files, 7 tests.
- `npm run typecheck` passed.
- `npm run scan:secrets` passed.
- `cargo fmt --check` passed.
- `cargo test -p ordo-backup` passed.
- `cargo clippy -p ordo-backup -- -D warnings` passed.
- `node scripts/generate-release-manifest.mjs` passed.
- `npm run release:verify` passed.
- `docker compose config --services` passed.
- `docker compose -f compose.hosted.yaml config --services` passed.
- `npm run appliance:release -- --allow-missing-scanners` passed and wrote
  05E evidence.

Residual release-environment notes:

- no supported SBOM tool was available locally.
- no supported vulnerability scanner was available locally.
- those were recorded as warnings because the local release run explicitly used
  `--allow-missing-scanners`.
- the temporary local image created by the release gate was removed after
  evidence was written.
