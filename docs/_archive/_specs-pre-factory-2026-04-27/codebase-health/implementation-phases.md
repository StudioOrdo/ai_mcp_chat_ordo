# Codebase Health — Implementation Phases

Status: Planned
Date: 2026-04-22
Owner: GitHub Copilot (authored) / TBD (executor)

## Conventions

- Each phase has: **Intent**, **Deliverables**, **Touch points**, **Regression sweep**, **Evidence**.
- A phase is complete only when `evidence/phase-N.md` exists and the regression sweep is green.
- Phases are ordered by dependency. Phase 0 must finish first; Phase 1 must finish before any test-touching phase; Phase 11 is the release gate.
- "Touch points" are indicative — the executor is responsible for the final file list recorded in evidence.

---

## Phase 0 — Baselines + verify script groundwork

Intent: Produce objective, commit-referenced baselines so subsequent phase evidence can show measurable deltas.

Deliverables

- `evidence/phase-0-baseline.md` capturing:
  - Current `npx tsc --noEmit` error count and grouping (starts at F1's ~51).
  - Current `npx vitest run` pass/fail counts (starts at 47 failed files / 113 failed tests / 4230 passing / 2 skipped).
  - Current `npm run lint` status.
  - Commit SHA pinning all three.
- Shell/NPM scaffolding for `npm run verify` (script entry only; content filled in Phase 1).

Touch points

- `package.json` (add `verify` script placeholder that runs `npm run lint && npx tsc --noEmit && npx vitest run`).
- `docs/_specs/codebase-health/evidence/phase-0-baseline.md`.

Regression sweep

- `npm run verify` may currently exit non-zero; that is the baseline captured.

Evidence

- `evidence/phase-0.md` must cite the three tool outputs and commit SHA.

---

## Phase 1 — TypeScript `--noEmit` baseline zero (F1, F8)

Intent: Drive `npx tsc --noEmit` to exit 0 so type-checking becomes a real regression gate, then wire it into `npm run verify`.

Deliverables

- Every file listed in `findings-2026-04-22.md#F1` compiles cleanly.
- `npm run verify` passes the tsc step.
- Release gate updated in production-readiness-checklist.

Touch points (from F1 inventory)

- `next.config.ts` (drop stale `eslint` key).
- `src/core/capability-catalog/runtime-tool-binding.test.ts`.
- `src/core/use-cases/ConversationInteractor.test.ts`.
- `src/lib/jobs/compose-media-deferred-job.test.ts`, `deferred-job-runtime.test.ts`, `job-capability-registry.ts`.
- `src/lib/media/browser-runtime/ffmpeg-browser-executor.test.ts`.
- `src/lib/media/server/compose-media-mermaid-renderer.ts`, `compose-media-plan-materialization.ts` (+ test), `media-worker-client.test.ts`, `media-worker-http.test.ts`.
- `tests/browser-ui/media-compose-planner-eval.spec.ts`.
- `tests/deferred-job-worker.test.ts`.

Regression sweep

- `npx tsc --noEmit` exit 0.
- `npm run lint`.
- `npx vitest run` — no new failures vs. Phase 0 baseline.

Evidence

- `evidence/phase-1.md` with before/after tsc counts and affected-file list.

---

## Phase 2 — Test-mock factories (F6)

Intent: Eliminate repeated hand-rolled partial mocks by introducing factory helpers that stay aligned with current repository / domain interfaces.

QA update, 2026-04-24

- Phase 1 closeout is green: `npm run test` passed with 564 files / 4,395 tests / 2 skipped, and `npm run qa:runtime-integrity` passed including production build and evidence generation. Phase 2 should start from this zero-known-failure baseline.
- Existing helper surface is partial, not absent. `tests/helpers/repository-fixture.ts` already contains narrow factories for deal, training-path, consultation-request, lead-record, and conversation-event recorder mocks. Prefer extending this helper family (or splitting it under `tests/helpers/repositories/`) over creating an unrelated parallel convention.
- Highest-risk mock drift now clusters around media/conversation/job tests that hand-roll `UserFileRepository` and `JobQueueRepository` shapes. Verified examples include `src/core/use-cases/ConversationInteractor.test.ts`, `src/core/capability-catalog/runtime-tool-binding.test.ts`, `src/core/use-cases/tools/compose-media.tool.test.ts`, and `src/lib/jobs/compose-media-deferred-job.test.ts`.
- Several current mocks use `as unknown as UserFileRepository` after filling only the methods a test needs. That is the exact drift pattern Phase 2 should remove first, especially because Phase 0/1 added `userFileRepository` responsibilities for compose-media canonicalization, source rehydration, transcript export, and deferred jobs.
- Many route/admin tests mock `@/adapters/RepositoryFactory` directly. Factory work should not require migrating every module mock in one pass; prioritize domain repository factories first, then add adapter-factory helpers only where duplicate setup is already causing churn.
- Broad-gate blockers found during Phase 1 included stale test expectations and missing imports, not a failing implementation baseline. Phase 2 should be conservative: migrate mocks without changing behavior, then run targeted suites plus the full test gate.

Deliverables

- A single location (e.g. `tests/_factories/`) exporting shared mock factories for `UserFileRepository`, `ConversationRepository`, `UserFileType`, `MediaCompositionPlan`, and similar shapes identified in F1/F6.
- Tests previously broken by mock drift switched onto the factories.
- A migration note explaining the factory convention and when to use `tests/helpers/repository-fixture.ts` versus any new domain-specific helper file.
- A no-regression cleanup of local `createUserFileRepositoryMock` / `createRepositoryMock` duplicates in the compose-media, conversation, and runtime-tool-binding tests.

Touch points

- New `tests/_factories/*.ts` or `src/core/testing/*.ts`.
- Existing `tests/helpers/repository-fixture.ts`.
- All `*.test.ts` files currently inlining partial mocks of the targeted interfaces.
- First migration slice should include:
  - `src/core/use-cases/ConversationInteractor.test.ts`.
  - `src/core/capability-catalog/runtime-tool-binding.test.ts`.
  - `src/core/use-cases/tools/compose-media.tool.test.ts`.
  - `src/lib/jobs/compose-media-deferred-job.test.ts`.

Regression sweep

- Targeted: `npx vitest run src/core/use-cases/ConversationInteractor.test.ts src/core/capability-catalog/runtime-tool-binding.test.ts src/core/use-cases/tools/compose-media.tool.test.ts src/lib/jobs/compose-media-deferred-job.test.ts`.
- Broad: `npm run test` remains green against the Phase 1 closeout baseline.

Evidence

- `evidence/phase-2.md` with before/after vitest counts and the list of tests migrated.
- Include the pre-migration duplicate factory inventory and the final shared factory file list.

---

## Phase 3 — Regression sweep canonicalization (F3)

Intent: Replace the informal "narrow sweep" discipline with a documented, phase-gate-integrated contract.

Deliverables

- `docs/operations/regression-sweep-contract.md` (or similar) describing:
  - Mandatory lint + tsc + targeted vitest scope.
  - Convention for phase-scoped vitest file lists.
  - Escalation from targeted to full sweep at release gate.
- Reference from every spec template to the contract.

Regression sweep

- Lint only; this phase is documentation.

Evidence

- `evidence/phase-3.md` linking the new contract doc and updated templates.

---

## Phase 4 — Capability descriptor placement doc (F4)

Intent: Document the placement rules for the two parallel capability stores (`src/core/capability-catalog/` vs. `src/lib/capabilities/`) so future descriptors land in the right place without ad-hoc grepping.

Deliverables

- `docs/operations/capability-descriptor-placement.md` explaining:
  - What belongs in `core/capability-catalog/` (pure catalog, DI-neutral).
  - What belongs in `lib/capabilities/` (runtime-bound surfaces, browser/server integration).
  - Migration criteria for moving a descriptor between them.
- One worked example converting an ambiguous descriptor.

Regression sweep

- Lint + vitest run on capability-catalog tests.

Evidence

- `evidence/phase-4.md`.

---

## Phase 5 — `user_preferences` policy split (F5)

Intent: Split `user_preferences` KV surface into `USER_WRITABLE_KEYS` and `SYSTEM_WRITABLE_KEYS`, enforced at the repository layer.

Deliverables

- Policy module exporting the two key sets.
- Repository guard that rejects writes from user-scoped callers to SYSTEM keys (and vice versa for internal writers writing to USER keys through the public surface).
- Migration note for existing keys.

Touch points

- `src/lib/user-preferences/**`.
- All call sites of user-preferences writes.

Regression sweep

- Lint + `vitest run` scoped to user-preferences + admin preferences tests.

Evidence

- `evidence/phase-5.md`.

---

## Phase 6 — Audio generation deep audit + fixes

Intent: Close the audio-generation regression surface documented in [evidence/audio-audit-2026-04-22.md](./evidence/audio-audit-2026-04-22.md).

Closeout state (2026-04-25)

- [src/proxy.ts](../../../src/proxy.ts) now sets the governed CSP header directly in the repo: `frame-ancestors 'none'; media-src 'self' blob:; connect-src 'self' ws: wss:`.
- [src/lib/config/env.ts](../../../src/lib/config/env.ts) `validateRequiredRuntimeConfig()` now requires both Anthropic and OpenAI keys, and [src/lib/health/probes.ts](../../../src/lib/health/probes.ts) now treats OpenAI as part of readiness.
- [src/components/AudioPlayer.test.tsx](../../../src/components/AudioPlayer.test.tsx) now asserts the `securitypolicyviolation` / `media-src blob` fallback explicitly.
- [tests/tts-route-hardening.test.ts](../../../tests/tts-route-hardening.test.ts) is now a behavior-level route suite covering 200 / 400 / 403 / 504 / 500 outcomes plus observability calls, rather than a source-grep test.
- Focused Phase 6 validation is fully green: `8` files / `70` tests. See [evidence/phase-6.md](./evidence/phase-6.md).

Delivered scope

- Production CSP carries `media-src 'self' blob:` and `connect-src` allows governed same-origin TTS and user-file delivery.
- Header snapshot evidence is captured by the proxy regression suite and recorded in [evidence/phase-6.md](./evidence/phase-6.md).
- `/api/tts` success path is verified against `recordRouteMetric(...)`, `tts.request.success`, `logFailure(...)`, and `X-Request-Id` handling.
- `OPENAI_API_KEY` is validated by `scripts/admin-validate-env.ts` through `getEnvValidationReport()` / `validateRequiredRuntimeConfig()`.
- The admin system page exposes OpenAI / TTS provider health alongside Anthropic.
- `AudioPlayerCard` structured-result rendering stays accessible with `role="region"`.
- `AudioPlayer` CSP fallback is directly unit-tested.
- The `audio-failure-detected` eval guard remains green.

Touch points

- Edge / CDN CSP source plus any deployment-level header templates.
- [scripts/admin-validate-env.ts](../../../scripts/admin-validate-env.ts).
- [src/lib/config/env.ts](../../../src/lib/config/env.ts).
- [src/lib/health/probes.ts](../../../src/lib/health/probes.ts).
- [src/lib/admin/processes.ts](../../../src/lib/admin/processes.ts).
- [src/app/admin/system/page.tsx](../../../src/app/admin/system/page.tsx).
- [src/proxy.ts](../../../src/proxy.ts).
- [src/frameworks/ui/chat/plugins/custom/AudioPlayerCard.tsx](../../../src/frameworks/ui/chat/plugins/custom/AudioPlayerCard.tsx).
- [src/components/AudioPlayer.tsx](../../../src/components/AudioPlayer.tsx).
- [src/app/api/tts/route.ts](../../../src/app/api/tts/route.ts).

Regression sweep

- `npx vitest run src/proxy.test.ts src/frameworks/ui/chat/plugins/custom/AudioPlayerCard.test.tsx src/components/AudioPlayer.test.tsx tests/tts-route-hardening.test.ts tests/chat-performance-a11y.test.tsx tests/admin-processes.test.ts tests/health-probes.test.ts tests/evals/eval-runner.test.ts`

Evidence

- [evidence/phase-6.md](./evidence/phase-6.md) records the 2026-04-25 closeout, the governed CSP header snapshot, and the green focused bundle.

---

## Phase 7 — Deferred-job-worker split (F2.1)

Intent: Break the deferred-job-worker hotspot into scheduler, executor, and failure-policy modules without behavior change.

Deliverables

- Three new modules (or one module with three clear boundaries) covering:
  - Scheduler (selects next job, concurrency policy).
  - Executor (invokes capability handler with context).
  - Failure policy (retry, dead-letter, reason-code mapping).
- Existing integration tests unchanged and green; new focused tests per module.

Touch points

- `src/lib/jobs/deferred-job-runtime.ts` and `src/lib/jobs/deferred-job-worker*`.
- `scripts/worker-supervisor.ts` boot path (if module surface changes).

Regression sweep

- Lint + `vitest run` on jobs/deferred-* + `scripts/process-deferred-jobs.ts` smoke.

Evidence

- `evidence/phase-7.md`.

---

## Phase 8 — Runtime-tool-binding isolation (F2.2)

Intent: Isolate the three responsibilities currently tangled in the runtime-tool-binding hotspot: catalog lookup, context construction, and dispatch.

Deliverables

- Three separated units with clear public APIs.
- `src/core/capability-catalog/runtime-tool-binding.test.ts` split to cover each unit.

Touch points

- `src/core/capability-catalog/runtime-tool-binding.ts` (+ test).
- Callers in chat-stream and browser runtime.

Regression sweep

- Lint + `vitest run` on capability-catalog + chat-stream-route + browser-capability-runtime.

Evidence

- `evidence/phase-8.md`.

---

## Phase 9 — Conversation retrieval interactor (F2.3)

Intent: Extract the `search-my-conversations` tool's retrieval logic into a `ConversationRetrievalInteractor` so the tool handler becomes a thin adapter.

Deliverables

- `ConversationRetrievalInteractor` in `src/core/use-cases/`.
- Tool handler updated to delegate.
- Focused interactor tests.

Touch points

- `src/core/use-cases/ConversationRetrievalInteractor.ts` (new).
- `src/core/use-cases/tools/search-my-conversations.*`.

Regression sweep

- Lint + `vitest run` on use-cases + tools + chat-policy.

Evidence

- `evidence/phase-9.md`.

---

## Phase 10 — Close carried `[~]` deferrals from preceding package

Intent: Convert the 4 honest `[~]` deferrals carried over from beginner-solopreneur-refactor into full `[x]` closures now that the hotspot refactors (Phase 7–9) and Phase 6 audio fixes are in.

Deliverables

- Phase 2 corpus-sourced coach: closed or explicitly re-scoped to "subsumed by Phase 4 chat" with a traceable reference.
- Phase 4 premium-gated deep search: premium content authored (minimum viable fixture) + test coverage.
- Phase 5 plain-language media-status copy: rewritten using the strings now surfaced by Phase 7's failure-policy module.
- Phase 5 beginner/operator card separation: registry split implemented.

Touch points

- Preceding package's checklist (`docs/_specs/beginner-solopreneur-refactor/production-readiness-checklist.md`) — flip `[~]` to `[x]` with evidence cross-links.
- Concrete code under the surfaces named in each deferral.

Regression sweep

- Lint + targeted vitest per deferral.

Evidence

- `evidence/phase-10.md` enumerating each deferral with its closure commit/test.

---

## Phase 11 — Release gate

Intent: Verify the package closes as a releasable unit.

Deliverables

- `npm run verify` exits 0 on the release-candidate commit.
- Full `vitest run` reports 0 failures.
- Every phase has an evidence file.
- Release notes entry drafted.

Regression sweep

- Full: `npm run lint && npx tsc --noEmit && npx vitest run`.

Evidence

- `evidence/phase-11.md` with the three tool outputs and the final commit SHA.
