# Phase 10: Product Experience Cutover

## Objective

Simplify the conversation experience around canonical state:

1. current work summary
2. business workflow context and next action
3. operator transition or trust-distribution next action
4. active work strip
5. reusable asset shelf
6. memory-backed next action
7. recent transcript as history

This phase cuts product surfaces away from transcript-owned operational state.

## Completion Status

- 2026-04-29: complete against the grounded Phase 10 scope.
- Implemented seams: `src/frameworks/ui/product-experience-facade.ts`,
  `src/frameworks/ui/product-experience-summary.ts`,
  `src/frameworks/ui/ProductExperienceSummary.tsx`,
  `src/frameworks/ui/useChatSurfaceState.tsx`,
  `src/frameworks/ui/ChatContentSurface.tsx`, and
  `src/lib/shell/shell-navigation.ts`.
- Verified outcomes: returning-user canonical summary above transcript,
  explicit experience-state routing, anonymous-first-run hero isolation,
  low-signal anonymous restore suppression, transcript-progress demotion when
  canonical jobs are present, and shell access to jobs, media, referrals, and
  profile workspaces.
- Important scope boundary: `WorkspaceRestore.ts` still publishes
  `migration: null`, so Phase 10 intentionally does not invent a migration
  strip or migrated-continuation state from transcript or browser artifacts.

## Source Specs

- [../restore-and-experience-spec.md](../restore-and-experience-spec.md)
- [../target-architecture.md](../target-architecture.md)
- [../business-workflow-context-spec.md](../business-workflow-context-spec.md)
- [../operator-transition-and-trust-distribution-spec.md](../operator-transition-and-trust-distribution-spec.md)
- [phase-03-restore-read-model-and-idempotent-homepage.md](phase-03-restore-read-model-and-idempotent-homepage.md)
- [phase-05-asset-catalog-and-reusable-outputs.md](phase-05-asset-catalog-and-reusable-outputs.md)
- [phase-09-identity-migration-privacy-and-repair.md](phase-09-identity-migration-privacy-and-repair.md)
- [../validation-strategy.md](../validation-strategy.md)

## Collect

Research current UI surfaces:

- embedded homepage chat shell
- floating chat shell
- chat provider and restore composition
- message list, hero state, and suggestion chips
- transcript-derived progress strip
- dedicated jobs workspace
- dedicated user media workspace
- shell workspace menu and admin workspace context
- failed-send recovery and retry affordances
- product return-to-source navigation surfaces
- notification and completion entry points
- search and asset discovery interactions

Likely starting points:

- `src/frameworks/ui/ChatSurface.tsx`
- `src/frameworks/ui/useChatSurfaceState.tsx`
- `src/frameworks/ui/MessageList.tsx`
- `src/frameworks/ui/chat/plugins/system/SystemJobCard.tsx`
- `src/frameworks/ui/chat/plugins/system/resolve-progress-strip.ts`
- `src/hooks/useGlobalChat.tsx`
- `src/hooks/chat/useChatRestore.ts`
- `src/hooks/chat/useChatRestoreCompatibility.ts`
- `src/components/jobs/JobsWorkspace.tsx`
- `src/components/media/UserMediaWorkspace.tsx`
- `src/components/ShellWorkspaceMenu.tsx`
- `src/components/NotificationFeed.tsx`
- `src/frameworks/ui/ChatSurfaceHeader.tsx`
- `src/frameworks/ui/ChatContentSurface.tsx`

Collect and classify each surface as one of:

- canonical read-model consumer that should survive cutover
- transcript-derived compatibility surface that should be demoted or removed
- shell or navigation entry seam that should point to canonical workspaces
- route or workspace that already owns its own read model
- product affordance that still depends on message-part inspection
- UI behavior that should move back to an earlier owning phase instead of being solved in Phase 10

## Decide

Decide the cutover order against the code that already exists.

### 1. Cut Over Returning-User Surfaces Before Reworking Anonymous Hero Presentation

The current anonymous hero is already serviceable. The bigger product problem
is that returning-user work still routes through transcript-derived UI.

Prioritize:

- current work summary and next action from canonical restore fields
- business workflow context strip
- operator transition or trust-distribution strip
- asset and jobs workspace entry surfaces
- recent transcript as a demoted history region

### 2. Promote Existing Dedicated Workspaces Instead Of Recreating Them In Chat

Jobs and media already have dedicated workspace components. Phase 10 should
promote them as product destinations and summary targets instead of re-creating
their behavior inside `MessageList.tsx` or tool cards.

### 3. Distinguish Product Summary From Transcript History

The top of the experience should answer:

- what the user is working on
- what needs attention now
- what durable assets are available
- what next action the product recommends

The transcript should remain available as history, but it should no longer act
as the place where product state is inferred.

### 4. Keep Compatibility Logic Contained And Shrinking

Phase 10 should still tolerate restore compatibility and message-derived
fallbacks while the cutover is in progress, but each slice must shrink the
amount of UI that depends on transcript inspection.

Rejected approaches must include:

- visually hiding old behavior while it still drives execution
- preserving message parts as the primary integration layer
- making the UI re-derive canonical state from transcript JSON
- moving jobs, assets, retry, or navigation logic into hero chips or branded
  homepage sections
- expanding `useGlobalChat.tsx` to own even more product summary logic

## Ground

Before changing Phase 10, preserve the current code truths this phase must
build on.

### The Primary Product Surface Is Still Chat-Provider-Centric

- `useGlobalChat.tsx` still composes restore, send, retry, job events, browser
  capability runtime, referral context, bootstrap messages, and current-page
  memento in one provider boundary.
- `ChatSurface.tsx` and `useChatSurfaceState.tsx` remain the runtime entry
  seam for both the embedded homepage surface and the floating chat shell.
- This means Phase 10 is not a blank-slate homepage redesign. It is a cutover
  away from an overgrown chat surface that still owns too much product state.

### Restore Still Enters Through The Chat Surface, Not A Product Facade

- `useChatRestore.ts` restores the active workspace or a conversation-scoped
  workspace directly into chat state and message replacement.
- `useChatRestoreCompatibility.ts` still derives routing and executable
  message behavior from `workspaceRestore` plus current conversation fields.
- The current product shell therefore still enters through chat-session
  compatibility logic instead of a dedicated experience facade.

This means Phase 10 must consume the restore contract produced by earlier
phases, not keep broadening compatibility logic inside the chat provider.

### Homepage Hero State Is Real, But It Is Still Message-List State

- The anonymous homepage hero and service chips currently render inside
  `MessageList.tsx` under `isHeroState`.
- Hero visibility still depends on a seeded assistant message with open
  suggestions rather than on a dedicated product read model.
- This is acceptable as an interim homepage behavior, but it is not the final
  architecture for returning-user product experience.

This means Phase 10 must distinguish anonymous first-screen hero treatment
from returning-user canonical work surfaces.

### Current Work Strip Is Still Derived From Transcript Tool Entries

- `resolve-progress-strip.ts` inspects presented transcript messages and
  extracts job-state cards from `toolRenderEntries`.
- Progress priority, retryability, and visible ordering are currently decided
  from transcript-presented job status parts, not from a standalone product
  workspace read model.
- This is the clearest proof that “active work” still lives behind transcript
  compatibility rather than a clean current-work surface.

This means Phase 10 must stop treating transcript-derived progress as the
durable product strip.

### Dedicated Jobs And Media Workspaces Already Exist

- `JobsWorkspace.tsx` already owns a dedicated job-status snapshot model,
  event stream reconciliation, selection, history loading, and job actions.
- `UserMediaWorkspace.tsx` already owns dedicated media inventory, quota,
  filtering, preview, and cleanup affordances.
- These routes are concrete examples of the product direction Phase 10 should
  promote rather than re-embedding everything back into the transcript.

This means the cutover should elevate these workspaces as primary product
destinations instead of duplicating their logic in message cards.

### Shell Workspace Navigation Already Decides Where Users Re-Enter Work

- `ShellWorkspaceMenu.tsx` already resolves authenticated, anonymous, and
  admin navigation context.
- The shell menu is therefore a real cutover surface for routing users toward
  jobs, assets, referrals, journal, and admin workspaces.
- Product experience cutover is not limited to the homepage body. It also
  includes making shell entry points align with canonical work surfaces.

### Migration Status Still Has No UI-Ready Restore Projection

- `WorkspaceRestore.ts` still types `migration` as `null`, so the restore
  contract does not yet expose a durable migration-status surface for Phase 10
  to render.
- Product cutover should therefore validate continuity after anonymous
  migration without fabricating a dedicated migration strip from
  `converted_from`, session storage, or transcript clues.
- Treat migrated-continuation UI as conditional on a future non-null restore
  projection from Phase 09 rather than as a Phase 10 excuse to re-derive state
  from compatibility artifacts.

### Failed-Send, Retry, And Browser Runtime Paths Are Still Chat-Led

- `useGlobalChat.tsx` still composes failed-send recovery, retry behavior, and
  browser runtime execution around the same message state.
- Phase 10 must not pretend these concerns disappear visually just because the
  homepage looks cleaner.
- Any surface that still depends on retryable transcript messages or browser
  runtime message IDs is still a compatibility surface, not a final product
  boundary.

## Spec QA

Before coding, map each UI element to its canonical read model. If no read
model exists, do not reconstruct from transcript. Return to the owning phase.

Phase 02A provides the first concrete business workflow read model through
`BusinessWorkflowContextReader.findByConversationId(conversationId)`. Product
cutover can rely on these fields when restore exposes them cleanly:

- mode label from `primaryMode`
- return/source label from `origin.label`
- compact business chips from `relatedRefs`
- review or feed indicators from `notificationRefs`
- setup blocker banner from blocking `healthRefs`
- primary action from `recommendedAction`

Do not build UI from lifecycle cards, coach cards, failed-send refs, current
page memento, or historical tool cards unless an earlier phase records durable
refs for those sources.

Product cases must include:

- returning user with no active work
- returning user with running work
- returning user with failed work needing attention
- returning user with reusable media assets
- returning user after anonymous migration continuity without fabricating a
  dedicated migration strip
- long conversation with compact memory summary and recent transcript
- returning user with workflow-origin and next-action context from canonical
  referral, setup, or other projected business objects
- first-run or career-transition user with an offer or first-share action
- affiliate user with QR/link/share/follow-up context
- returning user with interrupted retryable work
- returning user with completed notified work to review
- returning user blocked by runtime health or setup state

## Build

Expected deliverables:

- experience facade or equivalent composition boundary above the chat surface
- current work summary component or section driven by restore and job read models
- business workflow context strip with return-to-source and next action
- operator transition/trust distribution strip with QR/link/script/follow-up
  action when relevant
- active work strip driven by durable jobs rather than transcript tool cards
- reusable asset shelf driven by asset catalog or media workspace readers
- memory-backed next action display
- recent transcript history view as a demoted history surface
- shell navigation updates that route users to canonical workspaces
- removal or demotion of transcript-triggered runtime recovery paths from the
  top-level product experience

## Specific Architectural Patterns Required

This phase should explicitly use these patterns.

### Facade Pattern

Introduce a product-experience facade or equivalent composition boundary that
assembles restore, workflow, job, asset, and memory summaries for the UI.
Consume migration status only after Phase 09 exposes a non-null restore
projection. `useGlobalChat.tsx` should not remain the de facto product facade.

### Presenter Pattern

Use presenters or view-model mappers to convert canonical read models into UI
sections. Do not let `MessageList.tsx`, shell menus, or route components infer
display state directly from raw restore payloads or message arrays.

### Strategy Pattern

Use explicit strategies for first-run anonymous hero, returning-user summary,
interrupted-work attention state, and blocked/setup state. Do not pile these
branches into one monolithic message-list condition tree.

### State Pattern

Represent experience states explicitly: anonymous hero, returning idle,
returning active, returning blocked, and interrupted recovery. Add migrated
continuation only when Phase 09 ships a real restore-level migration state.
Product cutover should not infer these solely from message count, assistant
role, or suggestion presence.

### Adapter Pattern

Keep transcript-derived and compatibility-only surfaces behind adapters while
cutover is in progress. This lets Phase 10 shrink compatibility logic without
rewriting every route at once.

### Single Responsibility Principle

Chat sending, browser runtime execution, restore compatibility, and product
summary composition should not keep accreting inside one hook or provider.
Phase 10 should reduce that coupling, not rebrand it.

## What Phase 10 Must Remove

Before this phase is complete, remove or stop extending these seams:

- the assumption that `useGlobalChat.tsx` is the right place to compose all
  product experience state
- transcript-derived current-work strips as the primary product summary surface
- any new homepage logic that depends on seeded assistant messages to represent
  returning-user state
- any attempt to rebuild jobs, assets, or workflow truth from message parts
  when dedicated readers or workspaces already exist
- any shell navigation or workspace shortcut that points users back to
  transcript cards instead of canonical workspaces
- any new product summary logic added directly to `MessageList.tsx`
- any reuse of lifecycle or coach cards as authoritative product context once
  canonical workflow strips exist
- any restore-driven UI branch that infers migration, workflow, or blocked
  state from nullable transcript artifacts instead of explicit fields

## Implementation Sequence

1. Inventory the current homepage, floating chat, shell menu, jobs workspace,
   and media workspace entry surfaces by canonical owner and transcript
   dependency.
2. Introduce a product-experience facade or equivalent presenter boundary that
  reads restore, jobs, workflow, and asset summaries without routing that
  logic through `MessageList.tsx`.
3. Cut over the returning-user top section to current-work, workflow, and
  operator/trust-distribution strips backed by canonical read models.
4. Demote transcript-derived progress and tool-card-driven recovery UI from the
   primary viewport while preserving compatible fallback behavior underneath.
5. Route shell workspace entry points toward jobs, assets, referrals, and
   other dedicated workspaces instead of transcript-first re-entry.
6. Reduce homepage hero logic so it is limited to anonymous or true first-run
   presentation and no longer acts as a catch-all product shell.
7. Add focused tests for experience-state routing, restore-to-summary mapping,
   and transcript demotion behavior.

## Phase QA

Before implementation, verify accessibility and responsive layout expectations.
The UI should make ongoing work easier to scan, not create a decorative landing
page.

## Implementation QA

Required validation:

- component tests for each new surface
- focused integration tests for restore-to-summary and experience-state mapping
- browser test for repeated homepage load idempotency
- browser-cache deletion proof
- route-action coverage for canonical jobs, media, referrals, and workflow
  next-action navigation
- responsive review of the embedded homepage and floating chat summary surfaces
- tests that returning-user top sections no longer depend on transcript-only
  progress items or seeded hero messages
- tests that shell navigation targets canonical workspaces after cutover
- functional review against the target experience

## Completion Evidence

- Focused tests passed:
  `npm exec vitest run src/frameworks/ui/product-experience-facade.test.ts src/frameworks/ui/product-experience-summary.test.ts src/frameworks/ui/ChatContentSurface.test.tsx src/frameworks/ui/useChatSurfaceState.test.tsx src/lib/shell/shell-navigation.test.ts src/components/ShellWorkspaceMenu.test.tsx`
- Static errors were clean on the touched implementation files.
- Next.js runtime error sweep returned `No errors detected in 4 browser session(s).`
- Browser QA proved the anonymous homepage remained in the intended hero state
  after storage/cache clearing and explicit reload.

## Update

After completion, update Phase 11 with any remaining product regressions,
performance risks, and release blockers.
