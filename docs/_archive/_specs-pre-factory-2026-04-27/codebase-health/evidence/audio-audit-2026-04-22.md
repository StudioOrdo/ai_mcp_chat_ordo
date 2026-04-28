# Audio Generation Deep Audit — 2026-04-22

Status: Findings recorded (ahead of Phase 6 execution)
Scope: End-to-end audio generation — from chat intent → `/api/tts` → user-file cache → `AudioPlayer` playback.
Trigger: User report — "we have had failures, something is broken".

## Stack under audit

Provider: **OpenAI** (`tts-1`, voice `alloy`, format `mp3`). Not ElevenLabs.

Key modules

- `src/lib/audio/audio-generation-service.ts` — core TTS logic. Cache lookup via `UserFileSystem.lookup`, fetch with `AbortController`, store via `UserFileSystem.store`, 10 MB cap, provider-event emission (`emitProviderEvent` kinds: `attempt_start` / `attempt_success` / `attempt_failure`).
- `src/app/api/tts/route.ts` — POST handler. Auth-gated (anonymous returns 403), schema-validated via `TtsRequestSchema`. Returns binary MP3 with `X-User-File-Id` and `X-Request-Id` headers.
- `src/components/AudioPlayer.tsx` — browser audio element. Fetches `/api/tts` or `/api/user-files/{assetId}`, buffers via `ReadableStream` reader, builds a `Blob`, creates an object URL, plays via `new Audio(url)`.
- `src/frameworks/ui/chat/plugins/custom/AudioPlayerCard.tsx` — chat capability card around `AudioPlayer`.

## Findings

### A1. `AudioPlayerCard` structured-result branch renders `role="region"` — already wired, but partial failures remain

Reading `AudioPlayerCard.tsx` line ~180–210 (success branch): `CapabilityCardShell` is rendered with `ariaLabel={\`${label} result\`}` and no explicit `role`, relying on `CapabilityCardShell` to surface `role="region"`. The co-located test `AudioPlayerCard.test.tsx` asserts `getByRole("region", { name: "Generate Audio result" })`.

If the card's own vitest file currently fails, the root cause is not the JSX branch selection (terminal vs. structured) — it is either:

1. `CapabilityCardShell` no longer forwards `role="region"` when no explicit role is passed, **or**
2. The mocked `AudioPlayer` stub hides a required child element that `CapabilityCardShell` uses to decide on rendering the shell wrapper.

Action for Phase 6: read `CapabilityCardShell` and confirm; fix surgically rather than adding `role="region"` to `AudioPlayerCard` directly, to avoid double-role conflicts across the capability family.

### A2. Production CSP — historically missing `media-src 'self' blob:`

Per memory note `tts-production-csp-investigation.md` (2026-04-06), production CSP was `default-src 'self'` with **no** `media-src blob:`. `URL.createObjectURL(blob)` + `new Audio(blobUrl)` silently failed: `loaded=false`, `errored=true`, `networkState=3`, `readyState=0`, plus `securitypolicyviolation` for `media-src` / `blockedURI=blob`.

Current in-repo CSP surface:

- `src/proxy.ts` emits only `Content-Security-Policy: frame-ancestors 'none'`.
- No other `Content-Security-Policy` headers are set by this codebase (grep confirmed).
- Therefore the production CSP that blocked blob playback is applied **at the edge / CDN, not in-repo**. Any Phase 6 fix must be verified against a production-equivalent response header capture, not only against `src/proxy.ts`.

Defensive posture already in `AudioPlayer.tsx` (line ~181–213): a `securitypolicyviolation` window listener checks `effectiveDirective === "media-src"` and `blockedURI === "blob"` and dispatches `LOAD_ERROR` with "Audio playback was blocked by the site's security policy." This surfaces the failure but does not fix it.

Action for Phase 6: extend production CSP to include `media-src 'self' blob:` and `connect-src` allowances for `/api/tts` + `/api/user-files/*`. Capture header snapshot as evidence.

### A3. `/api/tts` success-path observability — already instrumented, supersedes stale memory

Memory note `tts-production-csp-investigation.md` asserts `/api/tts` success path emits no logs and is not wrapped by `recordRouteMetric`.

Current source at `src/app/api/tts/route.ts` contradicts the memory:

- `finalizeRequest` calls `recordRouteMetric(TTS_ROUTE, elapsed, isServerError)` on every outcome.
- Emits `logEvent("info", "tts.request.success", {...})` on 200 with `{ outcome, userFileId, bytes }` context.
- Emits `logFailure(REASON_CODES.TTS_TIMEOUT, ...)` on `AbortError` (504) and `logFailure(REASON_CODES.UNKNOWN_ROUTE_ERROR, ...)` on unexpected errors (500).
- Sets `X-Request-Id` on every response.

Action for Phase 6: record this as **already-closed**; update the repo memory note; keep a regression test under `tests/tts-route-hardening.test.ts` that asserts the observability event set on 200 / 400 / 403 / 504 / 500.

### A4. OpenAI env not validated in admin health surfaces

Memory note also flags: `scripts/admin-validate-env.ts` and the admin system page surface Anthropic env but not OpenAI / TTS. This is consistent with the audio stack being OpenAI-only — operators cannot self-diagnose a missing `OPENAI_API_KEY` from the admin surface.

Action for Phase 6: add OpenAI env validation and admin system-page surfacing; optionally issue a synthetic `tts-1` tokens-only check if OpenAI exposes a sufficiently cheap probe.

### A5. `AudioPlayer` swallows terminal playback errors silently (partially)

`AudioPlayer.tsx` registers an `error` listener on the `<audio>` element that dispatches `LOAD_ERROR` with "Audio generated, but the browser could not load it." It also registers the `securitypolicyviolation` listener (A2) to distinguish CSP-blocked failures.

Remaining gap: the listener relies on `pendingAudioLoadRef.current === audio` to correlate a violation to a specific element; if the CSP event fires before the element is assigned (race) or if a stale audio element lingers, the correlation may drop and the user sees nothing.

Action for Phase 6: add a focused unit test (jsdom + dispatched `SecurityPolicyViolationEvent`) asserting `LOAD_ERROR` is dispatched when `media-src` / `blockedURI=blob` fires while a pending audio load is in flight. This is the new test called out in the phase's deliverables.

### A6. Eval coverage

`src/lib/evals/scenarios.ts` already defines `audio-failure-detected` at around L353, consumed by `tests/evals/eval-runner.test.ts` L92. Phase 6 must not regress this scenario.

## Summary for Phase 6 execution

Real code changes to ship in Phase 6:

1. Extend production CSP (edge/CDN config) with `media-src 'self' blob:` and appropriate `connect-src`. Capture header snapshot.
2. `scripts/admin-validate-env.ts` — add `OPENAI_API_KEY` presence check.
3. Admin system page — surface OpenAI / TTS provider health.
4. Fix whatever path is currently breaking `AudioPlayerCard.test.tsx`'s `role="region"` assertion (likely inside `CapabilityCardShell`).
5. Add focused CSP-violation unit test for `AudioPlayer`.

Documentation-only updates:

6. Update `/memories/repo/tts-production-csp-investigation.md` to reflect current `/api/tts` observability.
7. Confirm `src/components/AudioPlayer.test.tsx` + `tests/tts-route-hardening.test.ts` pass after the above; record final counts in `evidence/phase-6.md`.

Out of scope for Phase 6 (even though audio-adjacent):

- Streaming audio via MediaSource (not in current regression surface).
- Non-OpenAI TTS providers (ElevenLabs etc.) — not present in codebase.
- Conversation retention for cached audio — already governed by `retentionClass` in `generateStoredAudioArtifact`.

## Evidence pointers

- `src/app/api/tts/route.ts` — current observability implementation.
- `src/lib/audio/audio-generation-service.ts` — provider-event emission, cache path.
- `src/components/AudioPlayer.tsx` L181–213 — CSP-violation listener.
- `src/frameworks/ui/chat/plugins/custom/AudioPlayerCard.tsx` L150–220 — terminal + success branches.
- `src/frameworks/ui/chat/plugins/custom/AudioPlayerCard.test.tsx` L52 — `role="region"` assertion.
- `src/proxy.ts` L10 — in-repo CSP surface (only `frame-ancestors 'none'`).
- `/memories/repo/tts-production-csp-investigation.md` — 2026-04-06 production investigation (partially stale; A3 supersedes).
