# Phase 6 — Audio generation deep audit + fixes

Status: Complete
Date: 2026-04-25
Preceding: [evidence/phase-0.md](./phase-0.md), [evidence/phase-1.md](./phase-1.md), [evidence/audio-audit-2026-04-22.md](./audio-audit-2026-04-22.md)

## Outcome

- Phase 6 is closed at HEAD.
- Governed audio-delivery CSP is now repo-managed in [src/proxy.ts](../../../../src/proxy.ts).
- OpenAI is now part of the hard runtime env-validation and readiness path.
- The `AudioPlayer` CSP fallback has a dedicated unit test.
- `/api/tts` hardening is now verified through behavior-level route tests rather than source inspection.

## Shipped changes

### 1. CSP fix is now in the repo-owned proxy

- [src/proxy.ts](../../../../src/proxy.ts) now emits:

```text
frame-ancestors 'none'; media-src 'self' blob:; connect-src 'self' ws: wss:
```

- This gives the browser explicit permission to play blob-backed audio while preserving the existing frame-ancestor hardening.
- [src/proxy.test.ts](../../../../src/proxy.test.ts) now asserts the exact header string and the presence of the audio-delivery directives. That test output is the committed header snapshot for this phase.

### 2. OpenAI-backed audio is now part of runtime validation and readiness

- [src/lib/config/env.ts](../../../../src/lib/config/env.ts) `validateRequiredRuntimeConfig()` now requires both Anthropic and OpenAI configuration.
- [src/lib/health/probes.ts](../../../../src/lib/health/probes.ts) now includes an `openai` readiness check and fails readiness when `OPENAI_API_KEY` is absent.
- `scripts/admin-validate-env.ts` closes over that same validation path via [src/lib/admin/processes.ts](../../../../src/lib/admin/processes.ts) `getEnvValidationReport()`.
- [tests/admin-processes.test.ts](../../../../tests/admin-processes.test.ts) and [tests/health-probes.test.ts](../../../../tests/health-probes.test.ts) now pin the new OpenAI gate.

### 3. Audio playback failure handling is directly exercised

- [src/components/AudioPlayer.tsx](../../../../src/components/AudioPlayer.tsx) already surfaced `securitypolicyviolation` for `media-src` / `blob` as a user-facing load error.
- [src/components/AudioPlayer.test.tsx](../../../../src/components/AudioPlayer.test.tsx) now dispatches that event directly and asserts the CSP-specific error message.

### 4. `/api/tts` hardening now has route-level observability coverage

- [tests/tts-route-hardening.test.ts](../../../../tests/tts-route-hardening.test.ts) now covers:
  - `200` success with `X-User-File-Id` and `X-Request-Id`
  - `403` anonymous-user rejection
  - `400` schema validation failure
  - `504` timeout / `AbortError`
  - `500` unexpected provider failure
- The suite asserts `recordRouteMetric(...)`, `logEvent(...)`, `logFailure(...)`, and provider lifecycle emission.

### 5. Existing accessibility and eval guards remain green

- [src/frameworks/ui/chat/plugins/custom/AudioPlayerCard.test.tsx](../../../../src/frameworks/ui/chat/plugins/custom/AudioPlayerCard.test.tsx) still proves the shared `role="region"` shell.
- [tests/chat-performance-a11y.test.tsx](../../../../tests/chat-performance-a11y.test.tsx) still proves the `AudioPlayerCard` accessibility assertion.
- [tests/evals/eval-runner.test.ts](../../../../tests/evals/eval-runner.test.ts) still contains the passing `audio-failure-detected` guard.

## Focused verification run

Command:

```bash
npx vitest run src/proxy.test.ts src/frameworks/ui/chat/plugins/custom/AudioPlayerCard.test.tsx src/components/AudioPlayer.test.tsx tests/tts-route-hardening.test.ts tests/chat-performance-a11y.test.tsx tests/admin-processes.test.ts tests/health-probes.test.ts tests/evals/eval-runner.test.ts
```

Result:

- Exit code: `0`
- Files: `8/8` passed
- Tests: `70/70` passed
- Per-file counts:
  - `src/proxy.test.ts`: `15`
  - `AudioPlayerCard.test.tsx`: `3`
  - `AudioPlayer.test.tsx`: `12`
  - `tts-route-hardening.test.ts`: `8`
  - `chat-performance-a11y.test.tsx`: `10`
  - `admin-processes.test.ts`: `3`
  - `health-probes.test.ts`: `3`
  - `eval-runner.test.ts`: `16`

## Phase 6 close statement

The Phase 6 audio audit findings are now implemented and test-backed in the repo. CSP, runtime validation, readiness, admin diagnostics, accessibility, route observability, and eval protection all have committed proof at HEAD.
