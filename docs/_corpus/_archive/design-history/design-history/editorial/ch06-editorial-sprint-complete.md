# Editorial Review: Chapter 6 — The Motion and Fluid Web Era

**Reviewer:** Senior Design/Engineering Editor  
**Date:** 2026-03-03  
**File:** `docs/book/chapters/ch06-the-motion-and-fluid-era.md`  

---

## Critical Issues (must fix before publication)

1. **Fluid Typography Formula Context.** The `clamp(2rem, 1.5rem + 2vw, 4rem)` example is excellent. However, you need to briefly explain *how* that formula works mathematically (the intersection of a static root EM basis with a dynamic viewport variance) so engineers understand they aren't just guessing the `+ 2vw` part.
2. **Reduced Motion Accessibility.** You discuss "Semantic Feedback" in animation. This is critical. But you absolutely must mention the `prefers-reduced-motion` media query. Ethically, a design engineering book cannot praise animation without explaining how to disable it for users with vestibular disorders.

## Substantive Concerns (strongly recommend fixing)

1. **Hardware Acceleration.** When discussing smooth easing curves (e.g., expanding an accordion), add a brief note about animating `transform` and `opacity` to ensure hardware acceleration (GPU rendering) instead of animating layout properties like `height`, which cause main-thread jank. 

## Minor Issues (copyedit level)

1. The phrase "pretending that the infinite spectrum of digital glass could be categorized into three tidy boxes" is pure poetry. Do not touch this sentence.

## Strengths (what works well)

- The "Death of Breakpoints" is a phenomenal framing that challenges a deeply entrenched industry assumption.
- Treating modern design as a live calculus equation solving for viewport variables is the perfect concluding thesis for the entire historical arc of the book.
