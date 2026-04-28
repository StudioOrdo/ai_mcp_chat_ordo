# Phase 3 Readiness Review

> Repo-grounded assessment for [Phase 3: Visual Polish](./phase-3-visual-polish.md).
> Use this before and during implementation so the work stays aligned with the current card/plugin architecture rather than the original greenfield wording.

---

## Summary

Phase 3 has not started as a milestone, but its dependencies are now in place.

What is already present:

- Phase 1 and Phase 2 already established the stable rendering seams: `ToolPluginPartRenderer`, `SystemJobCard`, `CapabilityErrorCard`, `ChatProgressStrip`, transcript highlighting, and store-backed job state.
- `CapabilityContextPanel` already renders `<dl>/<dt>/<dd>` semantics in [src/frameworks/ui/chat/primitives/CapabilityContextPanel.tsx](../../../../src/frameworks/ui/chat/primitives/CapabilityContextPanel.tsx).
- `CapabilityErrorCard` already handles shared shell semantics, tones, failure-class labeling, recovery metadata, replay route labels, repair summaries, and admin worker context in [src/frameworks/ui/chat/plugins/system/CapabilityErrorCard.tsx](../../../../src/frameworks/ui/chat/plugins/system/CapabilityErrorCard.tsx).
- `MediaRenderCard` already resolves video dimensions from artifact, replay, and input snapshots in [src/frameworks/ui/chat/plugins/custom/MediaRenderCard.tsx](../../../../src/frameworks/ui/chat/plugins/custom/MediaRenderCard.tsx), which makes aspect-ratio-safe loading states possible without new data plumbing.
- `AssistantBubble` already provides the single render pass for tool cards and job-status parts in [src/frameworks/ui/chat/bubbles/AssistantBubble.tsx](../../../../src/frameworks/ui/chat/bubbles/AssistantBubble.tsx), so gallery grouping should happen there rather than in a second transcript pass.
- `chat.css` already contains the Phase 2 transcript-highlight animation and the shared chat/card utility classes in [src/app/styles/chat.css](../../../../src/app/styles/chat.css).

What is actually missing:

- `MediaRenderCard` still shows a solid black verification overlay instead of a proper skeleton/loading state.
- Consecutive completed media results still render as individual cards rather than a grouped gallery surface.
- `CapabilityErrorCard` still treats media/runtime-specific failures as generic summaries rather than specialized, scannable error layouts.
- There is no poster-frame capture path for gallery thumbnails or compact previews.
- Accessibility gaps remain around media loading announcements, progress semantics, toggle copy, and color-independent status communication.

Highest-risk assumptions in the current Phase 3 doc:

- Phase 3 should not reopen the job/action/store work from Phase 2. Those seams are already in place and passing `npm run verify`.
- Structured error cards are now a refinement of `CapabilityErrorCard`, not a replacement for it.
- Accessibility hardening is partly already done in the shared card primitives, so the remaining work needs to target the unresolved surfaces instead of repeating completed items.

---

## Readiness By Slice

### 3A — Media Loading States

Current state:

- `VideoArtifactRow` in [src/frameworks/ui/chat/plugins/custom/MediaRenderCard.tsx](../../../../src/frameworks/ui/chat/plugins/custom/MediaRenderCard.tsx) already knows when playback verification is pending and toggles `controls` based on `onCanPlay`.
- The current pending state is a black overlay with white text, which is exactly the broken visual behavior called out in the phase doc.
- `resolveVideoDimensions()` already provides the right seam for aspect-ratio-safe skeleton sizing.

Assessment:

- This is the best first implementation target because it is self-contained, already covered by direct tests, and immediately improves the visible experience.
- The first change should stay inside `MediaRenderCard.tsx` and `chat.css`.

Recommended implementation target:

- Start here.

### 3B — Media Gallery Grouping

Current state:

- `AssistantBubble.tsx` maps `message.toolRenderEntries` directly into `ToolPluginPartRenderer` with no grouping pass.
- The render path is already stable after Phase 2, so grouping can be layered in as a local transformation before rendering.
- There is no existing `MediaGalleryCard` file yet.

Assessment:

- This is the first truly new surface in Phase 3.
- The highest-risk part is grouping logic, not the card itself. Running and failed entries must still break groups cleanly.

Recommended implementation target:

- Do this after 3A so the grouped media card can reuse the improved loading/presentation behavior.

### 3C — Structured Error Cards

Current state:

- `CapabilityErrorCard.tsx` already provides a strong shared shell, but it currently renders the error summary as plain text plus generic context rows.
- Phase 2 already added failure-class, route, repair, attempt, retry, and recovery presentation.
- Pattern-specific formatting does not yet exist for unresolved asset references, browser-capacity exhaustion, or ffmpeg exit errors.

Assessment:

- This is now a formatting/classification problem, not a shell problem.
- The safest path is additive: detect known patterns and render structured expansions while preserving the current fallback behavior for unknown errors.

Recommended implementation target:

- Do this after 3A so the visual language for cards is already settled.

### 3D — Video Poster Frames

Current state:

- `MediaRenderCard.tsx` renders live video output, but there is no poster extraction utility or gallery thumbnail pipeline.
- No current component owns frame-capture behavior.

Assessment:

- This slice should follow the gallery work because the main consumer is the grouped media surface.
- The fallback behavior for cross-origin/canvas security failures should be designed upfront so gallery rendering does not depend on perfect frame extraction.

Recommended implementation target:

- Land after 3B.

### 3E — Accessibility Hardening

Current state:

- `CapabilityContextPanel` semantics are already done.
- Some status and `sr-only` patterns already exist in the chat UI and progress strip, but not consistently across media loading, progress bubbles, or toggle affordances.
- `CapabilityCardHeader.tsx` and `CapabilityTimeline.tsx` do not yet expose explicit progressbar semantics or text alternatives for all visual-only indicators.

Assessment:

- This slice should be treated as a pass across the updated Phase 3 surfaces rather than a separate visual redesign.
- The work is still meaningful because Phase 3 introduces new loading/gallery UI that needs correct announcement semantics.

Recommended implementation target:

- Apply this throughout 3A through 3D and finish with an explicit cleanup pass.

---

## Recommended Execution Order

1. Media loading polish.
   - Extend [src/frameworks/ui/chat/plugins/custom/MediaRenderCard.tsx](../../../../src/frameworks/ui/chat/plugins/custom/MediaRenderCard.tsx).
   - Extend [src/app/styles/chat.css](../../../../src/app/styles/chat.css).
   - Update [src/frameworks/ui/chat/plugins/custom/MediaRenderCard.test.tsx](../../../../src/frameworks/ui/chat/plugins/custom/MediaRenderCard.test.tsx).

2. Media gallery grouping.
   - Add grouping near the existing render pass in [src/frameworks/ui/chat/bubbles/AssistantBubble.tsx](../../../../src/frameworks/ui/chat/bubbles/AssistantBubble.tsx).
   - Create `MediaGalleryCard.tsx` as the new grouped surface.
   - Add or create focused tests for the grouping behavior.

3. Structured media/runtime error formatting.
   - Extend [src/frameworks/ui/chat/plugins/system/CapabilityErrorCard.tsx](../../../../src/frameworks/ui/chat/plugins/system/CapabilityErrorCard.tsx).
   - Keep the current shell and fallback behavior intact.

4. Poster-frame previews.
   - Add frame-capture support only after the gallery surface exists.
   - Keep poster capture local to component state.

5. Accessibility cleanup.
   - Finish the remaining progress/toggle/loading semantics across the new Phase 3 surfaces.
   - Re-run the focused UI tests and then the repo gate.

---

## Suggested Verification Bundle

Run these first while implementing Phase 3:

```bash
npx vitest run \
  src/frameworks/ui/chat/plugins/custom/MediaRenderCard.test.tsx \
  src/frameworks/ui/chat/primitives/capability-card-primitives.test.tsx
```

Add focused coverage as new surfaces land:

- `MediaGalleryCard` tests
- `AssistantBubble` grouping tests
- `CapabilityErrorCard` structured-error tests

Then run the phase-level gate:

```bash
npm run verify
```
