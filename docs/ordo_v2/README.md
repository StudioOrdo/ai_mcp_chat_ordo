# Ordo v2

Status: planning package

This folder is the working north star for the next shape of Ordo.

The goal is simple:

Ordo should feel alive, accurate, and useful because the backend knows what
changed, turns that into clean read models, and updates the UI without making
the user hunt through raw jobs, logs, or half-finished screens.

## Why This Exists

The current app has real pieces:

- chat and conversation APIs;
- Studio work, media, jobs, and workflows;
- People, referrals, offers, and account surfaces;
- backup and restore work split between TypeScript and Rust;
- early brief request/result/reconcile code;
- SSE-style job event streams.

The problem is that these pieces do not yet add up to a product that feels
coherent. Too much frontend work has changed labels and layouts without giving
the UI better data. Ordo v2 starts from the backend shape we need, then plans
the frontend around that.

## Documents

- [00 North Star](00-north-star.md)
- [01 Current Code Grounding](01-current-code-grounding.md)
- [02 Target System Shape](02-target-system-shape.md)
- [03 Migration Roadmap](03-migration-roadmap.md)
- [04 Archaeology Phase](04-archaeology-phase.md)
- [05 GitHub Manufacturing Plan](05-github-manufacturing-plan.md)

## Evidence

The first archaeology issue is
[#1 Ordo v2 archaeology report](https://github.com/StudioOrdo/ai_mcp_chat_ordo/issues/1).

Initial evidence maps:

- [Current Runtime Map](evidence/current-runtime-map.md)
- [Current Database Map](evidence/current-database-map.md)
- [Current Read Model Map](evidence/current-read-model-map.md)
- [Current Realtime Map](evidence/current-realtime-map.md)
- [Current Briefs Map](evidence/current-briefs-map.md)

## Working Rule

Do not start another large UI sweep until the data path is clear.

For each section of the app, we need:

1. durable events;
2. read state;
3. section brief state;
4. selected object detail state;
5. realtime invalidation;
6. tests that prove the UI is rendering the product read model, not guessing.

## Current Priority

Plan the move from the current Next/Rust split to a single-image product where:

- TypeScript owns business rules, routes, auth, and UI read models;
- Rust owns long-running local work, realtime fanout, backup/restore, and heavy
  processing;
- SQLite is the durable local store;
- GitHub issues and PRs are the visible work process.
