# System Priority Shortlist - 2026-05-01

This is the concise, opinionated priority list. The evidence and code-grounded detail live in `docs/_review/system-priorities-2026-05-01.md`.

Status update, 2026-05-02:

- Priority 1 is complete through `docs/_refactor/provider-capability-configuration`.
- The next active package is Priority 2: `docs/_refactor/appliance-lifecycle-proof`.
- A small prerequisite from `docs/_review/agent-tool-surface-hot-path-review` remains useful before broad lifecycle diagnostics: prompt exposure budgeting for diagnostic/operator tools.

## Product Goal

Ordo should become a self-contained AI business appliance: one portable system that can install cleanly, run locally, create useful business artifacts, preserve evidence, route trusted referrals, and later interoperate with other Ordo sites through MCP/A2A-style protocols.

The main execution risk is not lack of features. The risk is that the system becomes too internally coupled before the core appliance loop is boring and reliable.

## Priority 1 - Make First Install Trustworthy (Complete)

Fix the provider/model setup before wider alpha.

- Add model selection to install and admin settings.
- Remove hard-coded deprecated Haiku validation models.
- Persist selected model/provider into SQLite-backed configuration.
- Make env and SQLite config resolution consistent.
- Support Anthropic-compatible providers such as DeepSeek through explicit provider policy, not hidden `ANTHROPIC_*` assumptions.

Success condition:

- A fresh user can install without editing env files, choose a provider/model, validate it, restart the container, and chat successfully.

Completion evidence:

- Provider/model selection was moved into governed configuration surfaces.
- Deprecated hard-coded Haiku validation assumptions were removed from the provider path.
- SQLite-backed provider settings, env fallback resolution, DeepSeek/Anthropic-compatible provider support, install/admin validation, runtime factories, capability availability, and health diagnostics were implemented as one package.
- Runtime tool enablement and provider capability pruning are now tied to configured provider availability instead of hidden key assumptions.
- The package was closed out in `docs/_refactor/provider-capability-configuration`, including phase docs, evidence, validation checklist, QA review, and health/docs updates.

Remaining follow-up:

- First install is now trustworthy enough to move on. The next risk is proving that a configured Ordo behaves like a recoverable appliance across restart, update, backup, restore, worker health, and data directory movement.

## Priority 2 - Prove The Appliance Lifecycle (Next Active Package)

The one-image claim needs operational proof.

- Define the canonical runtime shape: one container or app plus explicit worker profile.
- Test fresh install, restart, update, backup, restore, health check, and data directory permissions.
- Add backup/restore commands or API around `.data`.
- Make system health report the effective provider config, database status, worker status, search status, and media capability status.

Success condition:

- A copied `.data` volume can restore into a new container and pass health checks.

Work package:

- `docs/_refactor/appliance-lifecycle-proof`

## Priority 3 - Turn First Use Into A Production Loop

The current first use is setup-oriented. It should become artifact-oriented.

- After install, collect business identity, audience, and first offer/workflow.
- Generate one useful first artifact: offer page, intro card, workflow brief, or QR referral asset.
- Show the first trust ledger/timeline entries immediately.
- Make the first five minutes prove the product thesis: Ordo creates, records, and explains business work.

Success condition:

- A new alpha user leaves first use with a concrete business artifact and visible evidence of how it was produced.

## Priority 4 - Build The Trust Ledger As A Product Surface

The trust ledger should unify referrals, artifacts, evidence, and system actions.

- Keep referral tracking reviewable/manual during alpha.
- Move referral activation server-side so QR attribution is reliable.
- Connect ledger entries to artifacts, evidence, model/tool use, user actions, and referral events.
- Avoid blockchain framing. Make it an auditable relationship and production history.

Success condition:

- A user can answer: "What happened, who/what did it, what evidence supports it, and what can I do next?"

## Priority 5 - Harden Search As Local Appliance RAG

Keep the self-contained SQLite + FTS5 + local embedding architecture, but make its operating envelope explicit.

- Add golden-query retrieval evals.
- Report embedding model, model version, embedding count, FTS health, and last rebuild time.
- Warn on embedding model-version mismatches.
- Promote important access/relevance metadata into indexed SQLite columns.
- Add optional reranking later, after baseline retrieval quality is measurable.

Success condition:

- Search quality is measured, repeatable, role-safe, and repairable without adding an external vector database.

## Priority 6 - Simplify Tool And MCP Extension

The capability catalog is strong, but adding tools still touches too many places.

- Keep capability metadata as the source of truth.
- Finish reducing manual MCP server wiring.
- Add a tool scaffold that generates schema, executor, validator, presentation, MCP export, and tests.
- Treat MCP as an interoperability boundary, not the internal execution engine.

Success condition:

- Adding a new governed tool is a predictable workflow, not a repo-wide hunt.

## Priority 7 - Stabilize Media And Local Speech

The WASM media composer is strategically valuable, but the execution path needs sharper boundaries.

- Split browser media orchestration into smaller units.
- Stop swallowing playback verification failures as success.
- Use shared FFmpeg argument builders everywhere.
- Lower browser memory limits for alpha.
- Add local STT through a Whisper provider contract before adding voice UX.
- Treat GPU acceleration as probed capability, not an assumption.

Success condition:

- Media and speech jobs report what ran, where it ran, what device/model was used, and whether verification passed.

## Priority 8 - Reduce Core Coupling

The system needs fewer central knots before A2A and larger factory automation arrive.

- Shrink `RepositoryFactory` into smaller composition roots.
- Repair `src/core` imports that reach into `src/lib` or adapters.
- Split the largest hot-path files one at a time with characterization tests.
- Add architecture tests around core boundaries.

Success condition:

- Core contracts can be reused by web routes, MCP, jobs, and future A2A surfaces without dragging the whole app runtime with them.

## Priority 9 - Prepare Rust Kernels Behind Stable Ports

Do not rewrite for aesthetics. Use Rust only where it creates real appliance-grade reliability.

Best candidates:

- Search/vector hot paths.
- Trust/evidence ledger verification.
- Backup/restore verification.
- Media/job preflight.
- Long-running local workers.

Keep TypeScript for:

- UI.
- Install/admin.
- Chat presentation.
- Capability authoring.
- Business workflows that are still changing.

Success condition:

- A Rust-backed kernel can replace a TypeScript implementation without changing route, UI, or capability code.

## Priority 10 - Gate A2A On Local Reliability

A2A is important, but it should not enter the internal execution path too early.

- Build A2A around exported contracts: identity, capabilities, work offers, artifacts, evidence, referrals, and settlement metadata.
- Do not use A2A to replace local jobs, recipes, or capability routing.
- Beta-gate A2A on install, restore, job reliability, trust ledger, and artifact evidence.

Success condition:

- Each Ordo is independently reliable before it starts doing commerce with other Ordos.

## The Short Version

First make the appliance trustworthy. Then make first use produce value. Then make the trust ledger visible. Then harden search, tools, media, and local speech. Only after that should A2A and Rust expansion become major workstreams.
