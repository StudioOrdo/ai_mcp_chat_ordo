# Phase 02A: Business Workflow Context Projection

## Objective

Create the first canonical `BusinessWorkflowContext` projection so conversation
restore can recover business momentum, not only chat continuity.

For solopreneurs and small businesses, this is the enterprise-value layer:
lightweight CRM context, onboarding state, workflow handoff, notifications,
retries, and next actions inside the self-contained app.

Phase 02A is a bridge between the Phase 01 contract and the Phase 03 restore
payload. It must make the existing durable product records readable through
`BusinessWorkflowContextReader.findByConversationId(conversationId)` without
turning chat messages, browser refs, or prompt assembly into the source of
business truth.

## Source Specs

- [../business-workflow-context-spec.md](../business-workflow-context-spec.md)
- [../domain-model-spec.md](../domain-model-spec.md)
- [../restore-and-experience-spec.md](../restore-and-experience-spec.md)
- [../operator-transition-and-trust-distribution-spec.md](../operator-transition-and-trust-distribution-spec.md)
- [../test-infrastructure-and-evidence.md](../test-infrastructure-and-evidence.md)

## Collect

Research current business and workflow context sources:

- task-origin handoff
- current-page memento
- media-continuity handoff
- failed-send and interrupted-turn recovery
- lifecycle and coach context
- deferred job notifications and push preferences
- admin/operator navigation context
- leads, deals, consultations, training paths, referrals, and journal items
- QR/referral visit, affiliate analytics, and admin credit-review surfaces
- health and readiness routes

Current findings:

- `src/core/entities/business-workflow-context.ts` already defines the Phase 01
  entity shape: `primaryMode`, `origin`, compact `relatedRefs`, lifecycle,
  notification, interrupted-turn, health refs, and `recommendedAction`.
- `src/core/use-cases/BusinessWorkflowContextRepository.ts` already defines the
  reader/writer port. Phase 02 expects the optional reader and must not know the
  adapter or storage strategy.
- `src/core/entities/conversation-continuity.ts` includes source refs for jobs,
  job events, referrals, referral events, workspace snapshots, workflow context,
  and materialization records. Its `BusinessObjectKind` currently includes
  `lead`, `consultation`, `deal`, `training_path`, `referral`, `journal_item`,
  `work_order`, and `conversation`; it does not include `job` or `asset` as
  business object kinds, so Phase 02A must model those as evidence/source refs or
  explicitly extend the contract.
- `src/lib/chat/task-origin-handoff.ts` is a prompt-handoff helper only. It has
  useful admin/work-queue signal ids such as lead queue, deal queue, training
  path queue, consultation requests, system health, overdue follow-ups, and
  conversion review, but those ids currently disappear into a prompt block.
- `src/lib/chat/media-continuity-handoff.ts` scans chat messages for media assets
  and builds another prompt block. It is useful evidence for interrupted media
  work, but it is transcript-derived and cannot be the asset authority.
- `src/lib/chat/CurrentPageMemento.ts` and
  `src/hooks/chat/useCurrentPageMemento.ts` create a browser DOM/page snapshot.
  It is useful return-to-source evidence, not durable state.
- `src/hooks/chat/chatFailedSendRecovery.ts`,
  `src/hooks/chat/useFailedSendRecovery.ts`, and `src/hooks/chat/useChatSend.ts`
  keep failed send payloads, task-origin handoff, current page snapshot, and
  media handoff in message metadata or `useRef(Map)`. This is exactly where
  interrupted-turn refs should be captured, but browser memory and message
  reconstruction cannot remain canonical.
- `src/lib/chat/stream-route-handler.ts` and `src/lib/chat/stream-preparation.ts`
  are the server capture points for task origin, current page snapshot, media
  continuity, referral trust context, routing snapshot, and recorded user turns.
  They should call a projector/recorder through a port; they should not become a
  workflow-context service.
- `src/hooks/chat/useLifecycleContext.ts`,
  `src/app/api/lifecycle/context/route.ts`, and
  `src/lib/lifecycle/lifecycle-queue.ts` drain lifecycle payloads from user
  preferences and render lifecycle/coach system cards. The queue is durable
  enough to project refs, but consuming it only as chat cards loses the business
  workflow signal after render.
- `src/app/api/campaign/context/route.ts`, `src/hooks/chat/useCampaignContext.ts`,
  and `src/lib/referrals/campaign-queue.ts` mirror lifecycle behavior for
  referral/campaign coach payloads. They should be projected as workflow
  guidance refs only when linked to a conversation or user-visible workflow.
- `src/lib/jobs/deferred-job-notifications.ts` builds terminal job push payloads
  with conversation id, job id, and status. These belong in `notificationRefs` or
  review actions, but job ids should be `ContinuitySourceRef`s unless the
  business object contract is extended.
- `src/lib/admin/admin-navigation.ts` resolves page/workspace context for admin
  leads, conversations, affiliates, journal, settings, and diagnostics. It is a
  good return-to-source strategy input; `src/components/ShellWorkspaceMenu.tsx`
  is only a UI consumer and must not be imported by projection code.
- `src/core/entities/lead-record.ts`, `deal-record.ts`,
  `consultation-request.ts`, and `training-path-record.ts` already hold the
  compact labels, statuses, conversation ids, next actions, and owner ids needed
  for related business refs.
- `src/adapters/*DataMapper.ts` for leads, deals, consultations, and training
  paths already expose `findByConversationId(...)` through ports. These are the
  first durable authorities for Phase 02A.
- `src/core/entities/Referral.ts`, `ReferralEvent.ts`,
  `src/lib/referrals/referral-ledger.ts`, `referral-analytics.ts`,
  `referral-milestones.ts`, and `src/app/api/notifications/feed/route.ts` form a
  real referral ledger with idempotent milestone events and notification feed
  projection. Phase 02A should reference referral/referral-event ids, not parse
  referral chat cards.
- `src/app/api/referral/visit/route.ts` and
  `src/hooks/chat/useReferralContext.ts` provide anonymous trusted-introduction
  context for the first chat render. That is visit context, not a durable
  workflow context until the ledger attaches it to a conversation.
- `src/app/api/health/ready/route.ts` and `src/lib/health/probes.ts` expose only
  config/model readiness today. They can produce setup blockers but should not
  be expanded into a broad diagnostics engine in this phase.

Likely starting points:

- `src/lib/chat/task-origin-handoff.ts`
- `src/lib/chat/media-continuity-handoff.ts`
- `src/hooks/chat/useCurrentPageMemento.ts`
- `src/hooks/chat/chatFailedSendRecovery.ts`
- `src/hooks/chat/useFailedSendRecovery.ts`
- `src/hooks/chat/useLifecycleContext.ts`
- `src/core/entities/lifecycle.ts`
- `src/core/entities/coach.ts`
- `src/lib/jobs/deferred-job-notifications.ts`
- `src/lib/admin/admin-navigation.ts`
- `src/core/entities/lead-record.ts`
- `src/core/entities/deal-record.ts`
- `src/core/entities/consultation-request.ts`
- `src/core/entities/training-path-record.ts`
- `src/core/entities/Referral.ts`
- `src/lib/referrals/`
- `src/app/r/[code]/page.tsx`
- `src/app/api/referral/[code]/route.ts`
- `src/app/api/referral/visit/route.ts`
- `src/app/api/qr/[code]/route.ts`
- `src/app/referrals/page.tsx`
- `src/app/admin/affiliates/page.tsx`
- `src/app/api/health/ready/route.ts`

## Decide

Decide the first projection scope.

Prefer the smallest high-value slice:

1. related business refs for lead, deal, consultation, referral, and training
2. a conservative primary mode and recommended action from durable record state
3. origin and return-to-source context when captured by server-side handoff or
  derivable from the related ref
4. lifecycle/campaign progress refs when sourced from queued or consumed durable
  payloads
5. notification refs for referral milestones and terminal deferred jobs when an
  idempotent event/job source exists
6. interrupted-turn refs only if Phase 02A also introduces a durable capture
  point; otherwise document the gap and leave the array empty
7. health refs for readiness/setup blockers only

Rejected approaches must include:

- treating task-origin as prompt-only context
- duplicating full CRM or admin payloads inside conversation state
- requiring external CRM integrations for the default product to feel useful
- making transcript message parts the source of business workflow truth
- making `useRef`, local browser page snapshots, or chat bootstrap cards the
  canonical workflow store
- importing Next.js route handlers, React hooks, or UI components into core
  projection logic

## Spec QA

The workflow context contract must answer:

- why did this conversation start or resume
- which business object, if any, does it serve
- what mode is the user in: revenue, service, training, operations, setup, or
  general
- what next action would create the most business value
- how can the user return to the originating surface
- what interrupted work, notification, or health blocker changes the next step

## Ground

Before coding, map each workflow context field to a current source:

- `id`: deterministic projection id such as `bwc_${conversationId}` unless a
  persisted table is introduced for real mutable state.
- `userId`: conversation owner, authenticated business record owner, or
  `usr_anonymous`/anonymous session owner according to the existing conversation
  ownership contract. Do not infer ownership from browser state.
- `conversationId`: required input and the join key for the first slice.
- `primaryMode`: derive from durable refs. Deals and high-intent consultations
  imply `revenue`; training paths imply `training`; leads/consultations imply
  `service` or `revenue` by lane; lifecycle/setup blockers imply `setup`;
  readiness/admin/system work implies `operations`; otherwise `general`.
- `origin`: start with a `WorkflowOriginContext` from server-captured task origin
  or a related business ref. `CurrentPageMemento` may contribute label/path
  evidence only after the server records it. `admin-navigation` may provide a
  Strategy for labels/hrefs; the projector must not import the UI drawer.
- `relatedRefs`: build compact `BusinessObjectRef`s from
  `LeadRecordRepository.findByConversationId`,
  `ConsultationRequestRepository.findByConversationId`,
  `DealRecordRepository.findByConversationId`,
  `TrainingPathRecordRepository.findByConversationId`, and referral ledger refs.
  Use labels/statuses/ids only; do not embed full lead/deal/customer payloads.
- `lifecycleRefs`: project lifecycle and campaign queue items by ref/evidence.
  If the queue is drained before projection can observe it, Phase 02A must either
  add a server-side recorder or explicitly defer lifecycle refs.
- `notificationRefs`: project from referral milestone notifications and terminal
  deferred job notification events when ids and statuses are available.
- `interruptedTurnRefs`: project only from durable failed/interrupted-turn
  records. The current `useRef(Map)` and message metadata hydration are evidence
  that a gap exists; they are not enough by themselves.
- `healthRefs`: project only readiness/setup blockers from `getReadinessProbe()`
  or an equivalent port. Do not mix broad runtime diagnostics into the workflow
  read model.
- `recommendedAction`: choose a deterministic action from the highest-priority
  blocking or business ref: blocking health -> `configure`; interrupted turn ->
  `retry`; deal/lead/consultation next action -> `follow_up` or `review`;
  referral QR/campaign trust motion -> `share`; otherwise `continue`.

If a field has no current source, leave it null or empty and document the gap.

## Source Authority Matrix

| Workflow field | Current authority | Evidence-only sources | Notes |
| --- | --- | --- | --- |
| `relatedRefs` | lead, deal, consultation, training repositories; referral ledger | chat cards, tool result parts, admin page labels | Durable rows win. Message parts may link to ids but cannot create truth. |
| `primaryMode` | durable related refs and readiness state | task-origin signal ids | Mode is computed, not user-entered prompt text. |
| `origin` | server-recorded task origin or related business ref | current page memento, admin navigation resolver | Browser memento must cross a server capture boundary before restore can use it. |
| `lifecycleRefs` | lifecycle/campaign queue or a new consumed-event recorder | lifecycle/coach system messages | Cards are presentation. The projected ref must point at a queued/recorded event. |
| `notificationRefs` | referral events/feed projection; deferred job terminal events | push payload text | Notifications should keep ids, channel, status, and evidence refs. |
| `interruptedTurnRefs` | future durable interrupted-turn store | failed-send hook maps and message metadata | Do not fake durability by replaying old failed-send metadata. |
| `healthRefs` | readiness/setup probe port | admin diagnostics UI | Keep this tiny: config/model readiness and setup blockers only. |

## First Projection Shape

Implement the first slice as a repository-backed reader/projector, not a broad
new CRM subsystem:

- `BusinessWorkflowContextReader.findByConversationId(conversationId)` composes
  existing repository ports and returns a rebuildable read model.
- The reader is constructed in a composition root beside existing conversation
  repositories, not inside React hooks or route handlers.
- The first implementation can be stateless/rebuildable over existing durable
  rows. Add a persisted workflow context table only for fields that cannot be
  derived and must survive reload, such as server-captured origin or durable
  interrupted-turn refs.
- Any persisted projection rows must be idempotent by `(conversationId, source
  kind, source id)` or equivalent. Rebuilding should not duplicate refs.
- The projection should return compact refs and recommended actions; owning
  detail views/routes remain responsible for full CRM/referral/admin payloads.

## Clean Architecture, SOLID, and GoF Rules

- Entities stay pure. `BusinessWorkflowContext` and continuity refs must not
  import SQLite, Next.js, React, fetch, route handlers, or UI presentation code.
- Use the Repository pattern for source reads. Projection code depends on
  `LeadRecordRepository`, `DealRecordRepository`,
  `ConsultationRequestRepository`, `TrainingPathRecordRepository`, referral
  reader/ledger ports, notification reader ports, and health probe ports.
- Use Data Mapper adapters for SQLite. Do not let domain objects call `getDb()`
  or update themselves.
- Use a Projector/Read Model pattern for `BusinessWorkflowContext`: translate
  many source records into one restore-oriented view.
- Use Strategy for source-specific mapping: lead strategy, deal strategy,
  consultation strategy, training path strategy, referral strategy, lifecycle
  strategy, health strategy. Each strategy should know one source family.
- Use a Facade only at the restore boundary. The facade may ask for workspace
  snapshot and workflow context; it must not own projection rules.
- Use Adapter at capture points: stream preparation, lifecycle/campaign drain,
  referral ledger, deferred job notification, and failed-send recovery should
  call a port when they need to record workflow evidence.
- Use Null Object or empty arrays for absent optional sources so restore remains
  deterministic when referrals, lifecycle queues, jobs, or health blockers do
  not exist.
- Open/Closed: adding a new business source should add a projection strategy,
  not edit a god switch across unrelated workflow families.
- Single Responsibility: hooks render/cache/subscribe; route handlers authorize
  and translate HTTP; repositories read/write source records; projectors assemble
  workflow context.
- Interface Segregation: do not make one massive workflow dependency bag. Split
  source readers by actual need.
- Dependency Inversion: core projection depends on ports; adapters and
  composition roots wire concrete mappers.

Anti-patterns that fail Phase 02A:

- Active Record business entities that save or query themselves
- Service Locator calls such as `getDb()` or `getSessionUser()` inside core
  projection logic
- a god `BusinessWorkflowContextService` that knows every route, hook, table,
  and UI label
- using transcript tool parts as operational truth
- using browser/session/local refs as restore authority
- duplicating admin/CRM/referral payloads inside conversation rows

## Build

Expected deliverables:

- a repository-backed `BusinessWorkflowContextReader` implementation or
  equivalent projection class wired through the existing composition root
- source projection strategies for lead, deal, consultation, training path, and
  referral records
- compact `BusinessObjectRef` builders with stable labels/statuses and owner ids
- deterministic `primaryMode` and `recommendedAction` rules covered by tests
- optional server-side origin/evidence recorder if task origin or page memento is
  included in the first slice
- lifecycle/campaign/notification ref projection only where there is durable
  evidence; otherwise documented gaps
- tests for projection from existing durable records and for empty-source/null
  behavior

Do not build a broad CRM rewrite. The value comes from durable links and next
actions, not duplicating every business table.

Do not implement Phase 03 restore behavior in Phase 02A. Phase 02A supplies the
reader/projection; Phase 03 decides how homepage restore renders and consumes it.

## Phase QA

Before implementation, confirm this phase improves the return-user experience
for small operators:

- lead follow-up resumes as lead work
- deal follow-up resumes as revenue work
- onboarding resumes as setup work
- failed or interrupted work is retryable
- completed notified work is reviewable
- referral QR/link or trusted-introduction milestones can become workflow refs
- health blockers change next-action guidance

Critical doc/code alignment checks before implementation starts:

- Every source used by the projection has a clear authority level: durable
  authority, server-captured evidence, or browser/prompt hint.
- Every core dependency points at a port or pure entity, never a route, hook, or
  UI component.
- The projection can be rebuilt twice with identical output and no duplicate
  refs.
- The absence of leads, deals, consultations, training paths, referrals,
  notifications, lifecycle entries, interrupted turns, or health blockers returns
  empty arrays/nulls, not errors.
- The `job` and `asset` contract gap is resolved by source/evidence refs or by a
  deliberate `BusinessObjectKind` contract extension.

## Remove Before Phase 02A Is Complete

Phase 02A is not complete while business workflow state is still effectively
hidden in transient chat/bootstrap mechanisms. Remove or demote these patterns:

- Any Phase 02A restore dependency on `buildTaskOriginContextBlock` or other
  prompt text as the workflow authority.
- Any projection logic that reads historical message parts to decide whether a
  lead, deal, referral, training path, job, or asset currently exists.
- Any claim that `CurrentPageMemento` is durable restore context before a server
  recorder captures the relevant source ref.
- Any claim that `useRef(Map)` failed-send recovery is durable interrupted-turn
  state. Either persist an interrupted-turn record or mark the field as deferred.
- Any lifecycle/campaign workflow ref that exists only because a system card was
  appended to the chat transcript.
- Any direct import from `src/components`, `src/hooks`, or `src/app/api` into
  core workflow projection code.
- Any direct SQLite or `getDb()` usage outside adapters/composition roots for
  this feature.
- Any duplicated full CRM/admin/referral payload stored inside
  `BusinessWorkflowContext`; refs only, details stay with owning domains.
- Any non-idempotent recorder that creates a second workflow ref when the same
  source event is replayed.
- Any Phase 03 restore code path that consumes workflow context before the
  Phase 02A reader has deterministic tests.

## Implementation QA

Required validation:

- unit tests for task-origin normalization into workflow context
- integration tests for related business refs
- lifecycle/coach projection tests
- failed-send recovery tests across reload when persistence is introduced
- browser test for return-to-source action from conversation restore
- evidence runner scenario for business workflow restore

Recommended first test matrix:

- no source records returns `primaryMode: "general"`, empty refs, and no
  blocking health
- lead-only conversation produces a lead ref and follow-up/review recommendation
- deal conversation produces `primaryMode: "revenue"` and a deal target ref
- training path conversation produces `primaryMode: "training"`
- referral-linked conversation includes referral/referral-event evidence without
  parsing referral chat cards
- readiness failure produces a blocking health ref and `configure`
  recommendation
- rerunning projection or replaying the same referral/job event does not produce
  duplicate refs

## Update

After completion, update Phase 03 with the workflow context API and update
Phase 10 with the exact product UI elements that should render business
momentum.

## Implementation Notes

Phase 02A is implemented as a rebuildable read model over existing durable
records. It adds no schema and no homepage restore cutover.

Implemented files:

- `src/core/platform/business-workflow/BusinessWorkflowContextProjector.ts`
- `src/core/platform/business-workflow/BusinessWorkflowContextReader.ts`
- `src/core/platform/business-workflow/BusinessWorkflowContextProjector.test.ts`
- `src/core/platform/business-workflow/BusinessWorkflowContextReader.test.ts`
- `tests/conversation/phase-02a-business-workflow-context-projection.test.ts`

Composition wiring:

- `getBusinessWorkflowContextReader()` in `src/adapters/RepositoryFactory.ts`
  constructs `RepositoryBackedBusinessWorkflowContextReader` from existing
  conversation, lead, consultation, deal, training path, referral, referral
  event, job, and readiness sources.

Implemented source behavior:

- related refs are projected from `LeadRecordRepository`,
  `ConsultationRequestRepository`, `DealRecordRepository`,
  `TrainingPathRecordRepository`, and the referral ledger mapper
- `primaryMode` and `recommendedAction` are deterministic and covered by unit
  tests
- referral milestone events become `notificationRefs` with referral-event
  evidence refs
- terminal deferred-job notification events become `notificationRefs` with
  job-event evidence refs
- readiness failures become blocking `healthRefs` and a `configure`
  recommendation
- job and asset ids are not added to `BusinessObjectRef`; they remain source or
  evidence refs until the contract is deliberately extended
- lifecycle refs and interrupted-turn refs intentionally remain empty because
  the current lifecycle/campaign queues and failed-send recovery do not yet have
  durable conversation-linked recorders

Removal status:

- Phase 02A projection code does not import React hooks, Next.js routes,
  components, browser runtime code, `MessagePart`, transcript tool parts,
  `CurrentPageMemento`, SQLite, or `getDb()`
- prompt handoff blocks, browser mementos, failed-send `useRef(Map)` state, and
  lifecycle/coach system cards are not workflow authority
- Phase 03 restore remains untouched until the restore phase consumes the
  `BusinessWorkflowContextReader`

Executable proof:

- `npm run qa:conversation-refactor`
