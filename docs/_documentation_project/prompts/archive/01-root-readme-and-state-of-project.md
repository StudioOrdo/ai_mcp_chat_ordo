# Phase 01 Prompt: Root README And State Of Project

Implement `/Users/kwilliams/Projects/ordoSite/docs/_documentation_project/phases/01-root-readme-and-state-of-project.md`.

Before executing, read `docs/_documentation_project/prompts/semi-autonomous-phase-execution.md` and use it as the standing operating contract for this documentation phase.

Heads down.

This is the first public rewrite phase. Phase 00 produced the evidence map; Phase 01 turns that evidence into a public front door and a concise truth ledger. Do not reopen the whole documentation strategy. Do not rewrite `docs/README.md` yet. Do not add GitHub issue templates yet. Do not archive docs yet.

## Governing Contracts

- `docs/_documentation_project/README.md`
- `docs/_documentation_project/editorial-standard.md`
- `docs/_documentation_project/phase-plan.md`
- `docs/_documentation_project/github-customization-plan.md`
- `docs/_documentation_project/prompts/semi-autonomous-phase-execution.md`
- `docs/_documentation_project/evidence/00-inventory-and-editorial-map.md`
- `docs/_business/01_founding_thesis.md`
- `docs/_business/02_the_bottega_model.md`
- `docs/_business/07_governance_and_process.md`
- `docs/_business/ordo_process.md`
- `docs/_business/ux/02-message-and-tone.md`

## Core Invariant

The README is the front door. The state-of-project document is the truth ledger behind it.

A first-time reader should understand Ordo before they see a capability dump. A serious builder should be able to verify claims without reading the entire repo.

## Phase Scope

- Rewrite `README.md` for public comprehension, engagement, and truth.
- Create `docs/state-of-the-project.md` unless a better equivalent path is justified in the evidence.
- Include July 31, 2026 alpha direction and a bounded QA volunteer invitation.
- Include fast velocity as software manufacturing, not prompt magic.
- Include implemented system categories without turning the README into a source map.
- Include AGPL, ownable/local-first, and self-hostable posture where grounded.
- Use Phase 00 evidence to classify every claim as implemented, active refactor, alpha track, or vision.

## Non-Goals

- Do not rewrite `docs/README.md`; Phase 02 owns the docs index.
- Do not add or redesign GitHub issue templates; Phase 03 owns GitHub community surface.
- Do not archive docs; Phase 02 owns archive cleanup.
- Do not claim automatic GitHub issue creation or automatic issue resolution.
- Do not claim production readiness or complete platform behavior as a global statement.

## Current-Code And Public-Doc Anchors

- `README.md`
- `docs/state-of-the-project.md` if created
- `docs/_documentation_project/evidence/00-inventory-and-editorial-map.md`
- `docs/_business/01_founding_thesis.md`
- `docs/_business/02_the_bottega_model.md`
- `docs/_business/06_the_production_engine.md`
- `docs/_business/07_governance_and_process.md`
- `docs/_business/ordo_process.md`
- `docs/_business/ux/02-message-and-tone.md`
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

## Required Outputs

- Rewritten `README.md`.
- New `docs/state-of-the-project.md` or documented equivalent.
- Updated Phase 01 status from Planned to Complete when acceptance criteria are met.
- Phase 02 prompt in `docs/_refactor/ordo/prompts/next.md`.
- Matching Phase 02 archived prompt in `docs/_documentation_project/prompts/archive/02-docs-index-and-archive-cleanup.md`.

## Editorial Rules

- Lead with the human promise, then prove it.
- Use Keith's register: direct, civic, ambitious, practical, human, technically serious, impatient with fluff.
- Keep the first screen light.
- Use strong nouns and short sections.
- Preserve enough technical detail for serious builders to trust the project.
- Do not turn the README into an implementation diary.
- Do not imitate any publication's style.

## Claim Discipline Rules

- Every public claim must be grounded in Phase 00 evidence, current code, current docs, tests, or an explicit direction label.
- Use these labels in the state doc: Implemented, Active refactor, Alpha track, Vision.
- GitHub issue automation is alpha-track direction unless new code proves otherwise.
- Backup/restore should be framed as a foundation unless end-user restore completeness is verified in this phase.
- Avoid unsupported uses of: revolutionary, seamless, cutting-edge, unlock, empower, world-class, AI-powered, production ready, complete platform.

## QA Pass 1

- Read the Phase 01 spec and all governing docs.
- Read `docs/_documentation_project/evidence/00-inventory-and-editorial-map.md` before drafting.
- Rewrite for structure and truth first.
- Verify each capability claim against the Phase 00 claim ledger or a current repo anchor.
- Keep deep architecture in `docs/state-of-the-project.md` or linked source anchors, not in the README opening.
- Confirm the README answers: what Ordo is, why it matters, what is real today, what is being shaped next, and how to participate.

## QA Pass 2

- Re-read the README aloud for drag, repetition, hype, and cognitive overload.
- Read the state doc as a skeptical builder and verify claim labels are unambiguous.
- Confirm first-time readers get the product in the first screen.
- Confirm serious builders get links to evidence.
- Confirm alpha/QA volunteer language is welcoming but bounded.
- Confirm no automatic GitHub issue creation/resolution claim remains.
- Confirm the Phase 02 prompt is written and archived.

## Required Commands

Run these after edits, adapting only if the local tool is unavailable:

```bash
npm run lint -- README.md docs/state-of-the-project.md
rg -n "revolutionary|seamless|cutting-edge|world-class|fully automated|automatically files|automatically resolves|production ready" README.md docs/state-of-the-project.md
rg -n "July 31, 2026|AGPL|QA volunteer|software manufacturing|jobs|WASM|RAG|vector|backup|Rust|TypeScript" README.md docs/state-of-the-project.md
```

If `rg` is unavailable, use `grep -RInE` with the same patterns and record the fallback. If `npm run lint -- README.md docs/state-of-the-project.md` cannot lint markdown through the repo config, record that and rely on static/prose/link scans.

## Static Scans

- Scan changed public docs for unsupported hype terms.
- Scan changed public docs for overclaims about GitHub automation, production readiness, complete platform behavior, and fully automated behavior.
- Scan markdown links in changed docs and verify local links point to existing files.

## Prompt Handoff Requirement

At closeout, write the next phase execution prompt to:

- `docs/_refactor/ordo/prompts/next.md`

Also copy the same prompt to:

- `docs/_documentation_project/prompts/archive/02-docs-index-and-archive-cleanup.md`

The next prompt must target:

- `/Users/kwilliams/Projects/ordoSite/docs/_documentation_project/phases/02-docs-index-and-archive-cleanup.md`

The next prompt must include exact phase path, governing docs, scope boundaries, public-doc anchors, editorial rules, claim discipline, QA pass 1 and QA pass 2, required commands/static scans, final answer requirements, prompt handoff requirement for Phase 03, and deterministic stop criteria.

## Do Not Stop Until

- `README.md` is rewritten and passes the Phase 01 acceptance criteria.
- `docs/state-of-the-project.md` exists or an equivalent public truth ledger is created and justified.
- Phase 01 status is updated from Planned to Complete.
- QA pass 1 is complete.
- QA pass 2 is complete.
- `docs/_refactor/ordo/prompts/next.md` contains the Phase 02 prompt.
- `docs/_documentation_project/prompts/archive/02-docs-index-and-archive-cleanup.md` contains the same Phase 02 prompt.
- Final answer lists files changed, commands/scans run, claims promoted, claims downgraded/rejected, QA fixes, next prompt files written, and remaining explicit risks.
