# Editorial Review: Chapter 3 — Prompt Orchestration Primitives

**Reviewer:** Senior Acquisitions Editor  
**Date:** 2026-03-03  
**File:** `docs/book/chapters/ch03-prompt-orchestration-primitives.md`  
**Word count:** ~850 words (86 lines)

---

## Critical Issues (must fix before publication)

1. **Seven primitives listed but developed unequally.** Primitives 1 (Role Framing) and 4 (Acceptance Criteria) get explanatory prose. Primitives 2, 3, 5, 6, and 7 each receive only one or two sentences. For a chapter that claims to *define* these primitives, each needs at minimum: a definition, a rationale, one concrete example, and one anti-pattern.

2. **No concrete prompt examples.** A chapter defining "prompt orchestration primitives" that contains zero actual prompts is a critical gap. The Reusable Prompt Skeleton is a template but not a filled-in example. At least one fully worked example using all seven primitives is essential.

## Substantive Concerns (strongly recommend fixing)

1. **Model note makes unfalsifiable claim.** Lines 13–15: *"I genuinely activate a different behavioral posture…"* asserts an internal state that is not verifiable. Replace "genuinely activate" with "the outputs shift measurably toward."

2. **Primitives 4 (Acceptance Criteria) and 6 (Verification) overlap heavily.** The chapter should explicitly distinguish them — e.g., acceptance criteria define *what* must be true, verification defines *how* you check it.

3. **Cross-reference to Chapter 5 is under-leveraged.** The bridge to Chapter 5 needs to be stronger, with a brief preview of the loop structure.

4. **"Named framework compression" used without definition.** Line 47: This concept belongs to Chapter 4. Add a cross-reference: "Named framework compression (see Chapter 4)…"

## Minor Issues (copyedit level)

1. Line 10: *"Role framing changes optimization behavior."* — whose? Specify "the model's."
2. Lines 26–27: *"If done cannot be measured, done is ambiguous."* — grammatically odd. Consider "If completion cannot be measured…"
3. Line 36: Missing comma: *"…in real software, where consistency beats novelty."*
4. Anti-Patterns section: flat list with no elaboration. Map each anti-pattern to the primitive it violates.
5. Formatting inconsistency: Primitives use `### N)` headings, Skeleton uses `N.` numbered items.

## Strengths (what works well)

- The primitive taxonomy is the book's most actionable framework so far.
- The Reusable Prompt Skeleton is a genuinely useful artifact.
- The Exercise section (controlled comparison) is the best of the opening chapters.
- The Anti-Patterns section, while thin, adds useful negative examples.
