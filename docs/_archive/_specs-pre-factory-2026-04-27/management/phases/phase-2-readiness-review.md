# Phase 2 Readiness Review

> Repo-grounded assessment for [Phase 2: Transparent Operations](./phase-2-transparent-operations.md).
> Historical note: this document captured the pre-implementation assessment. Phase 2 is now complete, including the progress-strip upgrade, transcript navigation/pinning, shared card transparency updates, and Phase 0 repair-note rendering, with `npm run verify` passing on the latest closeout run.

---

## Summary

Phase 2 is complete as a user-visible milestone. The notes below remain useful as implementation history and as a record of the seams the work was built on.

What is already present:

- Job state is already store-backed through `useJobStateStore()` in [src/hooks/chat/useJobStateStore.ts](../../../../src/hooks/chat/useJobStateStore.ts), exposed through [src/hooks/useGlobalChat.tsx](../../../../src/hooks/useGlobalChat.tsx), and consumed by [src/frameworks/ui/useChatSurfaceState.tsx](../../../../src/frameworks/ui/useChatSurfaceState.tsx).
- The progress strip already resolves from job state through [src/frameworks/ui/chat/plugins/system/resolve-progress-strip.ts](../../../../src/frameworks/ui/chat/plugins/system/resolve-progress-strip.ts) and renders through [src/frameworks/ui/chat/plugins/system/ChatProgressStrip.tsx](../../../../src/frameworks/ui/chat/plugins/system/ChatProgressStrip.tsx).
- Job cards and error cards already exist in [src/frameworks/ui/chat/plugins/system/SystemJobCard.tsx](../../../../src/frameworks/ui/chat/plugins/system/SystemJobCard.tsx) and [src/frameworks/ui/chat/plugins/system/CapabilityErrorCard.tsx](../../../../src/frameworks/ui/chat/plugins/system/CapabilityErrorCard.tsx).
- Cancel and retry actions already route through the shared Phase 1 executor via [src/lib/chat/JobActionResolvers.ts](../../../../src/lib/chat/JobActionResolvers.ts), [src/app/api/chat/jobs/[jobId]/route.ts](../../../../src/app/api/chat/jobs/[jobId]/route.ts), and [src/app/api/jobs/[jobId]/route.ts](../../../../src/app/api/jobs/[jobId]/route.ts).
- Phase 0 media canonicalization repairs already survive into runtime result metadata through `replaySnapshot.repairs` for browser and media execution paths.

What is actually missing:

- The cards do not yet render attempt counts, elapsed time, total duration, retry countdowns, or checkpoint-resume indicators.
- The strip does not yet expose go-to-message, cancel, pinning, or richer failure/retry detail.
- There is no inline confirmation flow for cancel actions.
- There is no scroll-to-message anchor or highlight animation for job-focused navigation.
- Repair metadata from Phase 0 is still effectively raw JSON rather than guided transparency copy.

Highest-risk assumptions in the current Phase 2 doc:

- Phase 2 does not need a new job-action pipeline. The existing `buildJobStatusActions()` plus `CapabilityActionRail` path is already the right seam.
- The progress strip is no longer transcript-derived. Any Phase 2 strip work should extend the store-backed resolver, not the legacy message scan path.
- Phase 0 repair transparency is partly a rendering problem, not a backend problem. The metadata already exists in several execution paths.

---

## Readiness By Slice

### 2A — Job Transparency Rendering

Current state:

- `JobStatusMessagePart` already carries `attemptCount`, `maxAttempts`, `nextRetryAt`, `startedAt`, `completedAt`, `failureClass`, `recoveryMode`, and `lastCheckpointId` in [src/core/entities/message-parts.ts](../../../../src/core/entities/message-parts.ts).
- [SystemJobCard](../../../../src/frameworks/ui/chat/plugins/system/SystemJobCard.tsx) currently shows only generic status, progress label, percent, summary, and expandable detail-drawer snapshots.
- [CapabilityErrorCard](../../../../src/frameworks/ui/chat/plugins/system/CapabilityErrorCard.tsx) already surfaces `failureClass` and `recoveryMode`, but only as plain context rows.

Assessment:

- This is the real Phase 2 blocker. Until the cards render the richer timing and retry state, users still do not experience the Phase 2 milestone.
- The safest first implementation target is `SystemJobCard` because it already owns both compact-row and expanded-body layouts.

Recommended implementation target:

- Start here.

### 2B — In-Message Job Actions

Current state:

- `buildJobStatusActions()` already computes Cancel or Retry actions in [src/lib/chat/JobActionResolvers.ts](../../../../src/lib/chat/JobActionResolvers.ts).
- `CapabilityActionRail` is already rendered by both [SystemJobCard](../../../../src/frameworks/ui/chat/plugins/system/SystemJobCard.tsx) and [CapabilityErrorCard](../../../../src/frameworks/ui/chat/plugins/system/CapabilityErrorCard.tsx).
- The shared executor already handles cancel and retry through [src/lib/jobs/job-action-executor.ts](../../../../src/lib/jobs/job-action-executor.ts).

Assessment:

- This slice is more about interaction refinement than new plumbing.
- The main missing behavior is inline confirmation and better copy for dead-letter recovery.

Recommended implementation target:

- Do this immediately after 2A so the new card layouts have room for confirmation state.

### 2C — Progress Strip Upgrade

Current state:

- The strip already renders visible and overflow items through [ChatProgressStrip](../../../../src/frameworks/ui/chat/plugins/system/ChatProgressStrip.tsx).
- The resolver already computes `canRetryWholeJob`, status ordering, and store-backed strip items in [resolve-progress-strip.ts](../../../../src/frameworks/ui/chat/plugins/system/resolve-progress-strip.ts).
- The strip still behaves mostly like a passive status summary. It has retry-only detail actions and no transcript navigation or pinning.

Assessment:

- This slice should extend the existing strip rather than rewrite it.
- Pinning is the only part that introduces new persistence and should stay local to the conversation/browser layer unless product requirements change.

Recommended implementation target:

- Do this after 2A and 2B so the strip can reuse the same transparency language and action semantics as the cards.

### 2D — Scroll-to-Message Infrastructure

Current state:

- Assistant messages in [src/frameworks/ui/chat/bubbles/AssistantBubble.tsx](../../../../src/frameworks/ui/chat/bubbles/AssistantBubble.tsx) do not yet expose a job-specific DOM anchor.
- There is no dedicated `scrollToJobMessage(jobId)` helper or highlight class in [src/app/styles/chat.css](../../../../src/app/styles/chat.css).

Assessment:

- This slice is still cleanly greenfield.
- It is a good small follow-up once the strip has a concrete go-to-message action to invoke it.

Recommended implementation target:

- Do this as the enabling step for the strip's navigation affordance.

### 2E — Phase 0 Repair Transparency Carryover

Current state:

- Phase 0 added `AssetReferenceRepair[]` and canonicalization repair strategies in [src/lib/media/ffmpeg/media-composition-plan.ts](../../../../src/lib/media/ffmpeg/media-composition-plan.ts).
- Browser/runtime materialization paths already preserve `repairs` in [src/hooks/chat/composeMediaMaterializationCore.ts](../../../../src/hooks/chat/composeMediaMaterializationCore.ts) and [src/lib/media/browser-runtime/ffmpeg-browser-executor.ts](../../../../src/lib/media/browser-runtime/ffmpeg-browser-executor.ts).
- System job detail drawers currently expose `replaySnapshot` as raw JSON in [SystemJobCard](../../../../src/frameworks/ui/chat/plugins/system/SystemJobCard.tsx), which proves the data is present but not yet usefully explained.

Assessment:

- This is a genuine Phase 2 transparency win, but it should be treated as a carryover slice, not as a prerequisite for the entire phase.
- The best first cut is a muted explanatory note in the job detail drawer, not a full specialized media-inspector UI.

Recommended implementation target:

- Land after 2A so the formatting utilities and tone conventions already exist.

---

## Recommended Execution Order

1. Card-level transparency rendering.
   - Extend [src/frameworks/ui/chat/plugins/system/SystemJobCard.tsx](../../../../src/frameworks/ui/chat/plugins/system/SystemJobCard.tsx).
   - Extend [src/frameworks/ui/chat/plugins/system/CapabilityErrorCard.tsx](../../../../src/frameworks/ui/chat/plugins/system/CapabilityErrorCard.tsx).
   - Add timing, retry, and failure-class formatting helpers near the system-card rendering path.

2. Inline action refinement.
   - Extend [src/lib/chat/JobActionResolvers.ts](../../../../src/lib/chat/JobActionResolvers.ts) only as needed.
   - Keep [src/lib/jobs/job-action-executor.ts](../../../../src/lib/jobs/job-action-executor.ts) as the single executor seam.
   - Add inline cancel confirmation in the card components rather than inventing a second dialog layer.

3. Progress strip command-center upgrade.
   - Extend [src/frameworks/ui/chat/plugins/system/resolve-progress-strip.ts](../../../../src/frameworks/ui/chat/plugins/system/resolve-progress-strip.ts).
   - Extend [src/frameworks/ui/chat/plugins/system/ChatProgressStrip.tsx](../../../../src/frameworks/ui/chat/plugins/system/ChatProgressStrip.tsx).
   - Add pin persistence locally.

4. Scroll targeting and highlight.
   - Add job message anchors in [src/frameworks/ui/chat/bubbles/AssistantBubble.tsx](../../../../src/frameworks/ui/chat/bubbles/AssistantBubble.tsx).
   - Add the highlight animation in [src/app/styles/chat.css](../../../../src/app/styles/chat.css).

5. Phase 0 repair transparency.
   - Reuse the repair metadata already carried in replay snapshots.
   - Prefer structured explanatory rendering over raw JSON.

---

## Suggested Verification Bundle

Run these first while implementing Phase 2:

```bash
npx vitest run \
  src/frameworks/ui/chat/plugins/system/SystemJobCard.test.tsx \
  src/frameworks/ui/chat/plugins/system/ChatProgressStrip.test.tsx \
  src/frameworks/ui/chat/plugins/system/resolve-progress-strip.test.ts \
  src/frameworks/ui/useChatSurfaceState.test.tsx \
  src/hooks/useGlobalChat.test.tsx \
  src/lib/jobs/job-action-executor.test.ts \
  src/app/api/chat/jobs/[jobId]/route.test.ts \
  src/app/api/jobs/[jobId]/route.test.ts
```

Then run the phase-level gate:

```bash
npm run verify
```

---

## Recommended Doc Adjustments For Phase 2

If the main phase doc is updated later, tighten the wording in these places:

- Rephrase 2A from "render the transparency data that Phase 1 added" to "extend the existing cards to expose the transparency data already present in Phase 1 payloads."
- Rephrase 2B from "create computeJobActions" to "extend the existing job-action resolver and confirmation UX."
- Add an explicit Phase 0 carryover note so repair metadata surfacing does not get lost between phase documents.
