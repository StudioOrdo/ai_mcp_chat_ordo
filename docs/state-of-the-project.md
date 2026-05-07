# State Of The Project

Date: 2026-05-07

Ordo is in active development toward a July 31, 2026 alpha.

This page is the status page behind the README. It separates what works today
from what is still being shaped.

## What Ordo Is

Ordo is a local web app for one-person businesses.

Chat is the main work area. Behind chat, Ordo has tools for background work,
search, media, QA, local storage, and backup foundations.

The product goal is not “more chat.” The goal is a system that can help a person
run work, keep records, and see what needs attention.

## Working Foundations

These parts exist in the repo today:

### Chat And Tools

Ordo has public and signed-in chat pages. Tools are registered through a
capability catalog instead of being loose prompt text.

Evidence:

- [src/core/capability-catalog/catalog.ts](../src/core/capability-catalog/catalog.ts)
- [src/core/tool-registry/ToolRegistry.ts](../src/core/tool-registry/ToolRegistry.ts)
- [src/lib/jobs/job-capability-registry.ts](../src/lib/jobs/job-capability-registry.ts)

### Background Jobs

Long-running work can be stored as jobs and job events. This lets work continue
outside a single browser request.

Evidence:

- [src/lib/jobs/deferred-job-runtime.ts](../src/lib/jobs/deferred-job-runtime.ts)
- [src/lib/jobs/job-capability-registry.ts](../src/lib/jobs/job-capability-registry.ts)
- [package.json](../package.json)

### Work Orders

The repo has factory-style work order code for staged production work.

Evidence:

- [src/lib/factory/production-orchestrator.ts](../src/lib/factory/production-orchestrator.ts)
- [docs/_business/06_the_production_engine.md](./_business/06_the_production_engine.md)

### QA Reports

QA reports exist as structured product objects.

Evidence:

- [src/core/entities/qa-report.ts](../src/core/entities/qa-report.ts)
- [src/lib/factory/qa-evaluator.ts](../src/lib/factory/qa-evaluator.ts)

### Media Work

The repo includes browser/WASM FFmpeg support and controlled media paths.

Evidence:

- [src/lib/media/browser-runtime/ffmpeg-browser-executor.ts](../src/lib/media/browser-runtime/ffmpeg-browser-executor.ts)
- [package.json](../package.json)

### Search

The repo includes local keyword search, vector search, local embeddings, and
SQLite-backed storage.

Evidence:

- [src/core/search/HybridSearchEngine.ts](../src/core/search/HybridSearchEngine.ts)
- [src/adapters/SQLiteVectorStore.ts](../src/adapters/SQLiteVectorStore.ts)
- [src/adapters/LocalEmbedder.ts](../src/adapters/LocalEmbedder.ts)

### Local Runtime

The default local runtime uses SQLite and local files under `.data`.

Evidence:

- [package.json](../package.json)
- [src/lib/appliance/backup/backup-command-service.ts](../src/lib/appliance/backup/backup-command-service.ts)
- [src/lib/appliance/native/native-command-contract.ts](../src/lib/appliance/native/native-command-contract.ts)

### Backup And Rust

Backup command foundations exist. The repo also includes Rust crates for backup
and daemon work.

This is a foundation, not a promise that every restore path is finished.

Evidence:

- [src/lib/appliance/backup/backup-command-service.ts](../src/lib/appliance/backup/backup-command-service.ts)
- [src/lib/appliance/native/native-command-contract.ts](../src/lib/appliance/native/native-command-contract.ts)
- [Cargo.toml](../Cargo.toml)
- [crates/ordo-backup](../crates/ordo-backup)
- [crates/ordo-daemon](../crates/ordo-daemon)

## In Progress

These areas have real code, but should not be described as finished:

- end-user backup and restore;
- the public GitHub work process;
- the Rust and TypeScript boundary;
- the owner UI for Today, Studio, People, Offers, Knowledge, and System;
- issue-driven QA and release evidence.

## Alpha Track

The July 31, 2026 alpha is aiming for:

- better QA reports;
- clearer public docs;
- better screenshots and release evidence;
- a cleaner local install path;
- less confusing owner UI;
- GitHub issues that carry real evidence.

## What Not To Claim Yet

Do not claim that:

- Ordo creates or fixes GitHub issues without human review;
- the Studio Ordo organization repo is fully cut over;
- the whole app is production-ready for every deployment;
- every idea in [docs/_business](./_business/README.md) is shipped;
- archive docs are the current roadmap.

## How To Help

The best help right now is clear feedback with proof when you have it.

Good reports include:

- what you tried;
- where you tried it;
- what you expected;
- what happened;
- screenshots, logs, command output, or links when useful.

Start with [CONTRIBUTING.md](../CONTRIBUTING.md).

## Source Of Truth

When docs disagree, use this order:

1. Current source code and tests.
2. This status page.
3. The root README.
4. Current business and UX docs.
5. Archive material.
