# Codebase Health

Status: Active work package
Date: 2026-04-22
Process: Follows `docs/operations/ai-phase-delivery-process.md`
Preceding package: `docs/_specs/beginner-solopreneur-refactor/` (closed 2026-04-22, Phases 0–7 complete)

This package is the single source of truth for remediating platform-health debt identified while closing out the beginner-solopreneur-refactor. It rolls up:

- Findings F1–F8 documented in [findings-2026-04-22.md](./findings-2026-04-22.md).
- The F7 system-envelope contract already closed in [f7-system-envelope-contract.md](./f7-system-envelope-contract.md) (used as Phase 2 of the preceding package).
- The 4 honest `[~]` deferrals carried over from the beginner-solopreneur-refactor (Phase 2 corpus-sourced coach, Phase 4 premium deep search, Phase 5 plain-language media-status copy, Phase 5 beginner/operator card separation).
- A current-state regression surface: 47 failing test files / 113 failing tests (baseline 2026-04-22, see [test-failure-inventory-2026-04-22.md](./test-failure-inventory-2026-04-22.md)).
- A deep audio-generation audit (see [evidence/audio-audit-2026-04-22.md](./evidence/audio-audit-2026-04-22.md)).

## Package shape

Each phase carries the same gate shape used by the preceding package:

- Focused behavior: the user-visible or developer-visible outcome the phase must deliver.
- Regression sweep: `npm run lint` + targeted `vitest run` scoped to the phase.
- Truth check: no `[x]` without a corresponding `evidence/phase-N.md` file.

Evidence files live under [evidence/](./evidence/) and are committed alongside the phase flip.

## Phase map

See [implementation-phases.md](./implementation-phases.md) for full detail.

| Phase | Theme | Primary findings / issues |
| --- | --- | --- |
| 0 | Baselines + verify script | Groundwork for every subsequent phase |
| 1 | TypeScript baseline zero | F1 (51→0 tsc errors), F8 (`npm run verify`) |
| 2 | Test-mock factories | F6 (mock drift), unblocks mock-shape failures |
| 3 | Regression sweep canonicalization | F3 (narrow sweep discipline) |
| 4 | Capability descriptor placement doc | F4 (two parallel capability stores) |
| 5 | `user_preferences` policy split | F5 (USER/SYSTEM writable key separation) |
| 6 | Audio generation deep audit + fixes | TTS CSP / observability / a11y / env validation |
| 7 | Deferred-job-worker split | F2.1 (scheduler + executor + failure-policy) |
| 8 | Runtime-tool-binding isolation | F2.2 (catalog lookup + context + dispatch) |
| 9 | Conversation retrieval interactor | F2.3 (`search-my-conversations` → interactor) |
| 10 | Close carried `[~]` deferrals | Premium content, media-status copy, card separation |
| 11 | Release gate | All green, evidence complete, tag candidate |

## Release conditions

See [production-readiness-checklist.md](./production-readiness-checklist.md). Release readiness requires:

- `npx tsc --noEmit` exit 0.
- `npm run lint` exit 0.
- `npx vitest run` exit 0.
- `npm run verify` exists, wraps the above, and passes.
- Every phase has an `evidence/phase-N.md` file.
- Audio deep audit closed with production CSP fix verified, `/api/tts` success-path observability verified, OpenAI env validated in health checks, and `chat-performance-a11y` + `AudioPlayer` + `tts-route-hardening` test files green.

## Current summary

- Phase 0: **complete** (2026-04-23, commit `b20f61d`) — baselines captured, `verify` script added. See [evidence/phase-0.md](./evidence/phase-0.md).
- Phase 1: **complete** (2026-04-23) — `tsc --noEmit` now exits 0 (33 → 0 errors); vitest regression surface improved by one file. See [evidence/phase-1.md](./evidence/phase-1.md).
- Phase 6: **complete** (2026-04-25) — governed CSP is now repo-managed, OpenAI is part of runtime env validation and readiness, the dedicated `AudioPlayer` CSP fallback test is in place, and the focused Phase 6 bundle is green (`8` files / `70` tests). See [evidence/phase-6.md](./evidence/phase-6.md).

Phases 2–11: planned.

## Index

- [implementation-phases.md](./implementation-phases.md)
- [production-readiness-checklist.md](./production-readiness-checklist.md)
- [findings-2026-04-22.md](./findings-2026-04-22.md) — F1–F8 source observations
- [f7-system-envelope-contract.md](./f7-system-envelope-contract.md) — already closed
- [test-failure-inventory-2026-04-22.md](./test-failure-inventory-2026-04-22.md) — snapshot of 47 failing files
- [evidence/](./evidence/) — per-phase evidence, one file per phase
- [evidence/audio-audit-2026-04-22.md](./evidence/audio-audit-2026-04-22.md) — Phase 6 deep audit (done ahead of phase execution)
