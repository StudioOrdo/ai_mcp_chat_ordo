# Editorial Review: Chapter 2 — The Swiss Grid

**Reviewer:** Senior Design/Engineering Editor  
**Date:** 2026-03-03  
**File:** `docs/book/chapters/ch02-the-swiss-grid.md`  

---

## Critical Issues (must fix before publication)

1. **Missed Opportunity with Vignelli.** You mentioned Massimo Vignelli's subway map, but did not mention that the MTA literally just released a digital reproduction of his map as the default view in their app. This perfectly bridges the print-to-digital narrative. Add this.
2. **Rivers of White Space explanation.** The explanation of why justified text is bad is clear, but it needs to explicitly state that CSS `text-align: justify` is functionally obsolete in modern web typography for this exact mathematical reason. 

## Substantive Concerns (strongly recommend fixing)

1. **Grid Component Abstraction.** The Tailwind example (`grid-cols-12`) is fine, but it would be much stronger if you tied Müller-Brockmann's "objective rhythm" to the concept of separating *content* from *presentation*. The grid exists so content can be swapped without the layout breaking. State this explicitly.

## Minor Issues (copyedit level)

1. The phrasing "It is an engineering blueprint masquerading as art" is fantastic. Keep it.
2. Add a subheader for "The Rule of Rational Typography" to break up the flow. (Wait, it already exists. Never mind!) Just ensure "Helvetica" is emphasized as the ultimate scalable typeface.

## Strengths (what works well)

- The tie-in to `gap-4` is incredibly pragmatic.
- The use of the Beethoven poster perfectly illustrates the core concept of asymmetry governed by rigid math.
