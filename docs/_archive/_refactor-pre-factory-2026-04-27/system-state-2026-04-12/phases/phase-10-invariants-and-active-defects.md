# Phase 10 Invariants And Active Defects

> Status: Working note
> Purpose: Keep Phase 10 focused on the broken deferred-job truth surfaces without accidentally reopening lifecycle behaviors that already look healthy.

## Active Defects

- Terminal transcript projection can drift from the canonical job snapshot unless the existing `job_status` message is updated in place on terminal events.
- Long-running editorial work can outlive its lease and become eligible for `lease_recovered` requeue during healthy execution.
- Cancellation is still advisory for editorial work because the worker checks cancel state, but long-running handlers do not receive an abort signal.
- Chat rehydrate is narrow enough to hide older active or failed jobs in busy conversations.
- The signed-in jobs workspace can still regress to older fetched state because reconcile and selected-job refresh paths are not sequence-safe end to end.
- The chat progress strip is not a completion surface, so successful deferred completion depends on the transcript card and jobs surfaces staying truthful and visible.
- Deferred-job forensics and operator guidance are still split across runtime-relative logs, jobs surfaces, and stale copy.
- `prepare_journal_post_for_publish` still mixes post-level readiness with ambient user job activity.

## Preserved Invariants

- Shared job publication remains the canonical projection seam for chat, SSE, and snapshot channels.
- Replay lineage must stay intact: `replayedFromJobId` and `supersededByJobId` are already part of the job model and should not regress while fixing projection truth.
- Deduped replay outcomes remain valid behavior: if equivalent active work already exists, the system should switch the operator to that job instead of creating duplicate work.
- Anonymous-to-signed-in job migration remains valid behavior and should continue to emit `ownership_transferred` audit events.
- Audit-only events should stay audit-only and must not become a second competing visible job-state channel.
- The jobs page and admin job detail surfaces should continue to expose replay, supersession, retry, and cancellation metadata rather than hiding lifecycle history.

## Immediate Use

- Read this note before changing deferred-job projection, replay, or migration behavior.
- If a proposed Phase 10 fix alters an invariant above, treat that as a separate design decision and document it explicitly in the phase packet before landing code.