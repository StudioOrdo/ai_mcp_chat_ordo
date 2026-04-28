# Phase 5: Engine Power

> **Milestone:** After this phase, the job system can schedule work for the future and orchestrate multi-step workflows with dependency tracking. The LLM can say "generate audio and images in parallel, then compose the video when both finish" — and the engine handles it automatically. This is the phase where Ordo stops being a task runner and becomes an orchestrator.

## Status: `[ ] Not Started`

---

## What Ships

### 5A — Scheduled Execution

Consolidates: Spec 06 (scheduled jobs)

Allow jobs to be queued for future execution:

- [ ] Add `executeAt?: string | null` to `JobRequest` in `job.ts`
- [ ] Add `execute_at` column to job queue SQLite schema
- [ ] Update `claimNextQueuedJob` query: `WHERE status = 'queued' AND (execute_at IS NULL OR execute_at <= ?)`
- [ ] Pass current timestamp to claim query in `deferred-job-worker.ts`
- [ ] Update capability schemas for communication tools to accept `schedule_for` parameter
- [ ] Map `schedule_for` to `executeAt` during job enqueue
- [ ] Display scheduled time in job card: "Scheduled for Apr 28 at 10:00 AM"

### 5B — DAG Orchestration

Consolidates: Spec 05 (job orchestration DAGs)

Enable multi-step workflows with dependency tracking:

- [ ] Add `dependencies?: string[]` to `JobRequest` in `job.ts`
- [ ] Add `workflowId?: string | null` to `JobRequest` for grouping child jobs
- [ ] Update `claimNextQueuedJob` query: job is claimable only if all dependency jobs have `status = 'succeeded'`
- [ ] On job completion in worker: check if any pending jobs list this `jobId` as a dependency — if all their dependencies are now met, they become claimable
- [ ] On job failure with exhausted retries: cascade → mark dependent jobs as `failed_dependency` (or `canceled`)
- [ ] Create `src/lib/jobs/workflow-tracker.ts`
  - Track aggregate progress across child jobs under same `workflowId`
  - Emit synthetic `workflow_progress` SSE events
  - Calculate total workflow completion percentage
- [ ] Create a master `WorkflowJob` record that references its children and streams aggregate progress to the UI
- [ ] Display workflow progress in the progress strip: "Media Pipeline · 2 of 3 steps complete"

---

## Verification Checkpoint

```bash
npm run typecheck
npm run test
```

Integration tests:

- [ ] Enqueue a job with `executeAt` 5 minutes in the future → worker ignores it → advance clock → worker claims it
- [ ] Enqueue Job A (audio) and Job B (images) with Job C (compose) depending on both → A and B run in parallel → C starts automatically when both succeed
- [ ] Job B fails and exhausts retries → Job C is automatically marked `canceled` with reason `failed_dependency`
- [ ] Workflow progress strip shows "Media Pipeline · Step 2 of 3" during execution

---

## Files Touched

| Action | File |
| --- | --- |
| MODIFY | `src/core/entities/job.ts` |
| MODIFY | `src/adapters/JobQueueDataMapper.ts` |
| MODIFY | `src/lib/jobs/deferred-job-worker.ts` |
| MODIFY | `src/frameworks/ui/chat/plugins/system/SystemJobCard.tsx` (scheduled time display) |
| MODIFY | `src/frameworks/ui/chat/plugins/system/resolve-progress-strip.ts` (workflow grouping) |
| NEW | `src/lib/jobs/workflow-tracker.ts` |

---

## Depends On

**Phase 1** — entity types and event bus
**Phase 4** — auto-registration (so new workflow-related tools register automatically)

## Unlocks

Future vision work: A2A Networking (Spec 02), Developer Portal (Spec 03), Agentic Contributions (Spec 04)
