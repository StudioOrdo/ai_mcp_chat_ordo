# Canonical UX Architecture

Status: Normative

Evidence date: 2026-05-05

## Purpose

This document turns the UX canon into an implementation architecture. It is the
bridge between product intent and code phases.

The invariant:

> Chat is the operating interface. UI surfaces are the governance layer.

That means the user tells Ordo what to do in chat, and the UI shows what Ordo
knows, what it did, why it matters, what needs a decision, and where the
evidence lives.

## Architecture Layers

Ordo product work should be shaped through these layers:

1. **Conversation and intent**
   - Chat accepts direction, explains tradeoffs, asks clarifying questions, and
     starts governed work.
2. **Governed execution**
   - Jobs, operations, workflows, tools, factory work, media generation, and
     backup/restore commands execute work durably.
3. **Evidence sources**
   - Conversations, operation events, job events, workflow steps, media files,
     offers, referrals, tracked links, content, backups, restore plans, and
     access rules remain preserved.
4. **Read models**
   - Loaders/projectors translate implementation data into owner-safe product
     objects.
5. **Briefs**
   - Background or deterministic staff reports summarize what matters and link
     every claim to evidence.
6. **Governance surfaces**
   - Today, Studio, People, Offers, About, Account, and System render briefs,
     selectors, details, and actions.
7. **Admin diagnostics**
   - Raw jobs, operations, logs, provider details, keys, and native command
     results stay role-gated.

React components render read models. They should not re-derive business state
from raw tables or local component joins.

## Progressive Disclosure Contract

Every authenticated section uses the same disclosure path:

1. **Chat command**
   - "Ask Ordo to do this."
2. **Section brief**
   - "Here is what matters in this section right now."
3. **Second-column evidence index**
   - "Here are the objects and signals behind the brief."
4. **Selected detail**
   - "Here is one object, its current state, and the next action."
5. **Trail or provenance**
   - "Here is why Ordo says this and how the object got here."
6. **Admin diagnostic**
   - "Here are raw jobs, logs, provider/runtime details, and repair controls."

Do not collapse these levels into one dense dashboard. Do not put global totals
above every selected object detail. Do not expose diagnostic nouns in normal
owner UI.

## Canonical Shell

### Public Navigation

The public top navigation is:

- Home through the brand/home route
- Offers
- About
- Feed only when public content exists

No library, jobs, operations, activity, referrals, admin, system, blog, journal,
or corpus links belong in public top navigation.

### Owner Navigation

The authenticated owner rail is:

1. Conversations
2. Today
3. Studio
4. People
5. Offers
6. About

Rules:

- Conversations comes first because chat operates the system. Ordo is the
  active agent conversation; later human/operator handoffs should use the same
  second-column selector pattern.
- Today is the CEO daily brief.
- Studio owns all work Ordo produces.
- People owns relationships, referrals, customer stages, and follow-up.
- Offers owns public and private offers.
- About owns the business/site story.

### Account Menu

The upper-right account menu is for the user's own account context:

- My Account
- Affiliate Dashboard
- Sign out

Theme belongs as a compact toggle in the account menu header. Preferences live
inside My Account rather than as a top-level account-menu item. Change Password
also lives inside the My Account second-column rail rather than as a duplicate
top-level account-menu item. Affiliate Dashboard links to `/referrals` from the
account menu because it is the user's affiliate workspace; QR codes, referral
links, and performance details remain there and in relationship/referral
evidence surfaces, not the profile sidebar.
System belongs in the admin rail, not the account menu. My media,
my conversations, my offers, and my content are not primary account menu items;
those objects belong in Studio, People, and Offers.

### Admin Navigation

Admin/system navigation is role-gated:

- Admin
- Jobs
- System

`Factory`, `operations`, raw logs, provider details, and queue internals are
implementation or diagnostic concepts. They can remain in code and admin
details, but the user-facing rail should use `Jobs` and `System`.

### Mobile

Mobile is not a squeezed desktop:

- top bar shows brand, hamburger/menu, and account avatar;
- hamburger opens owner/admin navigation;
- avatar opens account settings;
- section list and selected detail are separate mobile states;
- selected detail has a clear back-to-list control.

## Section Model

Every major authenticated section should use:

```text
Left rail | Second-column evidence index | Main pane
```

Base route:

- main pane renders the section brief;
- second column shows a compact overview, search/filter, object list, and
  footer count.

Selected object route:

- main pane renders exactly one selected object detail;
- second column stays available as the selector;
- section-wide totals move out of the selected detail.

Canonical sections:

| Section | Brief | Second column | Detail |
| --- | --- | --- | --- |
| Today | CEO daily brief | decision/evidence index | selected Today item |
| Studio | production brief | work/media/content/campaign index | selected produced object |
| People | people brief | person index | relationship detail |
| Offers | offer brief | public/private/draft offer index | offer detail |
| About | business/site brief | public story content sections | public story editor/detail |
| Account | account brief | user info/password/preferences | account section detail |
| System | system brief | admin section index | selected system section |

## Governed Object Contract

Every selected object should be representable as a governed object:

```ts
interface OrdoGovernedObject {
  kind:
    | "brief"
    | "work"
    | "media"
    | "content"
    | "person"
    | "offer"
    | "link"
    | "campaign"
    | "backup"
    | "restore_plan"
    | "system";
  id: string;
  ownerUserId?: string;
  title: string;
  summary: string;
  visibility: "public" | "member" | "account" | "premium" | "apprentice" | "staff" | "admin" | "private" | "draft";
  status: string;
  stage?: string;
  sourceRefs: OrdoSourceRef[];
  evidenceRefs: OrdoSourceRef[];
  actions: OrdoAction[];
  adminDiagnosticHref?: string;
}
```

Owner UI uses the object contract. Admin UI may include additional diagnostics.

## Brief Contract

Briefs are durable staff reports, not decorative summaries.

A brief must include:

- id and version;
- as-of time;
- section or object scope;
- summary bullets;
- recommended next action;
- evidence refs;
- limitations when data is missing;
- visibility policy;
- prior version/history when updated.

A brief must not:

- invent metrics;
- hide missing evidence;
- leak private evidence into public or lower-role surfaces;
- expose raw jobs/logs/provider details in owner UI;
- overwrite prior brief history on failure.

## Brief Execution Pattern

Brief generation should copy the reliability shape of the Rust backup/restore
pipeline:

1. Create a durable request.
2. Validate schema, scope, actor, visibility, and evidence window.
3. Claim work with a lease and recover stale running work.
4. Gather evidence through loaders/read models.
5. Stage a draft brief and evidence manifest.
6. Validate claims against evidence or limitations.
7. Emit audit/activity events.
8. Reconcile successful results into section/object read models.
9. Preserve the prior brief on failure.

Start in TypeScript when iteration speed matters. Use Rust when the work needs
native filesystem scanning, local model execution, hashing, media metadata,
long-running resilience, or deterministic integrity checks.

## Rust Boundary

Rust is preferred for:

- backup and restore;
- local filesystem manifests, hashing, and integrity checks;
- media metadata extraction and future local transcription;
- local model execution where platform performance matters;
- long-running native jobs that should survive Node pressure.

TypeScript is preferred for:

- route handlers;
- UI read models;
- product object projection;
- policy checks that already live in the app;
- fast iteration around conversational workflows.

## Implementation Rules

1. Reuse or reframe existing code before inventing a new surface.
2. Keep product objects separate from raw implementation tables.
3. Keep admin diagnostics role-gated.
4. Keep every action attached to evidence or a durable command.
5. Keep mobile list/detail behavior first-class.
6. Keep public/private/staff/admin visibility explicit.
7. Keep phase docs and evidence docs updated with what actually changed.

## Test Gates

Product-facing phases must include positive, negative, and edge tests for:

- route/access/visibility boundaries;
- second-column selector behavior;
- base brief versus selected detail behavior;
- mobile list/detail back navigation;
- no raw diagnostic leakage in owner/public UI;
- evidence/provenance/trail links;
- stale or missing evidence states;
- no fake metrics or ungrounded claims.
