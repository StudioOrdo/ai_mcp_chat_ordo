# Editorial Review: Chapter 8 — Observability, Feedback, and Evals

**Reviewer:** Senior Acquisitions Editor  
**Date:** 2026-03-03  
**File:** `docs/book/chapters/ch08-observability-feedback-and-evals.md`  
**Word count:** ~700 words (72 lines)

---

## Critical Issues (must fix before publication)

1. **Title promises "Evals" but eval content is critically thin.** The "Evals as Operational Feedback" section is only four bullet points. No definition of what an "eval" means in context, no concrete example, no eval tooling discussion. Either expand substantially or rename the chapter (e.g., "Observability and Feedback Loops").

## Substantive Concerns (strongly recommend fixing)

1. **No cross-references to any other chapter.** Ch7 builds the Observer pattern this chapter depends on; Ch9 discusses governance signals; Ch5 is the destination for "Feed recurring regressions into sprint planning." None connected.

2. **Model note dominates the opening.** At ~8 lines it is longer than several content sections. Consider moving it after the Signal Stack section where the reader has more context.

3. **Diagram Prompt is a stub.** Same issue as other chapters.

4. **Closing sentence is grammatically orphaned.** *"If yes, observability is functioning…"* — "If yes" refers to a multi-item checklist. Use "When these hold" or "If all four are yes."

5. **Exercise jumps from taxonomy to ownership matrix.** The Signal Stack defines four classes; the Exercise asks for eight metrics plus an ownership model — a large pedagogical leap. Provide a worked example first.

## Minor Issues (copyedit level)

1. Inconsistent em-dash vs. parenthetical usage between model note and Anti-Patterns.
2. "Practical Lens" is again a single sentence.
3. At 72 lines, this is the thinnest of the implementation chapters. Observability arguably warrants more depth.

## Strengths (what works well)

- Signal Stack taxonomy (correctness, latency, resilience, governance) is immediately actionable.
- Model note's feedback-loop framing is one of the best articulations of human-AI collaboration.
- Anti-Patterns list is sharp: *"Metrics without action thresholds (vanity instrumentation)"* is memorable.
