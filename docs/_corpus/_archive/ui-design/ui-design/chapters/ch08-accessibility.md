# Chapter 8 — Accessibility: The Non-Negotiable Foundation

## Abstract

Accessibility is not a feature — it is a quality of engineering. An interface that cannot be used by people with disabilities is not a finished product; it is a prototype with incomplete interaction coverage. This chapter traces accessibility from Section 508 and WCAG through Léonie Watson's advocacy, the modern implementation of ARIA, keyboard patterns, and the engineering discipline of building accessibility into the component model from the start.

---

## Léonie Watson and the Screen Reader Perspective (2000s–present)

**Léonie Watson** is a web standards advocate and screen reader user who has spent decades bridging the gap between the W3C specifications and real-world accessibility. Her talks and writing demonstrate a simple, devastating truth: most web interfaces are *broken* for screen reader users, not because the technology is inadequate, but because developers don't test with assistive technology.

Watson's key insight: **semantic HTML is the accessibility layer.** When developers use `<div>` and `<span>` for everything and add click handlers with JavaScript, they create elements that are invisible to screen readers. A `<button>` announces itself as a button, communicates its label, and responds to keyboard activation (Enter and Space). A `<div onClick={...}>` does none of those things without explicit ARIA intervention.

The principle: **use the right HTML element first. Add ARIA only when no native element exists for the pattern.**

---

## WCAG 2.1: The Four Principles

The Web Content Accessibility Guidelines organize accessibility requirements under four principles (POUR):

### 1. Perceivable

Information must be presentable in ways that users can perceive. This includes:

- **Text alternatives** for images (`alt` attributes)
- **Captions** for video and audio
- **Sufficient contrast** (4.5:1 for text, 3:1 for large text)
- **Content that does not rely solely on color** to convey meaning

### 2. Operable

Users must be able to operate the interface. This includes:

- **Keyboard accessibility**: every interactive element reachable via Tab, activatable via Enter/Space
- **No keyboard traps**: focus must never become stuck in a component
- **Sufficient time**: users must have enough time to read and act
- **Seizure safety**: no content that flashes more than 3 times per second

### 3. Understandable

Content and operation must be understandable. This includes:

- **Readable language**: page language declared (`lang` attribute)
- **Predictable behavior**: navigation, naming, and interaction are consistent
- **Input assistance**: error identification, labels, and suggestions

### 4. Robust

Content must be robust enough to work with current and future assistive technologies. This means:

- **Valid HTML**: parsing errors confuse assistive technology
- **ARIA used correctly**: invalid ARIA is worse than no ARIA
- **Tested with real assistive technology**: not just automated tools

---

## Keyboard Navigation Patterns

Every component must specify its keyboard interaction. The WAI-ARIA Authoring Practices provide standard patterns:

| Component | Key | Action |
| ----------- | ----- | -------- |
| Button | Enter, Space | Activate |
| Link | Enter | Navigate |
| Checkbox | Space | Toggle |
| Radio group | Arrow keys | Move selection |
| Tab panel | Arrow keys | Switch tabs (within tablist) |
| Modal | Escape | Close |
| Dropdown | Arrow keys | Navigate options, Enter to select, Escape to close |

Implementing these patterns ensures that keyboard users (including screen reader users) can operate every component without a mouse.

```css
/* Focus ring: must be visible for keyboard navigation */
:focus-visible {
  outline: 2px solid var(--color-primary-500);
  outline-offset: 2px;
}

/* Remove default outline only when :focus-visible is supported */
:focus:not(:focus-visible) {
  outline: none;
}
```

---

## The Accessibility Testing Stack

Accessibility requires *layered* testing — no single tool catches everything:

| Layer | Tool | Catches |
| ------- | ------ | --------- |
| Automated | axe-core, Lighthouse | ~30% of issues (missing alt text, low contrast, missing labels) |
| Semi-automated | Screen reader testing | Interaction flow, reading order, live region behavior |
| Manual | Keyboard-only navigation | Focus traps, unreachable elements, invisible states |
| User testing | People with disabilities | Real-world workflow issues that tools cannot detect |

**The critical insight: automated tools catch less than a third of accessibility issues.** Passing Lighthouse accessibility with a 100 score does not mean the interface is accessible. It means the most basic, automatable checks passed.

---

## What This Means for Us

Accessibility is not an add-on. It is a quality of the component architecture. Components that are built with semantic HTML, keyboard patterns, and ARIA attributes from the start are accessible by default. Components that are built with `<div>` and decorated later require expensive retrofitting.

## Chapter Checklist

- Can every interactive element be reached and activated via keyboard?
- Does every image have a meaningful `alt` attribute (or `alt=""` for decorative images)?
- Do all text/background combinations meet WCAG AA contrast (4.5:1)?
- Is information conveyed by color also conveyed by text, shape, or icon?
- Have you tested with a screen reader (VoiceOver, NVDA), not just Lighthouse?
- Does every form field have a visible, associated `<label>`?
