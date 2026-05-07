# Product Kernel Contract

Status: Normative

Evidence date: 2026-05-04

## Purpose

This contract defines the smallest coherent product shape for Ordo.

Ordo is for individuals who have to build and run their own businesses. The
product promise is not "AI tools." The product promise is a capable operating
staff inside the user's own site: Ordo helps the owner create useful work,
sell offers, manage people, publish or share content, inspect provenance, and
understand what is producing results.

All owner-facing UX work must fit this kernel before it adds a new page,
concept, button, card, or metric.

## Kernel Objects

Every user-visible object must belong to one of these concepts.

| Object | User meaning | Existing anchors | Primary surface |
| --- | --- | --- | --- |
| Work | Ordo is doing or has done something | `job_requests`, `operations`, `media_workflows`, `factory_work_orders` | Today, Studio |
| Media | Image, audio, chart, graph, video, file | `user_files`, `blog_assets`, `materialization_records`, media workflow code | Studio |
| Content | Article, post, script, feed item, private note | `blog_posts`, `blog_post_artifacts`, journal/blog routes | Studio, Feed |
| Person | Visitor, lead, customer, affiliate, referrer, collaborator | `users`, `conversations`, `lead_records`, `deal_records`, `referrals` | People |
| Offer | Public package or private proposal | `offers`, `offer_events`, `config/services.json` donor | Offers |
| Link | QR code, referral link, tracked URL | referral routes, QR endpoints, `tracked_links`, `tracked_link_events` | People, Offers, Studio |
| Campaign | A content/offer/link effort with a goal | content, referrals, tracked links, planned campaign read model | Studio, Results |
| Activity | Something happened that may matter | `activity_receipts`, `job_events`, `operation_events`, `referral_events` | Today, details |
| Result | Evidence of business motion | referral analytics, tracked events, offer/person stages | Today, People, Offers |
| Brief | Evidence-backed staff report for a section or object | dashboard/studio/business/admin loaders, activity/events, future brief records | Today, Studio, People, Offers, Account, System |
| Backup/Restore | Appliance safety and recovery work | `system_commands`, backup/restore routes, `crates/ordo-backup` | System |

Implementation-specific names can remain in code. Product UI should translate
them into these concepts.

## Interface And Governance Contract

Chat is the operating interface. UI surfaces are the governance layer.

The user should mostly tell Ordo what they want in conversation. The UI should
make Ordo accountable by showing:

- what exists,
- what is public or private,
- what needs approval,
- what Ordo is doing,
- what Ordo produced,
- how it was produced,
- who is involved,
- what changed,
- what worked,
- what is risky,
- what can be inspected, approved, revised, published, shared, or undone.

Product surfaces are not separate apps competing with chat. They are control
rooms for the work chat starts and the evidence chat must respect.

Phase rule: if a user has to leave chat and manually operate a subsystem to do
normal work, the UX is drifting. If the UI cannot prove what chat did, the
system is not governed.

## Navigation Contract

### Public

The public site is minimal:

- Home
- Offers
- About
- Feed only when public published content exists

No library-first public navigation. No internal corpus, job, operation, or
diagnostic surfaces in public nav.

### Owner

The signed-in owner workspace is:

- Conversations
- Today
- Studio
- People
- Offers
- About

Conversations appears first because chat is the operating interface. Ordo is
the active agent conversation today; future person handoffs live in the same
conversation selector. The other surfaces are governance surfaces.

Jobs, notifications, activity, operations, and logs are not top-level owner
apps. They appear as:

- rail badges,
- Today attention cards,
- object status,
- provenance/history lenses,
- admin diagnostics.

Account settings live in the upper-right account menu, not in the business
workspace rail. The account menu owns:

- My Account
- Affiliate Dashboard
- Sign out

Theme is a compact toggle in the account menu header. Preferences live inside
My Account rather than as a top-level account-menu item. Change Password also
lives inside My Account's second-column account rail rather than as a duplicate
top-level account-menu item. Affiliate Dashboard is the account-menu shortcut to
the owner affiliate dashboard at `/referrals`; QR codes, referral links, and
referral performance remain in that dashboard and referral evidence detail
routes, not inside `/profile`. My media,
My conversations, My offers, and My content are not primary account-menu items;
they belong in Studio, People, and Offers. System appears in admin navigation
only for users with system/admin permission. Regular owner surfaces should
never require Jobs, Operations, Activity, Logs, or raw provider diagnostics as
primary navigation.

### Staff And Admin

Staff/admin functionality is a separate mode, preferably a left vertical rail.
It may expose:

- Admin
- Jobs
- System

Admin controls must not compete with the owner's daily operating surfaces.
`Factory` and `Operations` can remain internal or diagnostic words, but the
visible top-level admin product label is `Jobs` or `System`.

## Progressive Disclosure Contract

Authenticated sections must separate command, summary, selection, detail, and
diagnostics:

1. Chat command: the user tells Ordo what to do.
2. Section brief: Ordo explains what matters right now.
3. Second-column evidence index: objects and signals are selectable.
4. Selected detail: one object owns the main pane.
5. Trail/provenance: the user can inspect why/how.
6. Admin diagnostics: raw jobs, logs, providers, keys, and repair controls.

Base routes render section briefs. Query-selected routes render one object
detail. Selected object details must not start with global metric cards or
section-wide dashboards.

## Brief And Read Model Contract

Briefs are durable staff reports. They can be deterministic first and
LLM-generated later, but they must always be evidence-backed.

A brief must include:

- id/version or stable source;
- as-of timestamp;
- section or object scope;
- summary bullets;
- recommended next action;
- evidence references;
- limitations when evidence is missing;
- visibility policy;
- prior version/history when updated.

Briefs must not invent metrics, leak private evidence, expose raw diagnostics
in owner UI, or overwrite prior brief history on failure.

Read models translate raw tables and events into product objects before React
renders them. Components should render product objects, briefs, selectors, and
details. They should not assemble business meaning directly from raw jobs,
logs, or database table names.

## Card Contract

Cards are receipts, not dashboards. A card must answer:

1. What is this?
2. Why does it matter now?
3. What is the one obvious next action?
4. Is it public, private, draft, blocked, running, or ready?
5. Where can the user inspect how it happened?

Card limits:

- one primary action
- no more than three secondary actions
- no more than four metrics
- no raw job ids as primary copy
- no fabricated metrics
- no destructive or public action without confirmation

## Detail Lens Contract

Every important object should have the same mental detail shape.

Required lenses where applicable:

- Overview
- Provenance
- Relationship Trail
- Performance
- Actions
- History
- Related
- Visibility

Lens ownership:

- Provenance belongs to work, media, content, offers, and campaigns.
- Relationship Trail belongs to people, conversations, referrals, and deals.
- Performance belongs to public content, offers, links, campaigns, and
  relationship motion.
- Visibility belongs to content, offers, links, cards, and admin/staff views.

## Visibility Contract

Visibility is a product property.

Content should reuse the existing `ContentAudience` model where possible:

- public
- member
- account
- premium
- apprentice
- staff
- admin

Offers need equivalent product rules:

- Public offer: visible to anonymous visitors on public offer surfaces.
- Private offer: visible only to a selected person/account/role plus
  owner/staff/admin.
- Internal draft: owner/staff/admin only until published or sent.

Tracked links and QR codes may only be public for published/shareable objects.
Private or draft objects require a private/share-gated link model.

## Relationship Stage Contract

People should be staged from evidence, not vibes.

The owner-facing stage model is:

1. Visitor
2. Conversation
3. Contact
4. Offer
5. Purchased
6. Follow-up

Implementation can derive those labels from lower-level states:

- anonymous conversation,
- authenticated user,
- referral event,
- lead record,
- consultation request,
- deal record,
- offer selected,
- simulated purchase,
- completed/purchase-equivalent event.

Do not advance a stage without durable evidence. Do not invent PII when the
system only has anonymous activity.

## Operating Loop Contract

The product loop is:

1. The owner or visitor states intent in conversation.
2. Ordo grounds the request in context and evidence.
3. Ordo turns it into governed work.
4. Ordo produces work, content, media, an offer, a link, or a relationship
   outcome.
5. Ordo runs the configured QA/review loop when needed.
6. The owner publishes, shares, sends privately, approves, or follows up.
7. Ordo measures what happened.
8. Today recommends the next useful action.

Every phase in the solopreneur operating-loop series must move one part of
this loop into a simpler product shape.

## Scenario Test Contract

Before the loop is considered implemented, the product must support these
scenarios with deterministic tests or eval artifacts:

### New Owner

- signs in,
- sees Today without clutter,
- creates the first public offer,
- sees a clear next action.

### Offer To Visitor

- owner creates a priced public offer,
- visitor sees it,
- visitor starts a conversation from it,
- person/relationship stage advances from durable evidence.

### Private Proposal

- owner creates a private offer for a person,
- public visitors cannot see it,
- owner can inspect who it was sent to and what happened.

### Content To Result

- owner creates or approves content,
- content is published or staged,
- tracked link/QR is created,
- visit/chat/signup/offer-choice events connect back to the content.

### Studio Provenance

- media/content card links to source work,
- detail view shows how it was made,
- failed or blocked work exposes a repair action without showing raw internals
  as the primary experience.

### Today Brief Decision

- Today shows a concise CEO daily brief,
- the second column lists the evidence and decision items behind the brief,
- selected Today item detail explains why it matters,
- one next action is available through chat or a governed action,
- raw diagnostics stay in System/Admin.

## Cleanup Ledger

These existing surfaces are donors, not the final owner IA:

- `/jobs`
- `/activity`
- `/my/media`
- `/referrals`
- `/operations/media`
- old right workspace drawer
- top-right jobs icon
- top-right notification bell
- library-first public navigation
- account-menu My media/My conversations/My offers/My content links

They may remain as diagnostics, compatibility routes, tests, or admin/staff
views until their useful functionality is absorbed into Today, Studio, People,
Offers, details, or admin.

## Implementation Gate

Before implementation begins for a product-facing phase, the phase must state:

1. Which kernel object it changes.
2. Which existing code anchors it reuses.
3. Which donor routes/components it absorbs.
4. Which visibility rule applies.
5. Which scenario tests it advances.
6. Which stale surface it hides, reframes, or leaves diagnostic.
7. Which progressive disclosure level it changes.
8. Which read model or governed object contract it consumes or creates.

If a phase cannot answer those questions, it is not ready to implement.
