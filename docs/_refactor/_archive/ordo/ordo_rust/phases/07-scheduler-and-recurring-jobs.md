# Phase 07: Scheduler And Recurring Jobs

Status: Planned

## Goal

Add recurring task scheduling in Rust by inserting observable jobs into the
existing queue. Scheduling chooses when work should be queued; the job engine
still owns execution, retry, progress, and failure visibility.

## Current Code To Refresh

- `scripts/process-backup-scheduler.ts`
- job queue schema and scheduled/recurring task records.
- admin backup and operations surfaces.
- existing retention, cleanup, and background intelligence scripts.

## Implementation Scope

- Add cron configuration source and ownership rules.
- Add scheduler task in `ordo-daemon` gated by feature flag.
- Insert scheduled work into `job_queue` with the same payload contracts as
  user-triggered work.
- Add singleton scheduler locking to prevent duplicate insertions.
- Add missed-run and duplicate-run behavior.

## Out Of Scope

- Executing scheduled business work directly in the scheduler.
- Hiding scheduled jobs from normal job observability.
- Building a full UI scheduler editor before backend behavior is proven.

## Required Tests

Positive:

- cron trigger inserts one job;
- inserted job is picked up by the normal job engine;
- scheduled job appears in existing admin/system visibility.

Negative:

- duplicate daemon instances do not duplicate jobs;
- invalid cron config disables the schedule with diagnostics;
- disabled flag prevents scheduler activity.

Edge:

- missed run after restart;
- daylight saving or timezone configuration;
- database lock during insertion retries safely.

## Exit Criteria

- Recurring work follows the same command/result/reconcile discipline as
  on-demand work.
- Scheduler behavior is observable and reversible.
