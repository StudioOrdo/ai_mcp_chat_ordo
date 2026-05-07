# Target System Shape

Status: draft

## One Sentence

Ordo v2 is a local app where every important change is recorded once, projected
into section read models, and pushed to the UI as a small update signal.

## Runtime Layout

```text
Browser
  -> Next.js routes and server actions
  -> SQLite durable store
  -> Rust daemon for long-running work and realtime fanout
  -> Next.js read models
  -> Browser refetches changed sections
```

## Data Flow

### 1. Commands

Commands request work.

Examples:

- create backup;
- restore snapshot;
- compose media;
- update section brief;
- run local search index;
- produce an artifact.

Commands should be durable. A process can crash and resume without losing the
work request.

### 2. Events

Events record what happened.

Examples:

- message created;
- media workflow started;
- media workflow completed;
- offer accepted;
- person relationship updated;
- backup completed;
- brief marked stale;
- brief reconciled.

Events should have a global sequence so the UI can ask:

```text
What changed after sequence 12345?
```

### 3. Read Models

Read models are the UI-facing shape of the data.

Examples:

- Today brief;
- Studio production brief;
- People list and selected person detail;
- Offer list and selected offer detail;
- Knowledge index;
- System health and backup tables.

Read models should hide raw internals from regular owner UI.

### 4. Realtime Invalidation

The browser should not receive huge payloads for every change.

It should receive small update messages:

```json
{
  "sequence": 12346,
  "sections": ["today", "studio"],
  "objects": [
    { "kind": "media_workflow", "id": "mwf_123" }
  ]
}
```

Then the browser refetches the right read model.

This keeps memory and network use low.

## SQLite Tables To Design

Names are draft.

### `system_events`

Durable event log.

Important fields:

- `id`
- `sequence`
- `type`
- `occurred_at`
- `actor_user_id`
- `owner_user_id`
- `object_kind`
- `object_id`
- `section_ids_json`
- `visibility`
- `summary`
- `source_refs_json`
- `payload_json`

### `user_section_cursors`

Tracks what each user has seen per section.

Important fields:

- `user_id`
- `section_id`
- `last_seen_sequence`
- `updated_at`

### `user_inbox_items`

Tracks durable attention items.

Important fields:

- `id`
- `user_id`
- `section_id`
- `object_kind`
- `object_id`
- `intent`
- `title`
- `summary`
- `status`
- `event_sequence`
- `read_at`
- `dismissed_at`

### `brief_update_requests`

Already exists conceptually in TypeScript entities. Needs table/code audit.

### `section_briefs`

Already exists conceptually in TypeScript entities. Needs table/code audit.

## Rust Daemon Responsibilities

The target is one daemon, not many small services.

Rust daemon tasks:

- claim native commands;
- run backup and restore work;
- supervise long-running work;
- push realtime invalidation over WebSocket;
- later run media processing;
- later run local search/index work.

The Rust daemon should not decide product copy for the owner UI.

## Next.js Responsibilities

Next.js tasks:

- enforce auth and access;
- create commands;
- write product events;
- maintain read models;
- render UI;
- expose selected object detail APIs;
- expose section brief APIs;
- perform owner-safe copy and visibility filtering.

## Borrowed System Ideas

We should borrow proven ideas without adding heavy dependencies.

### Redis Streams

Use the idea of ordered event ids and consumer cursors.

Do not add Redis yet.

### Kafka

Use the idea of an append-only log and projections.

Do not add Kafka.

### Postgres LISTEN/NOTIFY

Use the rule: write durable data first, notify second.

### Email Inbox

Use separate read state. The event existing and the user seeing it are different
facts.

## What This Fixes

This system fixes the current frontend problem because the UI stops guessing.

Today does not have to make up a daily brief from scattered records.

Studio does not have to look like a raw job list.

People does not have to scrape relationship meaning from every route.

Offers can show lifecycle state only when events support it.

Knowledge can become a real surface instead of a loose page.

System can show diagnostics behind the right gates.
