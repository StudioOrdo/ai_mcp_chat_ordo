# Chapter 5 — Behavioral Design: Nudges, Defaults, and Ethics

## Abstract

Every interface nudges users toward certain behaviors. This chapter draws from Richard Thaler and Cass Sunstein's *Nudge*, BJ Fogg's behavior model, and the ethical boundaries that separate helpful nudges from dark patterns. The principle: **design influences behavior whether you intend it to or not — the question is whether that influence is ethical and transparent.**

---

## Thaler, Sunstein, and Choice Architecture (2008)

**Richard Thaler** and **Cass Sunstein** published *Nudge* in 2008, arguing that the way choices are *presented* (the "choice architecture") significantly influences which choices people make — even when the options themselves are unchanged.

Key nudge mechanisms:

- **Defaults**: the pre-selected option is chosen far more often than non-defaults. Organ donation rates, retirement savings rates, and cookie consent acceptance are all driven by defaults.
- **Framing**: "95% survival rate" and "5% mortality rate" describe the same thing but produce different emotional responses.
- **Social proof**: "87% of users completed this step" encourages completion.
- **Friction**: adding steps to a process (confirmation dialogs, multi-step unsubscription) discourages the action without prohibiting it.

---

## BJ Fogg and the Behavior Model (2009)

**BJ Fogg** (Stanford) proposed that behavior occurs when three elements converge: **Motivation** (the user wants to act), **Ability** (the action is easy enough), and a **Prompt** (something triggers the action). If any element is missing, the behavior does not occur.

UX implications:

- Low motivation + low ability = nothing happens (no one fills out a 20-field form for a newsletter)
- High motivation + low ability = frustration (the user wants to pay but can't find the checkout)
- Low motivation + high ability = requires a prompt (a notification, a suggestion)
- High motivation + high ability + prompt = behavior happens

---

## Dark Patterns and Ethical Boundaries

**Harry Brignull** coined the term "dark patterns" in 2010 to describe interface designs that trick users into unintended actions: hidden opt-outs, confusing language, visual misdirection, and roach motels (easy to subscribe, impossible to cancel).

Dark patterns violate the trust contract between product and user. They may increase short-term metrics (sign-ups, purchases) while destroying long-term trust and generating regulatory risk (the EU's Digital Services Act explicitly targets dark patterns).

Ethical behavioral design asks: **if the user fully understood what was happening, would they still make this choice?** If the answer is no, the nudge is a dark pattern.

---

## What This Means for Us

Every interface is a choice architecture. Defaults, framing, friction, and prompts are design tools. The ethical boundary is transparency: a nudge is ethical when it helps the user achieve *their* goal; it is a dark pattern when it helps the business at the user's expense.

## Chapter Checklist

- Are your defaults optimized for user benefit, or for business metrics?
- Does unsubscription require fewer steps than subscription?
- Can you identify every nudge in your user flow and articulate why it helps the user?
- Are destructive actions protected by confirmation dialogs?
- Would you be comfortable explaining every behavioral design choice to your users?
