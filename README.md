# Ordo

Ordo is an AGPL AI business appliance for solopreneurs.

Chat is the working surface. Governed workflows are the engine behind it. Ordo gives a solo operator one place to remember context, route work, run jobs, preserve evidence, and return useful artifacts to the same conversation.

The project is in active development toward a July 31, 2026 alpha. The repo already contains durable jobs, factory/work-order orchestration, structured QA reports, browser/WASM media execution, hybrid RAG and vector search, local SQLite persistence, backup/native command boundaries, and a Rust/TypeScript foundation.

## Why It Exists

Small expert businesses do not usually fail because the owner lacks tools. They stall because follow-through is scattered across chat threads, files, dashboards, calendars, and half-finished automation.

Ordo treats AI as an operator inside a governed process:

- The human decides.
- The assistant routes intent through capabilities.
- Durable jobs and workflows carry long-running work.
- QA reports and evidence keep the system honest.
- Results return to the conversation with status, artifacts, and provenance.

This is software manufacturing, not prompt tricks.

The public project is moving that manufacturing loop into GitHub: issues carry
evidence and accepted work, while pull requests carry implementation proof,
tests, visual review, and remaining risks.

## What Is Real Today

Implemented foundations include:

- Governed assistant chat for authenticated and anonymous flows.
- Role-aware capability routing through a catalog and tool registry.
- Deferred jobs with durable job events and worker execution.
- Factory/work-order orchestration for staged production work.
- Structured QA report entities and evaluators.
- Browser/WASM FFmpeg media execution and governed asset upload paths.
- Hybrid local search with keyword retrieval, vector similarity, local embeddings, and SQLite-backed storage.
- Local-first runtime data under `.data`, with SQLite as the default persistence layer.
- Backup and native command foundations, including a Rust backup executor boundary.
- Admin and operations surfaces for jobs, conversations, media, prompts, diagnostics, referrals, and publishing workflows.

The deeper truth ledger is [docs/state-of-the-project.md](docs/state-of-the-project.md). It separates implemented behavior, active refactors, alpha-track work, and vision.

## Alpha Direction

The July 31, 2026 alpha is being shaped around evidence-rich use.

The most useful help right now is QA: clear reports, reproducible failures, screenshots, command output, broken links, confusing docs, and examples where Ordo claims too much.

Code PRs are intentionally limited while the architecture is still being shaped. To help, start with [CONTRIBUTING.md](CONTRIBUTING.md) and the current issue templates in [.github/ISSUE_TEMPLATE](.github/ISSUE_TEMPLATE).

## Read Next

- [State Of The Project](docs/state-of-the-project.md): current truth ledger.
- [Business Canon](docs/_business/README.md): product thesis and operating doctrine.
- [Founding Thesis](docs/_business/01_founding_thesis.md): why bespoke software becomes possible again.
- [The Bottega Model](docs/_business/02_the_bottega_model.md): craft, apprenticeship, and process.
- [Governance And Process](docs/_business/07_governance_and_process.md): how AI work is kept honest.
- [Software Manufacturing Loop](docs/_business/08_software_manufacturing_loop.md): how issues and pull requests become the visible work ledger.
- [Contributing](CONTRIBUTING.md): current issue-first contribution path.

Some docs are ahead of the product and some are historical. When a claim matters, trust current code, tests, release evidence, and the state-of-project ledger first.

## Run Locally

Requirements:

- Node.js 22.22.2. The repo includes `.nvmrc` and `.node-version`.
- npm 10 or 11.
- A local environment file based on `.env.example`.
- A configured intelligence provider for chat, either through `/install`, admin provider settings, or env values such as `AI_PROVIDER=anthropic|deepseek`.
- Optional provider keys for image, audio, speech, and web-search capability slots.
- Docker if you want the containerized appliance path.

Install and start:

```bash
npm install
cp .env.example .env.local
npm run native:check
npm run dev
```

Open:

```text
http://localhost:3000
```

If Node changed after dependencies were installed, rebuild the SQLite native addon:

```bash
npm rebuild better-sqlite3
npm run native:check
```

`npm run dev` starts the Next.js app, deferred job worker, media worker, Rust backup executor, and backup scheduler together.

## Runtime Shape

The default local stack is compact:

- Next.js app server on port `3000`.
- SQLite database and local files under `.data`.
- Deferred job worker for async work.
- Media worker on port `3101` for server-side media execution.
- Rust backup executor and backup scheduler.
- Optional MCP server processes for exported capabilities.

The app does not require a separate database server, queue broker, search cluster, or vector database for the default local footprint.

## Docker

Quick start:

```bash
docker run -p 80:3000 kaw393939/studioordo
```

Use a named volume for durable state:

```bash
docker volume create studioordo-data
docker run -p 80:3000 -v studioordo-data:/app/.data kaw393939/studioordo
```

For local Compose development:

```bash
cp .env.example .env
docker compose up --build
```

For hosted reverse-proxy deployments, start from `compose.hosted.yaml`. TLS, domain routing, and public ingress should live at the proxy layer.

## Useful Commands

```bash
npm run typecheck
npm test
npm run lint
npm run lint:css
npm run build
npm run jobs:work
npm run media:worker
npm run runtime:inventory
npm run qa:runtime-integrity
npm run release:evidence
npm run rust:check
```

`npm run check` runs the main local quality chain: typecheck, lint, CSS lint, tests, and audit.

## License And Posture

Ordo is licensed under [AGPL-3.0-only](LICENSE). The npm package is currently marked `private`, but the license, data boundary, and single-repo structure are designed around auditable, self-hostable software.

The public GitHub home is moving to `StudioOrdo/ai_mcp_chat_ordo`; the local
origin may still point at `kaw393939/ai_mcp_chat_ordo` until repository cutover
is complete. A YouTube follow path has not been verified in this phase, so it is
intentionally not listed here.
