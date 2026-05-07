# Studio Ordo — Theme & Brand Audit Matrix

> **Date:** 2026-03-16
> **Purpose:** Map every visual mode, combination, and branding implication so the team can decide what to keep, merge, or cut.

---

## 1. System Overview

The theme system has **four independent axes** that combine multiplicatively:

| Axis | Options | Default |
|------|---------|---------|
| **Theme** (visual language) | Fluid · Bauhaus · Swiss · Skeuomorphic | Fluid |
| **Color scheme** | Light · Dark | System preference |
| **Density** | Compact · Normal · Relaxed | Normal |
| **Accessibility preset** | Default · Elderly · Compact · High-contrast · Color-blind (×3) | Default |

Additional fine-grained knobs within Accessibility:

| Setting | Options |
|---------|---------|
| Font size | xs · sm · md · lg · xl |
| Line height | tight · normal · relaxed |
| Letter spacing | tight · normal · relaxed |
| Color-blind mode | none · deuteranopia · protanopia · tritanopia |

**Total raw combinations: 4 themes × 2 schemes × 3 densities × 5 font sizes × 3 line heights × 3 letter spacings × 4 color-blind modes = 4,320**

## 1b. Supported Runtime Contract

Sprint 4 turns the theme manifest into the maintained runtime contract for both mutation and inspection.

| Contract surface | Current authority | Notes |
|------|---------|---------|
| Supported theme IDs | `src/lib/theme/theme-manifest.ts` | `bauhaus`, `swiss`, `skeuomorphic`, `fluid` |
| Read-only inspection | `inspect_theme` tool | Returns ordered theme profiles, supported IDs, control axes, and explicit active-theme unavailability when provenance is not available |
| Theme mutation | `set_theme` tool | Named theme selection only |
| Broader UI mutation | `adjust_ui` tool | Dark mode, density, font size, line height, letter spacing, color-blind mode, bounded presets, and optional theme |

### Supported control axes

| Axis | Options | Owner |
|------|---------|---------|
| Theme | Fluid · Bauhaus · Swiss · Skeuomorphic | `set_theme`, `adjust_ui` |
| Dark mode | `true` · `false` | `adjust_ui` |
| Density | Compact · Normal · Relaxed | `adjust_ui` |
| Font size | xs · sm · md · lg · xl | `adjust_ui` |
| Line height | tight · normal · relaxed | `adjust_ui` |
| Letter spacing | tight · normal · relaxed | `adjust_ui` |
| Color-blind mode | none · deuteranopia · protanopia · tritanopia | `adjust_ui` |
| Preset | Default · Elderly · Compact · High-contrast · Color-blind (×3) | `adjust_ui` |

Unsupported today by design: arbitrary token editing, free-form color overrides, free-form shadow overrides, and server-reported active-theme state without reliable client provenance.

---

## 2. Theme Profiles

### 2a. Fluid (Default)

| Property | Light | Dark |
|----------|-------|------|
| Font | Geist Sans | Geist Sans |
| Background | `oklch(0.98 0.01 250)` — near-white cool | `oklch(0.14 0.01 250)` — deep navy-black |
| Foreground | `oklch(0.21 0.01 250)` — near-black cool | `oklch(0.98 0.01 250)` — near-white |
| Surface | `oklch(1 0 0)` — pure white | `oklch(0.21 0.01 250)` — dark panel |
| Accent | `oklch(0.21 0.01 250)` — dark | `oklch(0.98 0.01 250)` — light (inverts) |
| Border radius | 1.25rem (large, pill-like) | same |
| Shadows | Layered bloom (5-layer stacked) | Same structure, heavier opacity |
| **Character** | Modern, soft, Apple-like | Matches — coherent pair |

**Brand fit:** ★★★★★ — This IS the brand. Geist Sans, cool blue-gray palette, large radii, layered shadows. Every new component is designed here first.

---

### 2b. Bauhaus

| Property | Light | Dark |
|----------|-------|------|
| Font | Syne | Syne |
| Background | `oklch(0.98 0.01 80)` — warm cream | `oklch(0.15 0 0)` — true black |
| Foreground | `oklch(0.15 0 0)` — true black | `oklch(0.98 0.01 80)` — warm cream |
| Accent | `oklch(0.56 0.19 24)` — Bauhaus red | same |
| Border radius | 10px | same |
| Shadows | Single medium blur | same |
| **Character** | Warm, geometric, editorial | Flat, stark |

**Brand fit:** ★★★☆☆ — Strong character but the warm cream + Syne font diverge significantly from the cool Fluid baseline. The red accent clashes with the neutral Ordo brand. Needs curated component adjustments if kept.

---

### 2c. Swiss Grid

| Property | Light | Dark |
|----------|-------|------|
| Font | Inter | Inter |
| Background | `oklch(1 0 0)` — pure white | `oklch(0 0 0)` — pure black |
| Foreground | `oklch(0 0 0)` — pure black | `oklch(1 0 0)` — pure white |
| Accent | `oklch(0 0 0)` — black | `oklch(1 0 0)` — white (inverts) |
| Border radius | 2px (sharp) | same |
| Shadows | `none` | same |
| **Character** | Stark, typography-first, Müller-Brockmann | Maximum contrast, no decoration |

**Brand fit:** ★★★★☆ — Philosophically aligned (precision, systems). Pure black/white is dramatic. The 2px radius and zero shadows are the opposite of Fluid's soft approach, but it works as an intentional "pro mode." Inter is a safe neutral.

---

### 2d. Skeuomorphic

| Property | Light | Dark |
|----------|-------|------|
| Font | System sans-serif (Inter fallback) | same |
| Background | `oklch(0.88 0.02 240)` — blue-gray linen | `oklch(0.18 0.05 250)` — deep blue-black |
| Foreground | `oklch(0.25 0.05 240)` — dark blue-gray | `oklch(0.88 0.02 240)` — light blue-gray |
| Accent | `oklch(0.6 0.18 240)` — steel blue | `oklch(0.65 0.15 240)` — lighter steel blue |
| Border radius | 12px | same |
| Shadows | `inset 0 1px` highlight + outer drop | same |
| **Character** | Tactile, early-macOS, brushed-metal feel | Frosted-glass panels |

**Brand fit:** ★★★☆☆ — The blue-gray palette is close to Fluid but with a nostalgic, textured feel. Could work as a "classic" option. The inset-shadow pattern adds depth. Moderate divergence.

---

## 3. Color Scheme Matrix (Dark × Light)

| Theme | Light → Dark transition quality | Notes |
|-------|--------------------------------|-------|
| **Fluid** | ★★★★★ Seamless | Cool palette inverts cleanly. Accent swaps dark↔light. |
| **Bauhaus** | ★★★★☆ Good | Warm→Stark. Red accent stays, which grounds it. |
| **Swiss** | ★★★★★ Seamless | Pure white↔black. Nothing to get wrong. |
| **Skeuomorphic** | ★★★★☆ Good | Linen → deep panel. Blue accent adjusts. Natural. |

---

## 4. Density Matrix

| Density | Container padding | Message gap | Composer | Avatar | Suggestion frame | Best for |
|---------|-------------------|-------------|----------|--------|------------------|----------|
| **Compact** | 1rem | 0.618rem | Tight | ~22px | Narrow | Power users, information-dense |
| **Normal** | 1.618rem | 1rem | Standard | ~26px | Standard | Default, balanced |
| **Relaxed** | 2.618rem | 1.618rem | Spacious | ~32px | Wide | Accessibility, touch interfaces |

**All themes support all densities.** Density tokens are theme-independent (pure spacing). No branding issues here — this axis is safe.

---

## 5. Accessibility Presets Matrix

| Preset | Dark? | Font | Line height | Spacing | Density | Color-blind | Brand impact |
|--------|-------|------|-------------|---------|---------|-------------|-------------|
| **Default** | — | md | normal | normal | normal | none | Baseline |
| **Elderly** | — | xl | relaxed | relaxed | relaxed | none | Low — just bigger/looser |
| **Compact** | — | xs | tight | tight | compact | none | Low — just tighter |
| **High-contrast** | Yes | lg | relaxed | — | — | none | Moderate — forces dark mode |
| **Color-blind (D)** | — | — | — | — | — | deuteranopia | Low — only status colors |
| **Color-blind (P)** | — | — | — | — | — | protanopia | Low — only status colors |
| **Color-blind (T)** | — | — | — | — | — | tritanopia | Low — only status colors |

**Accessibility presets are non-destructive to brand.** They adjust scale/spacing and override only status indicator colors (`--status-success`, `--status-error`). Safe to keep all.

---

## 6. Avatar/Branding Compatibility

The current `ordo-avatar.png` is **white eye on solid black background** (128×128 PNG, 3.9KB).

| Context | Dark mode | Light mode | Issue |
|---------|-----------|------------|-------|
| Navbar brand mark | ✅ Black circle with white eye, high contrast | ✅ Black circle on white bg — reads as intentional branded mark | None — works both modes |
| Chat bubble avatar (24×24) | ✅ Black circle blends into dark surface | ⚠️ Black circle is visible but very high contrast against light bg | May want a lighter variant or rely on the round-full clip to keep it small |
| Chat header (32×32) | ✅ Same as above | ⚠️ Same | Same |
| Hero watermark (SVG) | ✅ 3.5% opacity ghost — barely visible | ✅ Same treatment | None — opacity-based, adapts naturally |

**Recommendation:** The solid-black avatar actually works universally as a "seal" — similar to how a dark logo mark on light background is standard practice. If a softer light-mode treatment is desired, a CSS `filter: invert(1)` in `.dark` context (or two image variants) could be explored later.

---

## 7. Critical Combinations to QA

Of 4,320 total combos, these are the **16 highest-risk** for brand coherence:

| # | Theme | Scheme | Density | Preset | Risk | Why |
|---|-------|--------|---------|--------|------|-----|
| 1 | Bauhaus | Light | Relaxed | Elderly | 🟡 Medium | XL Syne on warm cream — readable but very different feel |
| 2 | Bauhaus | Light | Normal | Default | 🟡 Medium | Warm cream + red accent vs cool Ordo brand |
| 3 | Bauhaus | Dark | Compact | Default | 🟡 Medium | Dense Syne on black — stark but serviceable |
| 4 | Swiss | Light | Normal | Default | 🟢 Low | Sharp corners, no shadow — different but disciplined |
| 5 | Swiss | Dark | Normal | Default | 🟢 Low | Pure B&W — dramatic, on-brand |
| 6 | Swiss | Light | Compact | Default | 🟢 Low | Compact grid typography — very professional |
| 7 | Skeuomorphic | Light | Normal | Default | 🟡 Medium | Blue-gray linen — nostalgic, slightly off-brand |
| 8 | Skeuomorphic | Dark | Normal | Default | 🟡 Medium | Frosted panels — close to Fluid dark |
| 9 | Fluid | Light | Normal | Default | ✅ Baseline | THE brand reference |
| 10 | Fluid | Dark | Normal | Default | ✅ Baseline | Primary dark mode |
| 11 | Fluid | Light | Compact | Default | ✅ Safe | Brand + denser |
| 12 | Fluid | Dark | Relaxed | Elderly | ✅ Safe | Brand + accessible |
| 13 | Fluid | Light | Normal | High-contrast | ✅ Safe | Forces Fluid dark at larger size |
| 14 | Any | Any | Any | Color-blind (D) | ✅ Safe | Only touches status colors |
| 15 | Any | Any | Any | Color-blind (P) | ✅ Safe | Only touches status colors |
| 16 | Any | Any | Any | Color-blind (T) | ✅ Safe | Only touches status colors |

---

## 8. Recommendations

### Keep as-is (brand-safe)
- **Fluid** (Light + Dark) — primary brand. All density/accessibility combos.
- **Swiss** (Light + Dark) — strong secondary. Philosophically aligned. Minimal risk.
- **All accessibility presets** — these are user-need features, not brand expressions.
- **All density modes** — spacing-only, no brand impact.

### Keep with guardrails
- **Bauhaus** — Consider constraining the accent color to match the Ordo palette (swap red for the dark cool accent). The Syne font and warm cream are the main divergence.
- **Skeuomorphic** — Close enough to Fluid in palette. The inset shadows add nice texture. Consider whether the blue accent should match Fluid's neutral.

### Future refinements
- **Avatar light-mode treatment:** The dark avatar mark works as-is on light backgrounds (intentional seal style). If softer blending is desired, consider a CSS `dark:` class swap or generating a second `ordo-avatar-light.png` with dark eye on light/transparent background.
- **Theme count:** 4 themes × 2 color schemes = 8 visual states to maintain. Each new component or design change must be verified in all 8. Consider whether the value of 4 themes justifies the QA cost, or if 3 (Fluid, Swiss, +1) would suffice.

---

## 9. File Reference

| File | Purpose |
|------|---------|
| [src/core/entities/theme.ts](../src/core/entities/theme.ts) | Theme union type |
| [src/components/ThemeProvider.tsx](../src/components/ThemeProvider.tsx) | State management, persistence (3 localStorage keys), `/api/preferences` hydration, and DOM application |
| [src/components/ThemeSwitcher.tsx](../src/components/ThemeSwitcher.tsx) | User-facing theme selector labels and ordering |
| [src/core/use-cases/ThemeManagementInteractor.ts](../src/core/use-cases/ThemeManagementInteractor.ts) | Theme metadata and descriptive runtime-facing theme list |
| [src/lib/theme/theme-manifest.ts](../src/lib/theme/theme-manifest.ts) | Manifest-backed theme profile contract, supported IDs, and approved control axes |
| [src/app/styles/foundation.css](../src/app/styles/foundation.css) | Default tokens plus the four active theme overrides |
| [src/core/use-cases/tools/set-theme.tool.ts](../src/core/use-cases/tools/set-theme.tool.ts) | AI tool: set_theme |
| [src/core/use-cases/tools/inspect-theme.tool.ts](../src/core/use-cases/tools/inspect-theme.tool.ts) | AI tool: inspect_theme (read-only) |
| [src/core/use-cases/tools/adjust-ui.tool.ts](../src/core/use-cases/tools/adjust-ui.tool.ts) | AI tool: adjust_ui (composite) |
| [src/core/entities/ui-command.ts](../src/core/entities/ui-command.ts) | UI command type contract |
| [src/adapters/CommandParserService.ts](../src/adapters/CommandParserService.ts) | Legacy text-command parsing path |
| [src/hooks/useUICommands.ts](../src/hooks/useUICommands.ts) | Executes UI commands from AI tool calls |
| [public/ordo-avatar.png](../public/ordo-avatar.png) | Brand avatar (128×128, 3.9KB, white eye on black) |

---

## 10. Combination Count Summary

| Dimension | Count | Cumulative |
|-----------|-------|------------|
| Theme | 4 | 4 |
| × Color scheme | 2 | 8 |
| × Density | 3 | 24 |
| × Font size | 5 | 120 |
| × Line height | 3 | 360 |
| × Letter spacing | 3 | 1,080 |
| × Color-blind mode | 4 | **4,320** |

**Practical QA scope:** Focus on the 8 theme×scheme combos at normal density/default accessibility. That's where brand divergence lives. The remaining 4,312 combos are orthogonal spacing/sizing changes that do not materially affect brand identity.
