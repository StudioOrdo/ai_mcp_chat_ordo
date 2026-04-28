# Chapter 4 — User Flows and Journey Mapping: The Choreography of Experience

## Abstract

A single screen is a tableau. A *sequence* of screens is a choreography. User flows and journey maps make that choreography visible, inspectable, and improvable. This chapter covers flow diagramming, service blueprints, the jobs-to-be-done framework, and the distinction between happy paths and error recovery paths.

---

## Alan Cooper and Goal-Directed Design (1999)

**Alan Cooper** published *The Inmates Are Running the Asylum* in 1999, introducing **personas** and **goal-directed design**. His core argument: software is designed by engineers for engineers, and the result is products that are powerful but inhumane for non-technical users.

Cooper's solution: design for a specific *persona* (a fictional but research-grounded user archetype) pursuing a specific *goal*. The goal is not "use the software" — it is the real-world outcome the user is trying to achieve. "Book a flight" is a goal. "Fill out a form with departure city, arrival city, date, and passenger count" is a task. Design should optimize for the goal and minimize the tasks.

---

## Clayton Christensen and Jobs to Be Done (2003)

**Clayton Christensen** developed the **Jobs to Be Done** (JTBD) framework: users don't buy products — they "hire" products to do a specific job. A milkshake purchased during a morning commute is "hired" for the job of making a boring drive more interesting and filling until lunch.

JTBD reframes UX research from "who is the user?" to "what job is the user hiring this product to do?" The same product may be hired for different jobs by different users — and the experience should adapt accordingly.

---

## Mapping the Journey

### User Flows

A **user flow** is a step-by-step diagram of the path a user takes to accomplish a specific goal. It includes decision points (if/else), system actions, and state changes.

### Journey Maps

A **journey map** adds emotional context to the flow: at each step, what is the user *thinking*, *feeling*, and *doing*? Where are the pain points (frustration, confusion, delay)? Where are the delight points (surprise, satisfaction, relief)?

### Service Blueprints

A **service blueprint** extends the journey map to include backstage processes — the systems, APIs, databases, and human actions that support each step of the user-facing flow. This makes the entire system visible, from user input to server response.

---

## What This Means for Us

User flows, journey maps, and service blueprints are the UX equivalent of architecture diagrams. They make the invisible (the user's experience over time) visible and inspectable.

## Chapter Checklist

- Can you diagram the user flow for every core task in your product?
- Have you identified the emotional peaks and valleys in your user journey?
- Are your personas based on research data, or are they fictional stereotypes?
- Does your journey map include error recovery paths, not just happy paths?
- Can you articulate the JTBD for your product in one sentence?
