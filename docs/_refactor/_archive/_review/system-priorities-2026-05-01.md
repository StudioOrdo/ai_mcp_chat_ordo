# System Priorities Review - 2026-05-01

This review is based on source inspection of the current codebase, the business canon in `docs/_business`, the install/runtime paths, the QR affiliate flow, and the WASM media composer. It assumes the product intent is a self-contained solopreneur AI orchestration factory: one Docker image, local persistence, local workers, no required database server, queue server, search service, or external orchestration dependency.

## Summary

The system is pointed in the right direction. The most valuable idea in the codebase is not "chat with tools"; it is a portable business operating cell: chat as cockpit, durable jobs as execution floor, SQLite/local files as sovereign state, capability contracts as governance, and browser/server workers as local production machinery.

The main risk is that the codebase is becoming too internally coupled for that idea. Because the product intentionally avoids external infrastructure, the internal boundaries have to be unusually clean. Otherwise the single image becomes a single knot.

## P0 - Fix Before Wider Alpha

Phase-08 closeout note, 2026-05-02: the provider/capability configuration
package now implements the core recommendation in items 1, 1a, and 2. Follow-up
work should treat those sections as historical grounding and use the active
provider diagnostics/admin health surfaces as the current source of truth.

### 1. Make Anthropic model selection first-class in install and admin settings

Current behavior is inconsistent:

- Runtime env defaults to `claude-haiku-4-5` in `getAnthropicModel()` and fallback candidates include `claude-haiku-4-5`, `claude-sonnet-4-6`, and `claude-opus-4-6` in `src/lib/config/env.ts:45` and `src/lib/config/env.ts:93`.
- Docker Compose defaults `ANTHROPIC_MODEL` to `claude-haiku-4-5` in `compose.yaml:26`.
- README tells local users to set `ANTHROPIC_MODEL=claude-haiku-4-5` in `README.md:247`.
- The install key validator still hard-codes `claude-3-haiku-20240307` in `src/app/api/install/validate-keys/route.ts:45`.
- The admin key update route also hard-codes `claude-3-haiku-20240307` in `src/app/api/admin/system/keys/route.ts:41`.
- The install wizard only asks for keys, not model choice, in `src/app/install/InstallWizard.tsx:171`.
- Install setup persists `ANTHROPIC_API_KEY` but not `ANTHROPIC_MODEL` in `src/app/api/install/setup/route.ts:32`.

Why this matters:

The first-run installer is the product's trust doorway. If a user brings a valid Anthropic key but the validation model is unavailable, renamed, deprecated, or not enabled for their account, install fails even if the runtime could have used a configured model. This directly conflicts with the "self-contained appliance" goal.

Recommended fix:

- Add an Anthropic model selector to the install wizard and admin key settings.
- Persist `ANTHROPIC_MODEL` through `ConfigurationService.setString`.
- Validate keys against the selected model, not a hard-coded Haiku model.
- Centralize model policy in one module instead of spreading defaults across env, docs, compose, install validation, and admin validation.
- Preserve an advanced/manual model field so operators can use a new Anthropic model before the UI list is updated.

Acceptance test:

- Install can validate and persist `claude-sonnet-4-6` or another operator-entered Anthropic model.
- Admin settings can update the Anthropic model without changing the key.
- No source file contains `claude-3-haiku-20240307` except tests/fixtures documenting fallback behavior.

### 1a. Generalize Anthropic into an Anthropic-compatible provider layer

Current behavior:

- The chat/runtime layer is named around Anthropic, but the actual transport is the Anthropic Messages API shape.
- The Anthropic SDK already supports `baseURL` and `authToken` configuration through constructor options and `ANTHROPIC_BASE_URL`/`ANTHROPIC_AUTH_TOKEN`.
- DeepSeek documents an Anthropic-compatible endpoint at `https://api.deepseek.com/anthropic`, with `messages.create`, streaming, system prompts, tools, tool choice, text content, and tool_result blocks supported.
- DeepSeek model names are not Claude model names. Current fallback policy in `src/lib/config/env.ts:93` would send Claude fallback names to DeepSeek if only `ANTHROPIC_BASE_URL` were changed.

Why this matters:

DeepSeek support is technically easy because it can ride the Anthropic SDK, but it should not be hidden behind `ANTHROPIC_*` assumptions. If Ordo is going to support BYOK and token routing, the provider policy needs to know whether the active Anthropic-compatible backend is Anthropic, DeepSeek, or another compatible gateway.

Recommended fix:

- Add a provider config layer such as `AI_PROVIDER=anthropic|deepseek`.
- Support provider-specific keys and models:
  - `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `ANTHROPIC_BASE_URL`
  - `DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL`, `DEEPSEEK_BASE_URL=https://api.deepseek.com/anthropic`
- Build Anthropic SDK clients through one factory that accepts `{ apiKey, baseURL, modelCandidates, provider }`.
- Use DeepSeek-specific fallback candidates such as `deepseek-v4-pro` and `deepseek-v4-flash`, not Claude model names.
- Keep a manual model override because compatible providers change model names faster than the app can release.

Acceptance test:

- `AI_PROVIDER=deepseek` creates an Anthropic SDK client with DeepSeek base URL and DeepSeek key.
- Provider policy never mixes Claude fallback models into a DeepSeek request.
- Install/admin validation can validate the selected provider/model pair.

### 2. Unify env-backed and SQLite-backed runtime configuration

Current behavior:

- `ConfigurationService` explicitly supports env first, then SQLite `system_settings`, enabling a Drupal-like first-run install in `src/lib/config/ConfigurationService.ts:3`.
- `getAnthropicApiKey()` and `getAnthropicModel()` read only `process.env` in `src/lib/config/env.ts:35` and `src/lib/config/env.ts:45`.
- Install setup writes provider keys to SQLite in `src/app/api/install/setup/route.ts:32`.

Why this matters:

The code claims the container can boot without an env file and persist keys into SQLite, but some provider/runtime helpers still bypass `ConfigurationService`. That can create a system that installs successfully and then fails when chat/runtime code reads env-only configuration.

Recommended fix:

- Create a single provider config resolver used by chat, direct Anthropic calls, install validation, admin settings, health checks, and system pages.
- Resolver order should be explicit: env override, then SQLite setting, then documented default where safe.
- Keep aliases such as `API__ANTHROPIC_API_KEY`, but route them through the same resolver.
- Add tests proving a Docker-style SQLite-only install can run assistant chat without env keys.

Acceptance test:

- With no `ANTHROPIC_API_KEY` env var and a SQLite `system_settings` value, chat resolves the key and selected model.
- Admin system page and health checks report the same effective provider config source.

### 3. Harden the one-image install path into a real appliance lifecycle

Current behavior:

- README documents one-command Docker run and `/install` first-run setup in `README.md:284`.
- Dockerfile declares `/app/.data` as the writable volume in `Dockerfile:51`.
- Compose mounts `.data` and `config`, but runs app, media worker, and an idle MCP container as separate services in `compose.yaml:1`.
- Install check validates schema/write access through `ensureDbSchema()` in `src/app/api/install/check/route.ts:1`.

Why this matters:

For alpha users, install success is not enough. The appliance lifecycle needs to be boring: create, update, backup, restore, health check, and destroy. Your planned Traefik/container-per-Ordo model depends on this being deterministic.

Recommended fix:

- Add a single "instance lifecycle contract" doc and test suite covering first boot, install, restart, backup/export, restore, update, health, and data directory permissions.
- Add an explicit backup/restore command or API for `.data`, with smoke tests against a copied volume.
- Decide whether the canonical production shape is truly one container or a compose cell with app + media worker. README currently says the single-container image starts the media worker, while compose uses a separate media-worker service.
- Ensure install can complete without passing any provider keys as env vars if BYOK setup is expected through the UI.

Acceptance test:

- A fresh Docker run can install, create an admin, persist provider settings, restart, and resume without env-provided keys.
- A copied `.data` volume can restore into a fresh container and pass health checks.

## P1 - Reliability And Internal Architecture

### 4. Reduce the `RepositoryFactory` service-locator surface

Current behavior:

- `RepositoryFactory` is documented as a service locator and process-cached singleton registry in `src/adapters/RepositoryFactory.ts:92`.
- It imports and wires a broad mix of repositories, read models, media workflows, profile services, analytics, and platform facades.

Why this matters:

For a compact single-image system, a central composition point is acceptable. The risk is that it becomes the only way anything can be built, tested, or reasoned about. This raises the cost of every future refactor.

Recommended fix:

- Keep `RepositoryFactory` as an RSC/route escape hatch, but move domain-specific composition into smaller roots: chat, jobs, media, referrals, install/config, admin.
- Add import-boundary tests so new core code cannot reach into adapter/lib runtime wiring.
- Track direct `getDb()` route exceptions and force them to shrink over time.

### 5. Repair core boundary drift

Current behavior:

- `src/core/platform/knowledge-access/KnowledgeAccessService.ts:8` imports from `@/lib/access/content-access`.
- `src/core/platform/knowledge-access/KnowledgeAccessService.ts:9` imports from `@/lib/corpus-reference`.
- `src/core/capability-catalog/runtime-tool-binding.ts:1` imports adapter factory wiring directly.

Why this matters:

The business thesis depends on durable contracts: capabilities, recipes, work orders, artifacts, evidence, and projections. If core modules directly know app/runtime infrastructure, those contracts become harder to reuse as A2A/MCP/export boundaries.

Recommended fix:

- Move access/corpus helpers needed by core behind ports or into core-safe modules.
- Keep capability metadata in core, but move runtime binding/composition into an adapter/composition layer.
- Add architecture tests for `src/core` imports.

### 6. Split the browser media runtime orchestration hook

Current behavior:

- `useBrowserCapabilityRuntime.ts` owns discovery, runtime queueing, chart/graph materialization, asset readiness checks, browser execution, fallback, playback verification, and UI snapshot dispatch.
- Playback verification errors are swallowed and the job is marked succeeded in `src/hooks/chat/useBrowserCapabilityRuntime.ts:1122`.

Why this matters:

The WASM media composer is strategically strong because it turns the browser into local compute. But the orchestration surface is too concentrated. Bugs here can look like successful media creation even when playback verification failed.

Recommended fix:

- Split orchestration into smaller units: candidate selection, materialization, preflight/readiness, execution, fallback, presentation.
- Decide whether failed playback verification means warning, retry, fallback, or failed job. Do not silently convert it into success.
- Keep browser WASM as an optimization; durable server-side job state should remain source of truth.

### 7. Remove FFmpeg argument-builder drift

Current behavior:

- `src/lib/media/browser-runtime/ffmpeg-args.ts:1` defines shared/tested browser FFmpeg argument helpers and includes browser-short-explainer handling.
- `src/lib/media/browser-runtime/ffmpeg.worker.ts:150` has separate in-worker execution arg construction.

Why this matters:

Media composition is a high-trust production feature. If tests cover one argument builder while the worker uses another, the tested contract can drift from the shipped behavior.

Recommended fix:

- Make the worker use the shared `ffmpeg-args.ts` implementation.
- Add a worker-level test for `browser_short_explainer`.
- Keep all profile-specific FFmpeg decisions in one place.

### 8. Lower browser media memory limits for alpha profiles

Current behavior:

- Browser FFmpeg asset cap is `500_000_000` bytes in `src/lib/media/browser-runtime/ffmpeg-worker-limits.ts:1`.

Why this matters:

This is high for ordinary laptops and especially high for mobile browsers. Browser WASM should fail early into server fallback instead of letting a user burn memory and time.

Recommended fix:

- Add profile-specific browser caps.
- Default alpha browser composition to conservative limits.
- Route larger plans to deferred server execution before worker startup.

## P1 - Search And Retrieval

### 8a. Keep the self-contained search stack, but harden it as appliance RAG

Current behavior:

- Local embeddings are provided by `@huggingface/transformers` through `src/adapters/LocalEmbedder.ts`.
- The embedding model is currently `Xenova/all-MiniLM-L6-v2`, with logical model version `all-MiniLM-L6-v2@1.0` in `src/lib/chat/embedding-module.ts`.
- Embeddings are stored as SQLite BLOBs in the `embeddings` table and mirrored into an FTS5 table in `src/lib/db/tables.ts`.
- `SQLiteVectorStore` exposes vector search, keyword search, hydration, model-version lookup, and source cleanup in `src/adapters/SQLiteVectorStore.ts`.
- `HybridSearchEngine` performs vector retrieval, FTS keyword retrieval, reciprocal rank fusion, hydration, formatting, and section deduplication in `src/core/search/HybridSearchEngine.ts`.
- Chunking is heading-aware and metadata-rich in `src/core/search/MarkdownChunker.ts`, including document/section/passage levels, contextual embedding prefixes, chunk lineage, boundary source, and concept keywords.

Why this matters:

This is a good fit for the product thesis. A small Ordo should not require Pinecone, Weaviate, Elasticsearch, or a separate search server just to answer questions over its own documents, conversations, and evidence. SQLite + FTS5 + local embeddings is commercially coherent for "a million little sites with a few users each."

The risk is overestimating the current implementation. It is a strong small-appliance RAG stack, not a high-scale vector database. That distinction is fine as long as the product and code are honest about it.

Recommended fix:

- Keep the current SQLite/FTS5/local embedding path as the default.
- Document an expected operating envelope: rough chunk counts, corpus size, indexing time, search latency, and memory use.
- Add health/status output for embedding model, model version, embedding count, FTS count, and last rebuild time.
- Treat retrieval as a trust-producing subsystem: results should expose source, chunk metadata, relevance, vector rank, keyword rank, and evidence/artifact links where available.
- Keep external vector databases out of the default install. Add optional upgrade adapters only when the local envelope is exceeded.

Acceptance test:

- A fresh instance can index the bundled corpus, search it, restart, and return the same canonical top results.
- Search status clearly reports model version, indexed source types, embedding count, and whether the FTS mirror is healthy.

### 8b. Add retrieval evaluation before expanding corpus or memory scope

Current behavior:

- There are good unit tests for chunking, corpus indexing hashes, search command behavior, hybrid result pass-through, and embedding/MCP domain separation.
- There does not appear to be a golden-query retrieval evaluation set that measures whether real user questions retrieve the intended documents, sections, artifacts, or conversation memory.

Why this matters:

Search quality can regress while all mechanics remain green. For Ordo, retrieval quality is not a nice-to-have feature; it is the basis for grounded answers, artifact evidence, onboarding help, and eventually trust-ledger explanations.

Recommended fix:

- Add a small golden retrieval eval suite with 50-200 representative queries.
- Include expected canonical paths or artifact/evidence ids, not just text contains checks.
- Track top-1, top-3, top-5, and "must not retrieve" cases for permission-sensitive content.
- Run the eval suite before changing chunking, metadata, query processing, embedding model, or corpus structure.
- Store failing examples as fixtures so tuning work stays empirical.

Acceptance test:

- `npm` script or eval runner can score retrieval quality deterministically against the bundled corpus.
- A change to chunking or model version produces an explicit retrieval diff instead of silent behavior drift.

### 8c. Move important metadata filters into indexed columns

Current behavior:

- `SQLiteVectorStore` can filter by `source_type`, `chunk_level`, and `source_id`/prefix at SQL level.
- Audience, content class, and role persona filters are read from JSON metadata and applied after candidate retrieval/hydration in `src/adapters/SQLiteVectorStore.ts`.
- This preserves correctness for small result sets, but it makes access-control and relevance filtering more dependent on post-processing.

Why this matters:

The system's search layer is part of the access-control story. If Ordo serves many small business sites, search should remain fast and predictable while respecting audience/class/role boundaries before ranking as much as possible.

Recommended fix:

- Promote high-value metadata into nullable indexed columns on `embeddings` and `embedding_fts`:
  - `audience`
  - `content_class`
  - `role_persona`
  - `owner_user_id` or owner scope where applicable
  - `artifact_id` / `evidence_id` when search results represent governed production outputs
- Keep JSON metadata for rich detail, but do not require JSON hydration for common security/relevance filters.
- Add migration/repair logic that can backfill promoted columns from existing metadata.

Acceptance test:

- A role/audience-filtered search applies SQL-level filters before candidate ranking.
- Existing JSON metadata remains available in returned chunk metadata.

### 8d. Add model-version mismatch warnings and a reindex path

Current behavior:

- The indexing pipeline checks content hash and model version before deciding whether to reindex a source in `src/core/search/EmbeddingPipeline.ts`.
- `SQLiteVectorStore` can return a stored model version by source id.
- Query-time search does not appear to warn when the active embedding model/version differs from stored embeddings across retrieved sources.

Why this matters:

Embedding model drift is a subtle failure mode. Search still returns results, but the query vector and stored vectors may live in different semantic spaces. That creates bad retrieval with no obvious runtime error.

Recommended fix:

- Record the active query embedding model/version with each search.
- When hydrated results contain mismatched model versions, emit a warning and expose a search health issue.
- Add admin repair action: rebuild index for source type.
- Do not fail user search on mismatch during alpha; degrade loudly and give the operator a repair path.

Acceptance test:

- If stored embeddings use `model@old` and the active query uses `model@new`, search returns results with a warning/health issue.
- Rebuild clears the warning.

### 8e. Add reranking as an optional quality layer

Current behavior:

- Hybrid retrieval uses vector rank, FTS rank, reciprocal rank fusion, formatting, and deduplication.
- There is no obvious reranker stage after top-K retrieval.

Why this matters:

MiniLM plus FTS5 is a good default. But for business evidence, trust-ledger explanations, and user-facing answers, the final ordering matters. A local or provider-backed reranker over the top 20-50 candidates can improve precision without replacing the self-contained search architecture.

Recommended fix:

- Add an optional reranker interface after RRF and before final formatting.
- Start with a no-op reranker so the pipeline shape is stable.
- Later support:
  - local cross-encoder where feasible
  - provider-backed reranker for hosted/token users
  - heuristic reranker using source recency, artifact status, evidence confidence, and role/audience fit
- Keep reranking bounded and observable: record candidate count, provider, latency, and whether rerank changed the top result.

Acceptance test:

- With reranking disabled, current hybrid ranking remains unchanged.
- With a deterministic test reranker enabled, final order changes only inside the bounded candidate set and preserves access filters.

## P1 - Product Trust And Growth Loops

### 9. Move referral attribution from client effect to server-controlled activation

Current behavior:

- Referral landing renders active referral content server-side in `src/app/r/[code]/page.tsx:10`.
- Attribution activation happens through a client `useEffect` POST in `src/components/referral/ReferralVisitActivator.tsx:9`.
- Referral events have idempotency protection through a unique index in `src/lib/db/tables.ts:426`.

Why this matters:

The QR affiliate flow is conceptually strong: it links offline trust, attribution, and later conversion. But client-only activation can be missed if JavaScript is blocked, delayed, or the user clicks through before the POST completes.

Recommended fix:

- Set the referral visit cookie server-side on the referral route or via a route handler redirect.
- Keep client activation only as a fallback/repair path.
- Preserve the current ledger/idempotency model.

### 10. Keep payouts manual until attribution evidence is stronger

Current behavior:

- The referral system has ledger events, admin analytics, self-service referral pages, QR generation, and dedupe indexes.

Why this matters:

This is good enough for alpha relationship tracking. It is not yet enough for automated payout liability.

Recommended fix:

- Keep affiliate credit as "tracked/reviewable" during alpha.
- Add explicit admin review states before any token/payout automation.
- Make exported affiliate reports evidence-first: visit, conversion, referrer, conversation/deal link, exception state.

## P1 - Local Speech And Hardware Capability

### 10a. Add local Whisper as a first-class speech-to-text capability

Current behavior:

- Active source has OpenAI-backed TTS in `src/app/api/tts/route.ts:129` and `src/lib/audio/audio-generation-service.ts:111`.
- Active source does not appear to have a first-class speech-to-text route or Whisper transcription capability.
- Archived web-search specs mention an `eai transcribe_video` pipeline that used OpenAI Whisper, but this is not an active local STT surface.
- The repo already depends on `@huggingface/transformers`, which can run Whisper-family ASR models in browser/JS contexts, including WebGPU where available.

Why this matters:

Voice input is a natural fit for Ordo's "chat as cockpit" model, but requiring OpenAI for transcription conflicts with the sovereignty stack. Whisper should be treated as local infrastructure, not as a cloud-only API dependency.

Recommended fix:

- Add a `transcribe_audio` capability and `/api/stt` route with the same governance pattern as media/audio jobs.
- Store uploaded source audio and transcript artifacts in the user file/artifact system with retention metadata.
- Use a provider interface:
  - `local_whisper_cpp`
  - `local_transformers_js`
  - `openai_whisper` fallback, optional
- Prefer an OpenAI-compatible local Whisper endpoint where possible so the API boundary stays simple: `/v1/audio/transcriptions`.
- Do not combine this with TTS. Whisper is STT; OpenAI TTS replacement is a separate local TTS workstream.

Acceptance test:

- With no `OPENAI_API_KEY`, a local Whisper provider can transcribe an uploaded audio file.
- The transcript is stored as a governed artifact tied to user/conversation.
- The route reports provider, model, execution device, duration, and fallback reason.

### 10b. Standardize local Whisper runtime and GPU detection by host class

Research findings:

- `whisper.cpp` is the best fit for Ordo's appliance model. It is MIT-licensed, runs locally, has a `whisper-server` with an OpenAI-like API, supports quantized GGML models, has official Docker images, and supports multiple acceleration paths.
- `whisper.cpp` model memory ranges from roughly hundreds of MB for tiny/base to several GB for large models. This makes model choice an install/runtime setting, not a hidden default.
- On Apple Silicon, `whisper.cpp` supports Core ML for encoder acceleration and can also use local macOS acceleration paths, but Docker Desktop for macOS does not provide normal Apple GPU/Metal passthrough into Linux containers.
- On Linux with NVIDIA, GPU container use should go through NVIDIA Container Toolkit and Docker `--gpus`/`NVIDIA_VISIBLE_DEVICES`.
- On Windows, Docker Desktop GPU support is WSL2/NVIDIA oriented.
- `faster-whisper` is strong on NVIDIA CUDA through CTranslate2, but it introduces a Python/CUDA/cuDNN runtime and is less aligned with the one-image Node/SQLite appliance unless it is isolated as an optional worker image.
- Transformers.js/WebGPU can run Whisper-family ASR in the browser, but WebGPU support is browser-dependent and should be treated like the WASM media composer: useful local acceleration, not the only reliable backend.

Recommended fix:

- Build a `speech-worker` contract, analogous to the media worker, with provider/device reporting:
  - `provider`: `whisper_cpp`, `transformers_js`, `openai`
  - `device`: `cpu`, `metal`, `coreml`, `cuda`, `vulkan`, `webgpu`
  - `model`: `base.en`, `small.en`, `large-v3-turbo`, etc.
  - `runtime`: `host`, `container`, `browser`
- For Linux NVIDIA and Windows WSL2 NVIDIA, support a CUDA-enabled worker container/profile.
- For macOS, prefer host-side `whisper-server` or a browser WebGPU path; do not promise Docker Apple-GPU acceleration.
- Add a startup probe that records detected OS, architecture, available binaries, model path, GPU mode, and benchmark result.
- Make CPU the safe default everywhere; GPU should be opt-in or auto-selected only after a successful probe.

Suggested staged implementation:

1. Add OpenAI-compatible STT provider interface and tests using a mocked local `/v1/audio/transcriptions` endpoint.
2. Add `WHISPER_BASE_URL`, `WHISPER_MODEL`, `WHISPER_PROVIDER=local|openai`, and `WHISPER_DEVICE=auto|cpu|cuda|metal|coreml|webgpu`.
3. Add docs/scripts to run `whisper.cpp` locally on macOS/Linux/Windows.
4. Add optional Docker Compose profiles for Linux/Windows NVIDIA GPU.
5. Later, add browser WebGPU transcription as a client-side optimization.

Acceptance test:

- Startup diagnostics report whether local STT is available and which device is actually being used.
- A CPU-only machine can still transcribe with a small model.
- A Linux NVIDIA host can verify GPU access with a container-level probe before enabling CUDA transcription.
- A macOS host is not incorrectly marked GPU-ready inside Docker.

## P2 - Codebase Focus And Alpha Readiness

### 11. Shrink large hot-path files before adding more features

Observed hotspots from source inspection include:

- `src/hooks/chat/useBrowserCapabilityRuntime.ts`
- `src/core/capability-catalog/runtime-tool-binding.ts`
- `src/adapters/ChatPresenter.ts`
- `src/lib/evals/runner.ts`
- Large test files such as `src/adapters/ChatPresenter.test.ts`

Why this matters:

Large files are not automatically bad, but these are central behavioral surfaces. Adding A2A, issue automation, and more factory workflow on top of them without splitting ownership will slow every fix.

Recommended fix:

- Pick one hot path per week and split by responsibility with characterization tests first.
- Avoid broad rewrites. Extract stable seams around already-tested behavior.

### 12. Treat A2A as an external commerce/interoperability adapter, not internal orchestration

Current direction:

- The business plan expects A2A commerce between Ordo sites after the core alpha loop is stable.
- README already treats MCP as an interoperability/export boundary, not primary orchestration.

Why this matters:

A2A fits the "many small Ordos" thesis, but only after each Ordo has reliable local identity, artifacts, evidence, jobs, and settlement/credit semantics. If A2A enters the internal execution path too early, it will multiply failure modes.

Recommended fix:

- Build A2A around exported contracts: agent card, capabilities, work/order offers, artifact evidence, settlement/referral metadata.
- Do not use A2A to replace internal jobs, recipes, or capability routing.
- Beta-gate A2A on restore/update/job reliability, not on protocol implementation alone.

### 13. Make GitHub issue creation evidence-driven

Current direction:

- The alpha plan includes automatic GitHub issue creation from user testing and QA evidence.

Why this matters:

This can become a major advantage if it captures reproducible evidence instead of just dumping chat complaints into issues.

Recommended fix:

- Issues should include route, user/session class, app version, job ids, artifact ids, logs, screenshots when available, expected/actual result, and reproduction steps.
- Use the existing evidence/release orientation rather than creating a separate support-ticket system.
- Add redaction before export.

### 14. Use Rust selectively for stable system kernels, not product workflows

Expected direction:

- The TypeScript/Next.js layer should remain the product/control plane: UI, install, admin settings, chat presentation, provider config, capability catalog metadata, referrals, and fast-changing business workflows.
- Rust should be introduced only where the boundary is stable and the system benefits from deterministic performance, memory behavior, binary portability, and stricter data handling.

Best Rust candidates:

- Search/vector hot paths:
  - vector scoring
  - future approximate nearest-neighbor indexing
  - embedding storage codecs
  - metadata/index repair jobs
- Trust/evidence ledger kernel:
  - event normalization
  - hash-chain or tamper-evident sequencing
  - export bundle verification
  - redaction validation
  - provenance manifest generation
- Backup/restore and appliance lifecycle:
  - snapshot manifests
  - archive verification
  - migration preflight
  - volume integrity checks
- Media/job preflight:
  - file probing
  - asset manifest validation
  - deterministic job planning
  - child-process guardrails around FFmpeg/Whisper/etc.
- Long-running local workers where JavaScript runtime behavior becomes a reliability constraint.

What should not move to Rust early:

- Install wizard and admin UI.
- Chat UX and presentation.
- Capability catalog authoring surfaces.
- Product workflows that are still being discovered.
- A2A/MCP product policy.

Why this matters:

The value of Rust here is not aesthetic rewrite energy. It is turning Ordo from a large AI web app into a small AI appliance with durable kernels. If the right pieces move behind stable contracts, the product becomes easier to trust: TypeScript stays fast for product iteration, while Rust handles the engine-room work where correctness and bounded resource use matter.

Recommended fix:

- First define stable TypeScript ports around search execution, trust ledger verification, backup/restore verification, and media preflight.
- Add test fixtures at those boundaries before any Rust implementation starts.
- Introduce Rust through narrow CLI or native-module boundaries only after the TypeScript behavior is characterized.
- Keep SQLite and JSON contracts explicit so Rust and TypeScript can share data without hidden process state.
- Treat every Rust module as replaceable infrastructure behind a contract, not as a new place for product logic to spread.

Acceptance test:

- A Rust-backed implementation can replace a TypeScript kernel without changing route/UI/capability code.
- Fixtures prove identical behavior across TypeScript and Rust implementations during migration.
- Backup/restore, search, ledger verification, or media preflight can run as deterministic smoke tests inside the production image.

## Recommended Execution Order

1. Fix Anthropic model selection and remove hard-coded install/admin validation models.
2. Generalize Anthropic-compatible provider config so DeepSeek can be selected without Claude fallback leakage.
3. Unify provider config resolution across env and SQLite settings.
4. Prove fresh Docker install, restart, backup, restore, and health in tests/scripts.
5. Split browser media runtime enough to stop swallowing playback verification failures.
6. Move referral activation server-side.
7. Add retrieval evals and search health/version reporting before expanding corpus or memory scope.
8. Promote search access/relevance metadata into indexed SQLite columns.
9. Add a local Whisper/STT provider contract before adding voice UX.
10. Define stable ports for future Rust kernels before rewriting any implementation.
11. Add architecture tests around core import boundaries.
12. Start shrinking the largest hot-path files one at a time.

## Validation Already Run During Review

- `npm run typecheck` passed during the broader source assessment.
- `npm run lint:strict` reported warnings but no errors during the broader source assessment.
- Focused QR/referral tests passed: 9 files, 25 tests.
- Focused WASM media composer tests passed: 9 files, 73 tests.

## External References Checked

- DeepSeek Anthropic-compatible API documentation: `https://api-docs.deepseek.com/guides/anthropic_api`
- DeepSeek coding-agent integration documentation: `https://api-docs.deepseek.com/guides/coding_agents`
- `whisper.cpp` project documentation: `https://github.com/ggml-org/whisper.cpp`
- Hugging Face Transformers.js WebGPU documentation: `https://huggingface.co/docs/transformers.js/guides/webgpu`
- SYSTRAN `faster-whisper` documentation: `https://github.com/SYSTRAN/faster-whisper`
- Docker Desktop GPU support documentation: `https://docs.docker.com/desktop/features/gpu/`
- NVIDIA Container Toolkit Docker documentation: `https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/1.14.3/docker-specialized.html`

## Bottom Line

The codebase is not misguided. It is ahead of the common SaaS template because it treats AI systems as governed local production cells instead of thin chat wrappers around cloud services. The most important work now is reduction: make install reliable, make model/provider policy explicit, keep data portable, and reduce internal coupling before adding A2A commerce and larger factory automation.
