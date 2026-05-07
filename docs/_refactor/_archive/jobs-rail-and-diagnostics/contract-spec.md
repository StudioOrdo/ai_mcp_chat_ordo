# Jobs Rail And Diagnostic Bundle Contract Spec

Status: ready for implementation
Date: 2026-04-29
Owner surface: chat top chrome, jobs workspace, diagnostic export

## 1. Purpose

Studio Ordo jobs must become a first-class product surface rather than a
collection of progress chips, transcript cards, and admin-like detail panels.

This contract defines the implementation boundary for a Swiss-minimal, real-time
Jobs rail that replaces the current top `Data` control in chat chrome and makes
job recovery, inspection, and diagnostic export clear without turning the UI into
a log viewer.

The UI must show operational truth. The agent conversation must explain context,
diagnosis, and strategy.

## 2. Current Codebase Anchors

Implementation must reuse the existing platform seams instead of creating a
parallel jobs system.

Canonical sources already present:

- `src/frameworks/ui/ChatSurfaceHeader.tsx`: current top chrome seam.
- `src/frameworks/ui/ChatConversationDataMenu.tsx`: current conversation data
  import/export menu to be demoted into utility/overflow behavior.
- `src/frameworks/ui/useChatSurfaceState.tsx`: current hook that already owns
  `jobStateEntries`, progress-strip data, conversation export, and action
  dispatch.
- `src/hooks/chat/useChatJobEvents.ts`: current conversation-scoped SSE and
  reconcile loop.
- `src/hooks/chat/useJobStateStore.ts`: current in-memory job snapshot merge
  store for chat.
- `src/lib/jobs/job-read-model.ts`: canonical `JobStatusSnapshot` builder.
- `src/lib/jobs/job-event-stream.ts`: canonical job-event stream payload mapper.
- `src/core/platform/facade/PlatformInteractionFacade.ts`: timeline and
  revision inspection facade.
- `src/core/platform/facade/AgentPlatformFacade.ts`: revision/action facade.
- `src/core/platform/revision/RevisionContract.ts`: canonical revision action
  contract.
- `src/lib/jobs/manual-replay.ts`: current retry/replay lineage behavior.
- `src/lib/observability/runtime-audit-log.ts`: runtime audit log writer.
- `src/core/use-cases/tools/inspect-runtime-logs.tool.ts`: runtime log reader.
- `src/lib/chat/conversation-portability.ts`: conversation export payload.
- `src/app/api/jobs/events/route.ts`: user-scoped job SSE stream.
- `src/app/api/jobs/[jobId]/route.ts`: user job detail/action API.
- `src/app/api/chat/jobs/[jobId]/route.ts`: chat-scoped job action API.

## 3. Product Contract

### 3.1 Jobs Rail Role

The Jobs rail is the top-level operational surface for active and recent work.
It replaces the visible top `Data` trigger in chat chrome.

The rail must answer only four questions at rest:

1. Is work happening?
2. Does anything need user input?
3. Is the stream live/current?
4. What is the single next action?

The rail must not display raw logs, long error text, JSON payloads, worker
identity, or forensic details at rest.

### 3.2 Agent Conversation Role

The agent conversation owns explanation and strategy.

When a job needs attention, UI actions may seed the composer or invoke an agent
handoff, but the rail itself must remain concise.

Examples:

- Policy/content failure: rail primary action is `Revise`; agent explains why
  retrying the same input is likely not useful.
- Transient failure: rail primary action is `Retry`; agent can summarize what
  changed if asked.
- Unknown failure: rail primary action is `Diagnose`; agent can use the
  diagnostic bundle and job timeline.

### 3.3 Visual Standard

The Jobs rail must follow a Swiss-minimal operational design:

- tight grid alignment
- low ornament
- no nested cards
- restrained color
- hairline separators over heavy shadows
- status color only when meaningful
- no raw backend status vocabulary when plain language exists
- no dominant red unless the state is destructive or terminal
- tabular numbers for counts/progress where practical
- maximum 8px radius for rail rows and drawer rows unless inherited design tokens
  require otherwise

Motion is allowed only to clarify state change.

## 4. User-Facing State Model

Backend statuses remain unchanged:

- `queued`
- `running`
- `succeeded`
- `failed`
- `canceled`
- `dead_letter`

The Jobs rail projects them into product states:

```ts
export type JobsRailItemState =
  | "running"
  | "needs_input"
  | "completed"
  | "history";
```

Projection rules:

| Backend state | Failure class | Rail state | Default label |
| --- | --- | --- | --- |
| `queued` | any | `running` | Queued |
| `running` | any | `running` | Running |
| `succeeded` | any | `completed` | Done |
| `failed` | `policy` | `needs_input` | Needs revision |
| `failed` | `transient` | `needs_input` | Retry available |
| `failed` | `terminal` | `needs_input` | Failed |
| `failed` | `unknown` or null | `needs_input` | Needs review |
| `dead_letter` | any | `needs_input` | Failed |
| `canceled` | any | `history` unless user-visible | Canceled |

Superseded jobs must not appear in the default rail list.

Dismissed and archived jobs must not appear in the default rail list.

## 5. Rail View Model Contract

Create a pure projection module:

`src/frameworks/ui/jobs-rail/resolve-jobs-rail.ts`

It must export:

```ts
export type JobsRailSyncState = "live" | "reconnecting" | "stale" | "unknown";

export type JobsRailPrimaryState =
  | "idle"
  | "running"
  | "needs_input"
  | "completed"
  | "reconnecting";

export type JobsRailActionKind =
  | "open"
  | "cancel"
  | "retry"
  | "revise"
  | "diagnose"
  | "dismiss"
  | "archive"
  | "download_bundle";

export interface JobsRailAction {
  kind: JobsRailActionKind;
  label: string;
  actionType: "route" | "job" | "send";
  value: string;
  params?: Record<string, string>;
  primary: boolean;
}

export interface JobsRailItem {
  jobId: string;
  conversationId: string | null;
  toolName: string;
  title: string;
  subtitle: string | null;
  state: JobsRailItemState;
  statusLabel: string;
  progressLabel: string | null;
  progressPercent: number | null;
  updatedAt: string | null;
  failureClass: "canceled" | "policy" | "terminal" | "transient" | "unknown" | null;
  actions: JobsRailAction[];
}

export interface JobsRailModel {
  primaryState: JobsRailPrimaryState;
  syncState: JobsRailSyncState;
  syncLabel: string;
  activeCount: number;
  attentionCount: number;
  completedCount: number;
  items: JobsRailItem[];
  overflowActions: JobsRailAction[];
}

export interface ResolveJobsRailOptions {
  entries: readonly JobStateEntry[];
  syncState?: JobsRailSyncState;
  conversationId: string | null;
  canExportDiagnostics: boolean;
  maxVisibleItems?: number;
}

export function resolveJobsRail(options: ResolveJobsRailOptions): JobsRailModel;
```

The projection must be deterministic and side-effect free.

## 6. Rail Interaction Contract

### 6.1 At Rest

The compact rail trigger should read like:

```text
Jobs   2 running · 1 needs input   Live
```

If idle:

```text
Jobs   No active work
```

If reconnecting:

```text
Jobs   Reconnecting
```

### 6.2 Drawer Sections

The expanded drawer groups items in this order:

1. Needs input
2. Running
3. Completed
4. History, only when explicitly requested

Each row shows:

- title
- concise status label
- progress label or latest plain-language summary
- one primary action
- overflow actions

### 6.3 Action Selection

Primary action rules:

| State | Failure class | Primary action |
| --- | --- | --- |
| running queued/running | any | Open |
| running and cancelable detail view | any | Cancel may appear in overflow |
| failed | policy | Revise |
| failed | transient | Retry |
| failed | terminal | Diagnose |
| failed | unknown/null | Diagnose |
| dead_letter | any | Diagnose |
| succeeded | any | View/Open |
| canceled | any | Dismiss |

`Retry same input` must never be the primary action for policy failures.

## 7. Header Replacement Contract

`ChatSurfaceHeader` must render the Jobs rail in the current top chrome slot.

The current `ChatConversationDataMenu` behavior must be preserved but demoted to
an overflow utility action reachable from the rail drawer or a secondary icon.

The top-level visible text `Data` must no longer be the main chrome affordance.

Required prop changes:

```ts
interface ChatSurfaceHeaderProps {
  jobsRail: JobsRailModel;
  onJobsRailAction: (action: JobsRailAction) => void | Promise<void>;
  conversationUtilityActions: ConversationUtilityActions;
}
```

`useChatSurfaceState` remains the composition point that builds these props.

## 8. Action Contract

### 8.1 Existing Actions

Existing actions must continue to work:

- `cancel`
- `retry`
- `route` to `/jobs`
- conversation export/import/copy transcript

### 8.2 New Revision Operations

Extend `RevisionOperationKind` in
`src/core/platform/revision/RevisionContract.ts`:

```ts
export type RevisionOperationKind =
  | "pause"
  | "refine"
  | "resume"
  | "retry"
  | "cancel"
  | "dismiss"
  | "archive"
  | "revise";
```

Route parsers in the user and chat job APIs must reject unknown operations.

### 8.3 Dismiss And Archive

Dismiss and archive are visibility operations, not hard deletes.

They must not remove rows from `job_requests` or `job_events`.

They must not modify `status`.

They must be scoped per user.

### 8.4 Revise And Rerun

`revise` creates a new job from the original job with modified input.

Rules:

- source job must be owned by the user
- source job must be terminal or policy-blocked
- revised job must set `replayedFromJobId` to the source job id
- source job must set `supersededByJobId` to the new job id
- revised job must preserve tool name, conversation id, user id, priority, and
  initiator type unless explicitly changed by a capability-specific adapter
- revised job must recompute dedupe key from the revised request payload
- revised job must append a `queued` event with `replayedFromJobId`,
  `revisionKind: "user_revised_input"`, and `requestedByUserId`

The first supported revise target should be policy/content failures for image or
media generation jobs. Generic payload editing can come later.

## 9. Persistence Contract

Add user-scoped job marks.

Schema addition in `src/lib/db/tables.ts` and `src/lib/db/migrations.ts`:

```sql
CREATE TABLE IF NOT EXISTS job_user_marks (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  mark TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (job_id) REFERENCES job_requests(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(job_id, user_id, mark)
);

CREATE INDEX IF NOT EXISTS idx_job_user_marks_user_mark
  ON job_user_marks(user_id, mark, updated_at);

CREATE INDEX IF NOT EXISTS idx_job_user_marks_job_user
  ON job_user_marks(job_id, user_id);
```

Allowed marks:

```ts
export type JobUserMark = "dismissed" | "archived" | "pinned";
```

Create a dedicated repository port rather than adding mark behavior directly to
`JobQueueRepository`:

```ts
export interface JobUserMarkRepository {
  setMark(input: {
    jobId: string;
    userId: string;
    mark: JobUserMark;
    metadata?: Record<string, unknown>;
  }): Promise<void>;

  clearMark(input: {
    jobId: string;
    userId: string;
    mark: JobUserMark;
  }): Promise<void>;

  listMarksForUser(userId: string, options?: {
    marks?: JobUserMark[];
    jobIds?: string[];
  }): Promise<JobUserMarkRecord[]>;
}
```

This preserves single responsibility: job queue stores execution truth; marks
store user presentation preferences.

## 10. Diagnostic Bundle Contract

### 10.1 Purpose

Diagnostic export must produce a single downloadable support file without
showing logs in the normal UI.

The bundle should include enough evidence for a user, support agent, or system
agent to diagnose job and conversation failures.

### 10.2 Server Route

Add:

`src/app/api/diagnostics/conversations/[conversationId]/route.ts`

Method: `POST`

Request body:

```ts
interface DiagnosticBundleRequest {
  browserDiagnostics?: BrowserDiagnosticsSnapshot;
  includeRuntimeLogs?: boolean;
  includeConversationExport?: boolean;
  includeJobTimelines?: boolean;
}
```

Response:

- `200 application/json`
- `Content-Disposition: attachment; filename="ordo-diagnostic-bundle-{conversationId}-{timestamp}.json"`
- `Cache-Control: no-store`

### 10.3 Bundle Shape

```ts
export interface DiagnosticBundle {
  schemaVersion: 1;
  generatedAt: string;
  conversationId: string;
  requestId: string;
  app: {
    route: string | null;
    userAgent: string | null;
  };
  conversationExport: ConversationExportPayload | null;
  jobs: {
    snapshots: JobStatusSnapshot[];
    interactions: unknown[];
    events: unknown[];
  };
  runtimeLogs: Partial<Record<RuntimeAuditCategory, RuntimeAuditLogLine[]>>;
  browserDiagnostics: BrowserDiagnosticsSnapshot | null;
  redactions: {
    applied: true;
    fields: string[];
  };
}
```

### 10.4 Browser Diagnostics

Add a bounded browser diagnostic recorder:

`src/frameworks/ui/diagnostics/browser-diagnostics-recorder.ts`

It records:

- console `warn` and `error`
- console `info` and `debug` only when explicitly enabled or sampled
- `window.error`
- `unhandledrejection`
- failed fetches only through app-owned request wrappers initially

It must not globally monkey-patch `fetch` in the first implementation slice.

It must redact likely secrets before sending to the server.

```ts
export interface BrowserDiagnosticRecord {
  timestamp: string;
  level: "info" | "warn" | "error" | "debug";
  source: "console" | "window_error" | "unhandled_rejection" | "fetch";
  message: string;
  data?: unknown;
  url?: string;
}

export interface BrowserDiagnosticsSnapshot {
  capturedAt: string;
  records: BrowserDiagnosticRecord[];
  droppedCount: number;
}
```

### 10.5 Redaction

Create shared redaction helpers:

`src/lib/diagnostics/redaction.ts`

Required redactions:

- `authorization`
- `cookie`
- `set-cookie`
- `apiKey`
- `api_key`
- `token`
- `secret`
- `password`
- bearer tokens in strings

Diagnostic export must mark redactions as applied.

## 11. API Contract Summary

### Existing APIs To Preserve

- `GET /api/jobs`
- `GET /api/jobs/events`
- `GET /api/jobs/{jobId}`
- `POST /api/jobs/{jobId}`
- `GET /api/jobs/{jobId}/events`
- `POST /api/chat/jobs/{jobId}`
- `GET /api/conversations/{id}/export`

### New APIs

- `POST /api/diagnostics/conversations/{conversationId}`
- optional later: `GET /api/jobs/rail` if header rail needs user-global jobs
  independent of current conversation restore

Avoid adding `GET /api/jobs/rail` in the first slice unless current chat state is
insufficient. The first implementation should project from `jobStateEntries` to
keep scope tight.

## 12. Component Contract

Add:

- `src/frameworks/ui/jobs-rail/JobsRail.tsx`
- `src/frameworks/ui/jobs-rail/JobsRailDrawer.tsx`
- `src/frameworks/ui/jobs-rail/JobsRailRow.tsx`
- `src/frameworks/ui/jobs-rail/resolve-jobs-rail.ts`
- `src/frameworks/ui/jobs-rail/resolve-jobs-rail.test.ts`
- `src/frameworks/ui/jobs-rail/JobsRail.test.tsx`

`JobsRail` must be accessible:

- button has accurate `aria-label`
- drawer has dialog/menu semantics
- Escape closes drawer and restores focus
- outside click closes drawer
- primary action buttons have plain labels
- status updates are not announced excessively

## 13. Styling Contract

Styles should live with existing app CSS conventions, likely in
`src/app/styles/chat.css` unless a dedicated jobs rail CSS layer is introduced.

Required data attributes:

- `data-jobs-rail="true"`
- `data-jobs-rail-state`
- `data-jobs-rail-sync`
- `data-jobs-rail-drawer="true"`
- `data-jobs-rail-row-state`
- `data-jobs-rail-action`

Visual rules:

- rail trigger height must align with existing chrome controls
- drawer max width must fit floating and embedded chat modes
- drawer must not overlap composer controls on small screens
- text must truncate cleanly and never overflow buttons
- no nested cards
- no large shadows
- no decorative gradients

## 14. Motion Contract

Motion is progressive enhancement.

First slice may use CSS transitions only.

If Motion/Framer Motion is added later, it must be isolated to Jobs rail
components and used only for:

- row enter/exit
- drawer open/close
- state transition emphasis
- superseded job collapse into replacement

Motion must respect reduced-motion preferences.

## 15. Implementation Sequence

### Phase 1 - Rail Projection And Header Replacement

Deliver:

- `resolveJobsRail()` pure presenter
- `JobsRail` and drawer UI
- `ChatSurfaceHeader` uses Jobs rail instead of visible Data trigger
- Data export/import/copy preserved in overflow
- existing cancel/retry/open actions preserved

Do not add database schema in this phase.

### Phase 2 - Diagnostic Bundle

Deliver:

- browser diagnostic recorder
- redaction helpers
- server diagnostic bundle route
- rail overflow action for diagnostic download
- tests for bundle shape and redaction

### Phase 3 - User Job Marks

Deliver:

- `job_user_marks` schema and migrations
- `JobUserMarkRepository`
- `dismiss` and `archive` revision actions
- rail filtering for dismissed/archived jobs
- tests for user scoping and audit preservation

### Phase 4 - Revise And Rerun

Deliver:

- `revise` revision action
- first capability-specific revise adapter for policy/content generation
  failures
- revised job lineage through `replayedFromJobId` and `supersededByJobId`
- rail action selection: policy failure primary action becomes `Revise`
- tests proving retry is not primary for policy failures

### Phase 5 - Motion Polish

Deliver:

- isolated motion dependency if approved
- row/drawer/supersession animations
- reduced-motion compliance
- browser visual verification

## 16. Acceptance Tests

Required unit tests:

- `resolveJobsRail()` maps backend statuses to product states.
- Superseded jobs are hidden by default.
- Policy failure primary action is `Revise`, not `Retry`.
- Transient failure primary action is `Retry`.
- Terminal/unknown failure primary action is `Diagnose`.
- Diagnostic redaction removes secret-like fields recursively.
- Browser diagnostic recorder bounds record count and tracks dropped count.

Required component tests:

- `JobsRail` opens/closes drawer and restores focus on Escape.
- `JobsRail` dispatches primary actions through one action handler.
- Header renders Jobs rail instead of `Data` as the primary visible affordance.
- Conversation utility actions remain reachable.

Required route tests:

- diagnostic bundle route rejects anonymous users.
- diagnostic bundle route rejects conversations not owned by the user.
- diagnostic bundle route includes conversation export and job events.
- diagnostic bundle route applies redaction.
- job action routes reject unknown operations.

Required integration/browser tests:

- active job appears in top rail while stream is live.
- failed policy job shows `Needs revision` and `Revise`.
- downloading diagnostic bundle produces a JSON file.
- dismissed job disappears from rail but remains visible in job history.

## 17. Non-Goals

The first implementation must not:

- hard-delete jobs
- expose raw logs in the main UI
- make transcript message parts the source of operational truth
- add a second event stream if the existing stream can support the rail
- duplicate `/jobs` workspace detail behavior inside the rail
- make Motion a prerequisite for functional correctness
- mutate failed job request payloads in place

## 18. Definition Of Done

This contract is implemented when:

1. The top chat chrome shows Jobs, not Data, as the primary operational affordance.
2. The rail accurately reflects current job state from existing snapshots/streams.
3. The drawer provides one clear primary action per job.
4. Conversation data utilities are preserved but demoted.
5. A diagnostic bundle can be downloaded with conversation, jobs, runtime logs,
   and browser diagnostics.
6. Dismiss/archive hides jobs from current work without deleting audit history.
7. Policy/content failures guide the user toward revision instead of blind retry.
8. Unit, route, component, and browser tests cover the above behavior.

## 19. Implementation Notes

Keep dependencies pointing inward:

- UI components depend on rail view models, not DataMappers.
- Rail projection depends on `JobStateEntry` and plain capability descriptors, not
  React.
- API routes depend on facades and repositories, not UI helpers.
- Revision actions depend on `AgentPlatformFacade` and repository ports.
- Diagnostic bundle assembly depends on export/read-model/log ports and shared
  redaction helpers.

If implementation pressure creates a shortcut, prefer adding a small pure
projector or port over reaching across layers.
