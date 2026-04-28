# Spec 10 — Multimedia Card Redesign

## Goal

Replace the current flat, repetitive, and visually broken multimedia card rendering with a rich, media-aware card system that treats completed media jobs as first-class visual artifacts — not debug log entries.

---

## Problem Statement (Visual Evidence)

Three distinct failures visible in the current UI:

### 1. Dead Black Rectangles ("VERIFYING PLAYBACK")

The `MediaRenderCard` renders a fully black box with near-invisible white text during playback verification. There is no animation, no shimmer, no skeleton — it looks like a broken component.

**Source:** `MediaRenderCard.tsx` lines 76–100. The `<video>` is set to `opacity-0` and a `bg-black/90` overlay fills the container.

### 2. Wall of Identical Pills

Batch media jobs produce 15–20 identical compact rows that all say "Compose Media finished successfully." with a green dot. No thumbnail, no title differentiation, no way to tell which video is which without expanding every single row.

**Source:** `SystemJobCard.tsx` renders every job as a `ui-capability-card--compact` row. `AssistantBubble.tsx` maps over `toolRenderEntries[]` with no grouping logic.

### 3. Raw UUID Error Dumps

When media composition fails due to unresolved asset references, the LLM writes the raw error — including 8+ full UUIDs — directly into the chat text. This is not intercepted by the `CapabilityErrorCard` system because it appears as inline message content, not as a structured `job_status` part.

---

## Architecture: What Already Exists

The system has rich infrastructure that is currently underutilized:

| Existing Infrastructure | Current State | Potential |
|---|---|---|
| `CapabilityResultEnvelope.artifacts[]` | Carries video URI, dimensions, mimeType | Could render inline thumbnail/preview |
| `CapabilityCardShell` tone system | 7 tone variants in CSS (`media`, `editorial`, etc.) | Media cards could use `media` tone |
| `CapabilityArtifactRail` | Hidden inside expanded body | Could render as primary card content |
| `CapabilityTimeline` | Shows phase progress | Could show render pipeline stages |
| `resolveVideoDimensions()` | Already extracts width/height from envelope | Could size thumbnails correctly |
| `descriptor.cardKind` | Routing hint for card rendering | Could trigger media-specific layout |

---

## Feature 1: Skeleton Loading State (Replace Black Boxes)

### Current Behavior

```
┌──────────────────────────────┐
│                              │
│      (solid black)           │
│   VERIFYING PLAYBACK         │
│      (solid black)           │
│                              │
└──────────────────────────────┘
```

### Proposed Behavior

```
┌──────────────────────────────┐
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│ ░░░░░░ shimmer animation ░░░ │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│         ◉ Verifying...       │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
└──────────────────────────────┘
```

### Changes

- Replace `bg-black/90` overlay with a CSS shimmer animation on a neutral surface.
- Replace static "VERIFYING PLAYBACK" text with a pulsing dot + "Verifying playback..." in the design system's label style.
- Use the known `aspectRatio` from `resolveVideoDimensions()` to size the skeleton correctly (no layout shift when the video loads).
- Fade in the `<video>` element with `transition-opacity duration-500` when `onCanPlay` fires.

### Files Modified

- `MediaRenderCard.tsx`: Replace `VideoArtifactRow` loading state (lines 88–97).
- `chat.css`: Add `.ui-media-skeleton-shimmer` keyframe animation.

### Test Cases

**Positive:**
- Video still verifying: shows shimmer skeleton at correct aspect ratio.
- Video loads (`onCanPlay`): shimmer fades out, video fades in over 500ms.
- Video dimensions known (1280×720): skeleton renders at 16:9.

**Negative:**
- Video dimensions unknown: skeleton renders at default 16:9.
- Video fails to load: skeleton transitions to error state, not stuck forever.

**Edge:**
- Rapid `onCanPlay` (< 100ms): shimmer barely visible, no flash of unstyled content.

---

## Feature 2: Media Gallery Card (Replace Pill Wall)

### Current Behavior

```
● Compose Media finished successfully.
● Compose Media finished successfully.
● Compose Media finished successfully.
● Compose Media finished successfully.
● Compose Media finished successfully.
(×20)
```

### Proposed Behavior

```
┌─────────────────────────────────────────────┐
│  MEDIA GALLERY · 20 items                   │
├─────────────────────────────────────────────┤
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐   │
│ │ ▶   │ │ ▶   │ │ ▶   │ │ ▶   │ │ ▶   │   │
│ │thumb│ │thumb│ │thumb│ │thumb│ │thumb│   │
│ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘   │
│  Slide 1  Slide 2  Slide 3  Slide 4  ...    │
│                                             │
│            ◀  1 of 20  ▶                    │
└─────────────────────────────────────────────┘
```

### Architecture

This requires a **grouping step** in the message rendering pipeline. When `AssistantBubble` encounters multiple consecutive `toolRenderEntries` of the same `toolName` with status `succeeded`, it should group them into a single gallery card instead of rendering N individual cards.

### Grouping Logic (in `AssistantBubble.tsx`)

```typescript
// Pseudocode for grouping consecutive same-tool entries
function groupConsecutiveEntries(entries: ToolRenderEntry[]): (ToolRenderEntry | ToolRenderGroup)[] {
  const groups: (ToolRenderEntry | ToolRenderGroup)[] = [];
  let currentGroup: ToolRenderEntry[] = [];

  for (const entry of entries) {
    if (isGroupable(entry) && currentGroup.length > 0 && currentGroup[0].toolName === entry.toolName) {
      currentGroup.push(entry);
    } else {
      if (currentGroup.length > 1) {
        groups.push({ kind: "group", entries: currentGroup });
      } else if (currentGroup.length === 1) {
        groups.push(currentGroup[0]);
      }
      currentGroup = isGroupable(entry) ? [entry] : [];
      if (!isGroupable(entry)) groups.push(entry);
    }
  }

  // Flush remaining
  if (currentGroup.length > 1) groups.push({ kind: "group", entries: currentGroup });
  else if (currentGroup.length === 1) groups.push(currentGroup[0]);

  return groups;
}

function isGroupable(entry: ToolRenderEntry): boolean {
  return entry.kind === "job-status"
    && entry.part.status === "succeeded"
    && MEDIA_TOOL_NAMES.has(entry.part.toolName);
}
```

### Gallery Card Component (`MediaGalleryCard.tsx`)

- Renders a horizontal scrollable strip of video thumbnails.
- Each thumbnail is a poster frame extracted via `<video poster>` or a small preview element.
- Clicking a thumbnail opens it in a lightbox or inline expanded view.
- Header shows tool label + count (e.g., "Media Composition · 20 items").
- Uses `data-capability-tone="media"` for the rich gradient treatment already in CSS.

### Singleton Passthrough

If only 1 entry exists for a tool name, render the existing `MediaRenderCard` — no gallery wrapper.

### Test Cases

**Positive:**
- 5 consecutive `compose_media` successes: renders as gallery with 5 thumbnails.
- Click thumbnail: expands to show full video player inline.
- Gallery header shows "Media Composition · 5 items."

**Negative:**
- 5 consecutive jobs but different tool names: no grouping, render individually.
- 5 consecutive jobs but 2 are `failed`: failed ones render as `CapabilityErrorCard`, only the 3 successes group.
- 1 job: no gallery, render as standard `MediaRenderCard`.

**Edge:**
- Mixed success/failure sequence: `[ok, ok, fail, ok, ok]` → two groups of 2 + 1 error card in between.
- Job still `running` in the middle of a batch: running jobs are not groupable, they break the sequence.

---

## Feature 3: Structured Error Cards (Replace UUID Dumps)

### Current Behavior

The LLM writes raw error text into the chat message:

```
Compose Media job for Compose Media failed: Compose media plan
contains unresolved asset references:
audio_intelligence_explosion_narration, blogasset_0ad8449c-01bf-
4377-a2b5-95fdfa14db65 (available: uf_0a8ff654-556b-4601-ba95-
ff9c7faeb4cd, uf_0dde59c5-cd9d-47d8-9cea-e2ca192eff1d...
```

### Proposed Behavior

```
┌─────────────────────────────────────────────┐
│ ⚠ MEDIA COMPOSITION                 Failed  │
├─────────────────────────────────────────────┤
│ Unresolved asset references                 │
│                                             │
│ The media plan references assets that       │
│ could not be found:                         │
│                                             │
│  • audio_intelligence_explosion_narration   │
│  • blogasset_0ad8449c (not found)           │
│                                             │
│ ▸ Show available assets (12)                │
│ ▸ Show full error details                   │
└─────────────────────────────────────────────┘
```

### Architecture

This requires two changes:

**A. Error Classification in `CapabilityErrorCard`**

Add a pattern matcher that detects known error shapes and renders them structurally:

| Error Pattern | Structured Rendering |
|---|---|
| `unresolved asset references` | List of missing asset names with truncated IDs |
| `browser execution capacity is full` | Capacity limit notice with queue position |
| `ffmpeg exited with code` | Technical failure with collapsible stderr |
| Generic error | Current behavior (plain text) |

**B. Inline Error Interception**

When the LLM writes an error message as plain text (not as a `job_status` part), the `RichContentRenderer` should detect error patterns and render them as structured callouts instead of raw text. This is a progressive enhancement — if the pattern isn't recognized, the text renders normally.

### Test Cases

**Positive:**
- Job fails with "unresolved asset references": renders bulleted list of missing assets, not UUID wall.
- Job fails with "browser execution capacity": renders "Queue full" card with explanation.
- Expand "Show full error details": reveals raw error string for debugging.

**Negative:**
- Unknown error string: renders as plain text in the error card (current behavior preserved).
- Error from a non-media tool: uses generic `CapabilityErrorCard` treatment.

**Edge:**
- Error string contains 50+ asset references: truncate to first 5 with "and 45 more..." collapsible.

---

## Feature 4: Video Poster Frames

### Behavior

When a video artifact is successfully rendered and the `<video>` element has loaded, capture the first frame as a poster image for use in:
- Gallery thumbnail grid
- Compact row preview (small avatar-sized preview replacing the green dot)

### Implementation

```typescript
// In MediaRenderCard or a shared utility
function captureFirstFrame(videoElement: HTMLVideoElement): string | null {
  const canvas = document.createElement("canvas");
  canvas.width = videoElement.videoWidth;
  canvas.height = videoElement.videoHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(videoElement, 0, 0);
  return canvas.toDataURL("image/webp", 0.6);
}
```

This poster is stored in component state (not persisted) and used only for the current render session.

### Test Cases

**Positive:**
- Video loads: first frame captured and displayed as gallery thumbnail.
- Poster shown in compact row: green dot replaced with tiny frame preview.

**Negative:**
- Video fails to load: fallback to colored placeholder with tool icon.
- Cross-origin video: `canvas.toDataURL()` throws security error → fallback to placeholder.

---

## Implementation Phases

### Phase 1: Fix the Black Boxes (Highest Impact, Lowest Risk)
- Replace black overlay with shimmer skeleton in `MediaRenderCard.tsx`.
- Add `.ui-media-skeleton-shimmer` animation to `chat.css`.
- **Files:** `MediaRenderCard.tsx`, `chat.css`
- **Risk:** Minimal — visual-only change to loading state.

### Phase 2: Failure Class Error Cards
- Add error pattern matching to `CapabilityErrorCard.tsx`.
- Render structured error cards for known failure shapes.
- **Files:** `CapabilityErrorCard.tsx`, possibly `resolve-system-card.ts`
- **Risk:** Low — additive logic with fallback to current behavior.

### Phase 3: Gallery Grouping
- Add grouping logic to `AssistantBubble.tsx` or a new `useGroupedToolEntries` hook.
- Create `MediaGalleryCard.tsx` component.
- **Files:** `AssistantBubble.tsx`, new `MediaGalleryCard.tsx`, `chat.css`
- **Risk:** Medium — changes the rendering pipeline for tool entries.

### Phase 4: Poster Frames & Thumbnail Grid
- Add `captureFirstFrame` utility.
- Integrate poster frames into gallery thumbnails and compact row previews.
- **Files:** `MediaRenderCard.tsx`, `MediaGalleryCard.tsx`
- **Risk:** Medium — canvas operations can fail on cross-origin resources.

---

## Non-Goals

- This spec does not change the job execution engine or the SSE event stream.
- This spec does not add new API endpoints for thumbnail generation (server-side). Thumbnails are client-side only.
- This spec does not modify the `JobStatusMessagePart` type. All rendering changes use data already present in `CapabilityResultEnvelope`.
- This spec does not address the floating chat variant's card sizing — that is a separate responsive design concern.

---

## Success Criteria

1. No black rectangles visible during video verification — shimmer skeleton with correct aspect ratio instead.
2. A batch of 20 identical media completions renders as a single gallery card, not 20 pills.
3. Asset reference errors render as structured lists, not raw UUID walls.
4. The `media` tone from the existing CSS design system is used for media cards.
5. Single media results continue to render as they do today (no regression).
6. All changes are progressive — unknown or legacy job shapes fall back to current rendering.
