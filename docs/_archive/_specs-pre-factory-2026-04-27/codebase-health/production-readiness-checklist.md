# Codebase Health — Production Readiness Checklist

Status: Open
Date: 2026-04-22

Discipline (inherited from beginner-solopreneur-refactor):

- `[ ]` = not started.
- `[~]` = partial / honestly deferred with named scope.
- `[x]` = complete and backed by `evidence/phase-N.md`.

Never flip `[ ]` → `[x]` without an evidence file.

---

## Phase 0 — Baselines + verify script groundwork

- [x] Captured `npx tsc --noEmit` error count and grouping. (33 errors; see [evidence/phase-0.md](./evidence/phase-0.md))
- [x] Captured `npx vitest run` pass/fail (actual: 48 failed files / 114 failed tests vs. 47/113 expected).
- [x] Captured `npm run lint` status. (49 errors, 119 warnings.)
- [x] Added `verify` script stub to `package.json`.
- [x] `evidence/phase-0.md` exists and cites commit SHA `b20f61d`.

## Phase 1 — TypeScript `--noEmit` baseline zero (F1, F8)

- [x] `next.config.ts` clean.
- [x] Capability-catalog tests compile.
- [x] Use-case interactor tests compile.
- [x] Job-runtime tests + `job-capability-registry.ts` compile.
- [x] Media-pipeline tests + source modules compile.
- [x] Playwright browser-ui spec compiles.
- [x] `tests/deferred-job-worker.test.ts` compiles.
- [x] `npx tsc --noEmit` exits 0.
- [x] `npm run verify` exists and includes tsc.
- [x] `evidence/phase-1.md` exists with before/after counts.

## Phase 2 — Test-mock factories (F6)

- [ ] Shared factory module created.
- [ ] `UserFileRepository` factory + consumers migrated.
- [ ] `ConversationRepository` factory + consumers migrated.
- [ ] `MediaCompositionPlan` factory + consumers migrated.
- [ ] Vitest failure count reduced (target: every F6-blocked test green).
- [ ] `evidence/phase-2.md` exists.

## Phase 3 — Regression sweep canonicalization (F3)

- [ ] Regression-sweep contract doc published under `docs/operations/`.
- [ ] Spec templates reference the contract.
- [ ] `evidence/phase-3.md` exists.

## Phase 4 — Capability descriptor placement doc (F4)

- [ ] Placement doc published under `docs/operations/`.
- [ ] Worked example migrates an ambiguous descriptor.
- [ ] `evidence/phase-4.md` exists.

## Phase 5 — `user_preferences` policy split (F5)

- [ ] `USER_WRITABLE_KEYS` / `SYSTEM_WRITABLE_KEYS` exported from a policy module.
- [ ] Repository guard rejects cross-scope writes.
- [ ] All call sites updated.
- [ ] `evidence/phase-5.md` exists.

## Phase 6 — Audio generation deep audit + fixes

- [x] Production CSP carries `media-src 'self' blob:` and `connect-src` allows `/api/tts` + `/api/user-files/*`.
- [x] Header snapshot evidence captured.
- [x] `/api/tts` success-path observability verified against `recordRouteMetric` + `tts.request.success` event.
- [x] `OPENAI_API_KEY` validated by `scripts/admin-validate-env.ts`.
- [x] Admin system page exposes OpenAI / TTS provider health alongside Anthropic.
- [x] `AudioPlayerCard` structured-result branch renders `role="region"`.
- [x] `tests/chat-performance-a11y.test.tsx` AudioPlayerCard assertion green.
- [x] `src/frameworks/ui/chat/plugins/custom/AudioPlayerCard.test.tsx` green.
- [x] `src/components/AudioPlayer.test.tsx` green.
- [x] `tests/tts-route-hardening.test.ts` green.
- [x] `AudioPlayer` CSP-violation fallback unit-tested.
- [x] `tests/evals/eval-runner.test.ts#audio-failure-detected` still green.
- [x] `evidence/phase-6.md` exists and links [evidence/audio-audit-2026-04-22.md](./evidence/audio-audit-2026-04-22.md).

## Phase 7 — Deferred-job-worker split (F2.1)

- [ ] Scheduler module isolated.
- [ ] Executor module isolated.
- [ ] Failure-policy module isolated.
- [ ] Focused tests per module.
- [ ] `tests/deferred-job-worker.test.ts` + `tests/deferred-job-notifications.test.ts` green.
- [ ] `evidence/phase-7.md` exists.

## Phase 8 — Runtime-tool-binding isolation (F2.2)

- [ ] Catalog-lookup unit extracted.
- [ ] Context-construction unit extracted.
- [ ] Dispatch unit extracted.
- [ ] `src/core/capability-catalog/runtime-tool-binding.test.ts` split to match.
- [ ] `evidence/phase-8.md` exists.

## Phase 9 — Conversation retrieval interactor (F2.3)

- [ ] `ConversationRetrievalInteractor` exists under `src/core/use-cases/`.
- [ ] `search-my-conversations` tool delegates.
- [ ] Interactor tests cover success + empty + ACL paths.
- [ ] `evidence/phase-9.md` exists.

## Phase 10 — Close carried `[~]` deferrals

- [ ] Preceding package: Phase 2 corpus-sourced coach resolved (closure or explicit subsumption).
- [ ] Preceding package: Phase 4 premium-gated deep search content + test exist.
- [ ] Preceding package: Phase 5 plain-language media-status copy rewritten.
- [ ] Preceding package: Phase 5 beginner/operator card separation implemented.
- [ ] Cross-links added to preceding package's checklist.
- [ ] `evidence/phase-10.md` exists.

## Phase 11 — Release gate

- [ ] `npm run lint` exits 0.
- [ ] `npx tsc --noEmit` exits 0.
- [ ] `npx vitest run` exits 0 (0 failed files, 0 failed tests).
- [ ] `npm run verify` exits 0.
- [ ] Every phase 0–10 has an `evidence/phase-N.md`.
- [ ] Release notes entry drafted.
- [ ] `evidence/phase-11.md` exists with final commit SHA.

---

## Release conditions (roll-up)

- [ ] All phases 0–11 `[x]`.
- [ ] No `[ ]` items remain; any `[~]` items are explicitly re-scoped with named owner and follow-up package.
- [ ] Audio regression surface closed.
- [ ] TypeScript is a real regression gate.
- [ ] `npm run verify` is the canonical pre-commit / CI entry point.
