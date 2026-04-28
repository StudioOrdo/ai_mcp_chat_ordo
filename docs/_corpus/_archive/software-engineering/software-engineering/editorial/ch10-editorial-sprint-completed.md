# Editorial Review: Chapter 10 — Case Study: IS601 Demo

**Reviewer:** Senior Acquisitions Editor  
**Date:** 2026-03-03  
**File:** `docs/book/chapters/ch10-case-study-is601-demo.md`  
**Word count:** ~1,100 words (115 lines)

---

## Critical Issues (must fix before publication)

1. **None identified.** Factual claims are backed by verifiable repository artifacts. Cross-references are accurate.

## Substantive Concerns (strongly recommend fixing)

1. **Decomposition file names slightly inaccurate.** Line ~65: states the chat route was decomposed into *"validation.ts, policy.ts, orchestrator.ts, and http-facade.ts."* The route entry points (`route.ts`, `stream/route.ts`) still exist and delegate to decomposed modules. Clarify the delegation architecture.

2. **"No behavior changed" claim is unverified.** A sprint QA artifact confirming behavioral equivalence pre/post refactor would materially strengthen this claim.

3. **Model alias narrative imprecise.** *"claude-haiku → claude-haiku-4-5"* — confirm the exact original identifier or soften to describe the category of failure.

4. **"Lessons from the Process" is thin.** Four single-sentence bullets. For a case study chapter, each lesson deserves at least a paragraph showing how it was learned.

## Minor Issues (copyedit level)

1. Orphaned closing line: *"If yes, this case study functions as method, not just story."* needs structural anchor.
2. *"Uncle Bob-oriented"* — use "SRP-oriented" or "SOLID-oriented" for consistency with earlier sections.
3. Passive construction: *"produced by the previous one"* → "the previous phase produced."

## Strengths (what works well)

- "What Went Wrong" section is exceptional — three concrete failures with root cause, detection, and fix.
- Model note sidebar is startlingly honest about optimization constraints.
- All sprint QA artifact paths verified as real.
