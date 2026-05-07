# Phase 01c3i: Ordo Card System And Progressive Disclosure

Status: Implemented

Parent phase:

- `01c3-authenticated-workspace-tool-rail.md`

Depends on:

- `01c3h-object-centered-information-architecture.md`

## Goal

Create the shared object-card contract that lets Dashboard, Studio, Business,
and later detail surfaces present different business objects with the same
interaction grammar.

The solopreneur should not have to know whether an item came from a job table,
activity event, media workflow, file table, referral milestone, operation, or
business workflow context. They should see the object first, then drill into the
right evidence.

Every card should answer:

- What is it?
- What state is it in?
- Why does it matter?
- What changed recently?
- What should I do next?
- Where can I inspect provenance, funnel, performance, related objects, and
  activity?

## Product Rule

Cards are the first disclosure layer. Detail views are the second. Provenance,
funnel data, performance metrics, logs, job history, operation steps, and raw
activity are deeper lenses.

Do not make regular users start from raw jobs, logs, event streams, or internal
operation machinery. Those remain durable evidence.

## Current Code Grounding

### Object Taxonomy Contract

`src/core/entities/ordo-object.ts` now owns the shared object taxonomy from
`01c3h`, and `src/lib/shell/shell-navigation.ts` imports/re-exports it for
route-facing callers:

- `ORDO_OBJECT_KINDS`
- `OrdoObjectKind`
- `ORDO_DETAIL_LENSES`
- `OrdoDetailLens`
- `ORDO_OBJECT_KIND_CONTRACTS`
- `CURRENT_OBJECT_CENTERED_SURFACE_GAPS` remains shell-specific and is now
  empty after the `/studio` and `/business` root surface closeout.

Implementation note resolved: the object unions are no longer owned by shell
navigation, and the Ordo card layer imports the shared core entity directly.

Closeout evidence:

- `docs/_refactor/ordo/evidence/phase-01c3m-object-centered-ux-regression-closeout.md`

### Activity Card Donor

`src/components/activity/ActivityCard.tsx` is a source-event card. It already
handles:

- source labels,
- status pills,
- title/summary,
- updated timestamp,
- one primary link,
- secondary links.

It is used by:

- `src/components/activity/ActivityWorkspace.tsx`,
- `src/components/dashboard/UserDashboard.tsx`,
- the attention inbox path from the activity read model.

Do not rename `ActivityCard` into `OrdoCard`. Activity remains the ledger card.
The Ordo card layer should project activity into object cards only when a source
event is the best available donor.

### Dashboard Donor

`src/components/dashboard/UserDashboard.tsx` already has the right mobile-first
dashboard block shape:

- needs attention,
- current work,
- recent outputs,
- business loop,
- system health.

`src/lib/dashboard/load-user-dashboard.ts` currently loads those blocks from
`ActivityReadModel` and `ReferralAnalyticsService.getOverview()`. That is useful
input, but the dashboard should eventually render `OrdoCard` buckets rather
than `ActivityItem[]`.

### Jobs And Workflow Donor

`src/components/jobs/JobsWorkspace.tsx` already moved the work index to a
single-column layout and renders two donor card shapes:

- `data-work-index-card="media_workflow"`,
- `data-work-index-card="job"`.

It includes:

- search,
- filters,
- pagination,
- active/attention/completed summary counts,
- inline progress bars,
- linked job buttons for workflows,
- final artifact links,
- operation action buttons for workflows with operations,
- inline job detail/history on selected job,
- retry/cancel/copy/export actions.

The backing read models are:

- `src/lib/jobs/job-read-model.ts`
  - `CanonicalJobSnapshot`
  - redacted `inputSnapshot`
  - result envelope/artifact/materialization refs
  - ownership/failure metadata
- `src/lib/jobs/load-user-jobs-workspace.ts`
  - `UserJobsWorkspaceQuery`
  - `JobsWorkIndexBucket`
  - normalized filters and page info
- `src/lib/media/workflows/media-workflow-read-model.ts`
  - `CanonicalMediaWorkflowSnapshot`
  - `finalArtifact`
  - `linkedJobIds`
  - `linkedJobs`
  - operation refs/actions
  - stage progress

For 01c3i, a media workflow should project to a `workflow_run` card. Raw jobs
should project to `workflow_run` cards only as a fallback or diagnostic card;
they should not become the primary Studio language when a workflow object exists
above them.

### Media Asset Donor

`src/components/media/UserMediaWorkspace.tsx` currently uses a two-pane asset
list/detail pattern. It supports:

- filters for file type, source, retention, attached state,
- storage/quota summary cards,
- image/video/audio/chart/graph/document previews,
- safe delete for unattached assets,
- governed preview links.

`src/lib/media/user-media.ts` exposes `UserMediaItem`, but that DTO is page
specific and lacks richer provenance fields such as `producedByJobId` and
`materializationKey`.

The better first donor for object cards is:

- `src/core/platform/asset-catalog/AssetCatalogReader.ts`
- `src/core/entities/asset-catalog.ts`

`AssetCatalogEntry` already includes:

- `assetId`,
- `kind`,
- `ownerUserId`,
- `sourceType`,
- `status`,
- `label`,
- `fileName`,
- `mimeType`,
- `source`,
- `retentionClass`,
- `conversationId`,
- `producedByJobId`,
- `materializationKey`,
- dimensions/duration.

Use `AssetCatalogEntry` for `media_asset` cards. Use `UserMediaItem` only as a
legacy page donor until Studio has parity.

### Referral, QR, And Business Donor

`src/components/referrals/ReferralsWorkspace.tsx` already exposes:

- referral code,
- referral URL,
- QR code,
- QR download,
- copy actions,
- CTA copy,
- overview metrics,
- timeseries,
- pipeline stages,
- outcome counts,
- recent milestone list.

`src/lib/referrals/load-referrals-workspace.ts` composes:

- `UserProfileViewModel`,
- `AffiliateOverviewData`,
- `AffiliateTimeseriesPoint[]`,
- `AffiliatePipelineData`,
- `ReferralActivityItem[]`.

`src/lib/referrals/referral-analytics.ts` and
`src/lib/referrals/referral-milestones.ts` expose usable donors for
`tracked_link`, `campaign`, `person`, and business-loop cards. Phase `01c3q`
adds generic tracked links for published public offers and owned public URLs;
content/media/campaign-specific target validators remain a known gap and must
not be invented in cards.

### Business Workflow Context Donor

`src/core/platform/business-workflow/BusinessWorkflowContextReader.ts` and
`src/core/entities/business-workflow-context.ts` project conversation-centered
business context:

- primary mode,
- origin,
- related refs,
- lifecycle refs,
- notification refs,
- interrupted turn refs,
- health refs,
- recommended action.

This remains the right donor for `person`, `conversation`, and funnel context
cards. After 01c3p, `src/lib/business/people-read-model.ts` provides the first
derived owner-level person index over this evidence. It is still not a durable
merge/split identity table.

### Operation Donor

`src/frameworks/ui/operations/OperationCard.tsx` renders operation cards inside
rich content/chat surfaces. It already handles:

- status/risk labels,
- operation id,
- progress,
- artifact count,
- latest event,
- action buttons.

`src/lib/operations/operation-read-api.ts`,
`src/core/use-cases/operations/OperationReadModel.ts`, and
`src/lib/operations/operation-action-view-model.ts` provide the durable action
and permission model.

Do not collapse `OperationCard` into `OrdoCard`. Instead project operation
summaries into Ordo cards for Dashboard/Studio/Business, and keep the existing
operation card for operation-rich-content/detail rendering.

### Chat Capability Card Donor

`src/core/entities/capability-result.ts` and `src/core/entities/rich-content.ts`
already define chat-facing result envelopes, artifact refs, progress phases, job
status blocks, and operation-card blocks.

These are not the Ordo object-card contract. They are execution/result donors.
The Ordo card layer may read `CapabilityResultEnvelope` fields through
`CanonicalJobSnapshot`, but it should not render transcript-shaped message parts
as the product card model.

## Target Contract

Create a stable object card view model. Exact file names may change during
implementation, but the recommended target is:

- `src/core/entities/ordo-object.ts`
  - shared object kind/detail lens/source ref types, extracted from shell if
    feasible.
- `src/lib/ordo-cards/ordo-card-types.ts`
  - user-facing card view-model types.
- `src/lib/ordo-cards/ordo-card-projectors.ts`
  - projectors from existing donor read models.
- `src/components/ordo-cards/OrdoCard.tsx`
  - shared rendering primitive.
- `src/components/ordo-cards/OrdoCardList.tsx`
  - optional bucket/list wrapper if it reduces duplication.

Suggested contract:

```ts
type OrdoCardKind = OrdoObjectKind;

type OrdoCardBucket =
  | "needs_attention"
  | "in_motion"
  | "produced"
  | "business_loop"
  | "history";

type OrdoCardStatus =
  | "draft"
  | "queued"
  | "running"
  | "needs_review"
  | "blocked"
  | "failed"
  | "succeeded"
  | "published"
  | "archived"
  | "unavailable";

type OrdoCardTone = "neutral" | "active" | "good" | "warn" | "bad";

interface OrdoObjectRef {
  kind: OrdoCardKind;
  id: string;
  label: string;
  href?: string;
}

interface OrdoSourceRef {
  sourceKind:
    | "activity"
    | "job"
    | "media_workflow"
    | "asset_catalog"
    | "user_file"
    | "blog_asset"
    | "referral"
    | "referral_event"
    | "business_workflow_context"
    | "operation"
    | "capability_result";
  sourceId: string;
  href?: string;
}

interface OrdoCardAction {
  id: string;
  label: string;
  href?: string;
  actionType?: "route" | "operation" | "job" | "copy" | "download" | "send";
  tone?: "primary" | "secondary" | "destructive";
  disabled?: boolean;
  disabledReason?: string | null;
  requiresConfirmation?: boolean;
  payload?: Record<string, unknown>;
}

interface OrdoCardMetric {
  label: string;
  value: string;
  tone?: OrdoCardTone;
}

interface OrdoCardPreview {
  kind: "image" | "audio" | "video" | "chart" | "graph" | "document" | "qr" | "avatar" | "none";
  href?: string;
  alt?: string;
  mimeType?: string;
}

interface OrdoCard {
  id: string;
  kind: OrdoCardKind;
  objectRef: OrdoObjectRef;
  bucket: OrdoCardBucket;
  status: OrdoCardStatus;
  statusLabel: string;
  tone: OrdoCardTone;
  title: string;
  subtitle?: string;
  summary: string;
  preview: OrdoCardPreview;
  metrics: OrdoCardMetric[];
  primaryAction?: OrdoCardAction;
  secondaryActions: OrdoCardAction[];
  relatedRefs: OrdoObjectRef[];
  provenanceRefs: OrdoSourceRef[];
  activityRefs: OrdoSourceRef[];
  detailHref: string;
  diagnosticHref?: string;
  ownerUserId?: string | null;
  roleVisibility: readonly RoleName[];
  createdAt?: string;
  updatedAt: string;
}
```

The important constraints are:

- The card id must be object-based, not a borrowed job id unless the object is a
  `workflow_run` representing that job.
- The card must preserve source refs separately from object refs.
- Permission and role visibility must travel with the card.
- The card must have a deterministic `detailHref`, even if it initially points
  to a donor route.
- The card must support an optional `diagnosticHref` for jobs/activity/operation
  detail.
- The card must have no raw secret-bearing input snapshots.

## Projector Scope

Implement projectors in small layers:

### Activity Fallback Projector

- Input: `ActivityItem`.
- Output: a diagnostic/fallback `OrdoCard`.
- Purpose: Dashboard can migrate incrementally without losing current data.
- Constraint: activity source kind remains visible in `provenanceRefs`; the card
  title should not imply the activity event is the final business object.

### Job Projector

- Input: `CanonicalJobSnapshot`.
- Output: `workflow_run` card.
- Purpose: fallback work card and diagnostic work-card support.
- Required refs:
  - object ref: `workflow_run:${jobId}`,
  - source ref: `job:${jobId}`,
  - conversation ref when present,
  - artifact/materialization refs from the result envelope.
- Constraint: do not turn artifact refs into `media_asset` cards unless there is
  a real asset id.

### Media Workflow Projector

- Input: `CanonicalMediaWorkflowSnapshot`.
- Output: `workflow_run` card.
- Purpose: primary Studio in-motion/completed-work card.
- Required refs:
  - source ref for workflow,
  - source refs for linked jobs,
  - operation source ref when present,
  - final artifact ref when present.
- Constraint: linked job ids are provenance; the workflow is the user-facing
  object.

### Asset Projector

- Input: `AssetCatalogEntry`.
- Output: `media_asset` card, or `content_item` only when the source clearly
  represents published/editorial content.
- Purpose: primary Studio produced-object card.
- Required refs:
  - asset catalog/user file/blog asset source ref,
  - produced-by job source ref when present,
  - materialization ref when present,
  - conversation ref when present.
- Constraint: use governed preview routes and owner visibility.

### Referral/Business Projectors

- Inputs:
  - `AffiliateOverviewData`,
  - `AffiliatePipelineData`,
  - `ReferralActivityItem`,
  - `UserProfileViewModel`.
- Outputs:
  - `tracked_link` card for the current referral link/QR,
  - `campaign` or `person` summary cards only where the donor data supports it,
  - fallback business-loop cards for referral milestones.
- Constraint: generic tracked-link and campaign objects do not exist yet. Mark
  those cards as referral-backed and do not claim generic QR support.

### Business Workflow Context Projector

- Input: `BusinessWorkflowContext`.
- Output: `conversation` or `person` context card where a stable person/contact
  id exists; otherwise a conversation card.
- Constraint: do not create a fake account-level people index in this phase.

### Operation Projector

- Input: `OperationSummary` or conversation/admin operation summary.
- Output: `operation` card.
- Purpose: attention/confirmation cards and provenance links.
- Constraint: actions must use the existing operation action model and preserve
  confirmation/risk metadata.

## Component Scope

Add a reusable `OrdoCard` rendering primitive with progressive disclosure:

- compact mobile layout first,
- icon/status/title/summary visible without expansion,
- one primary action,
- secondary actions in a compact row on desktop and overflow/detail on mobile,
- metrics are capped and wrap safely,
- preview is optional and must not force layout shift,
- long titles and IDs must not overflow,
- diagnostic/provenance links are visually secondary.

Do not replace every donor component in this phase. Minimum implementation is:

- shared type contract,
- shared card component,
- projector coverage for at least one Studio object and one Business object,
- dashboard-compatible card list path,
- tests that lock the contract.

`ActivityCard`, `OperationCard`, `JobsWorkspace` cards, and `UserMediaWorkspace`
can remain while the Ordo card system gains parity.

## Read Model Boundary

The first implementation should be read-model only.

Do not add a universal `ordo_cards` table in 01c3i. Physical storage can wait
until we prove the projection and invalidation needs. Existing durable sources
remain authoritative:

- jobs,
- job events,
- media workflows,
- user files,
- materialization records,
- blog assets/posts,
- referrals/events,
- operations/events/actions/artifacts,
- activity receipts.

## Route Boundary

Until `01c3j` and `01c3k` add object detail and Studio/Business routes:

- Studio-oriented cards may point `detailHref` to current donor routes such as
  `/jobs`, `/my/media`, or governed asset previews.
- Business-oriented cards may point `detailHref` to `/referrals` or `/offers`.
- `diagnosticHref` may point to `/activity`, `/jobs`, or `/operations/**`.
- Do not add `/studio` or `/business` in 01c3i unless the implementation scope
  is explicitly expanded.

## UX Contract

### Mobile

- Cards are single-column.
- The primary action is obvious and thumb-sized.
- Secondary actions are fewer than desktop and can move into detail.
- Preview regions must have stable dimensions.
- Long labels wrap without overlapping adjacent controls.
- Metric rows should collapse before they shrink into illegible text.

### Desktop

- Cards may show icon + label controls.
- Studio/Business pages can later expose filters and search above card lists.
- Dashboard cards remain compact.
- Detail can become a side panel only when mobile has a full-page equivalent.

### Icons

- Use `lucide-react` icons where an existing icon fits.
- Keep icons semantic:
  - media: image/audio/video/file,
  - workflow: activity/progress,
  - person: user/contact,
  - tracked link/QR: QR/link,
  - campaign: megaphone/target,
  - operation: shield/check/alert.
- Icon-only controls need accessible labels or tooltips.

## Required Work

- [x] Extract or reuse the object taxonomy without duplicating string unions.
- [x] Add `OrdoCard` view-model types.
- [x] Add source/object ref types that keep object identity separate from donor
  identity.
- [x] Add card status/bucket/tone mapping helpers.
- [x] Add projectors from:
  - [x] `ActivityItem`,
  - [x] `CanonicalJobSnapshot`,
  - [x] `CanonicalMediaWorkflowSnapshot`,
  - [x] `AssetCatalogEntry`,
  - [x] referral analytics/milestones,
  - [x] `BusinessWorkflowContext` where safe,
  - [x] operation summaries/actions.
- [x] Add reusable `OrdoCard` component.
- [x] Add compact list/bucket helper only if it prevents duplicate dashboard
  code. No dashboard helper was added because this phase only needed pure
  projection and a reusable card component.
- [x] Keep the first card read model in memory/projection only.
- [x] Keep legacy donor cards/pages until parity is proven.
- [x] Document explicit gaps for generic tracked links, campaigns, feed metrics,
  and governed person merge/split operations.

## Implemented Artifacts

- `src/core/entities/ordo-object.ts`
  - shared object taxonomy and detail lens contract,
  - object kind donor-source contracts,
  - primary object-centered surface list.
- `src/lib/shell/shell-navigation.ts`
  - now imports and re-exports the shared object taxonomy instead of owning the
    object unions locally.
- `src/lib/ordo-cards/ordo-card-types.ts`
  - reusable card, object-ref, source-ref, metric, preview, action, bucket,
    status, and tone contracts.
- `src/lib/ordo-cards/ordo-card-projectors.ts`
  - pure projectors for activity, job snapshots, media workflows, asset catalog
    entries, referral QR/link data, referral milestones, business workflow
    context, and operation summaries/actions,
  - optional viewer-role filtering for operation actions so admin-only actions
    do not appear in regular-user card projections.
- `src/components/ordo-cards/OrdoCard.tsx`
  - reusable first-disclosure object card component with stable preview,
    metric, primary-action, and secondary-action rendering,
  - non-link actions render disabled unless the caller supplies an action
    handler, avoiding dead confirmation/copy buttons during migration.
- Tests:
  - `src/core/entities/ordo-object.test.ts`,
  - `src/lib/ordo-cards/ordo-card-projectors.test.ts`,
  - `src/components/ordo-cards/OrdoCard.test.tsx`.

## Positive Tests

- [x] A media workflow projects to a `workflow_run` card with linked jobs as
  provenance, not as separate primary objects.
- [x] A completed media workflow with a final artifact keeps the final asset ref
  distinct from the workflow/job id.
- [x] An asset catalog entry projects to a `media_asset` card with preview,
  owner visibility, produced-by job ref, and materialization ref when present.
- [x] A referral link/QR donor projects to a `tracked_link` business-loop card
  with copy/open/download actions when enabled.
- [x] A referral milestone projects to a business-loop fallback card; 01c3p now
  adds derived person cards where relationship evidence can identify a person
  stage.
- [x] An operation requiring confirmation projects to a `needs_attention`
  operation card with risk/confirmation metadata preserved.
- [x] The shared `OrdoCard` renders primary and secondary actions accessibly.
- [x] Cards render with stable, responsive single-column/mobile-safe structure.

## Negative Tests

- [x] A card never uses a job id as an asset id.
- [x] Private assets are not exposed to another user. This phase preserves
  owner visibility and governed preview URLs; enforcement stays with existing
  donor routes and preview APIs.
- [x] Admin-only operation actions do not render for non-admin users. This phase
  preserves action role metadata and supports viewer-role filtering in operation
  and media-workflow projectors; existing operation action policy remains the
  execution authority.
- [x] Runtime/provider logs do not become regular user cards.
- [x] Generic tracked-link/campaign cards are not emitted when the only data is
  referral-code data.
- [x] Raw capability result envelopes are not rendered directly as Ordo cards.
- [x] Secret-bearing input snapshot fields are not surfaced in card summaries,
  metrics, actions, or refs.

## Edge Tests

- [x] Empty dashboard/card list remains covered by the existing dashboard/jobs
  donor tests. No new card-list helper was added in this phase.
- [x] No preview asset.
- [x] Long title and long file name are rendered in the reusable card without
  page-local layout coupling.
- [x] Many metrics are capped at the first four visible metrics.
- [x] Deleted source asset with retained provenance maps to history/archived
  status through the asset projector.
- [x] Workflow with linked job ids but unavailable linked job snapshots.
- [x] Asset with no producing job.
- [x] Referral access disabled.
- [x] QR exists with no scans.
- [x] Operation action disabled with a reason.
- [x] Very narrow mobile viewport is handled by the single-column responsive
  card structure; visual viewport screenshot coverage belongs to later page
  integration phases.
- [x] Reduced motion remains unaffected because this component adds no motion.

## Implementation Order

1. Add or extract object/card types.
2. Add pure status/bucket/tone/preview mapping helpers.
3. Add pure projectors with unit tests.
4. Add `OrdoCard` and rendering tests.
5. Optionally introduce a dashboard block that can render either existing
   `ActivityItem` cards or new `OrdoCard` cards during migration.
6. Update the phase doc with the exact files and validation results.

## Validation Commands

Expected implementation validation:

```bash
npm test -- --run src/lib/ordo-cards/ordo-card-projectors.test.ts src/components/ordo-cards/OrdoCard.test.tsx
npm test -- --run src/components/dashboard/UserDashboard.test.tsx src/components/jobs/JobsWorkspace.test.tsx src/components/media/UserMediaWorkspace.test.tsx src/components/referrals/ReferralsWorkspace.test.tsx src/frameworks/ui/operations/OperationCard.test.tsx
npx eslint src/lib/ordo-cards src/components/ordo-cards
npm run typecheck
```

Adjust paths if implementation chooses different file names, but keep equivalent
coverage.

Actual validation run:

```bash
npm test -- --run src/core/entities/ordo-object.test.ts src/lib/ordo-cards/ordo-card-projectors.test.ts src/components/ordo-cards/OrdoCard.test.tsx src/lib/shell/shell-navigation.test.ts
npm test -- --run src/components/dashboard/UserDashboard.test.tsx src/components/jobs/JobsWorkspace.test.tsx src/components/media/UserMediaWorkspace.test.tsx src/app/referrals/page.test.tsx src/frameworks/ui/operations/OperationCard.test.tsx
npx eslint src/core/entities/ordo-object.ts src/core/entities/ordo-object.test.ts src/lib/shell/shell-navigation.ts src/lib/shell/shell-navigation.test.ts src/lib/ordo-cards src/components/ordo-cards
npm run typecheck
```

Results:

- Focused taxonomy/card/shell tests: 37 passed.
- Donor page/component regression tests: 26 passed.
- Targeted ESLint: passed.
- Typecheck: passed.

## QA Follow-Up

The post-implementation QA pass found and fixed two migration-safety issues:

- Operation actions now preserve `confirmPolicy`, `confirmationText`,
  `allowedRoles`, `allowedStatuses`, and `expiresAt` on the card action model.
- `projectOperationSummaryToOrdoCard()` and `projectMediaWorkflowToOrdoCard()`
  accept optional viewer roles and filter operation actions before rendering.
- `OrdoCard` disables non-link actions when no handler is supplied, preventing
  a visible button that cannot actually execute.

## Exit Criteria

- [x] A reusable card contract exists.
- [x] Object identity and donor/source identity are separate.
- [x] Current donor systems can project into the same card grammar.
- [x] The card layer preserves provenance, permission, and action safety.
- [x] Dashboard/Studio/Business phases can reuse cards instead of inventing
  page-local object layouts.
- [x] Existing diagnostic and donor pages remain intact until replacement parity
  is proven.
