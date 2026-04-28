# Editorial Review: Chapter 9 — Risk, Safety, and Operational Governance

**Reviewer:** Senior Acquisitions Editor  
**Date:** 2026-03-03  
**File:** `docs/book/chapters/ch09-risk-safety-and-governance.md`  
**Word count:** ~1,600 words (157 lines)

---

## Critical Issues (must fix before publication)

1. **Factual error: SEO threshold.** Line ~88: Claims *"SEO = 100"* but `.lighthouserc.js` sets `minScore: 0.9` (≥ 90, not 100). Must be corrected.

2. **Factual error: `quality` script does not run Lighthouse.** Line ~97 implies the `quality` script runs TypeScript, ESLint, and Lighthouse. The actual `package.json` defines `"quality": "npm run typecheck && npm run lint:strict && npm run test"` — it runs typecheck, lint, and **tests**, not Lighthouse. Correct the prose or update the script.

3. **Clark quote silently edited without notation.** Lines ~55–56: The words "Just" and "kind of" were removed from the original transcript without `[…]` brackets. For a university press, quoted speech must be verbatim or use editorial notation for elisions.

4. **Clark interview source not cited.** The passage says Clark "was asked in 2026" but does not name the interviewer (Ezra Klein), the platform (The Ezra Klein Show / New York Times), or provide any citation.

## Substantive Concerns (strongly recommend fixing)

1. **Duplicate sections.** "Additional Evidence" (lines ~113–117) is nearly identical to "Repository Example" (lines ~107–112). Same files appear in both. Merge or remove one.

2. **Deterministic Tools section is disproportionate.** ~70 of 157 lines cover TypeScript/ESLint/Lighthouse while the four other risk domains get only a few lines each. Balance or restructure.

3. **Clark's macro-level framing slides into specific three-tool stack.** The chapter implies Clark was recommending TypeScript + ESLint + Lighthouse. He was discussing organizational-level governance. Make the logical connection explicit.

4. **Orchestration Drift Risk has no concrete example.** Lines ~28–38: the most novel concept in the chapter is described only abstractly. Needs at least one worked example from the repository.

5. **O-ring concept under-explained.** Line ~60: Michael Kremer's O-ring theory (1993) is not commonly known. Add a one-sentence gloss.

## Minor Issues (copyedit level)

1. Inconsistent heading hierarchy: three tools and "Composite Quality Gate" are all H3 siblings. The gate should be differentiated.
2. "Practical Lens" is one sentence.
3. Empty language tag on fenced code block (line ~94). Add `text`.
4. Capitalization inconsistency: "TypeScript Strict Mode" vs. "zero-warnings tolerance."
5. "Was asked in 2026" is imprecise — use "in early 2026" or the specific date.

## Strengths (what works well)

- Deterministic Tools section is the best technical writing in any chapter. The three-layer framing with "What the tool catches" subsections is publishable standalone.
- Model note (*"I am the drift"*) is the single most memorable passage in the book.
- Four risk domains form a clean, adoptable taxonomy.
- All script and file references verified.
