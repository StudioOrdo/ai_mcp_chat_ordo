# GitHub Manufacturing Plan

Status: draft

This plan turns Ordo v2 into visible work.

Markdown explains the direction. GitHub issues and pull requests carry the work.

## Repository

Target repository:

```text
StudioOrdo/ai_mcp_chat_ordo
```

## Issue Set

Create these issues first.

### 1. Ordo v2 archaeology report

Type:

- `type:architecture`
- `status:accepted`

Goal:

Audit current Rust, TypeScript, database, event, brief, and read-model code.

Output:

- evidence maps under `docs/ordo_v2/evidence/`;
- accepted small implementation issues.

### 2. Durable system event log

Type:

- `type:implementation`
- `surface:system`
- `governance:evidence`

Goal:

Add a global event log with ordered sequence numbers, owner/visibility fields,
object refs, section refs, and source refs.

Non-goals:

- no UI redesign;
- no Rust broker;
- no LLM summaries.

### 3. User inbox and read state

Type:

- `type:implementation`
- `surface:today`
- `governance:evidence`

Goal:

Track what each user has seen by section and item.

Non-goals:

- no notification service;
- no email;
- no fake urgency.

### 4. Changes API

Type:

- `type:implementation`
- `surface:chat`
- `surface:today`

Goal:

Add an authenticated endpoint that returns changes after a sequence.

Non-goals:

- no WebSocket yet;
- no full payload streaming.

### 5. Brief freshness pipeline

Type:

- `type:implementation`
- `surface:today`
- `surface:studio`
- `surface:people`
- `surface:offers`
- `surface:knowledge`

Goal:

Mark section briefs stale when relevant events happen and enqueue durable brief
updates.

Non-goals:

- no fake live intelligence;
- no model integration until deterministic path is proven.

### 6. Rust realtime broker plan and spike

Type:

- `type:architecture`
- `type:implementation`
- `surface:chat`

Goal:

Use Rust for reconnectable realtime fanout after durable event storage exists.

Non-goals:

- no direct product state in Rust;
- no replacement of all routes.

### 7. Studio produced work read model

Type:

- `type:implementation`
- `surface:studio`

Goal:

Make Studio render produced work from a cleaner read model with object-specific
actions, provenance, and media playback.

Non-goals:

- no new media generation;
- no admin job queue UI in owner Studio.

### 8. Knowledge surface from real sources

Type:

- `type:implementation`
- `surface:knowledge`

Goal:

Build Knowledge from real stored content, references, conversation memory, or a
clear empty state.

Non-goals:

- no fake knowledge base;
- no unformatted raw markdown dump.

## Branch Pattern

Use short branches:

```text
v2/archaeology
v2/system-events
v2/user-inbox
v2/changes-api
v2/brief-freshness
v2/rust-realtime-spike
v2/studio-work-read-model
v2/knowledge-surface
```

## Pull Request Standard

Each PR should include:

- linked issue;
- goal;
- files changed;
- tests run;
- QA findings;
- screenshots when UI changed;
- remaining risks;
- follow-up issues.

## Labels

Use existing labels where possible:

- `status:needs-triage`
- `status:accepted`
- `status:in-progress`
- `status:needs-functional-review`
- `type:architecture`
- `type:implementation`
- `type:ux`
- `type:bug`
- `surface:chat`
- `surface:today`
- `surface:studio`
- `surface:people`
- `surface:offers`
- `surface:knowledge`
- `surface:system`
- `governance:evidence`
- `governance:privacy`
- `governance:no-fake-intelligence`

## First Command Set

After this package is reviewed, create the first issue:

```bash
gh issue create \
  --repo StudioOrdo/ai_mcp_chat_ordo \
  --title "Ordo v2 archaeology report" \
  --label "type:architecture,status:accepted,governance:evidence" \
  --body-file docs/ordo_v2/04-archaeology-phase.md
```

Then create a branch:

```bash
git checkout -b v2/archaeology
```

## Stop Rule

Do not implement the event log until the archaeology issue is complete.

The event log should be designed from the actual schema and tests, not from a
guess.
