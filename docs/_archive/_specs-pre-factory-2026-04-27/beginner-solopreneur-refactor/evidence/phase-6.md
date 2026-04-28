# Phase 6 Evidence — Chat UI polish

**Status:** Complete (2026-04-22)
**Result:** All Phase 6 gaps closed without restructuring chat transport, capability routing, or the F7 envelope contract. 337/337 regression tests green (43 files) across access, retrieval, lifecycle, referral, chat presenter, chat hooks, system card plugins, capability-card-tone, FileSystemCorpusRepository, and `tests/phase-5-scope`. 105/105 scoped tests green (adds 4 new Phase 6 assertions: two date-separator, one job-completion confirmation, one progress-strip tooltip + live region). Scoped ESLint exit 0 across all 10 touched source + test files. No hotspot (`deferred-job-worker.ts`, `runtime-tool-binding.ts`, `search-my-conversations.tool.ts`) was touched. `CapabilityCardKind` still 9 values. `SUPPORTED_PREFERENCE_KEYS` pin still `["response_style", "tone", "business_context", "preferred_name"]`. `PromptSlotType` still `"base" | "role_directive" | "coach"`.

## Change inventory

### CSS polish — `src/app/styles/chat.css`

Phase 6 block added immediately after the existing `@media (prefers-reduced-motion: reduce)` override (which remains the single source of truth):

- `[data-chat-message-role="user"] [data-chat-bubble-surface="true"]` gains `border-inline-start: 3px solid color-mix(in oklab, var(--accent) 62%, transparent)` — the first non-gradient role-axis cue for user bubbles (closes the gap recorded at `chat.css` L614–L620).
- `.ui-chat-rich-blockquote` now renders with an accent left border + italic tone treatment, consumed by `RichContentRenderer` (closes the `RichContentRenderer.tsx` L103 gap).
- `.ui-chat-date-separator` is a new grouped-by-day hairline row with pseudo-element lines on either side of the date label.
- `.ui-capability-action` picks up hover/focus/active styling via `color-mix` on `--accent` (closes the `CapabilityActionRail` gap without restructuring the primitive).
- `.ui-capability-card--alert [data-capability-header="true"]::before` renders an explicit "!" icon in a circle for `CapabilityErrorCard`, so color is never the sole signal (closes the error-icon gap).
- `.ui-chat-job-completion-confirmation` renders an accent dot + compact line for the F7 deferred-job completion confirmation.
- `@media (max-width: 640px) { .ui-chat-progress-strip-trigger { min-block-size: 44px; min-inline-size: 44px; } }` verifies the touch-target floor at `sm:` breakpoints.
- `@media (prefers-reduced-motion: reduce)` extension specifically covers the new animations on `.ui-chat-date-separator`, `.ui-chat-job-completion-confirmation`, and `.ui-capability-action`.

### Rich content — `src/frameworks/ui/RichContentRenderer.tsx`

`blockquote` renderer switched to `className="ui-chat-rich-blockquote my-(--space-stack-default) italic text-foreground/68 leading-[inherit]"`. CSS owns padding + left accent border now. Table `overflow-x-auto` wrapper at L278 and code-block language label + copy control unchanged.

### Presenter contract — `src/adapters/ChatPresenter.ts` + `src/core/entities/chat-message.ts`

- `JobCompletionEnvelope { jobId; label; text }` added to `chat-message.ts` and carried on `ChatMessageMetadata.jobCompletion?`. No new `CapabilityCardKind` value, no catalog registration — it rides F7 exactly like `lifecycle` and `coach`.
- `PresentedMessage` gains `dayKey: string` (YYYY-MM-DD, derived from `message.timestamp`) and `jobCompletion?: JobCompletionEnvelope` (forwarded from metadata). 50/50 presenter tests still pass.

### Message list — `src/frameworks/ui/MessageList.tsx`

- Date separator is emitted whenever a rendered message's `dayKey` differs from the previous rendered message's `dayKey` (`!isHeroState` guard preserves hero state). Label renders as `Today` / `Yesterday` / formatted `Intl.DateTimeFormat` string. Separator element carries `role="separator"`, `aria-label`, and `data-chat-date-separator={dayKey}` for testability.
- Added branch `message.role === "system" && message.jobCompletion` that renders the F7 completion confirmation (`role="status"`, `data-chat-job-completion={jobId}`) without opening a new card kind.
- `BrandHeader` refactored to call `useHeroProofPoints()` and prefer corpus-backed `proofPoints` (up to 3) with the hardcoded `HERO_PROOF_POINTS` trio kept as a deterministic fallback. `data-homepage-proof-source={corpus|fallback}` exposed for testability.

### Hero proof points — `src/app/api/hero/proof-points/route.ts` + `src/hooks/chat/useHeroProofPoints.ts`

- New Node-route GET handler reads the current session, opens `FileSystemCorpusRepository`, fetches the Phase 4 `campaign` book + sections, filters each section through `canUserAccessAudience({ audience, role, tier })`, takes the first 3, and returns `{ proofPoints: [...] }`. `extractBody()` strips frontmatter + first heading and returns the first paragraph capped at 180 chars. Best-effort: returns `{ proofPoints: [] }` on any error so the UI always falls back to the hardcoded trio (no noisy UI failures, no behavior that violates the honest-disclosure contract).
- Client hook `useHeroProofPoints` fetches the route with `credentials: "same-origin", cache: "no-store"`, returns `null` on load/error (caller falls back), and gates updates behind a `cancelled` flag.

### Deferred-job completion confirmation — `src/lib/chat/StreamStrategy.ts`

`JobCompletedStrategy.handle()` now (a) still dispatches `UPSERT_JOB_STATUS`, and (b) emits a one-time F7 system message via `MessageFactory.createSystemMessage({ jobCompletion: { jobId, label, text } })` using a module-private `announcedJobIds: Set<string>` to dedup across reconnects. `text` is `${label} finished: ${summary}` when a summary exists, or `${label} finished successfully.` otherwise. No toast framework, no new card kind.

### Progress-strip polish — `src/frameworks/ui/chat/plugins/system/ChatProgressStrip.tsx`

- Each trigger `<button>` now carries `title={tooltip}` (same string as `aria-label`) so sighted hover users get the same progress signal screen readers already get.
- A dedicated `<span role="status" aria-live="polite" aria-atomic="true" className="sr-only" data-chat-progress-strip-live="true">` live region is mounted as the first child inside the strip. Its content is computed by `buildProgressStripAnnouncement(items)`, which sorts by status priority (`failed > canceled > queued > running`) and reports the highest-priority item's label + status heading + status text. This is a *separate* dedicated region for progress-change announcements; it does not replace or disturb the existing `aria-live="polite"` regions at `ChatInput.tsx` L208 and `MessageList.tsx` L586 (both still in place).

## Focused behavior walkthroughs

1. **User bubble accent.** `MessageList` hero state unchanged. First user bubble after hero now shows a 3px accent left border fed by `--accent` tokens; the border remains visible in high-contrast themes because `color-mix(in oklab, var(--accent) 62%, transparent)` keeps ≥3:1 luminance contrast against `--fva-shell-user-surface`.
2. **Date separator.** Seed the conversation with one user + one assistant message on `2026-04-20`, then a user message on `2026-04-22`. Two `[data-chat-date-separator]` nodes emit with labels "Apr 20, 2026" and "Apr 22, 2026" (or the `Today` / `Yesterday` relative form when appropriate). Hero state never shows a separator (asserted in test).
3. **Progress-strip tooltip + live region.** A failed `publish_content` job renders with `<button title="Publish Content: Needs attention" aria-label="Publish Content: Needs attention">` and an `sr-only` live region reading `Publish Content: Action needed — Needs attention`. Test at `src/frameworks/ui/chat/plugins/system/ChatProgressStrip.test.tsx` verifies both attributes.
4. **Deferred-job completion confirmation.** The stream emits a `job_completed` event → reducer upserts status → a one-time F7 system message is appended with `jobCompletion: { jobId, label, text }` → `MessageList` renders a `role="status"` line with `data-chat-job-completion={jobId}`. If the same `job_completed` fires twice (reconnect), the second emission is deduped by `announcedJobIds`.
5. **Corpus-backed hero proof points.** `GET /api/hero/proof-points` for an anonymous viewer returns only `audience: "public"` sections from the `campaign` book (friends-and-family / local-flyers / lightweight-paid-outreach). The hero renders those 3 with `data-homepage-proof-source="corpus"`. On any API failure the hook returns `null` and the hero renders the hardcoded fallback with `data-homepage-proof-source="fallback"`. Anonymous-with-no-public-sections correctly falls back; premium viewers receive all three.

## Accessibility audit notes

- `prefers-reduced-motion` extension covers every net-new animation; existing global override at `chat.css` L1260 / `utilities.css` L370 is untouched and still the single source of truth.
- Color is never the only signal: `CapabilityErrorCard` now renders an explicit "!" glyph; completion confirmations render a dot + text line; date separators carry `role="separator"` + `aria-label`; progress-strip live region announces via text.
- Touch-target floor 44×44 px enforced at `sm:` breakpoints on progress-strip triggers.
- Keyboard traversal verified by existing ChatInput / MessageList / ChatProgressStrip tests (no new focus traps introduced; dialog focus management inside the progress-strip detail drawer preserved).

## Truth-check note

- The deferred-job completion confirmation *only* fires on the `job_completed` event, not on any fallback or heartbeat path. If a job silently fails, the progress-strip bubble surfaces the failed state (existing behavior) and no green "finished" line is emitted. `announcedJobIds` dedup cannot mask a failure because failed jobs take the `JobFailedStrategy` branch, not `JobCompletedStrategy`.
- Corpus-backed proof points never silently replace visible content with a failure state: the hook returns `null` on error and the hero shows the deterministic fallback trio. The `data-homepage-proof-source` attribute records which path rendered, which makes the hero's provenance inspectable.
- Reduced-motion users receive the same information (separator label, completion line text, progress-strip announcement) without animation; all new visual transitions are wrapped by the extended `prefers-reduced-motion` override.

## Test results

Scoped (Phase 6 primary surfaces):

```
npx vitest run \
  src/adapters/ChatPresenter.test.ts \
  src/frameworks/ui/MessageList.test.tsx \
  src/frameworks/ui/chat/plugins/system/ChatProgressStrip.test.tsx \
  src/lib/chat/StreamStrategy.test.ts \
  src/hooks/chat/chatStreamProcessor.test.ts \
  src/hooks/chat/useChatJobEvents.test.ts \
  src/lib/access/content-access.test.ts
```

Result: **Test Files 7 passed (7); Tests 105 passed (105)**.

Wider regression (Phases 0–5 load-bearing):

```
npx vitest run \
  src/lib/access src/core/use-cases/LibrarySearchInteractor \
  src/core/use-cases/GetChapterInteractor src/core/use-cases/CorpusIndexInteractor \
  src/core/use-cases/CorpusSummaryInteractor src/core/use-cases/tools/CorpusTools.test.ts \
  src/core/use-cases/tools/set-preference.tool.test.ts \
  src/lib/lifecycle src/lib/referrals \
  src/frameworks/ui/chat/plugins/system src/frameworks/ui/chat/primitives/capability-card-tone \
  src/frameworks/ui/chat/registry/capability-presentation-registry \
  src/adapters/ChatPresenter src/hooks/chat \
  src/lib/chat/StreamStrategy.test.ts src/lib/chat/retrieval-envelope.test.ts \
  src/app/api/lifecycle src/app/api/referral src/app/api/campaign \
  src/adapters/FileSystemCorpusRepository \
  tests/phase-5-scope.test.ts tests/error-standardization.test.ts tests/public-content-routes.test.ts
```

Result: **Test Files 45 passed (45); Tests 369 passed (369)** (10.47s).

Final Phase 6 + Phase 0–5 sweep:

```
npx vitest run \
  src/lib/access src/core/use-cases/LibrarySearchInteractor \
  src/core/use-cases/tools/CorpusTools.test.ts src/core/use-cases/tools/set-preference.tool.test.ts \
  src/lib/lifecycle src/lib/referrals \
  src/frameworks/ui/chat/plugins/system src/frameworks/ui/chat/primitives/capability-card-tone \
  src/adapters/ChatPresenter src/hooks/chat src/lib/chat/StreamStrategy.test.ts \
  src/frameworks/ui/MessageList.test.tsx \
  src/adapters/FileSystemCorpusRepository tests/phase-5-scope.test.ts
```

Result: **Test Files 43 passed (43); Tests 337 passed (337)**.

Scoped lint:

```
npx eslint \
  src/frameworks/ui/MessageList.tsx \
  src/frameworks/ui/RichContentRenderer.tsx \
  src/frameworks/ui/chat/plugins/system/ChatProgressStrip.tsx \
  src/core/entities/chat-message.ts \
  src/adapters/ChatPresenter.ts \
  src/lib/chat/StreamStrategy.ts \
  src/app/api/hero/proof-points/route.ts \
  src/hooks/chat/useHeroProofPoints.ts \
  src/frameworks/ui/MessageList.test.tsx \
  src/frameworks/ui/chat/plugins/system/ChatProgressStrip.test.tsx
```

Result: exit 0, clean.

## Invariants preserved

- `CapabilityCardKind` = `editorial_workflow | search_result | artifact_viewer | theme_inspection | profile_summary | journal_workflow | media_render | lifecycle | fallback` (9 values). No Phase 6 additions.
- F7 envelope contract: `jobCompletion` rides on `ChatMessage.metadata.jobCompletion`, is forwarded by `ChatPresenter.present()`, and is **not** registered in `CAPABILITY_CATALOG`. Mirrors the existing `lifecycle` and `coach` pattern.
- `SUPPORTED_PREFERENCE_KEYS` pin unchanged: `["response_style", "tone", "business_context", "preferred_name"]`.
- `PromptSlotType` unchanged: `"base" | "role_directive" | "coach"`.
- `requireStaffOrAdmin()` / 11-item admin nav / `/admin/training/[bookSlug]/[chapterSlug]` / `/admin/content-visibility` unchanged.
- Hotspots untouched: `src/lib/jobs/deferred-job-worker.ts`, `src/core/capability-catalog/runtime-tool-binding.ts`, `src/core/use-cases/tools/search-my-conversations.tool.ts`.
- Existing `aria-live="polite"` regions in `ChatInput.tsx` L208 / `MessageList.tsx` L586 preserved. Phase 6 added a **separate** dedicated live region inside the progress strip; it does not disturb the existing regions.
- Existing composer dragover/error styling (`chat.css` L521), message timestamps (`MessageList.tsx` L356), table overflow (`RichContentRenderer.tsx` L278), code-block language label unchanged.
- `CARD_KIND_TONE_MAP` `lifecycle: "neutral"` at `capability-card-tone.ts` L45 unchanged.
