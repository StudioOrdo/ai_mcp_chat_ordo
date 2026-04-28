# Chapter 2 — Cognitive Foundations: How Users Think

## Abstract

UX design is applied cognitive science. Users do not behave rationally — they behave *predictably irrationally*. This chapter traces the cognitive models that underpin every UX decision: cognitive load theory, mental models, Fitts's Law, Hick's Law, and the peak-end rule. The principle: **design for the brain users actually have, not the brain you wish they had.**

---

## George Miller and the Magic Number (1956)

**George Miller** published "The Magical Number Seven, Plus or Minus Two" in 1956, establishing that human short-term memory can hold approximately 7±2 items simultaneously. This finding directly informed UI design: navigation with more than ~7 items exceeds working memory capacity, forcing users to *read* rather than *scan*.

### Cognitive Load Theory

**John Sweller** extended Miller's work into cognitive load theory (1988): learning and task performance degrade when working memory is overloaded. Three types of cognitive load:

- **Intrinsic**: the inherent complexity of the task
- **Extraneous**: complexity added by poor design (confusing navigation, unclear labels)
- **Germane**: the mental effort of building understanding

UX design can reduce only *extraneous* load — the noise introduced by the interface itself. Every unnecessary option, every inconsistent pattern, every ambiguous label adds extraneous load.

---

## Fitts's Law (1954) and Hick's Law (1952)

### Fitts's Law

The time to reach a target is a function of the **distance to the target** divided by the **size of the target**. Large, close targets are fast to hit. Small, distant targets are slow.

UI implications: primary action buttons should be large and positioned where the cursor/thumb naturally rests. Destructive actions should be small and distant from primary actions — making accidental activation physically unlikely.

### Hick's Law

The time to make a decision increases logarithmically with the number of choices. Two choices are fast. Ten choices involve noticeable deliberation. Fifty choices cause paralysis.

UI implications: progressive disclosure (reveal options only when relevant), categorization (group 50 items into 5 groups of 10), and defaults (pre-select the most common choice) all reduce decision time.

---

## Mental Models and Norman's Gulf

Users approach every interface with a **mental model** — their internal theory of how the system works. If the interface matches their mental model, interaction feels intuitive. If it doesn't, every action requires conscious effort.

Don Norman's gulfs of execution and evaluation (Book III, Chapter 6) are the measurable distance between the user's mental model and the system's actual model. Good UX design minimizes both gulfs by using conventions, familiar metaphors, and consistent behavior.

---

## Kahneman and the Peak-End Rule (2000)

**Daniel Kahneman** (behavioral economist, Nobel laureate) demonstrated that people judge experiences not by their average quality but by two moments: the **peak** (most intense point — positive or negative) and the **end** (the last moment).

UX implication: the most important moments in a user journey are the *best* moment and the *final* moment. An onboarding flow that ends with a confusing step will be remembered as confusing, even if the previous five steps were brilliant. A checkout flow that ends with a delightful confirmation will be remembered as pleasant, even if the address form was tedious.

---

## What This Means for Us

Cognitive science is not optional reading for UX practitioners — it is the operating manual for the system you are designing for (the human brain).

## Chapter Checklist

- Does any screen present more than 7±2 options simultaneously?
- Are primary actions large and positioned for easy reach (Fitts's Law)?
- Do you use progressive disclosure to reduce choice overload (Hick's Law)?
- Is the final step of every user flow designed to be positive (peak-end rule)?
- Can you describe the user's mental model of your system — and does your interface match it?
