# Release Gates And Evidence

This document explains the current public release-verification baseline for the
repository.

It is the operational companion to the Sprint 0 unification artifacts under
`docs/_refactor/unification/artifacts/`. Those artifacts freeze the baseline
assumptions and closeout categories. This document explains which commands and
artifacts currently back that governance story in the repo.

## 1. Public Contract

The current public-release contract is:

1. an outside reader should be able to run the repository from public docs,
   environment templates, and repo commands alone
2. release claims should be backed by reproducible commands and saved evidence,
   not only by prose
3. production-specific host or compose notes may exist as operator knowledge,
   but they must not be a hidden prerequisite for local or OSS use
4. release artifacts and docs must remain safe for source control and CI
   storage

## 2. Current Verification Ladder

Use the following ladder for the current repo baseline.

| Layer | Command | What it proves |
| --- | --- | --- |
| environment correctness | `npm run validate:env` | local runtime configuration is present and structurally valid |
| environment template parity | `npm run parity:env` | environment templates still expose the same key set |
| static and regression bundle | `npm run quality` | typecheck, strict lint, CSS lint, spacing audit, and Vitest regression suite |
| production build correctness | `npm run build` | Next.js build completes against the current workspace |
| secret hygiene | `npm run scan:secrets` | tracked files and artifacts do not obviously contain leaked secrets |
| runtime inventory baseline | `npm run runtime:inventory` | writes the current tool and corpus inventory to `release/runtime-inventory.json` |
| focused runtime-integrity gate | `npm run qa:runtime-integrity` | runs focused integrity suites plus build and writes `release/runtime-integrity-evidence.json` |
| unification seam verification | `npm run qa:unification` | runs all 190+ architecture unification tests across provider-policy, capability catalog, job publication, MCP export, registry convergence, prompt directives, and end-to-end catalog flow (Sprints 4-14) |
| release evidence aggregation | `npm run release:evidence` | writes aggregated release evidence, including `release/qa-evidence.json`, and blocks if runtime-integrity evidence is missing or failed |

For browser-facing release confidence, use `npm run browser:verify` and
`npm run browser:smoke` as additional checks rather than replacements for the
release gate above.

## 3. Machine-Readable Artifacts

The current repo already writes several machine-readable artifacts under
`release/`.

| Artifact | Produced by | Purpose |
| --- | --- | --- |
| `release/manifest.json` | `npm run release:prepare` and `npm run release:verify` workflow | build metadata and release-manifest verification input |
| `release/runtime-inventory.json` | `npm run runtime:inventory` | current role, tool, and corpus baseline inventory |
| `release/runtime-integrity-evidence.json` | `npm run qa:runtime-integrity` | pass/fail evidence for the focused runtime-integrity gate |
| `release/qa-evidence.json` | `npm run release:evidence` | aggregated release-evidence result |
| `release/canary-summary.json` | `npm run release:evidence` | summarized canary/release evidence payload used by the aggregate report |

`npm run release:evidence` also accepts repeated `--warning` and
`--manual-check` flags when a release needs explicit human review notes.

## 4. Human-Readable Baseline Artifacts

The release gate is not only machine-readable output. Sprint 0 froze the human
baseline in the unification workstream.

- `docs/_refactor/unification/artifacts/sprint-0-baseline-inventory.md`
- `docs/_refactor/unification/artifacts/sprint-0-public-release-assumption-matrix.md`
- `docs/_refactor/unification/artifacts/sprint-0-closeout-category-checklist.md`
- `docs/_refactor/unification/artifacts/sprint-0-vocabulary-and-boundary-glossary.md`
- `docs/_refactor/unification/artifacts/sprint-0-artifact-map.md`

Later sprints should update those workstream artifacts when architecture or
closeout expectations change instead of silently redefining the release story in
scattered notes.

## 5. Phase 2 Unification Gates (Sprints 9-14)

The following gates were added during the Phase 2 unification work:

| Gate | Evidence | Sprint |
| --- | --- | --- |
| Zero direct `getDb()` callers outside audit-marked exceptions | `grep -c "getDb()" across all non-audit-marked callers = 0` | Sprint 9 |
| Catalog covers all 55+ registered tools | `CAPABILITY_CATALOG` entry count ≥ 55 | Sprint 10 |
| MCP domain/transport separation verified | `mcp-domain-separation.test.ts` passes | Sprint 11 |
| Three registries replace manual descriptor calls | `registry-convergence.test.ts` passes | Sprint 12 |
| Role directives assembled from catalog, not hardcoded | `prompt-directive-unification.test.ts` passes | Sprint 13 |
| End-to-end catalog flow proven | `e2e-catalog-flow.test.ts` passes | Sprint 14 |
| Zero non-test source type errors | `npx tsc --noEmit` non-test count = 0 | Sprint 14 |

## 6. Current Public-Release Rules

These rules are part of the present repo baseline.

1. Do not publish secrets, environment values, or private infrastructure
   identifiers in docs or release artifacts.
2. Do not describe the runtime as MCP-first when the current app runtime is
   still internal-tool-registry-first and only exposes MCP as a protocol-facing
   layer.
3. Do not claim release readiness from lint, test, or build alone; the release
   evidence and secret-safety steps also matter.
4. Keep the current contribution policy explicit: public contributions are
   issue-first and code pull requests are intentionally not accepted at this
   stage.

## 7. Suggested Current Release Order

When preparing a real release from the current baseline, run commands in this
order:

1. `npm run validate:env`
2. `npm run parity:env`
3. `npm run quality`
4. `npm run build`
5. `npm run scan:secrets`
6. `npm run runtime:inventory`
7. `npm run qa:runtime-integrity`
8. `npm run qa:unification`
9. `npm run release:evidence`

If the release changes browser-visible behavior materially, add
`npm run browser:verify` and the relevant Playwright smoke coverage before the
final release decision.
