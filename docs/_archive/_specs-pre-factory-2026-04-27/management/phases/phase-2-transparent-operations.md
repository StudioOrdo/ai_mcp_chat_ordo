# Phase 2: Transparent Operations

> **Milestone:** After this phase, users can see what the job system is doing - retry counts, failure classes, elapsed timers, countdown clocks - and they can control it with cancel/retry buttons directly on cards and in the progress strip. This is the first phase where the user notices a difference.
> **Repo note:** The current codebase already has the Phase 1 store/SSE foundation, partial job-action wiring, and Phase 0 media-repair metadata. Phase 2 is therefore primarily a rendering, interaction, and explanation pass over infrastructure that already exists.

## Status: `[x] Complete`

---

## What Ships

### 2A — Job Transparency Rendering

Consolidates: Spec 09 (UI rendering portion)

Render the transparency data that Phase 1 added to `JobStatusMessagePart`:

- [x] Extended the existing `SystemJobCard` compact row and expanded body to display attempt, timing, retry, and checkpoint transparency
- [x] Extended `SystemJobCard` and `CapabilityErrorCard` to present `failureClass` with human-readable copy and shared tone handling
- [x] Display running/completed timing context from `startedAt` and `completedAt`
- [x] Display retry countdown / retry-state messaging when `nextRetryAt` is set
- [x] Display checkpoint resume indicators and richer failure context in the shared system-card path
- [x] Preserve worker and replay metadata in the expandable detail surface

### 2B — In-Message Job Actions

Consolidates: Spec 11 (card actions)

Add cancel/retry buttons directly on job cards:

- [x] Extended the existing `buildJobStatusActions()` / `CapabilityActionRail` path instead of creating a second job-action pipeline
- [x] Preserved the current `onActionClick` -> `POST /api/chat/jobs/[jobId]` and `POST /api/jobs/[jobId]` delegation path through the shared Phase 1 executor
- [x] Added inline cancel confirmation instead of a one-click cancel affordance
- [x] Added recovery-oriented retry copy for terminal and dead-letter style failure states

### 2C — Progress Strip Upgrade

Consolidates: Spec 11 (strip enhancements)

Transform the strip from a passive notification bar to a job command center:

- [x] Built on the existing store-backed `resolveProgressStripFromStore()` and `ChatProgressStrip` rather than reintroducing transcript scans
- [x] Added a "Go to message" action that scrolls to the transcript anchor and applies a transient highlight pulse
- [x] Added Cancel to the strip detail panel alongside retry/state actions
- [x] Added `failureClass`, `attemptCount`, retry/detail copy, and richer item metadata to the strip panel
- [x] Added inline cancel confirmation in the strip panel
- [x] Added pin/bookmark toggle persisted to `localStorage` by conversation
- [x] Kept pinned jobs visible regardless of terminal status
- [x] Added pin markers for pinned job bubbles/detail state

### 2D — Scroll-to-Message Infrastructure

- [x] Added stable assistant-message job anchoring for job-bearing tool parts
- [x] Added `scrollToJobMessage(jobId)` with `scrollIntoView`, focus-safe behavior, and transient highlight state
- [x] Added `.ui-chat-message-highlight` pulse styling with reduced-motion-safe behavior

### 2E — Phase 0 Repair Transparency Carryover

Carry forward the Phase 0 media canonicalizer work so repaired asset references are explainable instead of silently buried in JSON:

- [x] Surface muted user-facing repair notes when a job result includes `replaySnapshot.repairs`
- [x] Translate repair strategies like `underscore_normalization`, `uuid_fragment`, and `kind_singleton` into readable copy
- [x] Keep repair notes informative rather than alarming: explain what was matched and why execution could continue
- [x] Prefer structured detail-drawer rendering over raw JSON where possible

---

## Verification Checkpoint

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

npm run verify
```

Verification result:

- [x] Full repo `npm run verify` passed: lint, TypeScript, and Vitest all green on the latest run
- [x] Focused strip coverage validated go-to-message, cancel/retry detail actions, pin persistence, and highlighted transcript navigation
- [x] Focused system-card coverage validated transparency copy, failure-class rendering, cancel confirmation, and repair-note rendering
- [x] Shared job routes and executor coverage remained green while preserving the Phase 1 action path
- [x] Repo-level cleanup during closeout fixed stale test harnesses and mock contracts so the phase stays green under the full suite

---

## Files Touched

| Action | File |
| --- | --- |
| MODIFY | `src/frameworks/ui/chat/plugins/system/SystemJobCard.tsx` |
| MODIFY | `src/frameworks/ui/chat/plugins/system/CapabilityErrorCard.tsx` |
| MODIFY | `src/frameworks/ui/chat/plugins/system/ChatProgressStrip.tsx` |
| MODIFY | `src/frameworks/ui/chat/plugins/system/resolve-progress-strip.ts` |
| MODIFY | `src/frameworks/ui/useChatSurfaceState.tsx` |
| MODIFY | `src/frameworks/ui/chat/bubbles/AssistantBubble.tsx` |
| MODIFY | `src/lib/chat/scrollToJobMessage.ts` |
| MODIFY | `src/frameworks/ui/chat/plugins/system/job-transparency.ts` |
| MODIFY | `src/lib/chat/JobActionResolvers.ts` |

---

## Depends On

**Phase 1** — entity types, job state store, event bus, SSE catch-up

Also reuses Phase 0 media repair metadata where result envelopes already carry canonicalization details.

## Unlocks

Phase 3 (Visual Polish), Phase 4 (Platform Maturity)
