# Chapter 3 — Experimentation: A/B Testing Done Right

## Abstract

A/B testing is the gold standard for causal inference in product development. This chapter covers experimental design, statistical significance, sample size calculation, and the common mistakes that invalidate test results.

## Key Concepts

- **Control vs. treatment**: only one variable changes between versions
- **Statistical significance**: typically p < 0.05 (5% chance the result is random)
- **Sample size**: calculated before the test starts, not decided after
- **Running time**: tests must run for complete business cycles (at least one full week)

## Common Mistakes

- **Peeking**: checking results before the test reaches significance
- **Multiple comparisons**: testing many metrics inflates false positive rate
- **Winner's curse**: small samples exaggerate the effect size of the winner
- **Survivorship bias**: analyzing only users who completed the flow, ignoring dropouts

## Chapter Checklist

- Do you calculate required sample size before starting tests?
- Do you run tests for at least one full business cycle?
- Are you correcting for multiple comparisons?

---
