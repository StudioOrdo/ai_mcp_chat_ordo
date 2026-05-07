Here’s the ideal letter.

````markdown
# Letter to Agent: UI Surface Realignment Specs Before Implementation

Implement this **heads down**, but begin with specs, not code.

We are realigning Ordo’s UI around the actual product model. Do not treat this as a cosmetic redesign. This is an information architecture, route inventory, product-surface, and read-model alignment pass.

The core invariant remains:

> Chat is the operating interface. UI surfaces are the governance layer.

The owner should not feel like they are managing raw routes, jobs, logs, forms, or internal tables. The owner should see intelligence briefs, lifecycle surfaces, useful actions, and drill-down evidence.

## 0. Critical instruction

Before implementing UI changes, create a spec package that researches the current codebase and maps what already exists to the target product architecture.

Do not invent new architecture if existing code can be reused, moved, renamed, or reframed.

Do not expose raw donor routes as primary product surfaces.

Do not fake live intelligence. Placeholder data is allowed only when it is clearly deterministic, owner-safe, and replaceable by future read models.

---

# 1. Product vision to align against

Ordo is becoming a human-agent business lifecycle system for solopreneurs.

The lifecycle is:

```text
Source / QR / referral / content
→ visitor
→ conversation
→ human handoff
→ offer
→ accepted offer
→ work / fulfillment
→ delivery
→ feedback
→ report
→ follow-up
````

The public site is a small, high-signal business surface.

The owner workspace is an intelligence cockpit.

The Studio is the production/job system where generated work, media, workflows, campaigns, deliverables, and background intelligence jobs live.

The default view of each owner/admin page should be an LLM-written, evidence-backed brief that is periodically updated by background jobs.

Examples:

```text
People default page:
What is happening with people, leads, handoffs, referrals, and follow-ups?

Offers default page:
Which offers exist, which are performing, which need work, and what accepted offers require fulfillment?

Studio default page:
What is being produced, what media exists, what finished, what failed, and what needs owner review?

About default page:
Is the public story complete, honest, compelling, and supported by evidence?

Knowledge Base default page:
What parts of the business brain are complete, missing, stale, or need owner input?
```

Every default surface should answer:

```text
1. What is going on?
2. Why does it matter?
3. What does the owner need to provide, decide, approve, or fix?
4. What evidence supports this?
5. Where can the owner drill in?
```

---

# 2. Navigation architecture

Research and align the route/menu system around four separate navigation zones.

## A. Public top rail

For visitors.

```text
Logo / Home
Offers
About
Feed, only when public content exists
Login/Register or authenticated user menu
```

Rules:

* Public top rail is visitor-facing.
* About should usually exist.
* Offers may exist with an honest empty/intake state.
* Feed should be hidden from public nav until public content exists.
* Do not expose internal owner/admin surfaces in public nav.
* Do not expose Library, Jobs, Activity, Operations, Admin, raw Studio, or System in public nav.

## B. Upper-right authenticated user menu

Account/session only.

Current target:

```text
My Account
Affiliate Dashboard
Sign out
```

Theme toggle may remain in the menu header.

Rules:

* Account menu answers: “Who am I, how do I manage access, preferences, and session?”
* Do not place business work here.
* Do not place Studio, People, Offers, Media, Jobs, System, Admin, or Knowledge Base here.
* Affiliate Dashboard may remain as a single account-adjacent shortcut because referral identity is user-associated, but the actual affiliate/referral work belongs at `/referrals`.

## C. Left operator rail

For authenticated owner/staff/admin operation.

Target owner rail:

```text
Conversations
Today
Studio
People
Offers
Knowledge Base
About
```

Potential future rail item:

```text
Accepted Offers
```

But do not add it prematurely unless the spec proves it should be top-level. Accepted offers can initially appear inside People, Offers, Studio, and Today.

Rules:

* Left rail is for operating the business.
* It is not the public website nav.
* It is not the account menu.
* It should be hidden/collapsed into the mobile main menu on narrow screens.

## D. Second-column submenu

Every operator surface should use the same mental model:

```text
Left rail | Second-column selector | Main brief/detail pane
```

Second column means:

```text
- sections
- filters
- objects
- evidence index
- chapters
- selected records
```

Main pane means:

```text
- default intelligence brief
- selected object detail
- owner actions
- evidence/provenance
```

---

# 3. Required spec package

Create this spec folder:

```text
docs/_refactor/ordo/phases/02-ui-surface-realignment/
```

Create these specs before implementation:

```text
00-route-and-surface-inventory.md
01-shell-and-menu-ia-alignment.md
02-shared-surface-frame-contract.md
03-public-surfaces-homepage-modes.md
04-owner-intelligence-brief-surfaces.md
05-knowledge-base-surface.md
06-accepted-offers-lifecycle-surface.md
07-placeholder-read-model-policy.md
08-studio-jobs-and-background-briefs.md
09-implementation-phase-plan.md
```

Each spec must include:

```text
Goal
Current code grounding
Verified current state
Target behavior
Reuse / move / hide / mock decisions
Positive tests
Negative tests
Edge tests
Acceptance criteria
Non-goals
Required commands
Closeout evidence required
```

Use the existing phase-doc style as the model.

---

# 4. Required code research

Before writing the specs, inspect the current code anchors.

At minimum research:

```text
src/app/**/page.tsx
src/lib/shell/shell-navigation.ts
src/components/AccountMenu.tsx
src/components/governance/GovernanceSectionFrame.tsx
src/components/studio/**
src/components/dashboard/**
src/components/about/**
src/components/offers/**
src/components/referrals/**
src/components/profile/**
src/app/profile/page.tsx
src/app/referrals/page.tsx
src/app/business/**
src/app/library/**
src/app/jobs/**
src/app/activity/**
src/app/operations/**
src/app/admin/**
src/lib/*/load-*.ts
src/core/**
src/adapters/**
docs/_business/ux/**
docs/_refactor/ordo/phases/**
```

Produce a route inventory table in `00-route-and-surface-inventory.md`:

```text
Route
Current component
Current data source / loader
Current role visibility
Current nav exposure
Target IA location
Decision: keep / move / hide / redirect / donor / admin-only / mock
Notes
Tests affected
```

---

# 5. Surface classification rules

Classify every route or component into one of these categories.

## A. Real product surface

Use it, improve it, and place it correctly.

Likely examples:

```text
Today
Studio
About
Offers
Referrals
Profile / My Account
```

## B. Donor surface

Do not expose directly as a primary product surface. Reuse its data/components under the correct surface.

Likely examples:

```text
/jobs
/activity
/operations
/my/media
/library
/blog
/journal
```

These may feed Studio, Knowledge Base, Reports, Admin, or evidence panels.

## C. Missing product surface

Create a temporary ideal surface using deterministic placeholder read models.

Likely examples:

```text
Knowledge Base
Accepted Offers
People intelligence brief
Offer performance brief
Media performance brief
Homepage mode selector
A2A / agent-card readiness
```

Placeholder surfaces must be visually close to the final intended product, but technically honest.

---

# 6. Placeholder read-model policy

Temporary mock surfaces are allowed only under these rules:

```text
1. Use deterministic fixtures, not random fake data.
2. Clearly mark placeholder data as prototype/demo/empty-state.
3. Never claim live performance if no live evidence exists.
4. Prefer honest empty states over fake metrics.
5. Structure placeholder data like the future real read model.
6. Keep mock data isolated so loaders can replace it later.
7. Do not mix prototype claims into public-facing production copy unless explicitly marked.
```

Bad placeholder:

```text
“Your offer converted 42% better this week.”
```

Good placeholder:

```text
“Offer performance will appear here after Ordo records public views, conversations, accepted offers, and feedback.”
```

---

# 7. Required product surfaces

## Conversations

Default main pane:

```text
Chat stage / Ordo operating interface
```

Second column:

```text
Ordo
Active visitor conversations
Human handoffs
Waiting on owner
Archived
```

## Today

Default main pane:

```text
Today Brief
Owner decision queue
Next best actions
```

Second column:

```text
Needs owner
Handoffs
Accepted offers needing action
Deliveries ready
Feedback ready
Reports ready
System warnings, owner-safe only
```

## People

Default main pane:

```text
People Brief
What is happening with leads, visitors, customers, referrals, and follow-ups
```

Second column:

```text
All
Visitors
Leads
Customers
Referrals
Needs follow-up
Offer in motion
Accepted offers
```

Selected detail:

```text
Person brief
Conversation history
Source/referral path
Offers shown
Accepted offers
Work/delivery status
Feedback
Follow-up
```

If real data is missing, create an ideal deterministic placeholder surface.

## Offers

Default main pane:

```text
Offers Brief
What offers exist, what is performing, what needs owner input
```

Second column:

```text
Public
Private
Draft
Sent
Accepted
Purchased
Archived
Needs review
```

Selected detail:

```text
Offer detail
Visibility
CTA
Related source links / QR
Accepted offers
Performance evidence
Owner actions
```

## Accepted Offers

Do not necessarily add as a top-level rail item yet.

But define the lifecycle object:

```text
Accepted Offer = a person accepted a specific offer, creating fulfillment responsibility.
```

Surface it inside:

```text
People
Offers
Studio
Today
Reports / future
```

Minimum fields for future read model:

```text
id
personId
offerId
sourceId?
conversationId?
acceptedAt
status
fulfillmentState
deliveryState
feedbackState
reportState
```

## Studio

Default main pane:

```text
Studio Brief
What is being made, what finished, what failed, what needs review
```

Second column:

```text
Work in progress
Media
Content
Campaigns
Workflows
Deliverables
Background jobs
```

Rules:

* Studio is the owner-facing production surface.
* Raw job diagnostics remain admin-only.
* Background brief-generation jobs should be visible as owner-safe production/intelligence activity, not raw logs.

Translate raw internals like this:

```text
raw job → work item
workflow run → production process
media asset → deliverable / asset
job event → evidence
completed job → output / artifact
failed job → owner-safe issue or admin diagnostic
```

## About

Default main pane:

```text
Business Story / About Brief
```

About should evolve into a scrollytelling billboard surface.

Second column:

```text
Public story
Mission
Who we help
Problem
Promise
How it works
Proof/results
Trust/governance
Offers context
Call to action
```

Billboard section model:

```text
headline
one-sentence claim
short supporting copy
CTA
related offer
related evidence
visibility
status: draft | published | needs evidence
```

Public view should be minimal and high-signal.

Owner view should show claim, evidence, visibility, and actions.

## Knowledge Base

Refactor the old Library concept into Knowledge Base.

Knowledge Base is not a public library. It is the business brain.

Second column:

```text
System Manual
Brand Guide
Operating Manual
Offer Playbook
Audience Model
Templates
Research
```

Brand Guide should eventually support:

```text
Brand archetype
Cialdini persuasion principles
Maslow / customer need layer
Value proposition
Voice and tone
Proof strategy
Trust signals
```

Do not force users to fill out theory forms. The agent should interview the owner and generate these artifacts.

## Public homepage modes

Define a site setting:

```text
homepageMode:
  chat
  about
  offers
  feed
  campaign
```

Rules:

```text
Chat: always available unless disabled
About: always available with useful default state
Offers: available with honest empty/intake state
Feed: hidden from public nav until public content exists
Campaign: active for QR/tracked-link contexts
```

---

# 8. Background intelligence briefs

Define how background jobs update owner-facing briefs.

Examples:

```text
People brief:
Updated periodically from people, conversations, handoffs, referrals, accepted offers, and feedback.

Offers brief:
Updated from offers, offer views if available, conversations, accepted offers, source attribution, and feedback.

Studio brief:
Updated from jobs, workflows, media, campaigns, content, deliverables, failures, and review states.

About brief:
Updated from brand guide completeness, public story sections, evidence gaps, published offers, and feedback.

Knowledge Base brief:
Updated from manual completeness, stale chapters, missing owner input, and generated/reviewed artifacts.
```

Each brief should include:

```text
title
generatedAt
scope
summary
what changed
why it matters
owner actions
evidence refs
limitations / missing evidence
drill-in links
```

The default page should render the latest brief.

If no brief exists yet, render an honest empty brief state:

```text
“Ordo has not generated this brief yet. Once there is enough activity, this page will summarize what matters and what needs your attention.”
```

---

# 9. Implementation plan requirements

After the specs are written, create `09-implementation-phase-plan.md`.

Break implementation into small phases.

Recommended order:

```text
Phase 1: Route and nav inventory, no UI changes
Phase 2: Shell/menu IA cleanup
Phase 3: Shared brief/selector/detail visual contract
Phase 4: About scrollytelling billboard prototype
Phase 5: Offers brief and accepted-offer placeholder states
Phase 6: People brief placeholder/read-model alignment
Phase 7: Knowledge Base placeholder surface
Phase 8: Studio brief/media/job read-model refinement
Phase 9: Homepage mode setting prototype
Phase 10: Regression closeout
```

Each implementation phase must include:

```text
files to inspect
files to change
positive tests
negative tests
edge tests
required commands
static scans
acceptance criteria
evidence required
```

---

# 10. UX quality bar

The UI should feel like:

```text
Apple-level calm
Linear-level speed
Stripe-level trust
Figma-level object clarity
Studio Ordo brand restraint
```

No clutter.

No dashboard soup.

No raw admin leakage.

No dead public pages.

No fake business metrics.

No forms-first UX where conversation/intelligence should do the work.

The owner should experience Ordo as:

```text
brief first
action second
evidence third
diagnostics last
```

---

# 11. Testing and verification

Every spec must include tests.

At minimum, plan tests for:

```text
navigation visibility by role
public nav hiding/showing Feed based on content
account menu staying account-only
left operator rail visibility and mobile collapse
second-column selector behavior
brief empty states
placeholder read-model rendering
no fake metrics
no raw job/log/provider leakage in owner surfaces
admin-only diagnostics remaining protected
mobile single-pane behavior
desktop three-pane behavior
```

Static scans should check for stale labels and misplaced nav items:

```bash
rg -n "Library|My media|My conversations|My offers|My content|System|Jobs|Operations|Activity" src/components src/app src/lib/shell tests
rg -n "fake|mock|placeholder|demo" src/app src/components src/lib
rg -n "conversion|performance|views|clicks|accepted" src/app src/components src/lib
```

Use these scans to ensure placeholders are honest and internal donor surfaces are not accidentally promoted.

---

# 12. Non-goals

Do not:

```text
- Build the final backend read models yet unless already trivial.
- Build payment processing.
- Build legal contracts.
- Build a full CRM.
- Build a full project-management system.
- Expose raw jobs/logs/admin diagnostics to owners.
- Replace working components unnecessarily.
- Add more top-level nav than needed.
- Rewrite account menu semantics.
- Delete donor routes without redirect and test coverage.
- Make fake analytics claims.
```

---

# 13. Closeout evidence required

For the spec phase, provide:

```text
- Route inventory table
- Current nav map
- Target nav map
- Surface classification table
- Existing components to reuse
- Missing surfaces requiring placeholders
- Donor routes to hide/reframe
- Proposed implementation phases
- Open questions
```

For later implementation phases, provide:

```text
- screenshots or Playwright evidence for desktop/tablet/mobile
- before/after nav lists
- route visibility evidence
- test output
- static scan output
- list of reused components
- list of placeholder read models created
- list of docs updated
```

---

# Final instruction

Create the specs first.

Do not implement UI changes until the specs clearly show:

```text
what exists
what moves
what gets hidden
what gets mocked
what remains admin-only
what becomes public
what becomes owner-facing
what data backs each surface
what evidence is missing
```

The goal is not to make the current app prettier.

The goal is to align the current codebase with the Ordo product architecture:

> A chat-first, owner-governed, human-agent business lifecycle system where public pages are simple lenses, owner pages are intelligence briefs, Studio is the production/job center, and the Knowledge Base is the business brain.

```

This should give your agent enough direction to **research first, document correctly, then implement without drifting into fake dashboard software**.
```
