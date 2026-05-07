# Phase 00: Inventory And Editorial Map

Status: Complete

## Goal

Build the evidence map for public documentation before rewriting anything.

This phase decides what can be claimed, what must be labeled as direction, what
needs to be archived, and what each public surface should do.

## Governing Docs

- `docs/_documentation_project/README.md`
- `docs/_documentation_project/editorial-standard.md`
- `docs/_documentation_project/github-customization-plan.md`
- `docs/_business/01_founding_thesis.md`
- `docs/_business/02_the_bottega_model.md`
- `docs/_business/06_the_production_engine.md`
- `docs/_business/07_governance_and_process.md`
- `docs/_business/ordo_process.md`
- `docs/_business/ux/02-message-and-tone.md`
- `docs/_business/architecture/05-ordo-development-workflow.md`

## Current Code And Doc Anchors

- `README.md`
- `docs/README.md`
- `CONTRIBUTING.md`
- `.github/ISSUE_TEMPLATE/agent-runtime-integrity.yml`
- `package.json`
- `src/lib/jobs/deferred-job-runtime.ts`
- `src/lib/jobs/job-capability-registry.ts`
- `src/lib/factory/production-orchestrator.ts`
- `src/core/entities/qa-report.ts`
- `src/lib/factory/qa-evaluator.ts`
- `src/lib/media/browser-runtime/ffmpeg-browser-executor.ts`
- `src/core/search/HybridSearchEngine.ts`
- `src/adapters/SQLiteVectorStore.ts`
- `src/adapters/LocalEmbedder.ts`
- `src/lib/appliance/backup/backup-command-service.ts`
- `src/lib/appliance/native/native-command-contract.ts`
- `crates/ordo-backup`
- `crates/ordo-daemon`

## Scope

- Inventory public docs and GitHub surfaces.
- Create a claim ledger for public docs.
- Decide which docs are active, source material, stale, archive candidates, or
  public-facing.
- Define the intended reader journey from README to docs to GitHub issues.
- Do not rewrite root docs yet except to fix obvious broken links discovered by
  validation.

## Outputs

- `docs/_documentation_project/evidence/00-inventory-and-editorial-map.md`
- updated status in this phase doc
- next prompt for Phase 01

## Required Evidence Sections

The evidence file must include:

- public surface inventory
- claim ledger with implemented / active refactor / alpha track / vision labels
- stale docs and archive candidates
- GitHub customization gap list
- reader journey map
- prose risks and cognitive-load risks

## QA Pass 1

- Verify all anchors exist.
- Search for current GitHub issue templates and public metadata.
- Search docs for stale top-level folder references.
- Search code for the systems the README may claim: jobs, factory, QA reports,
  WASM/media, RAG/vector search, backup/restore, Rust/TypeScript boundary.
- Draft evidence only after searches are complete.

## QA Pass 2

- Re-read the evidence file for overclaims.
- Confirm each public claim has a repo anchor or a direction label.
- Confirm archive candidates are not active governing docs.
- Confirm Phase 01 prompt is written and archived.

## Required Commands

```bash
find docs -maxdepth 3 -type f | sort
find .github -maxdepth 3 -type f | sort
rg -n "_specs|_reference|operations/|coming soon|fake|sample|world-class|revolutionary|seamless|AI-powered" README.md docs/README.md CONTRIBUTING.md docs .github
rg -n "GitHub issue|qa report|QA report|work order|deferred job|browser_wasm|VectorStore|SQLiteVectorStore|LocalEmbedder|backup|rust_daemon" README.md docs src crates .github
```

## Static Scans

```bash
rg -n "automatically files|automatically resolves|fully implemented|production ready|complete platform" README.md docs .github
```

## Acceptance Criteria

- Evidence map exists and is specific enough to guide rewriting.
- No public claim category is ambiguous.
- Phase 01 has a precise execution prompt.
- No docs are archived in this phase.
