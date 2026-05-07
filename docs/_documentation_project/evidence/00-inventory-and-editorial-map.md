# Phase 00 Evidence: Inventory And Editorial Map

Date: 2026-05-07

Status: Complete

## Public Surface Inventory

| Surface | Current state | Phase 01+ recommendation |
| --- | --- | --- |
| `README.md` | Current front door is technically grounded and already warns that `docs/_business` is aspirational doctrine, not fully implemented behavior. It is also dense and reads more like an architecture briefing than a first-contact public README. | Rewrite in Phase 01 as a public front door: what Ordo is, why it matters, what is real today, how alpha participation works, and where serious builders can verify details. |
| `docs/README.md` | Stale as an active index. It points to `docs/_specs`, `docs/_reference`, and `docs/operations`, but the current top-level docs tree contains `_archive`, `_business`, `_corpus`, `_debug`, `_documentation_project`, and `_refactor`. | Rewrite in Phase 02 after README/state docs settle. Treat this as a current public-doc risk, not a Phase 00 edit target. |
| `CONTRIBUTING.md` | Welcoming but misaligned with current GitHub surface. It says standard issue templates exist, while the repo currently has only one specialized runtime-integrity template. It asks for issues only and no code PRs, which matches the current bounded contribution posture. | Rewrite in Phase 03 with issue-template language that matches the actual template set and alpha QA workflow. |
| `.github/ISSUE_TEMPLATE/agent-runtime-integrity.yml` | One real specialized issue template exists for prompt/runtime truth drift, retrieval/citation correctness, and render contract failures. | Keep as implemented evidence. Add broader alpha, bug, QA, and docs templates in Phase 03 only. |
| `.github/copilot-instructions.md` | Workspace/agent setup artifact, not a public community surface. | Keep out of public reader journey unless needed for agent customization documentation. |
| `.github/workflows/ci.yml` | CI workflow exists, but Phase 00 did not validate CI behavior. | Mention only if Phase 01 validates enough release/CI evidence for public claims. |
| `docs/_business/*` | Active strategic and architectural canon. It provides the voice and operating doctrine: governed assistant, bottega/workshop model, software manufacturing, QA-first intake, and local/ownable orientation. | Use as public story source, while clearly labeling aspirational or directional material. |
| `docs/_documentation_project/*` | Active documentation manufacturing control plane. | Keep internal/governing; link publicly only if useful for contributors who want to understand the docs process. |
| `docs/_corpus/*` | Structured corpus manifests exist for architecture reference, field guide, operators handbook, studio-ordo thesis, and system docs. | Treat as active source material, not the first public route through the repo. |
| `docs/_archive/*` | Large archive tree with historical specs, refactors, audits, QA, business, and unification docs. | Do not treat archived docs as current truth. Phase 02 should create or update archive manifests and keep public readers out of old phase packets. |
| `docs/_refactor/ordo/prompts/next.md` | Active phase handoff mechanism for this documentation project. | Continue using as operator-facing execution pointer. |

## Reader Journey Map

1. First-contact public visitor starts at `README.md`.
2. The README should answer in the first screen: Ordo is an AGPL, ownable AI operator system/business appliance; chat is the interface; governed workflows are the engine; the project is moving toward a July 31, 2026 alpha.
3. A serious builder should then choose `docs/state-of-the-project.md` for the truth ledger: implemented, active refactor, alpha track, and vision.
4. A QA volunteer should go from README or state doc to `CONTRIBUTING.md` and the GitHub issue templates.
5. A strategy reader can follow into `docs/_business/README.md` and the business canon.
6. A maintainer or agent follows `docs/_documentation_project/README.md` and `docs/_refactor/ordo/prompts/next.md` for this documentation manufacturing process.
7. Archived specs and refactor packets should be discoverable only through archive indexes, not presented as the main public path.

## Claim Ledger

| Claim | Label | Evidence anchors | Public wording guidance |
| --- | --- | --- | --- |
| Ordo is a governed AI operator system / business appliance for solopreneurs. | Implemented + direction | `README.md`, `docs/_business/01_founding_thesis.md`, `docs/_business/06_the_production_engine.md`, `src/core/capability-catalog`, `src/core/tool-registry` | Promote as the central product claim, but keep wording concrete: governed chat plus durable workflows. |
| Chat is the main operating interface, not the whole product. | Implemented | `README.md`, `src/lib/chat`, `src/frameworks/ui/chat`, jobs/media/workflow modules | Promote. Good first-screen explanation. |
| Role-aware capability routing exists. | Implemented | `README.md`, `src/lib/jobs/job-capability-registry.ts`, `src/core/capability-catalog/catalog`, `src/core/tool-registry` | Promote briefly; deep details belong in state/architecture docs. |
| Deferred jobs and durable job events exist. | Implemented | `src/lib/jobs/deferred-job-runtime.ts`, `src/lib/jobs/deferred-job-worker.ts`, `src/lib/jobs/job-capability-registry.ts`, `package.json` scripts `jobs:work` | Promote. Avoid claiming every async workflow is complete. |
| Factory/work orders and staged production orchestration exist. | Implemented | `src/lib/factory/production-orchestrator.ts`, `src/core/entities/work-order`, `docs/_business/06_the_production_engine.md` | Promote as evidence of software manufacturing, not as a fully public factory product. |
| QA reports exist as structured product/work-order artifacts. | Implemented | `src/core/entities/qa-report.ts`, `src/lib/factory/qa-evaluator.ts` | Promote as internal implementation proof. Do not imply GitHub issue filing is wired. |
| Browser WASM media execution exists. | Implemented | `src/lib/media/browser-runtime/ffmpeg-browser-executor.ts`, `@ffmpeg/*` dependencies in `package.json` | Promote as browser/WASM media foundation. Keep scope: composition executor and governed asset upload path. |
| RAG/vector search exists locally. | Implemented | `src/core/search/HybridSearchEngine.ts`, `src/adapters/SQLiteVectorStore.ts`, `src/adapters/LocalEmbedder.ts`, `@huggingface/transformers` dependency | Promote. Use precise language: hybrid vector + keyword search, local embeddings, SQLite-backed vector store. |
| Backup/restore foundation exists with Rust-backed native boundary. | Implemented + active refactor | `src/lib/appliance/backup/backup-command-service.ts`, `src/lib/appliance/native/native-command-contract.ts`, `crates/ordo-backup`, `package.json` script `rust:check` | Promote carefully: backup command service and Rust backup executor foundation exist. Do not claim complete consumer-grade restore UX without Phase 01 verification. |
| Rust/TypeScript hybrid boundary exists. | Implemented foundation | `Cargo.toml`, `crates/ordo-backup`, `crates/ordo-daemon`, native command contracts | Promote as a foundation, not as a broad Rust rewrite. |
| GitHub issue automation from QA reports exists. | Alpha track | `docs/_documentation_project/github-customization-plan.md`, `docs/_business/07_governance_and_process.md`, no current code evidence found in Phase 00 for public issue emission | Downgrade. Frame as alpha-track direction only. |
| Public GitHub templates cover alpha feedback, bug, QA, and docs feedback. | Alpha track | `docs/_documentation_project/github-customization-plan.md`; current `.github/ISSUE_TEMPLATE` has only `agent-runtime-integrity.yml` | Downgrade until Phase 03 creates templates. |
| Ordo is production ready / complete platform. | Reject unless narrowed with evidence | Overclaim scan found the phrase mainly in governance/archive contexts, not as an active README claim. | Avoid. Use “active development toward alpha” and exact release evidence instead. |
| `docs/_business` fully describes shipped product behavior. | Reject | `README.md` already labels this directory as aspirational objectives and operating doctrine. | Preserve this distinction. |

## Stale Docs And Archive Candidates

- `docs/README.md` is the highest-priority stale public index. It references missing active top-level folders: `docs/_specs`, `docs/_reference`, and `docs/operations`.
- Large historical workstreams now live under `docs/_archive` and `docs/_refactor/_archive`; public docs should not send first-time readers into those trees as if they were current product truth.
- The worktree currently shows many unrelated unstaged deletions under `docs/_refactor/*`, `docs/_specs/*`, `docs/_review/*`, and `docs/content_strategy/*`. Phase 00 did not restore, revert, or modify those unrelated changes.
- Current active governing docs for this documentation project are not archive candidates: `docs/_documentation_project/*`, the listed `docs/_business/*` anchors, and `docs/_refactor/ordo/prompts/next.md`.
- `docs/_debug/git.log`, `docs/debug_info`, and several root-level standalone docs may need Phase 02 classification as archive, public reference, or removal candidates after current ownership is verified.

## GitHub Customization Gap List

- Current implemented template: `.github/ISSUE_TEMPLATE/agent-runtime-integrity.yml`.
- Planned but missing templates from the GitHub customization plan:
  - `.github/ISSUE_TEMPLATE/alpha-feedback.yml`
  - `.github/ISSUE_TEMPLATE/bug-report.yml`
  - `.github/ISSUE_TEMPLATE/qa-report.yml`
  - `.github/ISSUE_TEMPLATE/docs-feedback.yml`
  - `.github/ISSUE_TEMPLATE/config.yml`
- Optional missing surface: `.github/PULL_REQUEST_TEMPLATE.md`.
- `CONTRIBUTING.md` should stop saying “standard GitHub issue templates” until the broader template set exists.
- Public wording must say QA reports are being shaped into GitHub/agent-assisted intake during alpha, not that Ordo automatically files or resolves issues.

## Prose Risks And Cognitive-Load Risks

- Root README risk: accurate but too much capability density before the reader has a simple mental model.
- Docs index risk: stale paths create immediate trust loss for public readers.
- Archive risk: many old specs contain valid history but stale claims; search results can make old direction look current.
- Contribution risk: issue-only contribution stance is useful, but current wording can feel abrupt unless paired with a clear alpha QA invitation.
- Claim risk: “governed AI operator system” is strong but needs one plain explanation before architecture terms appear.
- Founder voice risk: public docs should carry Keith’s urgency and care without becoming biography-first or internally performative.
- Technical proof risk: serious builders need anchors, but first-time readers should not be asked to parse `src/` before understanding the promise.

## Claims To Promote Into The README/State Docs

- Ordo is an AGPL, ownable AI operator system/business appliance for solopreneurs.
- Chat is the working surface; durable jobs, workflow state, search, media, and QA contracts are the engine behind it.
- The project is built through software manufacturing: collect, decide, spec, QA, phase, implement, verify, update.
- Real implemented foundations include deferred jobs, factory/work orders, QA reports, browser/WASM media composition, hybrid local search, SQLite persistence, and backup/native command boundaries.
- The repo is moving toward a July 31, 2026 alpha and needs evidence-rich QA volunteers more than broad code PRs right now.
- AGPL and local/ownable architecture are part of the anti-enshittification stance, not decorative licensing language.

## Claims To Downgrade Or Reject

- Downgrade automatic GitHub issue creation/resolution to alpha-track direction.
- Downgrade broad public GitHub template coverage until Phase 03 creates it.
- Downgrade backup/restore to “foundation exists” unless Phase 01 verifies end-user restore completeness.
- Reject “production ready” and “complete platform” as global claims.
- Reject treating old archived specs as current public roadmap unless Phase 02 explicitly reactivates them.
- Reject generic hype terms such as “revolutionary,” “seamless,” “world-class,” and unexplained “AI-powered.”

## Searches And Scans Run

- `git status --short` before editing; result showed many unrelated modified/deleted files already present in the worktree.
- `find docs -maxdepth 3 -type f | sort`.
- `find .github -maxdepth 3 -type f | sort`.
- `rg` was attempted for the required scans but is not installed in this environment.
- Fallback scan: `grep -RInE "_specs|_reference|operations/|coming soon|fake|sample|world-class|revolutionary|seamless|AI-powered" README.md docs/README.md CONTRIBUTING.md docs .github`.
- Fallback scan: `grep -RInE "GitHub issue|qa report|QA report|work order|deferred job|browser_wasm|VectorStore|SQLiteVectorStore|LocalEmbedder|backup|rust_daemon" README.md docs src crates .github`.
- Fallback scan: `grep -RInE "automatically files|automatically resolves|fully implemented|production ready|complete platform" README.md docs .github`.
- Anchor verification loop for all Phase 00 current-code and doc anchors.
- Top-level docs folder check with absolute macOS binaries after the shell `PATH` stopped resolving `find`/`sort`.

## Phase 01 Prompt Handoff Confirmation

Phase 01 should use this evidence file as the truth ledger for rewriting `README.md` and creating `docs/state-of-the-project.md`.

The active handoff must be written to `docs/_refactor/ordo/prompts/next.md` and archived at `docs/_documentation_project/prompts/archive/01-root-readme-and-state-of-project.md`.
