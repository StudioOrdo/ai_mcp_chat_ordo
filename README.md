# Studio Ordo

Studio Ordo is a governed AI operator system for solopreneurs. It is a Next.js application with an internal capability platform, durable workflow execution, SQLite-backed persistence, retrieval, media generation/composition, jobs, admin surfaces, and release evidence in one repo.

The current product is not just a chat UI. Chat is the main user surface, but the system behind it includes role-aware tool routing, deferred jobs, media workflow orchestration, library search, user media storage, referrals, notifications, and operational diagnostics.

This project is licensed under AGPL-3.0-only. The package is currently marked `private` in `package.json`, but the license and source structure are designed around auditable, self-hostable software.

## Current Capabilities

Studio Ordo can currently:

- Run a governed assistant chat surface with authenticated and anonymous user flows.
- Route tool access by role through a capability catalog and runtime tool registry.
- Search and read the local corpus/library with structured citations and retrieval quality signals.
- Generate and compose media through durable jobs, including audio, charts, images, and composed video workflows.
- Persist multi-step media workflows so dependency completion can advance the final deliverable without relying on assistant polling.
- Show canonical job and workflow state in chat and in the Jobs workspace.
- Store and account for user media assets through a server-side asset catalog.
- Support user profiles, themes, accessibility-oriented per-user theme changes, shell navigation, and workspace restore.
- Manage referrals, affiliate-style QR/link flows, lead capture, consultation requests, deals, and training-path records.
- Expose admin and operations surfaces for jobs, conversations, media, prompts, diagnostics, attribution, referrals, and publishing workflows.
- Run deferred background work through a worker process with durable job events and replay/repair paths.
- Run a separate media worker for server-side composition and FFmpeg-backed media execution.
- Export selected capabilities through MCP servers for operational interoperability.
- Produce release and runtime evidence through deterministic tests, evals, health checks, runtime inventory, and release artifacts.

## Product Direction And Business Canon

The `docs/_business` directory contains the project's strategic and architectural north star. Treat these documents as aspirational objectives and operating doctrine for where Ordo is going, not a claim that every idea in them is already fully implemented.

Start here:

- [Business Canon README](docs/_business/README.md)
- [01 Founding Thesis](docs/_business/01_founding_thesis.md)
- [02 The Bottega Model](docs/_business/02_the_bottega_model.md)
- [03 The Economic Thesis](docs/_business/03_the_economic_thesis.md)
- [04 The Trust Ledger](docs/_business/04_the_trust_ledger.md)
- [05 The Sovereignty Stack](docs/_business/05_the_sovereignty_stack.md)
- [06 The Production Engine](docs/_business/06_the_production_engine.md)
- [07 Governance And Process](docs/_business/07_governance_and_process.md)
- [Ordo Process](docs/_business/ordo_process.md)

Architecture vision:

- [Architecture Index](docs/_business/architecture/README.md)
- [00 North Star](docs/_business/architecture/00-north-star.md)
- [01 Current System Map](docs/_business/architecture/01-current-system-map.md)
- [02 Ordo Core Kernel](docs/_business/architecture/02-ordo-core-kernel.md)
- [03 Workflow Recipe Model](docs/_business/architecture/03-workflow-recipe-model.md)
- [04 Scrollytelling Production](docs/_business/architecture/04-scrollytelling-production.md)
- [05 Ordo Development Workflow](docs/_business/architecture/05-ordo-development-workflow.md)
- [06 Business Process Views](docs/_business/architecture/06-business-process-views.md)
- [07 Projections And Read Models](docs/_business/architecture/07-projections-and-read-models.md)
- [08 Stage Roadmap](docs/_business/architecture/08-stage-roadmap.md)

The implementation should keep moving toward those docs, but README claims should be read as current system truth unless explicitly labeled as direction.

## Architecture Overview

Studio Ordo is organized as a layered application rather than a loose collection of routes and components.

### Runtime Shape

At runtime, the default local stack is:

- Next.js app server on port `3000`.
- SQLite database and local data files under `.data`.
- Deferred job worker started by the dev/prod startup scripts.
- Media worker on port `3101` for server-side media execution.
- Optional MCP server processes for selected exported capabilities.

In development, `npm run dev` starts the app, deferred job worker, and media worker together. In production, `scripts/start-server.mjs` starts the Next server, supervises the deferred job worker, and starts an internal media worker when `MEDIA_WORKER_URL` is not configured. Docker Compose runs the app and media worker as separate services.

### Source Layout

Important directories:

- `src/app`: Next.js routes, API routes, pages, and app-level styles.
- `src/core`: entities, use cases, command abstractions, capability catalog, search ports, and platform contracts.
- `src/adapters`: data mappers, repository factory, stream adapters, parser adapters, and infrastructure wiring.
- `src/lib`: runtime services for chat, jobs, media, search, storage, prompts, evals, diagnostics, referrals, notifications, and operations.
- `src/frameworks/ui`: reusable UI surfaces and chat tool/card renderers.
- `src/components`: product-specific React components such as shell, jobs, media, profile, journal, and admin widgets.
- `src/hooks`: client state and chat/runtime hooks.
- `mcp`: MCP server entrypoints.
- `scripts`: operational scripts, workers, release evidence, search indexing, and QA runners.
- `tests`: cross-cutting integration, architecture, eval, browser, and policy tests.
- `docs`: product, business, refactor, operations, specs, review, and corpus documentation.

### Core Boundaries

The system follows a clean architecture style:

- Core entities and use cases define the stable business contracts.
- Adapters implement persistence, parsing, streaming, and external services.
- `RepositoryFactory` centralizes repository construction and DB access.
- Capability definitions are registered once and projected into prompt/tool/runtime surfaces.
- UI components consume read models and DTOs; they should not own durable workflow truth.
- Background workers execute jobs and emit events; they do not decide chat presentation.
- Read models project durable state into chat, jobs, admin, and workspace views.

The main design rule is that durable workflows own long-running outcomes. Assistant text can explain state, but it should not be the source of truth for async execution.

## Capability And Tool Architecture

Studio Ordo uses an internal tool platform first.

- `src/core/capability-catalog` defines capability metadata, role access, prompt directives, schemas, and runtime projections.
- `src/core/tool-registry` owns execution middleware and policy-aware tool invocation.
- `src/core/use-cases/tools` contains tool implementations.
- `src/lib/chat/tool-bundles` assembles tools for chat runtime use.
- MCP servers under `mcp/` export selected capabilities for interoperability.

MCP is an export and interoperability boundary. It is not the primary orchestration model for the app.

## Jobs And Media Workflows

Deferred work is stored as jobs and job events. The worker processes queued jobs and writes durable state so UI and repair paths can recover without relying on an open browser stream.

Key job modules:

- `src/lib/jobs/job-read-model.ts`
- `src/lib/jobs/deferred-job-worker.ts`
- `src/lib/jobs/deferred-job-runtime.ts`
- `src/lib/jobs/enqueue-deferred-tool-job.ts`
- `src/lib/jobs/compose-media-deferred-job.ts`
- `src/lib/jobs/generate-audio-deferred-job.ts`

Media workflows add a higher-level product object above individual jobs. A request like "make a video with a chart and new audio" becomes one durable workflow with dependency steps. When audio completes, the backend workflow orchestrator can enqueue composition automatically.

Key workflow modules:

- `src/lib/media/workflows/types.ts`
- `src/lib/media/workflows/state.ts`
- `src/lib/media/workflows/factory.ts`
- `src/lib/media/workflows/sqlite-media-workflow-repository.ts`
- `src/lib/media/workflows/orchestrator.ts`
- `src/lib/media/workflows/media-workflow-read-model.ts`
- `src/frameworks/ui/chat/plugins/custom/MediaWorkflowCard.tsx`

The current media workflow package is covered by deterministic unit, integration, presentation, architecture, and eval tests.

## Data And Persistence

The default persistence layer is SQLite through `better-sqlite3`.

- Schema bootstrap and migrations live under `src/lib/db`.
- Data mappers live under `src/adapters`.
- Runtime data lives under `.data` by default.
- Local runtime logs live under `.runtime-logs`.
- Media/user files are stored locally and projected through governed asset/catalog APIs.

The app is intentionally compact: it does not require a separate database server, queue broker, search cluster, or vector database for the default local footprint.

## Search, Corpus, And Library

The system supports local corpus search and structured section reads.

- Corpus/library routes live under `src/app/library` and related API routes.
- Search core lives under `src/core/search`.
- Search adapters include SQLite/BM25/vector stores and local embedding support.
- Corpus tools expose structured search/read contracts to the assistant.

Search responses are designed to distinguish locating information from making detailed grounded claims.

## UI And Product Surfaces

Main user-facing surfaces include:

- Chat workspace.
- Jobs workspace.
- Library and journal.
- User media workspace.
- Profile/settings and theme controls.
- Referral and affiliate entry points.
- Admin and operations workspaces.

The UI is built with React/Next.js, local CSS, shared chat card primitives, and product-specific components. Chat tool results render through a plugin/card registry instead of bespoke markup in every tool.

## Evaluation, QA, And Release Evidence

The repo uses tests as architecture contracts. Important suites include:

- Unit and integration tests with Vitest.
- Browser and UI smoke tests with Playwright.
- Architecture guardrails for data access, tool registration, workflow ownership, and UI boundaries.
- Deterministic eval scenarios for product behavior.
- Runtime integrity and release evidence generators.

Common validation commands:

```bash
npm run typecheck
npm test
npm run lint:strict
npm run lint:css
npm run quality
```

Release evidence commands:

```bash
npm run runtime:inventory
npm run qa:runtime-integrity
npm run release:evidence
```

Media workflow package validation:

```bash
./node_modules/.bin/vitest run \
  src/lib/media/workflows \
  src/adapters/ChatPresenter.test.ts \
  src/hooks/usePresentedChatMessages.test.tsx \
  src/hooks/chat/useChatJobEvents.test.tsx \
  src/frameworks/ui/chat \
  src/components/jobs \
  src/app/api/chat/jobs/route.test.ts \
  src/app/api/jobs/route.test.ts \
  src/app/jobs \
  tests/evals/eval-scenarios.test.ts \
  tests/evals/eval-fixtures.test.ts \
  tests/evals/eval-runner.test.ts \
  --pool=threads
```

## Installation

### Requirements

- Node.js 22.
- npm.
- A local environment file based on `.env.example`.
- `ANTHROPIC_API_KEY` for normal assistant chat.
- Optional `OPENAI_API_KEY` for OpenAI-backed media/image/audio paths depending on the configured feature path.
- Optional `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID` for ElevenLabs audio paths.
- Docker, if using the containerized stack.

### Local Development

```bash
npm install
cp .env.example .env.local
```

Edit `.env.local` and set at least:

```bash
ANTHROPIC_API_KEY=your_key_here
ANTHROPIC_MODEL=claude-haiku-4-5
```

Validate and run:

```bash
npm run validate:env
npm run dev
```

Open:

```text
http://localhost:3000
```

`npm run dev` starts:

- Next.js dev server.
- Deferred job worker.
- Media worker.

The dev script uses a lock file to prevent accidentally running multiple local stacks against the same SQLite data.

### Production Build

```bash
npm run build
npm run start
```

`npm run start` runs the production server through `scripts/start-server.mjs`, which also supervises the deferred job worker unless `DISABLE_DEFERRED_JOB_WORKER=1` is set. It starts the in-process container media worker unless `MEDIA_WORKER_URL` points at an external worker or `DISABLE_MEDIA_WORKER=1` is set.

### Docker Quick Start

The published Docker image is multi-architecture for `linux/amd64` and `linux/arm64`.

```bash
docker run -p 80:3000 kaw393939/studioordo
```

Open:

```text
http://localhost/install
```

The image declares `/app/.data` as the writable runtime volume. Docker creates an anonymous volume for the one-command run above. Use a named volume when you want durable local state across container replacements:

```bash
docker volume create studioordo-data
docker run -p 80:3000 -v studioordo-data:/app/.data kaw393939/studioordo
```

The single-container image starts the web server, deferred job worker, and media worker. API keys can be entered through the install flow or passed as environment variables:

```bash
docker run -p 80:3000 \
  -v studioordo-data:/app/.data \
  -e ANTHROPIC_API_KEY=your_key_here \
  -e OPENAI_API_KEY=your_key_here \
  kaw393939/studioordo
```

### Docker Compose

```bash
cp .env.example .env
# edit .env
docker compose up --build
```

The Compose stack includes:

- `app`: Next.js application on port `3000`.
- `media-worker`: media execution service on port `3101` inside the compose network.
- `admin-web-search-mcp`: prepared container service for MCP/admin web search operational use.

Persistent data is mounted from:

```text
.data
config
```

## Operational Commands

Useful commands:

```bash
npm run jobs:work
npm run media:worker
npm run media:report-storage
npm run admin:health
npm run admin:diagnostics
npm run admin:conversation-retention
npm run admin:reap-chat-uploads
npm run repair:conversation-indexes
npm run scan:secrets
```

MCP exports:

```bash
npm run mcp:operations
npm run mcp:calculator
npm run mcp:generate-audio
npm run mcp:admin-web-search
```

LLM export:

```bash
npm run llm:export
```

This writes `ordo_llm_export.txt` and `ordo_llm_export.zip` in the repository root.

## Contributing

At this stage, the preferred contribution path is specific issue reports and QA evidence. The project has many architectural guardrails and product contracts, so broad code changes should be planned against the current specs and tests before implementation.

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Current Caveat

The system is evolving quickly. Some docs under `docs/_business`, `docs/_specs`, `docs/_refactor`, and `docs/_review` describe planned or recently completed work. When in doubt:

- Trust passing tests and current source code for implementation truth.
- Treat `docs/_business` as the product and business north star.
- Treat phase/spec docs as implementation contracts that may be ahead of or catching up to code depending on the package.
