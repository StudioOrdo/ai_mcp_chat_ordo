# 02 UI Surface Realignment: Studio, Jobs, And Background Briefs

Status: Draft spec

## Goal

Consolidate production work into Studio while keeping raw jobs and operations as
admin/system diagnostics. Define how background jobs update briefs using the
same durable command/result/reconcile pattern as backup and restore.

## Current Code Grounding

Current anchors:

- `src/lib/studio/load-studio-workspace.ts`
- `src/components/studio/StudioWorkspace.tsx`
- `src/lib/jobs/load-user-jobs-workspace.ts`
- `src/components/jobs/JobsWorkspace.tsx`
- `src/app/jobs/page.tsx`
- `src/lib/operations/operation-workspace-loader.ts`
- `src/components/media/UserMediaWorkspace.tsx`
- `src/app/my/media/page.tsx`
- `src/lib/media/user-media.ts`
- `src/components/media/MediaAssetDetail.tsx`
- `src/lib/briefs/brief-update-executor.ts`
- `src/lib/briefs/brief-update-reconciler.ts`
- `src/lib/appliance/backup/backup-command-service.ts`
- `src/lib/admin/system/load-admin-system-workspace.ts`
- `crates/ordo-backup`

## Verified Current State

- Studio read model already merges workflows, jobs, media assets, content, and
  campaigns into object cards.
- Studio uses `GovernanceSectionFrame`.
- Studio selected media detail can render `MediaAssetDetail`.
- `/my/media` has a separate media selector/detail UI and should be a donor or
  redirect after Studio owns media inspection.
- `/jobs` exists as a user jobs workspace but should not be a primary owner app.
- System/Admin already has a Jobs section with raw diagnostics.
- Brief executor/reconciler exists and mirrors the durable request/result shape.
- Backup command service creates durable system commands and pending snapshots,
  providing the model for future background brief generation.

## Target Behavior

Studio owns:

- work Ordo is doing;
- work Ordo completed;
- media;
- content;
- campaigns;
- workflows;
- jobs-as-work projections;
- provenance for produced artifacts.

Jobs owns:

- admin/system diagnostics;
- queue pressure;
- failed/retryable work;
- raw job ids and payload context, role-gated only.

Background briefs:

- background processes create durable brief update requests;
- executors gather evidence, generate a result, stage it, and reconcile it;
- failed brief updates do not overwrite prior briefs;
- owner surfaces show brief status and evidence refs, not raw executor logs.

Studio detail:

- one selected work/media/content/campaign item;
- provenance/trail;
- preview/player where appropriate;
- controls appropriate for object type;
- related offer/person/campaign refs when available.

## Reuse / Move / Hide / Mock Decisions

- Reuse Studio as the canonical work/media/content/campaign surface.
- Move `/my/media` functionality into Studio and retire/redirect `/my/media`.
- Hide `/jobs` from owner primary nav; keep admin Jobs.
- Reuse `BriefUpdateExecutor` and `BriefUpdateReconciler` for background
  intelligence updates.
- Reuse backup/restore command semantics for durability and auditability.

## Positive Tests

- Studio selector includes media, workflow, content, and campaign objects.
- Selected media detail renders one asset and does not show global media totals
  above it.
- Owner-safe Studio cards do not expose raw job ids as primary copy.
- Admin System Jobs section can expose raw job diagnostics behind admin gate.
- Brief update executor stages and reconciles successful results.

## Negative Tests

- `/my/media` is not linked from account menu or owner rail.
- Owner Studio does not require `/jobs` to inspect produced work.
- Owner UI does not show raw payloads, provider config, logs, or system command
  internals.
- Failed brief updates do not replace the current brief.

## Edge Tests

- Media with no workflow still renders as an asset with limited provenance.
- Workflow with no media still renders as work.
- Job with missing operation is owner-safe and links to System/Admin only for
  admin users.
- Brief update with no evidence produces limited result.
- Backup/restore warnings stay admin-only.

## Acceptance Criteria

- Studio is the only owner surface needed to inspect produced work/media.
- Jobs is diagnostic/admin, not owner primary IA.
- Background brief generation is durable, auditable, and failure-safe.
- Owner-facing Studio details are object-centered and provenance-backed.

## Non-Goals

- No full media deletion policy change.
- No new queue engine.
- No new LLM provider integration.
- No raw operations UI in owner surfaces.

## Required Commands

```bash
npx vitest run src/lib/studio/load-studio-workspace.test.ts src/components/studio/StudioWorkspace.test.tsx src/components/media/UserMediaWorkspace.test.tsx src/lib/jobs/load-user-jobs-workspace.test.ts src/components/jobs/JobsWorkspace.test.tsx src/lib/briefs/brief-update-executor.test.ts src/lib/briefs/brief-update-reconciler.test.ts src/lib/appliance/backup/backup-command-service.test.ts src/components/admin/system/AdminSystemWorkspace.test.tsx
npm run typecheck
npm run lint -- src/lib/studio/load-studio-workspace.ts src/components/studio/StudioWorkspace.tsx src/components/media/UserMediaWorkspace.tsx src/lib/jobs/load-user-jobs-workspace.ts src/components/jobs/JobsWorkspace.tsx src/lib/briefs/brief-update-executor.ts src/lib/briefs/brief-update-reconciler.ts src/lib/appliance/backup/backup-command-service.ts
rg -n "my/media|raw job|payload|provider|operation|factory|queue|backup|restore" src/app src/components src/lib
```

## Closeout Evidence Required

- Studio object inventory proving work/media/content/campaign consolidation.
- Route evidence showing `/my/media` is donor/redirected or hidden from nav.
- Test output for Studio, jobs, media, brief executor, and backup command paths.
- Owner/admin screenshots proving raw diagnostics stay behind System/Admin.
