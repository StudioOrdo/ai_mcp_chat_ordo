# Phase 05C - Image Minimization And Runtime Bundle

Status: complete

## Goal

Reduce the production image contents without breaking the single-image
appliance model established by Phases 05A and 05B.

This phase is not a cosmetic Docker cleanup. It creates a runtime bundle
contract: every file class copied into the production image must be either
required by the live appliance, required by supervised workers, required by
operator diagnostics, or explicitly excluded.

The current image remains intentionally broad where production still runs
TypeScript entrypoints through `tsx`. This phase now inventories and guards the
bundle, removes proven broad copies, and defers compiled worker entrypoints
until the runtime contract is stable.

## Current Code Grounding

Ground this phase in:

- `Dockerfile`
  - uses `node:22.22.2-alpine` for the runner.
  - installs `ffmpeg` in the runner for media generation.
  - copies full `node_modules` from the dependency stage.
  - copies `package.json`, `tsconfig.json`, `next.config.ts`, `.next`,
    `public`, `docs/_corpus`, `release/manifest.json`, `config`, `scripts`,
    `mcp`, `src`, and Rust `bin/ordo-backup`.
  - runs `scripts/start-server.mjs` as non-root `nextjs`.
- `.dockerignore`
  - excludes `node_modules`, `.next`, coverage, `.data`, `.runtime-logs`,
    Playwright data, `.git`, logs, JSONL files, `.env*`, `tests`, `.github`,
    `vitest.config.ts`, `lighthouse-prod.json`, and `lint_results.txt`.
  - excludes `*.md` except `README.md`, which means Markdown-heavy `docs`
    runtime behavior must be proven by an image inventory check rather than
    assumed from source tree contents.
- `scripts/start-server.mjs`
  - verifies native runtime compatibility through
    `scripts/check-native-runtime.mjs`.
  - loads `.next/required-server-files.json`.
  - owns the single-writer `.data` lock.
  - supervises TypeScript workers through `node_modules/tsx/dist/cli.mjs`.
  - supervises the Rust backup executor at `bin/ordo-backup`.
- Supervised worker entrypoints
  - `scripts/process-deferred-jobs.ts`
  - `scripts/media-worker-server.ts`
  - `scripts/process-backup-scheduler.ts`
  - these import source modules through the `@/` TypeScript path alias, so
    `src`, `scripts`, `tsconfig.json`, and `tsx` are runtime requirements
    until a compiled worker bundle replaces them.
- MCP runtime
  - `src/core/capability-catalog/mcp-process-metadata.ts` declares
    `mcp/admin-web-search-server.ts`, `mcp/calculator-server.ts`,
    `mcp/generate-audio-server.ts`, and `mcp/operations-server.ts`.
  - `src/lib/capabilities/mcp-stdio-adapter.ts` launches MCP processes with
    `node_modules/.bin/tsx` and a container root of `/app`.
  - `mcp/operations-server.ts` reads `docs/_corpus` for librarian tools.
  - `mcp` cannot be removed while MCP stdio tools are still exposed through
    the runtime capability system.
- Runtime documents and config
  - `src/adapters/FileSystemCorpusRepository.ts` reads `docs/_corpus`.
  - `src/app/api/hero/proof-points/route.ts` uses the corpus repository.
  - `mcp/operations-server.ts` reads and mutates `docs/_corpus`.
  - `src/lib/config/instance.ts` reads `config/identity.json`,
    `config/prompts.json`, `config/services.json`, and `config/tools.json`.
  - `compose.yaml` and `compose.hosted.yaml` mount `/app/config` read-only,
    but the image still needs default config files for one-command operation.
  - `src/lib/admin/processes.ts` reads `release/manifest.json` for diagnostics.
- Existing tests
  - `tests/docker-runtime-contract.test.ts`
  - `tests/docker-appliance-lifecycle.contract.test.ts`
  - `tests/runtime-supervision-contract.test.ts`
  - `tests/image-security-contract.test.ts`
  - `tests/hosted-network-contract.test.ts`

## QA Findings Closed

1. No explicit production bundle inventory existed.
   - Closed by `tests/image-runtime-bundle-contract.test.ts`, which asserts the
     exact runner `COPY` list.
2. The runner copies broad source directories without a file-class allowlist.
   - Closed at the top-level copy contract. `src`, `scripts`, and `mcp` remain
     intentionally retained because workers and MCP stdio tools still use TSX.
3. `docs` was copied too broadly for the intended runtime need.
   - Runtime needs `docs/_corpus` for library and MCP librarian behavior.
   - Closed by replacing the broad `docs` copy with a narrow
     `docs/_corpus` copy.
4. `release` had one runtime reason.
   - Admin diagnostics reads `release/manifest.json`.
   - Closed by replacing the broad `release` copy with a narrow
     `release/manifest.json` copy.
5. `node_modules` is currently full production-plus-build surface.
   - The image uses `tsx`, TypeScript source, Next, `better-sqlite3`, and media
     dependencies at runtime.
   - Closed as an explicit retained dependency with evidence; pruning remains
     out of scope until compiled worker/MCP bundles exist.
6. `.dockerignore` exclusions were not asserted by a focused image-bundle test.
   - Closed by contract assertions for local data, logs, env files, tests, and
     build reports.
7. No build-independent test protected against accidentally copying host-only
   evidence into the runner.
   - Closed by forbidden-copy assertions for `.env*`, `.data`, runtime logs,
     tests, Playwright artifacts, debug docs, review docs, refactor docs,
     archive docs, and personal notes.

## Implemented Contract

### 1. Add A Static Runtime Bundle Contract

Added `tests/image-runtime-bundle-contract.test.ts`.

The test parses `Dockerfile` and `.dockerignore` as source contracts and
asserts:

- the runner copies only approved runtime paths:
  - `node_modules`
  - `package.json`
  - `tsconfig.json`
  - `next.config.ts`
  - `.next`
  - `public`
  - `docs/_corpus`
  - `release/manifest.json`
  - `config`
  - `scripts`
  - `mcp`
  - `src`
  - `bin/ordo-backup`
- the runner does not copy broad host-only paths:
  - `.env`
  - `.env.local`
  - `.git`
  - `.data`
  - `.runtime-logs`
  - `.playwright-data`
  - `coverage`
  - `test-results`
  - `playwright-report`
  - `tests`
  - `.github`
  - `docs/_debug`
  - `docs/_review`
  - `docs/_refactor`
  - `docs/_archive`
  - `docs/me.txt`
- `.dockerignore` continues excluding local data, logs, env files, tests, and
  build reports.

This is a contract test, not a Docker build, so it runs quickly in normal unit
test pipelines.

### 2. Narrow Runtime Docs Instead Of Copying All Docs

Replaced the broad runner copy:

```Dockerfile
COPY --from=builder --chown=nextjs:nodejs /app/docs ./docs
```

with the narrow runtime corpus copy:

```Dockerfile
COPY --from=builder --chown=nextjs:nodejs /app/docs/_corpus ./docs/_corpus
```

Updated `.dockerignore` to keep only the corpus runtime Markdown content:

```text
*.md
!README.md
!docs/_corpus/**/*.md
!docs/_corpus/**/book.json
```

The runner does not include `_debug`, `_review`, `_refactor`, `_archive`, or
host-local personal files in the production runner.

### 3. Narrow Runtime Release Files

Replaced the broad runner copy:

```Dockerfile
COPY --from=builder --chown=nextjs:nodejs /app/release ./release
```

with:

```Dockerfile
COPY --from=builder --chown=nextjs:nodejs /app/release/manifest.json ./release/manifest.json
```

`src/lib/admin/processes.ts` only needs `release/manifest.json` for the live
admin diagnostics report. Additional release evidence belongs in source control
and external release artifacts, not inside every runtime appliance image.

### 4. Keep TypeScript Runtime Files For Now

Kept these runner copies in Phase 05C:

- `node_modules`
- `tsconfig.json`
- `next.config.ts`
- `scripts`
- `mcp`
- `src`

They are required today because:

- `scripts/start-server.mjs` launches TS workers through `tsx`.
- workers import `@/` source modules.
- MCP stdio tools launch TS entrypoints through `tsx`.
- `mcp/operations-server.ts` needs source adapters and `docs/_corpus`.

Compiled workers and MCP entrypoints remain deferred behind a later strangler
contract.

### 5. Inventory Script Decision

No separate inventory script was added. The focused contract test is sufficient
for this phase and avoids a second source of truth. Docker build proof remains
05E scope.

## Files Changed

- `.dockerignore`
- `Dockerfile`
- `tests/image-runtime-bundle-contract.test.ts`
- `docs/_refactor/appliance-lifecycle-proof/phases/05c-image-minimization-and-runtime-bundle.md`
- `docs/_refactor/appliance-lifecycle-proof/phases/README.md`
- `docs/_refactor/appliance-lifecycle-proof/evidence/05c-image-minimization-and-runtime-bundle-2026-05-03.md`

## QA Certification

Reviewed: 2026-05-03

Decision: implemented and verified.

Evidence:

- `../evidence/05c-image-minimization-and-runtime-bundle-2026-05-03.md`

Commands passed:

```text
npm test -- tests/image-runtime-bundle-contract.test.ts
npm test -- tests/image-runtime-bundle-contract.test.ts tests/image-security-contract.test.ts tests/docker-runtime-contract.test.ts tests/docker-appliance-lifecycle.contract.test.ts tests/runtime-supervision-contract.test.ts tests/hosted-network-contract.test.ts tests/process-deferred-jobs-entrypoint.test.ts src/lib/capabilities/mcp-process-runtime.test.ts tests/corpus/book-discovery.test.ts tests/corpus/librarian-tools.test.ts
npm run typecheck
npx eslint tests/image-runtime-bundle-contract.test.ts
docker compose config --services
docker compose -f compose.hosted.yaml config --services
```

Repeat QA also passed these same focused gates after the documentation update.
After Docker was healthy again, `docker build --target runner -t
studioordo:phase05c-qa .` completed successfully. The build reached and passed
the narrowed `docs/_corpus`, `release/manifest.json`, and Rust executor copy
steps. A runtime image inspection verified that broad host-only docs were not
present, `release/manifest.json` was present, and `/app/bin/ordo-backup` was
executable.

Docker emitted build warnings about the placeholder env names
`ANTHROPIC_API_KEY` and `OPENAI_API_KEY`; Phase 05D owns removing or replacing
that secret-shaped build-env pattern.

The first draft of the new contract test incorrectly treated the legitimate
`/app/.data` volume and environment references as forbidden. The test was
tightened to inspect runner `COPY` lines only, which is the actual bundle
surface being governed by this phase.

## SOLID/Clean/GOF Notes

- Single Responsibility: image bundle tests verify packaging only; they should
  not test app behavior.
- Strangler Fig: keep TSX runtime entrypoints now, then replace them with
  compiled worker/MCP bundles one at a time after this contract exists.
- Dependency Inversion: future supervisor code should launch configured worker
  artifacts instead of hardcoded development source paths.
- Contract Test: Dockerfile and `.dockerignore` become reviewed public
  contracts for what can enter the appliance image.
- Open/Closed: future runtime paths must be added to the allowlist with a reason
  instead of silently expanding the image.

## Positive Use Cases

- Production image still runs the Next app.
- Deferred job worker still starts.
- Media worker still starts and still has `ffmpeg`.
- Backup scheduler still starts.
- Rust backup executor still runs from `bin/ordo-backup`.
- MCP stdio tools still resolve their TypeScript entrypoints.
- Library and librarian flows still read `docs/_corpus`.
- Admin diagnostics still reads `release/manifest.json`.
- Default config files still exist for one-command startup.

## Negative Use Cases

- `.env.local` or any raw `.env*` file enters the image.
- `.data/local.db`, backups, uploads, or runtime logs enter the image.
- `tests`, Playwright reports, coverage, or CI-only files enter the image.
- `docs/_debug`, `docs/_review`, `docs/_refactor`, or personal notes enter the
  image.
- Removing `src` while TSX workers still import `@/` breaks worker startup.
- Removing `mcp` while MCP process metadata still advertises stdio entrypoints
  breaks tool execution.

## Edge Use Cases

- `.dockerignore` excludes Markdown broadly; corpus Markdown must be explicitly
  re-included if the runtime copy narrows to `docs/_corpus`.
- `release/manifest.json` may be absent in local development; runtime
  diagnostics already degrade gracefully, but Docker build should either copy
  the generated manifest or generate it before release builds.
- `better-sqlite3` native module must match Node 22 inside the image.
- `tsx` must remain available while workers and MCP servers are TypeScript.
- Source maps and compiled Next artifacts should not expose more source than
  the current TypeScript runtime requirement already forces.
- Read-only root filesystem means no runtime path should write outside
  `/app/.data`, `/tmp`, `/app/.runtime-logs`, or `/app/.next/cache`.

## Out Of Scope

- Distroless image conversion.
- Compiled worker/MCP runtime bundle.
- Dependency pruning to production-only modules.
- SBOM, scan, signing, and image digest release gates; those belong to 05E.
- Secret loading, first-boot lock, and redaction; those belong to 05D.
- CPU, memory, pids, log rotation, and tmpfs sizing; those belong to 05F.
- Traefik labels and platform orchestration.

## Exit Criteria Met

- `tests/image-runtime-bundle-contract.test.ts` exists and passes.
- Dockerfile runner copy list is allowlisted by test.
- `.dockerignore` forbidden runtime artifacts are asserted by test.
- Broad `docs` copy is replaced by a narrow corpus runtime copy.
- Broad `release` copy is replaced by a narrow manifest runtime copy.
- TSX-dependent runtime copies are explicitly retained with evidence:
  `node_modules`, `tsconfig.json`, `next.config.ts`, `scripts`, `mcp`, and
  `src`.
- Existing single-image and security tests pass:
  - `tests/image-security-contract.test.ts`
  - `tests/docker-runtime-contract.test.ts`
  - `tests/docker-appliance-lifecycle.contract.test.ts`
  - `tests/runtime-supervision-contract.test.ts`
  - `tests/hosted-network-contract.test.ts`
- Focused runtime tests pass:
  - `tests/process-deferred-jobs-entrypoint.test.ts`
  - `src/lib/capabilities/mcp-process-runtime.test.ts`
  - corpus/library tests that cover `docs/_corpus`
- Evidence is recorded at:
  - `../evidence/05c-image-minimization-and-runtime-bundle-2026-05-03.md`
