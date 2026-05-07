# Ordo v2 North Star

Status: draft

## The Product

Ordo is a local operator system.

The user should be able to talk to Ordo, ask what is happening, approve work,
inspect evidence, and understand what changed without learning the machinery
underneath.

Chat is where work starts and continues.

The UI is where the user checks the state of the work.

## The Experience We Want

Every major section should work the same way:

- the main route shows a clear brief for that section;
- the second column lists the things behind the brief;
- selecting an item shows one item, with its evidence and actions;
- the UI updates when the backend changes;
- the user can always ask Ordo what to do next.

The app should not feel like a pile of dashboards. It should feel like a clean
briefing system with drill-down.

## The Backend We Need

The frontend cannot get better by layout alone.

The backend needs one clear update path:

```text
Something happens
-> durable event is written
-> affected read models are marked stale or updated
-> browser gets a small update signal
-> UI fetches the exact changed read model
-> read state is recorded
```

This is the missing piece behind Today, Studio, People, Offers, Knowledge, and
System.

## Single-Image Runtime

Ordo should still ship as one local product image.

That means we should avoid adding Redis, Kafka, RabbitMQ, hosted vector systems,
or other external moving parts unless there is a strong reason.

The better shape is:

- SQLite for durable data;
- Next.js for UI, API routes, auth, business rules, and read models;
- one Rust daemon for long-running work, realtime fanout, backup/restore, and
  heavier processing;
- local files for media, backups, and generated artifacts.

## What Rust Should Own

Rust should own work that is long-running, memory-sensitive, or better managed
outside Node:

- backup and restore execution;
- process supervision;
- realtime broker and WebSocket fanout;
- eventually media execution;
- eventually local search/vector indexing;
- command leases and worker loops.

Rust should not own product meaning. Product meaning stays in TypeScript read
models unless we intentionally move that boundary later.

## What TypeScript Should Own

TypeScript should own:

- auth and route access;
- business rules;
- shell and UI;
- section read models;
- object details;
- prompt/tool grounding;
- tests that prove owner-safe behavior.

TypeScript writes commands and reads results. It should not run every heavy or
long-lived task itself.

## What The User Should See

The user should see:

- Today: what needs attention now;
- Studio: work Ordo is producing;
- People: relationship evidence;
- Offers: commercial state and offer lifecycle;
- Knowledge: useful stored knowledge and references;
- System: admin-only machine health, jobs, backups, restore, and diagnostics;
- Conversations: the operating interface.

The user should not see raw job queues, provider payloads, operation ids, logs,
or half-explained internal records in normal owner screens.

## Hard Rules

1. Do not fake live intelligence.
2. Do not show global totals at the top of selected object detail pages.
3. Do not build one-off UI frames for every section.
4. Do not use markdown phase loops as the active work queue.
5. Do use GitHub issues, branches, PRs, tests, and evidence.
6. Do ground every product claim in code, data, or an honest limitation.
