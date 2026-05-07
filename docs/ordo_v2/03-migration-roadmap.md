# Migration Roadmap

Status: draft

This roadmap moves from the current app to Ordo v2 without throwing away useful
work.

## Rule

Backend clarity first. Frontend polish second.

The UI should not get another large redesign until the section data path is
ready.

## Stage 0: Freeze The Current Lesson

Goal:

Record the problem clearly.

Current lesson:

- many UI phases changed labels and frames;
- the product still feels mostly the same;
- Knowledge and other pages reveal that layout work cannot replace real data
  contracts;
- the app needs one change system before another broad UI pass.

Output:

- this `docs/ordo_v2` package;
- GitHub issues for the next work;
- no new markdown phase loop as the main queue.

## Stage 1: Code Archaeology

Goal:

Verify exactly what exists before designing tables or APIs.

Main questions:

- Which brief tables and mappers exist?
- Which event tables exist?
- Which route loaders already produce read models?
- Which Rust commands can already be claimed and reconciled?
- Which tests prove these paths?
- Which UI surfaces still render raw internals?

Output:

- archaeology report;
- route/read-model map;
- database table map;
- Rust/TypeScript boundary map;
- accepted GitHub issues.

See [04 Archaeology Phase](04-archaeology-phase.md).

## Stage 2: Durable Event Log

Goal:

Add one system-wide event log with a global sequence.

Scope:

- table/migration;
- TypeScript event writer;
- tests for ordering, visibility, and source refs;
- no UI redesign yet.

Acceptance:

- events can be written for conversation, work, offer, person, backup, and brief
  changes;
- each event has an owner, visibility, object ref, section refs, and sequence;
- tests prove no private events leak through owner/public readers.

## Stage 3: Inbox And Read State

Goal:

Track what each user has seen.

Scope:

- `user_section_cursors`;
- `user_inbox_items`;
- mark-read APIs;
- tests for per-user read state.

Acceptance:

- left rail badges come from read state, not guessed counts;
- section selectors can show unread or needs-attention state;
- reading one section does not mark unrelated sections read.

## Stage 4: Realtime Changes Endpoint

Goal:

Replace broad polling with precise change checks.

Scope:

- `GET /api/changes?after=sequence`;
- returns affected sections and object refs;
- UI can call it without loading whole dashboards.

Acceptance:

- authenticated user only sees changes they can access;
- anonymous users do not receive owner events;
- response is small and stable.

## Stage 5: Realtime Broker

Goal:

Move from polling/SSE toward the Rust broker.

Scope:

- first keep Next API as a bridge if needed;
- Rust WebSocket broker comes after event log and change API are stable;
- browser subscribes by user/session and refetches changed read models.

Acceptance:

- browser receives update signals after durable writes;
- Rust does not invent product state;
- reconnect can resume from last sequence.

## Stage 6: Section Brief Freshness

Goal:

Make Today, Studio, People, Offers, Knowledge, and System briefs honest and
updateable.

Scope:

- mark brief stale when relevant events arrive;
- enqueue brief update requests;
- deterministic first implementation;
- LLM/local model later.

Acceptance:

- failed brief update does not erase the last good brief;
- brief claims have evidence refs or limitations;
- UI can show as-of and stale/limited state.

## Stage 7: Section-by-Section UI Rebuild

Goal:

Only now rebuild the UI around reliable data.

Order:

1. Conversations
2. Today
3. Studio
4. People
5. Offers
6. Knowledge
7. System
8. Account

Acceptance:

- base route shows the section brief;
- second column shows evidence/items;
- selected route shows one item;
- mobile list/detail works;
- UI updates when backend changes.

## Stage 8: Rust Work Expansion

Goal:

Move heavy work into the daemon after the contracts are stable.

Candidates:

- backup/restore consolidation into `ordo-daemon`;
- media workflow execution;
- local search/indexing;
- WebSocket broker;
- brief executor support.

Acceptance:

- one daemon owns leases and worker loops;
- TypeScript schemas drive IPC contracts;
- crash/restart behavior is tested.

## Stage 9: Public Process

Goal:

Run this through GitHub, not hidden markdown queues.

Process:

```text
issue -> branch -> implementation -> tests -> PR -> review -> merge
```

Acceptance:

- every stage has issues;
- every implementation has a PR;
- every PR lists tests, risks, and screenshots when relevant.
