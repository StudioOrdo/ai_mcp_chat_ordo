# Spec 16 — Chat Accessibility Hardening

## Goal

Bring all chat UI components to WCAG 2.1 AA compliance. The progress strip has good accessibility foundations; the media cards, error cards, and job cards do not.

---

## Audit Findings

### What's Good

- `ChatProgressStrip`: Uses `aria-live="polite"`, `aria-expanded`, `aria-haspopup="dialog"`, `role="status"`, and a screen-reader-only announcement region.
- `CapabilityCardShell`: Sets `role="region"` and `aria-label` on every card.
- `SystemJobCard`: Uses `aria-expanded`, `aria-controls`, and proper `id` linkage for the expandable body.
- `CapabilityErrorCard`: Uses `role="alert"` for failed states.

### What's Missing

#### Media Cards

| Issue | Location | WCAG |
|---|---|---|
| `<video>` has no captions (`eslint-disable jsx-a11y/media-has-caption`) | `MediaRenderCard.tsx` L77 | 1.2.2 Captions |
| Black loading overlay has no `role` or `aria-live` | `MediaRenderCard.tsx` L88-97 | 4.1.3 Status Messages |
| "VERIFYING PLAYBACK" text is in `text-white/70` (contrast ratio ~3.5:1 on black) | `MediaRenderCard.tsx` L93 | 1.4.3 Contrast |
| Download links have no visible focus indicator | `MediaRenderCard.tsx` L110-119 | 2.4.7 Focus Visible |
| The card container `<div>` has `aria-label` but no `role` beyond implicit | `MediaRenderCard.tsx` L166 | N/A (semantic) |

#### Error Cards

| Issue | Location | WCAG |
|---|---|---|
| Inline failure context panel uses `label` + `value` with no semantic pairing | `CapabilityErrorCard.tsx` L34-37 | 1.3.1 Info and Relationships |
| No `aria-describedby` linking the error summary to the card header | `CapabilityErrorCard.tsx` | 1.3.1 |

#### Job Cards (Compact Row)

| Issue | Location | WCAG |
|---|---|---|
| Progress percentage in status text has no `aria-valuenow` / `aria-valuemin` / `aria-valuemax` | `SystemJobCard.tsx` L203-209 | 4.1.2 Name, Role, Value |
| The progress bar `<div>` has no `role="progressbar"` | `SystemJobCard.tsx` L204 | 4.1.2 |
| Compact row toggle uses `+` / `–` characters as expand indicators — screen readers announce "plus" / "minus" which is ambiguous | `SystemJobCard.tsx` L188 | 1.3.1 |

#### General

| Issue | Location | WCAG |
|---|---|---|
| Color-only status differentiation (green dot = ok, red dot = error) — no text or icon secondary indicator | All cards | 1.4.1 Use of Color |
| No skip link from progress strip to main content | Chat layout | 2.4.1 Bypass Blocks |

---

## Proposed Changes

### Fix 1: Video Captions Track

Add an empty `<track>` element to satisfy the captions requirement and provide a future hook for generated subtitles:

```tsx
<video controls src={href} aria-label={label}>
  <track kind="captions" label="Captions" default />
</video>
```

For generated media that has no captions, this is a valid progressive enhancement — the track exists but is empty, satisfying the DOM requirement while we work toward actual caption generation.

### Fix 2: Loading State Announcements

Add `aria-live="polite"` to the loading overlay in `VideoArtifactRow`:

```tsx
<div role="status" aria-live="polite" aria-label={progressLabel ?? "Preparing playback"}>
  <span>{progressLabel ?? "Preparing playback..."}</span>
</div>
```

### Fix 3: Contrast Fix

Replace `text-white/70` (rgba 255,255,255,0.7 ≈ #B3B3B3 on black = 3.5:1) with `text-white/90` (#E6E6E6 on black ≈ 15:1):

```css
/* Before */
.text-white\/70 → contrast 3.5:1 ❌
/* After */
.text-white\/90 → contrast 15:1 ✅
```

### Fix 4: Progress Bar Semantics

Add proper ARIA attributes to the progress track:

```tsx
<div
  className="ui-capability-progress-track"
  role="progressbar"
  aria-valuenow={Math.round(progressPercent)}
  aria-valuemin={0}
  aria-valuemax={100}
  aria-label={`${label} progress`}
>
  <div className="ui-capability-progress-fill" style={{ width: `${progressPercent}%` }} />
</div>
```

### Fix 5: Expand Toggle Screen Reader Text

Replace `+` / `–` with screen-reader-friendly labels:

```tsx
<span className="ui-capability-compact-row-toggle" aria-hidden="true">
  {expanded ? "−" : "+"}
</span>
<span className="sr-only">{expanded ? "Collapse details" : "Expand details"}</span>
```

### Fix 6: Context Panel Semantics

Use `<dl>` / `<dt>` / `<dd>` for the failure context panel instead of flat `label` / `value` spans:

```tsx
<dl className="ui-capability-context-panel">
  {items.map(item => (
    <div key={item.label}>
      <dt>{item.label}</dt>
      <dd>{item.value}</dd>
    </div>
  ))}
</dl>
```

### Fix 7: Color-Independent Status Indicators

Add text labels alongside the colored dots:

```tsx
<span className="ui-capability-progress-bubble-dot" aria-hidden="true" />
<span className="sr-only">{status === "failed" ? "Error" : status === "running" ? "In progress" : "Complete"}</span>
```

The dots can remain as visual reinforcement, but the status must also be conveyed via text.

---

## Files

| Action | File |
|---|---|
| **MODIFY** | `MediaRenderCard.tsx` — captions track, loading state, contrast |
| **MODIFY** | `SystemJobCard.tsx` — progress bar role, toggle label |
| **MODIFY** | `CapabilityErrorCard.tsx` — describedby linkage |
| **MODIFY** | `CapabilityContextPanel.tsx` — dl/dt/dd semantics |
| **MODIFY** | `ProgressStripBubble.tsx` — status text alongside color |
| **MODIFY** | `chat.css` — contrast adjustments |

---

## Verification

Run `axe-core` via Playwright after each phase:

```typescript
import AxeBuilder from "@axe-core/playwright";

test("chat transcript has no a11y violations", async ({ page }) => {
  const results = await new AxeBuilder({ page })
    .include("[data-chat-message-role]")
    .analyze();
  expect(results.violations).toEqual([]);
});
```

---

## Success Criteria

1. All `role="progressbar"` elements have `aria-valuenow`.
2. All color-differentiated states have a text alternative.
3. Video elements have a captions track.
4. Loading states announce to screen readers via `aria-live`.
5. Contrast ratios meet 4.5:1 minimum (AA) for all text.
6. `axe-core` reports zero violations on a chat transcript with mixed job states.
