# Phase 02B: Operator Transition And Trust Distribution Projection

## Objective

Create the first canonical projections for first-run agency and trusted
distribution.

This phase makes conversation restore useful for users who are trying to become
operators, not only users who already have a clean business workflow. It should
answer where the user is in becoming economically effective, what they can
share, what trusted-introduction activity exists, and what concrete next action
creates momentum.

Phase 02B must produce `OperatorTransitionReader` and
`TrustDistributionReader` implementations over existing durable records without
turning chat cards, prompt text, route UI, or analytics dashboard rows into the
source of truth.

## Source Specs

- [../operator-transition-and-trust-distribution-spec.md](../operator-transition-and-trust-distribution-spec.md)
- [../business-workflow-context-spec.md](../business-workflow-context-spec.md)
- [../domain-model-spec.md](../domain-model-spec.md)
- [../restore-and-experience-spec.md](../restore-and-experience-spec.md)
- [../test-infrastructure-and-evidence.md](../test-infrastructure-and-evidence.md)
- [phase-01-canonical-domain-contracts.md](phase-01-canonical-domain-contracts.md)
- [phase-02a-business-workflow-context-projection.md](phase-02a-business-workflow-context-projection.md)

## Phase 01 Handoff

Phase 01 already added the pure contracts and ports this phase should implement:

- `OperatorTransitionProfile`, `OperatorTransitionAction`, and helpers in
  `src/core/entities/operator-transition.ts`
- `TrustDistributionContext`, share asset refs, intro scripts, campaign refs,
  and helpers in `src/core/entities/trust-distribution.ts`
- `OperatorTransitionReader` / `OperatorTransitionWriter` in
  `src/core/use-cases/OperatorTransitionRepository.ts`
- `TrustDistributionReader` / `TrustDistributionWriter` in
  `src/core/use-cases/TrustDistributionRepository.ts`
- shared source/evidence/business refs in
  `src/core/entities/conversation-continuity.ts`

Do not rename these contracts during Phase 02B unless implementation evidence
proves the Phase 01 shape is wrong. The first implementation should be a
projection-backed reader, not a broad new activation subsystem.

## Phase 02A Handoff

Phase 02A implemented `BusinessWorkflowContextReader` over existing durable
lead, consultation, deal, training, referral, job-notification, and readiness
sources.

Phase 02B should reuse the same pattern:

- pure projectors under `src/core/platform/operator-transition/` or a similarly
  narrow platform folder
- repository-backed readers that depend on ports and small source readers
- concrete mappers and services wired only in `RepositoryFactory` or a
  request-scoped composition root
- no schema unless a source cannot be rebuilt and must survive reload
- no restore endpoint or homepage UI cutover; Phase 03 consumes the readers

## Current Codebase Grounding

The codebase already has strong trust-distribution infrastructure. The missing
piece is a canonical projection that restore can read.

### Existing Durable And Semi-Durable Sources

| Source | Current API or file | Phase 02B use | Boundary |
| --- | --- | --- | --- |
| User profile referral fields | `src/lib/profile/profile-service.ts`, `src/lib/profile/types.ts`, `UserDataMapper.findProfileById` | Owns `affiliateEnabled`, `referralCode`, `referralUrl`, `qrCodeUrl`, credential, roles, and profile label. | Do not parse profile tool results or profile page UI for referral readiness. |
| Affiliate defaults | `UserDataMapper.ensureDefaultAffiliateAccess` provisions admins; `toggleAffiliate` enables/disables users. | Helps classify `internal_admin` and `community_affiliate` modes. | Do not make affiliate enablement a role substitute. It is a profile capability. |
| Referral ledger | `src/lib/referrals/referral-ledger.ts`, `ReferralDataMapper`, `ReferralEventDataMapper` | Owns validated visits, conversation starts, registration linkage, qualified opportunities, credit state, and idempotent milestone events. | Do not reconstruct referral truth from chat cards, cookies, or dashboard rows. |
| Referral activity/feed mapping | `src/lib/referrals/referral-milestones.ts` | Converts referral events into user-facing activity and feed milestones. | Mapping labels are presentation helpers; source refs still point to `referral` and `referral_event`. |
| Affiliate self-service analytics | `src/lib/referrals/referral-analytics.ts`, `loadReferralsWorkspace` | Provides overview, pipeline, recent activity, and notification feed for the current affiliate. | Analytics are projections over ledger rows, not canonical storage. |
| Admin affiliate analytics | `src/lib/referrals/admin-referral-analytics.ts`, `loadAdminAffiliatesWorkspace` | Provides exception pressure, pending credit review, leaderboard, and payout-ready rows. | Admin analytics should produce pressure refs, not mutate transition state directly. |
| Referral landing and QR | `src/app/r/[code]/page.tsx`, `src/app/api/qr/[code]/route.ts`, `referral-resolver.ts`, `referral-visit.ts` | Public share and signed visit entry; QR readiness can be projected from profile referral fields. | Route handlers validate and serialize HTTP only; core projection must not import routes. |
| Chat stream attribution | `src/lib/chat/stream-intake.ts` and `ReferralLedgerService.attachValidatedVisitToConversation` | Attaches signed visits to conversation and ledger before downstream workflow. | Do not treat raw cookies or client bootstrap state as durable trust context. |
| Anonymous migration | `src/lib/chat/migrate-anonymous-conversations.ts` | Links migrated conversations to authenticated referral state on login/registration. | Migration status projection is Phase 09; Phase 02B can consume successful linkage only. |
| Campaign coach queue | `src/lib/referrals/campaign-queue.ts`, `campaign-presets.ts`, `/referrals/actions.ts` | Useful first-share evidence and starter campaign guidance. | Current queue is preference-backed and drained into chat cards; it is not yet a durable transition record. |
| Lifecycle queue | `src/lib/lifecycle/lifecycle-queue.ts`, `src/core/entities/lifecycle.ts`, `src/core/entities/coach.ts` | Useful setup/onboarding evidence. | Lifecycle/coach cards are presentation. Only queued or recorded durable events can become refs. |
| Chat tools | `get_my_referral_qr`, `get_my_affiliate_summary`, `list_my_referral_activity`, admin affiliate tools | Prove share/analytics capability exists and provide tool result compatibility. | Tool results are not projection authority. Projection must call the same underlying services or ports. |

### Current Product Surfaces

- `/referrals` loads `loadReferralsWorkspace(userId)` and returns a stable
  disabled state when `affiliateEnabled`, `referralCode`, `referralUrl`, or
  `qrCodeUrl` is missing.
- `/admin/affiliates` loads global affiliate overview, leaderboard, pipeline,
  exception queues, and manual credit review actions.
- `/r/{code}` validates an enabled affiliate referral code, starts signed visit
  activation through `ReferralVisitActivator`, and lets the visitor continue to
  chat.
- `/api/referral/{code}` and `/api/referral/visit` validate and read signed
  referral visit state.
- `/api/qr/{code}` renders a QR image only for enabled referral codes.
- Chat tools expose referral QR, affiliate summary, referral activity, admin
  summary, and admin exceptions from shared profile and analytics services.

### Current Gaps

- No `OperatorTransitionProfile` projection or persistence exists yet.
- No `TrustDistributionContext` projection exists yet.
- Campaign and lifecycle queues are preference-backed, best-effort, and drained
  into chat presentation; they are not durable restore state after consumption.
- Physical-card/share-asset workflow does not have a canonical asset ref yet.
- Intro scripts exist only as campaign/coach copy, not as durable
  `TrustIntroScript` refs.
- Admin exception pressure is queryable, but not represented as a restoreable
  `recommendedAction` for admins.
- First-run offer formation is not recorded as compact expertise, audience, or
  offer refs outside transcript/profile/lifecycle hints.

## Collect

Before implementation, re-check the current code for these source families:

- install and welcome flow
- lifecycle and coach state
- user profile referral fields
- `/r/{code}` referral landing and signed visit activation
- `/api/referral/{code}` and `/api/referral/visit`
- `/api/qr/{code}`
- referral ledger and referral events
- `/referrals` self-service workspace
- `/admin/affiliates` admin workspace
- affiliate analytics and notification feed
- chat tools for referral QR, affiliate summary, and referral activity
- anonymous-to-authenticated referral migration

Likely starting points:

- `src/app/install/page.tsx`
- `src/app/install/InstallWizard.tsx`
- `src/app/welcome/page.tsx`
- `src/core/entities/lifecycle.ts`
- `src/core/entities/coach.ts`
- `src/lib/lifecycle/lifecycle-queue.ts`
- `src/lib/profile/profile-service.ts`
- `src/app/r/[code]/page.tsx`
- `src/app/api/referral/[code]/route.ts`
- `src/app/api/referral/visit/route.ts`
- `src/app/api/qr/[code]/route.ts`
- `src/lib/referrals/referral-ledger.ts`
- `src/lib/referrals/referral-analytics.ts`
- `src/lib/referrals/admin-referral-analytics.ts`
- `src/lib/referrals/referral-milestones.ts`
- `src/lib/referrals/campaign-queue.ts`
- `src/lib/referrals/campaign-presets.ts`
- `src/app/referrals/page.tsx`
- `src/app/referrals/actions.ts`
- `src/app/admin/affiliates/page.tsx`
- `src/core/use-cases/tools/user-profile.tool.ts`
- `src/core/use-cases/tools/affiliate-analytics.tool.ts`
- `src/lib/chat/stream-intake.ts`
- `src/lib/chat/migrate-anonymous-conversations.ts`

## Decide

Decide the first projection scope.

Prefer the smallest high-value slice:

1. `TrustDistributionContext` from profile referral fields, referral analytics,
   recent referral events, and campaign preset evidence when available
2. `OperatorTransitionProfile` from profile role/capability state, setup or
   campaign evidence, referral readiness, and recent trust-distribution activity
3. setup blocker or first useful action from profile/referral readiness and
   readiness health
4. referral QR/link readiness with stable `/referrals`, `/r/{code}`, and
   `/api/qr/{code}` routes
5. recent referral milestone refs from `referral_events`
6. admin credit-review pressure from `AdminReferralAnalyticsService.getExceptions`
   for admin users

Default implementation posture:

- Start with rebuildable readers and pure projectors.
- Add no table for Phase 02B unless durable first-run, offer, intro-script,
  physical-card, or consumed campaign state cannot be faithfully rebuilt.
- If persistence is needed, record only compact source refs and idempotency keys;
  do not duplicate profile, referral, analytics, or chat payloads.

Rejected approaches must include:

- making first-run a dashboard tour
- hiding provider/setup blockers behind motivational guidance
- requiring a complete CRM before the user can get value
- treating affiliate/referral as only a marketing feature
- reconstructing QR/referral state from chat tool cards or transcript messages
- using `CoachPayload` system cards as durable operator-transition state
- using raw referral cookies as trust-distribution authority
- using admin analytics rows as mutable domain objects
- adding a broad activation table before proving which state cannot be rebuilt

## Source Authority Matrix

| Projection field | Current authority | Evidence-only or presentation source | First rule |
| --- | --- | --- | --- |
| `OperatorTransitionProfile.id` | deterministic projection id such as `otp_${userId}` or `otp_${conversationId}` | none | Stable across rebuilds. |
| `OperatorTransitionProfile.status` | referral readiness, campaign queue/recorded events, lifecycle/setup evidence, recent referral milestones | lifecycle/coach cards, welcome copy, transcript narration | Compute conservatively: no evidence means `not_started`; share-ready means `sharing`; recent referred activity means `following_up`; established business refs may become `operating`. |
| `operatorMode` | user roles, affiliate capability, profile credential, admin role, business workflow context | prompt text or user self-description in old messages | Admin role can imply `internal_admin`; affiliate readiness can imply `community_affiliate`; otherwise use explicit durable evidence only. |
| `expertiseRefs` | profile credential or future durable profile/offer records | chat text, welcome copy | Use profile credential only as a compact evidence-backed ref; do not infer expertise from transcript. |
| `audienceRefs` | future durable audience/offer/campaign records | campaign preset copy | Empty until a durable source exists. |
| `offerRefs` | future durable lead/offer/business records | transcript summaries | Empty until a durable source exists. Do not store invented offers from chat text. |
| `trustDistributionRef` | `TrustDistributionContext` projection id | tool cards | Set when referral readiness or ledger activity exists. |
| transition `recommendedAction` | readiness/profile/referral/admin pressure source refs | UI button labels | Choose `resolve_setup`, `prepare_share`, `share`, `follow_up`, or `operate` deterministically. |
| `TrustDistributionContext.referralCode` | `UserProfileViewModel.referralCode` / user row | tool result | Null if affiliate is disabled or code missing. |
| `referralUrl` | `buildPublicReferralUrl(referralCode)` via profile service | rendered link text | Null if referral code is unavailable. |
| `qrCodeUrl` | profile service `/api/qr/{code}` URL | QR image render response | URL ref only; binary QR generation remains route-owned. |
| `physicalShareAssets` | future asset catalog or materialization refs | downloaded QR response, browser image cache | Empty until asset catalog/materialization can identify physical-card assets. |
| `introScripts` | future durable intro-script/campaign records | campaign preset copy, coach cards | Empty or projection-only with evidence until persisted. Do not duplicate long campaign copy. |
| `activeCampaignRefs` | campaign preset selection if recorded durably | preference queue after drain, coach cards | If the current preference queue is the only source, mark as transient and defer durable restore. |
| `recentReferralRefs` | `referrals` and `referral_events`, `ReferralAnalyticsService.getRecentActivity` | notification feed cards | Use compact `BusinessObjectRef` refs for referral ids and statuses only. |
| trust `recommendedAction` | profile readiness, recent milestones, admin exception pressure | chat tool text | Disabled -> setup; ready/no activity -> share; activity/pending review -> follow up or review. |

## First Projection Shape

Implement Phase 02B as two projection families that can later be consumed by
Phase 03 restore.

Recommended files:

- `src/core/platform/operator-transition/OperatorTransitionProjector.ts`
- `src/core/platform/operator-transition/OperatorTransitionReader.ts`
- `src/core/platform/operator-transition/TrustDistributionProjector.ts`
- `src/core/platform/operator-transition/TrustDistributionReader.ts`
- `src/core/platform/operator-transition/*.test.ts`
- `tests/conversation/phase-02b-operator-transition-and-trust-distribution-projection.test.ts`

Recommended reader dependencies:

- a narrow profile reader that returns `UserProfileViewModel` or a core profile
  port
- a referral analytics/activity reader for affiliate-self metrics
- an admin referral pressure reader for admin-only exceptions and credit review
- optional campaign queue peek reader, treated as transient until recorded
- optional readiness/setup probe
- optional `BusinessWorkflowContextReader` so operator transition can align with
  existing business workflow refs without duplicating those rules

Suggested trust projection input:

```typescript
export interface TrustDistributionProjectionInput {
  userId: string;
  profile: UserProfileViewModel;
  recentActivity: readonly ReferralActivityItem[];
  overview?: AffiliateOverviewData | null;
  pipeline?: AffiliatePipelineData | null;
  adminPressure?: AdminReferralExceptionsResult | null;
  campaignCoach?: readonly CoachPayload[];
  observedAt: string;
}
```

Suggested operator projection input:

```typescript
export interface OperatorTransitionProjectionInput {
  userId: string;
  conversationId: string | null;
  profile: UserProfileViewModel;
  trustDistribution: TrustDistributionContext | null;
  businessWorkflowContext?: BusinessWorkflowContext | null;
  lifecycleEvents?: readonly LifecyclePayload[];
  campaignCoach?: readonly CoachPayload[];
  readiness?: WorkflowReadinessProbeResult | null;
  observedAt: string;
}
```

The exact types may change, but the input must stay explicit and already loaded.
Projectors must not query databases, call routes, read cookies, or inspect chat
messages.

## Clean Architecture, SOLID, And Gang Of Four Rules

Phase 02B must stay Uncle Bob clean in the practical repo sense: policy belongs
in pure projectors and use-case readers, data access belongs in adapters, and
framework code only authenticates or serializes.

### Clean Architecture Rules

- Entities in `src/core/entities` stay pure and unchanged unless a contract gap
  is proven.
- Projectors live under `src/core/platform/operator-transition` and import only
  entities, ports, and pure value helpers.
- Readers implement Phase 01 ports and depend on narrow source readers, not
  concrete `DataMapper` classes.
- SQLite, `getDb()`, profile services, analytics services, and route handlers are
  wired at the composition boundary.
- Next.js route handlers and pages are consumers or HTTP adapters; they do not
  own projection policy.
- React hooks and chat cards render or enqueue presentation. They do not own
  operator-transition truth.
- Tool results remain compatibility output. They are never restore authority.

### SOLID Rules

- Single Responsibility: `TrustDistributionProjector` owns share/referral/QR
  context; `OperatorTransitionProjector` owns activation status and next action;
  neither owns referral ledger mutation or UI rendering.
- Open/Closed: adding physical-card assets, offer records, or intro scripts
  should add a projection input/strategy, not rewrite unrelated referral logic.
- Liskov Substitution: readers must be testable with fake profile, analytics,
  admin-pressure, campaign, and workflow readers.
- Interface Segregation: do not pass broad profile services or analytics
  services when a reader needs only referral readiness or recent activity.
- Dependency Inversion: core projection depends on ports and abstractions;
  concrete `createProfileService`, `createReferralAnalyticsService`, and
  `createAdminReferralAnalyticsService` stay behind factories.

### Gang Of Four Patterns To Use Deliberately

- Repository: user profile, referral, referral event, campaign, and future
  operator records are read through ports.
- Data Mapper: SQLite mapping stays in adapter classes such as `UserDataMapper`,
  `ReferralDataMapper`, and `ReferralEventDataMapper`.
- Projector: pure projection maps loaded source records to
  `OperatorTransitionProfile` and `TrustDistributionContext`.
- Factory / Composition Root: `RepositoryFactory` or a narrow restore root wires
  concrete profile, analytics, referral, admin-pressure, and readiness readers.
- Strategy: mode/status/action mapping should be split into small strategies for
  admin setup, affiliate share readiness, campaign follow-up, and referral
  activity pressure.
- Adapter: existing route/services/tool outputs are adapted into narrow readers
  instead of imported by core projection.
- Facade: Phase 03 may compose workspace, workflow, operator, trust, jobs,
  assets, memory, and transcript. Phase 02B should not create that facade.
- Null Object / Empty Projection: absent referral access, campaign state,
  intro scripts, physical assets, or business workflow should produce nulls or
  empty arrays, not fake inferred objects.

Patterns to avoid:

- Active Record user/referral models that query or save themselves
- Service Locator calls inside core projectors
- god activation service that imports routes, hooks, analytics, profile, chat,
  and UI
- singleton domain state for first-run or campaign progress
- observer/SSE state as source of truth
- message-part or tool-card authority
- untyped metadata blobs where source refs are known

## Spec QA

The projections must answer:

- is the user operating an existing business, creating a new offer, navigating a
  career transition, acting as a community affiliate, or setting up the system
- what first action creates real agency
- what link, QR, script, or asset is ready to share
- what referral milestones or exceptions require follow-up
- what setup or health blocker prevents progress
- which refs are authoritative, and which are intentionally empty until a later
  phase records them

## Ground

Before coding, map each field to a current source:

- operator status from lifecycle, campaign, referral readiness, or explicit
  future activation rows
- referral code, URL, and QR route from profile/referral fields
- trusted-introduction milestones from referral ledger and events
- business refs from Phase 02A `BusinessWorkflowContextReader`
- unavailable or blocked states from profile/referral readiness and health
  sources
- admin pressure from affiliate exceptions and payout-review analytics

If a field has no current source, leave it null or empty and document the gap.
Do not backfill from transcript text.

## Build

Expected deliverables:

- repository-backed `OperatorTransitionReader` implementation
- repository-backed `TrustDistributionReader` implementation
- pure projectors for both contracts
- referral QR/link readiness projection
- first-run/setup/share/follow-up/admin-review recommended-action rules
- compact referral milestone refs from ledger/activity sources
- tests for empty, disabled, share-ready, recent-activity, and admin-pressure
  projections
- architecture canaries proving projection code does not import routes, hooks,
  UI, SQLite, tool results, or message parts
- `npm run qa:conversation-refactor` updated with Phase 02B suites and release
  evidence regenerated

Do not rebuild the affiliate system. This phase connects existing referral,
profile, lifecycle, campaign, and analytics infrastructure to first-run and
restore through compact read models.

Do not implement Phase 03 restore behavior in Phase 02B. Phase 02B supplies the
readers/projections; Phase 03 decides how homepage restore serializes and
renders them.

## Remove Before Phase 02B Is Complete

Phase 02B is not complete while operator transition or trust distribution still
depends on presentation-only mechanisms. Remove or demote these patterns before
closing the phase:

- Any Phase 02B projection that reads `ChatMessage`, `MessagePart`, `tool_call`,
  `tool_result`, `job_status`, or historical transcript JSON to infer operator
  mode, referral readiness, activity, or next action.
- Any projection dependency on `get_my_referral_qr`,
  `get_my_affiliate_summary`, `list_my_referral_activity`, or admin affiliate
  tool result payloads as authority. Use the underlying profile/analytics/source
  readers instead.
- Any core projection import from `src/app`, `src/components`, `src/hooks`,
  `next/*`, route handlers, or page modules.
- Any direct `getDb()` or `better-sqlite3` usage inside Phase 02B core/platform
  files.
- Any claim that campaign or lifecycle coach cards are durable transition state
  after the queue is drained. Either record a durable ref or leave the field
  empty/deferred.
- Any use of raw referral cookies or client bootstrap state as trust authority.
  Only signed, server-validated visits attached to ledger/conversation state can
  become refs.
- Any duplicated profile, referral, analytics, admin, lead/deal, or campaign
  payload stored inside `OperatorTransitionProfile` or
  `TrustDistributionContext`.
- Any automatic payout or credit approval behavior. Admin review remains
  manual-first.
- Any physical-card/share-asset ref that is only a downloaded QR response or
  browser cache item instead of a durable asset/materialization ref.
- Any intro script that is copied from long campaign text without an evidence
  ref or retention decision.
- Any new broad activation table that stores loosely typed JSON instead of
  compact source refs and stable fields.
- Any non-idempotent recorder that creates duplicate campaign, intro-script,
  referral, or transition refs when the same source event is replayed.
- Any Phase 03 restore code path that consumes operator/trust projections before
  Phase 02B has deterministic tests and evidence-runner coverage.

## Phase QA

Before implementation, confirm this phase improves the product for a user who
does not yet have a clean business workflow:

- a new operator can get a first useful action
- a career-transition user can resume offer formation when durable evidence
  exists, or the gap is explicit when it does not
- an affiliate can find and share a QR/link from canonical profile state
- a referred visitor's conversation keeps trusted attribution through the
  referral ledger
- admin review remains visible when credits or exceptions need attention
- disabled affiliate access returns a stable unavailable/setup action, not fake
  share readiness

Critical doc/code alignment checks before implementation starts:

- Every field has an authority level: durable source, server-captured evidence,
  transient hint, or deferred gap.
- Every core dependency points at a port, reader, entity, or pure helper.
- Projection can be rebuilt twice with identical output and no duplicate refs.
- Missing profile, disabled affiliate access, no referral activity, no campaign
  state, no business workflow, and no admin role all return deterministic
  nulls/empty arrays.

## Implementation QA

Required validation:

- unit tests for operator-mode and transition-status projection
- unit tests for referral QR/link readiness
- unit tests for disabled affiliate and no-activity cases
- unit tests for admin credit-review/exception pressure
- integration tests for referral visit to conversation linkage when readers use
  real mappers
- migration tests for anonymous referral linkage on registration/login, or an
  explicit Phase 09 deferral if this phase only consumes completed linkage
- browser tests for QR scan or `/r/{code}` activation into anonymous chat when
  restore consumes the projection in Phase 03
- browser or integration test for `/referrals` unavailable and enabled states
- evidence runner scenario for first-run agency and trust distribution restore
- architecture canary for `src/core/platform/operator-transition/*` forbidden
  imports

Recommended first test matrix:

- anonymous or missing profile returns null/empty projections without throwing
- authenticated user with affiliate disabled returns no share URLs and a
  `resolve_setup` recommendation
- enabled affiliate with referral code returns referral URL, QR URL, and `share`
  recommendation
- enabled affiliate with recent referral milestones returns referral refs and a
  `follow_up` recommendation
- admin with credit-review backlog returns an admin review recommendation
- campaign queue evidence can produce a transient campaign ref only if the
  source is still available; otherwise it is explicitly deferred
- projection never contains full referral metadata JSON, analytics rows, tool
  payloads, or transcript parts

## Update

After completion, update Phase 03 with the exact reader APIs and restore fields
for operator transition and trust distribution.

Also update Phase 10 with the UI elements for:

- operator mode/status
- referral QR/link/share readiness
- campaign or intro-script next action
- trusted-introduction follow-up
- admin credit-review pressure
- disabled affiliate/setup state

Update `src/lib/evals/conversation-refactor-evidence.ts` and regenerate
`release/conversation-refactor-evidence.json` after adding the Phase 02B focused
suites.

## Implementation Notes

Phase 02B is implemented as rebuildable projection-backed readers over existing
profile, referral-analytics, admin-exception, workflow, and readiness sources.
It adds no schema and no restore/UI cutover.

Implemented files:

- `src/core/platform/operator-transition/TrustDistributionProjector.ts`
- `src/core/platform/operator-transition/TrustDistributionReader.ts`
- `src/core/platform/operator-transition/OperatorTransitionProjector.ts`
- `src/core/platform/operator-transition/OperatorTransitionReader.ts`
- `src/core/platform/operator-transition/TrustDistributionProjector.test.ts`
- `src/core/platform/operator-transition/TrustDistributionReader.test.ts`
- `src/core/platform/operator-transition/OperatorTransitionProjector.test.ts`
- `src/core/platform/operator-transition/OperatorTransitionReader.test.ts`
- `tests/conversation/phase-02b-operator-transition-and-trust-distribution-projection.test.ts`

Composition wiring:

- `getTrustDistributionReader()` in `src/adapters/RepositoryFactory.ts`
  constructs a repository-backed trust reader from the profile service,
  referral analytics service, admin referral analytics service, conversation
  repository, and readiness probe.
- `getOperatorTransitionReader()` in `src/adapters/RepositoryFactory.ts`
  constructs a repository-backed operator reader from the profile service,
  trust-distribution reader, business-workflow reader, conversation repository,
  admin referral analytics service, and readiness probe.

Implemented source behavior:

- trust distribution uses canonical profile referral fields for referral code,
  public link, and QR route readiness
- recent affiliate activity becomes compact referral refs and a follow-up
  recommendation without copying analytics payloads
- disabled or missing affiliate readiness returns a stable `resolve_setup`
  action instead of fake share readiness
- admin exception pressure becomes review/follow-up guidance without turning
  admin analytics rows into mutable domain state
- operator transition uses durable workflow context, trust-distribution state,
  roles, credential, and readiness to compute conservative mode/status/action
- expertise refs use the profile credential only as a compact evidence-backed
  ref; audience, offer, intro script, campaign, and physical-share asset refs
  remain intentionally empty until later phases record durable sources

Removal status:

- Phase 02B core projection code does not import routes, pages, components,
  hooks, `next/*`, transcript parts, tool-result payloads, SQLite, or `getDb()`
- tool outputs remain compatibility surfaces and are not trust/operator
  authority
- campaign, intro-script, and physical-share-asset refs remain deferred instead
  of being backfilled from drained queues, long copy, or browser caches

Executable proof:

- `npm run qa:conversation-refactor`
