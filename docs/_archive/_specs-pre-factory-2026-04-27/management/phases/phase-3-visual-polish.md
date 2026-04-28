# Phase 3: Visual Polish

> **Milestone:** After this phase, the chat UI looks and feels premium. Black video boxes are replaced with shimmering skeletons. Walls of identical pills collapse into gallery cards. Raw UUID errors become structured, scannable cards. The system passes a WCAG 2.1 AA accessibility audit. This is the phase where the product looks like it was designed, not just built.
> **Repo note:** Phase 1 and Phase 2 already landed the stable job-state store, shared system-card shells, strip navigation/pinning, detail-drawer transparency, `CapabilityContextPanel` semantics, and transcript highlight styling. Phase 3 should now focus on visual presentation, media grouping, richer error formatting, and accessibility gaps on top of those seams rather than reopening the action/state infrastructure.

## Status: `[ ] Not Started`

---

## What Ships

Current repo baseline before Phase 3 starts:

- `MediaRenderCard.tsx` still uses a black verification overlay and does not provide a shimmer/skeleton state.
- `CapabilityErrorCard.tsx` already renders shared structured context such as failure class, recovery mode, attempts, route, repairs, and timing, but it does not yet classify specific media/runtime error patterns into dedicated card layouts.
- `AssistantBubble.tsx` already hosts the stable job-part rendering path used by Phase 2, but it does not yet group consecutive completed media entries into a gallery surface.
- `chat.css` already includes `.ui-chat-message-highlight` from Phase 2, so Phase 3 should extend the existing stylesheet rather than invent a second highlight/animation layer.
- `CapabilityContextPanel.tsx` already renders `<dl>/<dt>/<dd>` semantics, so that accessibility item is complete and should not be reimplemented here.

### 3A — Media Loading States

Consolidates: Spec 10 Phase 1 (shimmer skeleton)

Replace the current black verification overlay in `MediaRenderCard.tsx` with a proper media-loading experience:

- [ ] Replace `bg-black/90` overlay with CSS shimmer animation on neutral surface
- [ ] Size skeleton using `resolveVideoDimensions()` aspect ratio (no layout shift)
- [ ] Fade in `<video>` with `transition-opacity duration-500` on `onCanPlay`
- [ ] Add `.ui-media-skeleton-shimmer` keyframe to `chat.css`
- [ ] Fallback: unknown dimensions → default 16:9 skeleton
- [ ] Error fallback: video fails to load → skeleton transitions to error state

### 3B — Media Gallery Grouping

Consolidates: Spec 10 Phase 3 (gallery card)

Collapse identical completion pills into a visual gallery:

- [ ] Add consecutive-entry grouping near the existing job/tool render pass in `AssistantBubble.tsx`
- [ ] Create `MediaGalleryCard.tsx` — horizontal thumbnail strip with click-to-expand
- [ ] Use `data-capability-tone="media"` for the existing gradient treatment
- [ ] Header shows tool label + count: "Media Composition · 20 items"
- [ ] Single entry passthrough: 1 item → render as `MediaRenderCard`, no gallery wrapper
- [ ] Mixed states: `[ok, ok, fail, ok, ok]` → two gallery groups + 1 error card in between
- [ ] Running jobs are not groupable — they break the sequence

### 3C — Structured Error Cards

Consolidates: Spec 10 Phase 2 (error patterns)

Replace raw UUID dumps with human-readable error cards:

- [x] Shared error-card shell, tone handling, failure-class labeling, and structured context rows already landed in Phase 2
- [ ] Add media/runtime-specific error pattern matching to `CapabilityErrorCard.tsx` without replacing the shared shell
- [ ] Pattern: `unresolved asset references` → bulleted list of missing asset names
- [ ] Pattern: `browser execution capacity is full` → capacity notice with explanation
- [ ] Pattern: `ffmpeg exited with code` → technical failure with collapsible stderr
- [ ] Unknown patterns → current behavior preserved (plain text)
- [ ] Truncate: 50+ asset references → show first 5 + "and 45 more..." collapsible

### 3D — Video Poster Frames

Consolidates: Spec 10 Phase 4

- [ ] Add `captureFirstFrame()` utility — canvas snapshot of first video frame
- [ ] Use poster as gallery thumbnail and compact row preview
- [ ] Cross-origin fallback: security error → colored placeholder with tool icon
- [ ] Store in component state only (not persisted)

### 3E — Accessibility Hardening

Consolidates: Spec 16 (all items)

- [ ] Add `<track kind="captions">` to all `<video>` elements
- [ ] Add `role="status" aria-live="polite"` to media loading overlay
- [ ] Fix contrast: `text-white/70` → `text-white/90` (3.5:1 → 15:1)
- [ ] Add `role="progressbar"` with `aria-valuenow/min/max` to progress bars
- [ ] Replace `+`/`−` toggle with `sr-only` "Expand/Collapse" labels
- [x] `CapabilityContextPanel` already uses `<dl>/<dt>/<dd>` semantics
- [ ] Add `aria-describedby` linking error summary to card header
- [ ] Add `sr-only` status text alongside colored dots where visual-only indicators remain

---

## Verification Checkpoint

```bash
npm run typecheck
npm run build         # SSR safety for new components

npx vitest run \
  src/frameworks/ui/chat/plugins/custom/MediaRenderCard.test.tsx \
  src/frameworks/ui/chat/plugins/system/CapabilityErrorCard.test.tsx \
  src/frameworks/ui/chat/bubbles/AssistantBubble.test.tsx \
  src/frameworks/ui/chat/primitives/capability-card-primitives.test.tsx
```

Manual checks:

- [ ] Trigger a media job → shimmer skeleton appears at correct aspect ratio → video fades in
- [ ] Trigger 5 media jobs → gallery card renders with 5 thumbnails, not 5 pills
- [ ] Trigger a job with "unresolved asset references" error → structured error card, not UUID wall
- [ ] Trigger a job with playback verification pending → overlay is announced as loading state and no longer renders as a solid black box
- [ ] Run axe-core on chat transcript → zero violations

Accessibility:

- [ ] Screen reader announces loading state changes
- [ ] All progress bars report numeric value
- [ ] Status is conveyed by text, not just color

---

## Files Touched

| Action | File |
| --- | --- |
| MODIFY | `src/frameworks/ui/chat/plugins/custom/MediaRenderCard.tsx` |
| MODIFY | `src/frameworks/ui/chat/plugins/system/CapabilityErrorCard.tsx` |
| MODIFY | `src/frameworks/ui/chat/bubbles/AssistantBubble.tsx` |
| MODIFY | `src/app/styles/chat.css` |
| NEW | `src/frameworks/ui/chat/plugins/custom/MediaGalleryCard.tsx` |

---

## Depends On

**Phase 1** — entity types, job payload structure, and retry/failure metadata
**Phase 2** — shared job cards, strip navigation/pinning, detail-drawer transparency, and transcript highlighting already in place

## Unlocks

Nothing blocks on this — but this is the phase that makes the product demo-ready.
