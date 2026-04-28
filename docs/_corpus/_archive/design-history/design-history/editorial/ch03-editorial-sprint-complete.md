# Editorial Review: Chapter 3 — Postmodernism and Rebellion

**Reviewer:** Senior Design/Engineering Editor  
**Date:** 2026-03-03  
**File:** `docs/book/chapters/ch03-postmodernism-and-rebellion.md`  

---

## Critical Issues (must fix before publication)

1. **The 'System Error' Example.** The code snippet showing the `SYSTEM ERROR` text breaking the grid is good, but you need to explain the *accessibility* implications of doing this. Breaking the grid visually is fine, but structurally (in the DOM), it must still make sense to screen readers. Add a note about `aria-hidden` or `role="alert"` for the error state.
2. **"Reading is an emotional experience"** This is a powerful thesis. Elaborate briefly on how David Carson explicitly stated that *not* reading an article because it looks boring is a failure of communication, even if the text is perfectly legible in Helvetica.

## Substantive Concerns (strongly recommend fixing)

1. **Paula Scher reference.** You mention she treated type as illustration, scaling logarithmically. Give a specific example of this scaling in CSS (e.g., `clamp()` or `vw` units) to anchor the historical note in modern engineering.

## Minor Issues (copyedit level)

1. Rephrase "just making mistakes because you never learned the grid?" in the checklist. It's a bit antagonistic. Change it to something like, "Are you breaking the grid intentionally to communicate priority, or accidentally due to a lack of structural discipline?"

## Strengths (what works well)

- The Bryan Ferry / Zapf Dingbats anecdote is spectacular. It perfectly illustrates the difference between legibility and communication.
- The concept of the "Intentional Exception" maps beautifully to UI design.
