# Phase 05C Evidence - Image Minimization And Runtime Bundle

Date: 2026-05-03

## Decision

Phase 05C is implemented and verified.

The production runner image now has a focused runtime bundle contract. Broad
runtime copies were reduced where the current code allowed it:

- `docs` is no longer copied wholesale.
- `docs/_corpus` is copied for library and MCP librarian runtime behavior.
- `release` is no longer copied wholesale.
- `release/manifest.json` is copied for admin diagnostics.

The following runtime paths remain intentionally retained:

- `node_modules`
- `tsconfig.json`
- `next.config.ts`
- `scripts`
- `mcp`
- `src`

They are still required because the production supervisor launches TypeScript
workers and MCP stdio entrypoints through `tsx`.

## Files Changed

- `.dockerignore`
- `Dockerfile`
- `tests/image-runtime-bundle-contract.test.ts`
- `docs/_refactor/appliance-lifecycle-proof/phases/05c-image-minimization-and-runtime-bundle.md`
- `docs/_refactor/appliance-lifecycle-proof/phases/README.md`

## Code-Grounded Runtime Reasons

- `scripts/start-server.mjs` launches:
  - `scripts/process-deferred-jobs.ts`
  - `scripts/media-worker-server.ts`
  - `scripts/process-backup-scheduler.ts`
- `src/lib/capabilities/mcp-stdio-adapter.ts` launches MCP entrypoints through
  `node_modules/.bin/tsx`.
- `src/core/capability-catalog/mcp-process-metadata.ts` declares MCP
  TypeScript entrypoints under `mcp/`.
- `mcp/operations-server.ts` reads `docs/_corpus`.
- `src/adapters/FileSystemCorpusRepository.ts` reads `docs/_corpus`.
- `src/lib/config/instance.ts` reads `config/*.json`.
- `src/lib/admin/processes.ts` reads `release/manifest.json`.

## Verification

Passed:

```text
npm test -- tests/image-runtime-bundle-contract.test.ts
```

Result:

```text
Test Files  1 passed (1)
Tests       5 passed (5)
```

Passed:

```text
npm test -- tests/image-runtime-bundle-contract.test.ts tests/image-security-contract.test.ts tests/docker-runtime-contract.test.ts tests/docker-appliance-lifecycle.contract.test.ts tests/runtime-supervision-contract.test.ts tests/hosted-network-contract.test.ts tests/process-deferred-jobs-entrypoint.test.ts src/lib/capabilities/mcp-process-runtime.test.ts tests/corpus/book-discovery.test.ts tests/corpus/librarian-tools.test.ts
```

Result:

```text
Test Files  10 passed (10)
Tests       63 passed (63)
```

Passed:

```text
npm run typecheck
npx eslint tests/image-runtime-bundle-contract.test.ts
docker compose config --services
docker compose -f compose.hosted.yaml config --services
```

Compose service output:

```text
app
app
```

Repeat QA passed after documentation updates:

```text
git diff --check -- Dockerfile .dockerignore tests/image-runtime-bundle-contract.test.ts docs/_refactor/appliance-lifecycle-proof/phases/05c-image-minimization-and-runtime-bundle.md docs/_refactor/appliance-lifecycle-proof/phases/README.md docs/_refactor/appliance-lifecycle-proof/evidence/05c-image-minimization-and-runtime-bundle-2026-05-03.md
npm test -- tests/image-runtime-bundle-contract.test.ts tests/image-security-contract.test.ts tests/docker-runtime-contract.test.ts tests/docker-appliance-lifecycle.contract.test.ts tests/runtime-supervision-contract.test.ts tests/hosted-network-contract.test.ts tests/process-deferred-jobs-entrypoint.test.ts src/lib/capabilities/mcp-process-runtime.test.ts tests/corpus/book-discovery.test.ts tests/corpus/librarian-tools.test.ts
npm run typecheck
npx eslint tests/image-runtime-bundle-contract.test.ts
docker compose config --services
docker compose -f compose.hosted.yaml config --services
```

Repeat result:

```text
Test Files  10 passed (10)
Tests       63 passed (63)
```

## Docker Build Proof

An additional image build proof was attempted during repeat QA before Docker
maintenance:

```text
docker build --target runner -t studioordo:phase05c-qa .
```

Result:

```text
ERROR: failed to build: EOF
```

Fallback checks showed a local Docker Desktop/daemon issue rather than a
Dockerfile copy-path failure:

```text
docker info --format '{{json .ServerVersion}} {{json .Driver}} {{json .BuildkitVersion}}'
DOCKER_BUILDKIT=0 docker build --target runner -t studioordo:phase05c-qa .
```

Both fallback commands hung without reaching a Dockerfile step and were stopped.
The source-level image bundle contract, compose rendering, typecheck, lint, and
focused runtime tests all passed. Full image build provenance remains Phase 05E
scope, but this repeat QA records the attempted build and the local Docker
blocker explicitly.

After Docker Desktop was healthy again and Docker cache was pruned, the same
build was rerun successfully:

```text
docker build --target runner -t studioordo:phase05c-qa .
```

Result:

```text
#30 [runner 11/18] COPY --from=builder --chown=nextjs:nodejs /app/docs/_corpus ./docs/_corpus
#30 DONE 0.1s
#31 [runner 12/18] COPY --from=builder --chown=nextjs:nodejs /app/release/manifest.json ./release/manifest.json
#31 DONE 0.0s
#36 [runner 17/18] COPY --from=rust-builder --chown=nextjs:nodejs /app/target/release/ordo-backup ./bin/ordo-backup
#36 DONE 0.0s
#38 writing image sha256:2684ea6fd062330a3f550d90b86acc9640f09a909384ba99cd45eaac26ee87fd done
#38 naming to docker.io/library/studioordo:phase05c-qa done
```

The build emitted two Docker warnings:

```text
SecretsUsedInArgOrEnv: Do not use ARG or ENV instructions for sensitive data (ENV "ANTHROPIC_API_KEY") (line 21)
SecretsUsedInArgOrEnv: Do not use ARG or ENV instructions for sensitive data (ENV "OPENAI_API_KEY") (line 22)
```

Those are build placeholder env names, not real secrets in this run. They are
tracked for Phase 05D, which owns secrets and first-boot hardening.

Image contents were then inspected:

```text
docker run --rm --entrypoint sh studioordo:phase05c-qa -lc 'set -eu; test -d /app/docs/_corpus; test -f /app/release/manifest.json; test ! -e /app/docs/_debug; test ! -e /app/docs/_review; test ! -e /app/docs/_refactor; test ! -e /app/docs/_archive; test ! -e /app/docs/me.txt; test -x /app/bin/ordo-backup; find /app/docs -maxdepth 2 -type d | sort; find /app/release -maxdepth 1 -type f | sort; ls -l /app/bin/ordo-backup'
```

Result:

```text
/app/docs
/app/docs/_corpus
/app/docs/_corpus/_archive
/app/docs/_corpus/architecture-reference
/app/docs/_corpus/field-guide
/app/docs/_corpus/operators-handbook
/app/docs/_corpus/studio-ordo-thesis
/app/docs/_corpus/system-docs
/app/release/manifest.json
-rwxr-xr-x    1 nextjs   nodejs     4020000 May  3 05:44 /app/bin/ordo-backup
```

The temporary QA image was removed after inspection:

```text
docker image rm studioordo:phase05c-qa
docker builder prune --force
```

## Docker Disk Maintenance

Before maintenance:

```text
Filesystem: 40Gi available
Images: 23.8GB total, 17.3GB reclaimable
Containers: 9 stopped, 17.14MB reclaimable
Build Cache: 38.1GB total, 20.96GB reported reclaimable
```

Maintenance run:

```text
docker container prune --force
docker image prune --all --force
docker network prune --force
docker builder prune --all --force
```

Docker volumes were intentionally not pruned.

After maintenance and after removing the temporary QA image/cache:

```text
Filesystem: 101Gi available
Images: 0B
Containers: 0B
Build Cache: 0B
Local Volumes: 57.85MB, preserved
```

## QA Note

The first draft of `tests/image-runtime-bundle-contract.test.ts` incorrectly
checked all runner-stage text for `/app/.data`. That path is legitimate as the
durable volume, environment default, and writable directory. The test was fixed
to check runner `COPY` lines only, because Phase 05C governs image bundle
contents, not the runtime volume contract already owned by earlier phases.

## Remaining Scope

The following work is intentionally deferred:

- compiled worker and MCP runtime bundle
- production dependency pruning
- distroless conversion
- Docker build provenance, SBOM, scan, signing, and digest gates
- first-boot secret handling and redaction
- resource limits and failure posture
