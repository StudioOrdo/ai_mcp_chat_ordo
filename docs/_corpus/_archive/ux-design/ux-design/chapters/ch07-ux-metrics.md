# Chapter 7 — UX Metrics: Measuring What Matters

## Abstract

Without measurement, UX is opinion. This chapter covers the metrics that separate effective UX practice from aesthetic preference: task success rate, time on task, error rate, the System Usability Scale, Net Promoter Score, and the HEART framework from Google. The principle: **measure behavior, not satisfaction alone.**

---

## Kerry Rodden and the HEART Framework (2010)

**Kerry Rodden** (Google) developed the HEART framework to give product teams a structured way to measure user experience across five dimensions:

| Metric | Measures | Example Signal |
| -------- | ---------- | --------------- |
| **Happiness** | User satisfaction | CSAT survey, NPS |
| **Engagement** | Depth and frequency of use | DAU/MAU, session duration, feature adoption |
| **Adoption** | New user acquisition | Sign-up rate, first-time feature use |
| **Retention** | Users who return | Day-7 retention, churn rate |
| **Task Success** | Effectiveness and efficiency | Completion rate, time on task, error rate |

### Goals → Signals → Metrics

Rodden's key contribution was the GSM (Goals-Signals-Metrics) process: first define the *goal* (what outcome do you care about?), then identify the *signal* (what user behavior indicates progress toward that goal?), then choose the *metric* (how do you measure that signal at scale?).

---

## The System Usability Scale (1986)

**John Brooke** created the System Usability Scale (SUS) — a ten-question standardized questionnaire that produces a score from 0 to 100. The questions alternate between positive and negative framing to prevent response bias.

SUS scores have been validated against millions of evaluations:

- **68 = average** (the 50th percentile)
- **80+ = excellent** (top 10%)
- **Below 50 = serious usability problems**

SUS is useful because it is standardized (you can compare your product against industry benchmarks) and cheap (10 questions, administered post-task).

---

## Quantitative UX Metrics

| Metric | What It Tells You |
| -------- | ------------------ |
| Task success rate | Can users accomplish their goals? |
| Time on task | How efficient is the interaction? |
| Error rate | How often do users make mistakes? |
| Learnability | How quickly do new users reach proficiency? |
| Satisfaction (SUS/CSAT) | How do users feel about the experience? |

The critical insight: **satisfaction and usability are not the same thing.** Users can be satisfied with an unusable product (they blame themselves for the difficulty) and dissatisfied with a usable product (it works but feels sterile). Measuring both is necessary.

---

## What This Means for Us

UX metrics convert subjective experience into objective evidence. They are the validation layer for design decisions — the equivalent of `npm test` for the product experience.

## Chapter Checklist

- Do you have a HEART framework (or equivalent) for your product?
- Are you measuring task success rate, not just satisfaction?
- Can you benchmark your SUS score against industry averages?
- Do your UX metrics inform design decisions, or do they sit in dashboards?
- Is every major design change A/B tested with a defined success metric?
