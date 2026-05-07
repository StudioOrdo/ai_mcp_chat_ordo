# Current Briefs Map

Issue: https://github.com/StudioOrdo/ai_mcp_chat_ordo/issues/1

Status: initial archaeology evidence

## Summary

Brief infrastructure is farther along than the UI suggests.

The repo already has:

- section brief entities;
- evidence manifests;
- brief events;
- durable update requests;
- durable update results;
- leases;
- deterministic fallback generation;
- reconcile behavior that avoids overwriting the current brief on failure.

The missing piece is not the brief entity. The missing piece is integration with
the rest of the product event system.

## Core Entities

Code anchors:

- `src/core/entities/brief.ts`
- `src/core/entities/brief-execution.ts`

What is real:

- `SectionBrief`
- `BriefEvidenceManifest`
- `BriefEvidenceRef`
- `BriefReadModelEvent`
- `BriefUpdateRequest`
- `DurableBriefUpdateRequest`
- `BriefUpdateResult`
- `StoredBriefUpdateResult`

Important validation:

- Brief update requests must include a section or object scope.
- Brief update requests have visibility policy.
- Executor kinds include deterministic, llm, local model, and rust native.
- Results must match request ids.
- Succeeded/limited results require staged brief and manifest evidence.

## Storage

Code anchors:

- `src/adapters/BriefReadModelDataMapper.ts`
- `src/adapters/BriefUpdateRequestDataMapper.ts`
- `src/adapters/BriefReadModelDataMapper.test.ts`
- `src/adapters/BriefUpdateRequestDataMapper.test.ts`
- `src/lib/db/tables.ts`

Tables:

- `brief_read_models`
- `brief_events`
- `brief_update_requests`
- `brief_update_results`

What is real:

- Briefs are stored by scope.
- Current brief is tracked.
- Brief events include created, updated, failed, and stale states.
- Update requests can be claimed with a lease.
- Expired leases can be recovered.
- Results can be staged.

## Execution

Code anchors:

- `src/lib/briefs/brief-update-executor.ts`
- `src/lib/briefs/brief-update-reconciler.ts`
- `src/lib/briefs/section-brief-resolver.ts`
- `src/lib/briefs/brief-update-executor.test.ts`
- `src/lib/briefs/brief-update-reconciler.test.ts`
- `src/lib/briefs/section-brief-resolver.test.ts`

What is real:

- Executor claims the next pending brief update.
- Executor gathers evidence.
- Executor finds the prior brief.
- Executor can generate a deterministic draft.
- Executor stages result.
- Reconciler saves succeeded results.
- Failed results do not replace current brief.

## Gaps

Missing or incomplete:

- event-driven stale marking;
- durable product event sources for every section;
- section brief status shown consistently in UI;
- model-backed generation policy;
- background scheduling policy;
- owner-safe evidence windows per section;
- UI refresh when a brief changes.

## Recommended Next Brief Work

Do not start with LLM brief generation.

Start with:

1. product events mark affected section briefs stale;
2. deterministic update requests prove the pipeline;
3. UI shows current/stale/limited state honestly;
4. later add LLM/local model generation behind the same request/result/reconcile
   boundary.

## Brief Conclusion

The current brief system is a good foundation. It should become the section
brief engine for Ordo v2 after the event log exists.
