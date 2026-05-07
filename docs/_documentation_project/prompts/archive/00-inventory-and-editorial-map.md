# Phase 00 Prompt: Inventory And Editorial Map

Implement `/Users/kwilliams/Projects/ordoSite/docs/_documentation_project/phases/00-inventory-and-editorial-map.md`.

Before executing, read `docs/_documentation_project/prompts/semi-autonomous-phase-execution.md` and use it as the standing operating contract for this documentation phase.

Heads down.

This is a documentation manufacturing phase, not a product-code phase. The goal is to prepare the public documentation and GitHub customization rewrite with the same care normally applied to code: inventory first, claim discipline, prose QA, reader QA, evidence, and deterministic handoff.

Do not rewrite the public README yet. Do not add issue templates yet. Do not archive docs yet. This phase builds the evidence map and editorial story map so the next writing phases can move fast without becoming vague, bloated, or ungrounded.

## Governing Contracts

- `docs/_documentation_project/README.md`
- `docs/_documentation_project/editorial-standard.md`
- `docs/_documentation_project/github-customization-plan.md`
- `docs/_documentation_project/phase-plan.md`
- `docs/_documentation_project/prompts/semi-autonomous-phase-execution.md`
- `docs/_business/01_founding_thesis.md`
- `docs/_business/02_the_bottega_model.md`
- `docs/_business/06_the_production_engine.md`
- `docs/_business/07_governance_and_process.md`
- `docs/_business/ordo_process.md`
- `docs/_business/ux/02-message-and-tone.md`
- `docs/_business/architecture/05-ordo-development-workflow.md`

## Core Invariant

Great documentation is product work. Public prose must be succinct, powerful, inspirational, real, grounded, and written in Keith's register: direct, strategic, civic, human, impatient with fluff, and protective of quality.

## Documentation Project Sequence

1. `docs/_documentation_project/phases/00-inventory-and-editorial-map.md`
2. `docs/_documentation_project/phases/01-root-readme-and-state-of-project.md`
3. `docs/_documentation_project/phases/02-docs-index-and-archive-cleanup.md`
4. `docs/_documentation_project/phases/03-github-community-surface.md`
5. `docs/_documentation_project/phases/04-public-prose-polish-and-cognitive-load-pass.md`
6. `docs/_documentation_project/phases/05-closeout-and-stop.md`

At the end of Phase 05, replace `docs/_refactor/ordo/prompts/next.md` with the stop prompt defined in `docs/_documentation_project/phases/05-closeout-and-stop.md`. Do not invent phases after Phase 05.

## Phase Scope

- Inventory current public docs and GitHub surfaces.
- Create a claim ledger for public docs.
- Decide which docs are active, source material, stale, archive candidates, or public-facing.
- Define the intended reader journey from README to docs to GitHub issues.
- Identify implemented, active-refactor, alpha-track, and vision claims.
- Identify prose risks and cognitive-load risks.
- Produce evidence only; do not perform the public rewrite in this phase.

## Current-Code And Doc Anchors

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

## Editorial Rules

- No writing before inventory.
- Claims need evidence or a clear direction label.
- Preserve founder voice without turning docs into a memoir.
- Keep public docs grounded in current repo truth.
- Separate implemented capability from alpha-track direction.
- Do not claim automatic GitHub issue creation until implemented and validated.
- Do not call the system production-ready unless release evidence proves the specific surface.
- Do not imitate any publication's style; use high editorial discipline, compression, factual rigor, and rhythm.
- Avoid cognitive overload. The reader should always know what Ordo is, what is real, and what to do next.

## Required Output

Create `docs/_documentation_project/evidence/00-inventory-and-editorial-map.md` with these sections:

- public surface inventory
- reader journey map
- claim ledger with implemented / active refactor / alpha track / vision labels
- stale docs and archive candidates
- GitHub customization gap list
- prose risks and cognitive-load risks
- claims to promote into the README/state docs
- claims to downgrade or reject
- Phase 01 prompt handoff confirmation

## QA Pass 1

- Read the phase spec and every governing doc above.
- Verify all current-code and doc anchors exist.
- Search for current GitHub issue templates and public metadata.
- Search docs for stale top-level folder references.
- Search code for the systems the README may claim: jobs, factory, QA reports, WASM/media, RAG/vector search, backup/restore, Rust/TypeScript boundary.
- Draft the evidence file only after searches are complete.
- Downgrade any ungrounded claim.

## QA Pass 2

- Re-read the evidence file for overclaims, repetition, and cognitive load.
- Confirm each public claim has a repo anchor or a direction label.
- Confirm archive candidates are not active governing docs.
- Confirm GitHub automation is framed as alpha-track direction unless code proves otherwise.
- Confirm `docs/_refactor/ordo/prompts/next.md` points to Phase 01.
- Fix every issue found.

## Required Commands

```bash
find docs -maxdepth 3 -type f | sort
find .github -maxdepth 3 -type f | sort
rg -n "_specs|_reference|operations/|coming soon|fake|sample|world-class|revolutionary|seamless|AI-powered" README.md docs/README.md CONTRIBUTING.md docs .github
rg -n "GitHub issue|qa report|QA report|work order|deferred job|browser_wasm|VectorStore|SQLiteVectorStore|LocalEmbedder|backup|rust_daemon" README.md docs src crates .github
rg -n "automatically files|automatically resolves|fully implemented|production ready|complete platform" README.md docs .github
```

## Prompt Handoff Requirement

At closeout, write the next phase execution prompt to:

- `docs/_refactor/ordo/prompts/next.md`

Also copy the same prompt to:

- `docs/_documentation_project/prompts/archive/01-root-readme-and-state-of-project.md`

The next prompt must target:

- `/Users/kwilliams/Projects/ordoSite/docs/_documentation_project/phases/01-root-readme-and-state-of-project.md`

The next prompt must include:

- exact phase file path
- governing docs
- phase-specific scope boundaries
- current-code and public-doc anchors from the phase
- editorial rules
- claim discipline rules
- QA pass 1 and QA pass 2 instructions
- required commands
- static scans
- final answer requirements
- prompt handoff requirement for Phase 02

## Do Not Stop Until

- `docs/_documentation_project/evidence/00-inventory-and-editorial-map.md` exists.
- All required searches/scans are run and reviewed.
- QA pass 1 is complete.
- QA pass 2 is complete.
- Phase 00 status is updated from Planned to Complete.
- `docs/_refactor/ordo/prompts/next.md` contains the Phase 01 prompt.
- `docs/_documentation_project/prompts/archive/01-root-readme-and-state-of-project.md` contains the same Phase 01 prompt.
- Final answer lists files changed, searches/scans run, claims promoted, claims downgraded/rejected, prose risks, cognitive-load risks, next prompt files written, and remaining explicit risks.
