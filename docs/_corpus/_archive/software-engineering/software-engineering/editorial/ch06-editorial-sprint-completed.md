# Editorial Review: Chapter 6 — 12-Factor in the LLM Era

**Reviewer:** Senior Acquisitions Editor  
**Date:** 2026-03-03  
**File:** `docs/book/chapters/ch06-12-factor-in-the-llm-era.md`  
**Word count:** ~1,000 words (99 lines)

---

## Critical Issues (must fix before publication)

1. **Duplicate sections.** "Additional Evidence" (lines 65–70) substantially duplicates "Repository Example" (lines 53–62). Both list config centralization, build-release-run scripts, health endpoints. Merge or differentiate clearly.

2. **Factor VII (Port Binding) never discusses port binding.** Lines 37–38 pivot immediately to health endpoints without addressing the actual port-binding concern — self-contained HTTP export. Missed opportunity to discuss Next.js's server model.

## Substantive Concerns (strongly recommend fixing)

1. **Validation Strategy framework introduced but never applied.** Lines 72–78 list implementation/command/artifact proof, then move to Additional Evidence without demonstrating the framework on even one factor. Demonstrate at least one fully worked row.

2. **Factor VIII (Concurrency) is thin.** Lines 40–41 restate the original principle without LLM-era reinterpretation. How do streaming routes and long-running inference interact with the process model?

3. **`claude-haiku-4-5` model version.** Line 18: citing a specific model version is concrete but may date rapidly. Add a note that the version is illustrative.

4. **No cross-reference to Chapter 5.** The Exercise asks readers to "create one sprint with acceptance checks" and "publish a QA artifact" — Chapter 5 concepts with no cross-reference.

## Minor Issues (copyedit level)

1. Inconsistent casing: "12-Factor" (capital F) vs. "12-factor" (lowercase). Standardize to "12-Factor" as a proper noun.
2. Line 10: "thousands" of deployments is vague/possibly hyperbolic. Consider "extensive real-world deployment experience."
3. Line 92: "with better tools" is ambiguous. Consider "with higher stakes."
4. Line 45: Factor XI reinterpretation goes beyond the original; flag as reinterpretation.

## Strengths (what works well)

- Factor-by-factor structure is clean and scannable.
- Factor IX (Disposability) is the strongest entry — connects streaming semantics to graceful shutdown.
- The three-proof validation framework is a genuinely useful contribution.
- Repository Example maps factors to real files, grounding the discussion.
