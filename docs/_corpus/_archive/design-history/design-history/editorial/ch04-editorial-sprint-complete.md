# Editorial Review: Chapter 4 — The Digital Transition

**Reviewer:** Senior Design/Engineering Editor  
**Date:** 2026-03-03  
**File:** `docs/book/chapters/ch04-the-digital-transition.md`  

---

## Critical Issues (must fix before publication)

1. **State Machine Clarification.** The Next.js repository example shows a Tailwind button with `:hover`, `:active`, and `:focus`. This is excellent. However, you need to explicitly link the **`:focus` state** to accessibility and keyboard navigation. Affordance isn't just for mice; it's for `Tab` index users too.
2. **The Command Key origin.** You mentioned Susan Kare designed the command key symbol, but missed the perfect historical anecdote: she found the symbol (`⌘`) in a dictionary of symbols, where it represented a "place of interest" on Swedish campground signs. Add this! It perfectly illustrates mapping physical world concepts to the digital realm.

## Substantive Concerns (strongly recommend fixing)

1. **Anti-aliasing.** You note that Kare's fonts didn't rely on anti-aliasing. Briefly explain *why* (1-bit pixel grids literally couldn't render grayscale pixels to smooth the edges). Mentioning this technical constraint makes her achievement more impressive to engineers.

## Minor Issues (copyedit level)

1. The checklist question "Are you communicating state clearly (e.g., success, error, loading)..." feels slightly disconnected from the "affordance" focus of the chapter. Tie it back by saying "Are you communicating state clearly... to provide continuous affordance?"

## Strengths (what works well)

- The connection between a mosaic artist and a 16x16 pixel grid is a brilliant bit of historical context.
- Translating "Affordance" directly into "CSS State Machines" is a high-value engineering takeaway.
