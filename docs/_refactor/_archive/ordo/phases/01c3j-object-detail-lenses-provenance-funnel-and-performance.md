# Phase 01c3j: Object Detail Lenses, Provenance, Funnel, And Performance

Status: Implemented

Parent phase:

- `01c3-authenticated-workspace-tool-rail.md`

Depends on:

- `01c3h-object-centered-information-architecture.md`
- `01c3i-ordo-card-system-and-progressive-disclosure.md`

Feeds:

- `01c3k-studio-business-surface-consolidation.md`

## Goal

Create the object detail layer behind Ordo cards.

The user-facing path should be:

`card -> object detail -> lens -> related evidence/action`

The detail layer must make Ordo feel simple for the solopreneur while keeping
the system inspectable. A produced video, audio file, QR link, referral, or
workflow should not be an isolated page. It should expose the context needed to
understand what it is, how it was produced, what it affected, and what the user
can ask Ordo to do next.

## Product Rule

Produced things default to provenance. Business-development objects default to
funnel or performance.

- Media assets, content items, and workflow runs expose how they were made.
- Operations remain governed execution objects; they stay diagnostic-first but
  act as provenance donors for produced work.
- Referral links, QR codes, campaigns, and offers expose whether they are
  working.
- Conversation-scoped business contexts expose funnel state and next action.
- Activity/history remains reachable for auditability, but it is not the first
  lens for most objects.

## Current Code Grounding

### Implemented Contract From Prior Phases

- `src/core/entities/ordo-object.ts`
  - Defines `ORDO_OBJECT_KINDS`, `ORDO_DETAIL_LENSES`,
    `ORDO_OBJECT_KIND_CONTRACTS`, and target surfaces.
  - Current object kinds are `media_asset`, `content_item`, `workflow_run`,
    `operation`, `person`, `offer`, `tracked_link`, `campaign`, and
    `conversation`.
  - Current lenses are `overview`, `provenance`, `funnel`, `performance`,
    `actions`, `history`, `related`, and `activity`.
- `src/lib/ordo-cards/ordo-card-types.ts`
  - Defines `OrdoCard`, `OrdoObjectRef`, `OrdoSourceRef`, `OrdoCardAction`,
    `detailHref`, `diagnosticHref`, `defaultLens`, `provenanceRefs`, and
    role/action metadata.
- `src/lib/ordo-cards/ordo-card-projectors.ts`
  - Projects activity, jobs, media workflows, asset catalog entries, referral
    links, referral activity, business workflow context, and operations into
    Ordo cards.
  - Closeout route state:
    - media asset: `/studio/media/[assetId]`,
    - media workflow: `/studio/workflows/[workflowId]`,
    - referral link/activity: `/business/referrals/[referralCode]`,
    - business workflow context: `/business/conversations/[conversationId]`,
    - operation: `/operations/[operationId]`.
  - Donor and diagnostic URLs remain available through `diagnosticHref` or
    source refs rather than primary navigation.
- `src/components/ordo-cards/OrdoCard.tsx`
  - Already treats `detailHref` as the main card destination.

Closeout evidence:

- `docs/_refactor/ordo/evidence/phase-01c3m-object-centered-ux-regression-closeout.md`

### Produced Media And Provenance Donors

- `src/core/platform/asset-catalog/AssetCatalogReader.ts`
  - User-scoped lookup for produced/reusable media by asset id.
- `src/core/platform/asset-catalog/AssetCatalogProjector.ts`
  - Projects `user_files`, `blog_assets`, and materialization records into
    `AssetCatalogEntry`.
  - Already carries the detail inputs needed for first-pass provenance:
    `assetId`, `kind`, `ownerUserId`, `sourceType`, `status`, `mimeType`,
    `conversationId`, `producedByJobId`, `materializationKey`, `toolName`,
    dimensions, duration, and derivative asset id.
- `src/app/api/user-files/[id]/route.ts`
  - Actual media serving route. It is not `[assetId]`.
  - `user_file` access is owner-checked. `blogasset_` access still has a
    TODO-shaped permission weakness and must not be used as proof of broad
    public access in this phase.
- `src/components/media/UserMediaWorkspace.tsx`
  - Current user-facing media donor page. It has previews, filtering, quota
    summary, and delete flow, but it is still a media library page rather than
    an object detail lens.
- `src/lib/media/user-media.ts`
  - Current page read model for `/my/media`.

### Workflow, Job, And Operation Donors

- `src/components/jobs/JobDetailPanel.tsx`
  - Mature donor for job status, job id, conversation id, failure class,
    recovery mode, replay/supersede lineage, artifact link, retry/cancel/copy,
    and history.
- `src/components/jobs/JobHistoryTimeline.tsx`
  - Durable owner-visible job event timeline.
- `src/app/api/jobs/[jobId]/route.ts`
- `src/app/api/jobs/[jobId]/events/route.ts`
- `src/app/api/jobs/events/route.ts`
  - Existing job read/action/event APIs.
- `src/lib/operations/operation-workspace-loader.ts`
  - `loadOperationDetailWorkspace` already enforces read access, loads
    operation snapshot, last 200 events, up to 100 artifacts, and available
    actions.
- `src/components/operations/OperationDetailWorkspace.tsx`
  - Current diagnostic operation detail surface.
- `src/frameworks/ui/operations/OperationTimeline.tsx`
  - Donor for operation steps and event timeline.
- `src/app/operations/[operationId]/page.tsx`
  - Existing operation detail route. Keep it. Do not rebuild operations in the
    Studio surface yet.

### Funnel And Performance Donors

- `src/lib/referrals/referral-analytics.ts`
  - Current best source for performance/funnel metrics:
    introductions, started chats, registered users, qualified opportunities,
    credit status counts, timeseries, pipeline stages, outcomes, recent
    activity, and notification feed.
- `src/components/referrals/ReferralsWorkspace.tsx`
  - Donor for QR/link/share/download UI, performance cards, timeseries,
    pipeline, outcomes, and recent milestones.
- `src/lib/referrals/referral-milestones.ts`
  - Projects referral events into human-visible milestones.
- `src/core/platform/business-workflow/BusinessWorkflowContextReader.ts`
  - Conversation-scoped reader for lead, consultation, deal, training path,
    referral, referral events, job notification events, and readiness.
- `src/core/platform/business-workflow/BusinessWorkflowContextProjector.ts`
  - Projects the above into `BusinessWorkflowContext` related refs,
    lifecycle refs, notification refs, health refs, and recommended action.

### Explicit Corrections To Older Assumptions

- There is no `src/lib/admin/attribution/admin-attribution.ts`. Use the
  referral analytics, business workflow context, and existing admin referral
  analytics donors instead of inventing a new attribution module here.
- There are no public `/studio` or `/business` root routes yet. This phase may
  add typed object detail routes, but `01c3k` owns the larger Studio/Business
  index consolidation.
- The current system has conversation-scoped business context. It does not yet
  have a durable, general-purpose person/account object index. Treat `person`
  as a future object kind and do not fake it from partial referral data.
- Generic tracked links do not exist yet. The real implemented tracked-link
  donor is the referral/QR code system.

## Detail Route Contract

Implement user-facing object details with typed routes. Existing donor routes
remain available as diagnostic or legacy-compatible paths until `01c3k`
consolidates the indexes.

### Studio Object Routes

- `/studio/media/[assetId]`
  - Primary route for `media_asset`.
  - Default lens: `provenance`.
  - Loader must use `AssetCatalogReader.findByAssetId({ assetId, userId })`.
  - Preview must use `/api/user-files/[id]`.
- `/studio/workflows/[workflowId]`
  - Primary route for user-facing `workflow_run` when a durable media workflow
    id exists.
  - Default lens: `provenance`.
  - If only a raw job id exists, keep `/jobs?jobId=...` as the detail route
    until a workflow object exists.
- `/operations/[operationId]`
  - Keep existing operation detail route.
  - Operation cards may continue using this as `detailHref` because operations
    are diagnostic/governed execution objects.

### Business Object Routes

- `/business/referrals/[referralCode]`
  - Primary route for `tracked_link` backed by the current referral QR/link
    system.
  - Default lens: `performance`.
  - Route loader must verify the referral code belongs to the current user or
    the viewer is allowed by role.
- `/business/conversations/[conversationId]`
  - Primary route for conversation-scoped `conversation` or business workflow
    context details.
  - Default lens: `funnel` when business context exists; otherwise `history`.
  - Route loader must not expose admin-only lead/deal details to regular users.

Do not add a generic `/business/people/[personId]` route in this phase. The
person object is planned, but the current code does not support it cleanly.

## Shared Detail Model

Add a small detail contract beside the Ordo card contract. The detail model
should use cards and source refs instead of replacing them.

Suggested files:

- `src/lib/ordo-details/ordo-detail-types.ts`
- `src/lib/ordo-details/ordo-detail-projectors.ts`
- `src/lib/ordo-details/load-studio-object-detail.ts`
- `src/lib/ordo-details/load-business-object-detail.ts`
- `src/components/ordo-details/OrdoDetailLayout.tsx`
- `src/components/ordo-details/OrdoDetailLensTabs.tsx`
- `src/components/ordo-details/lenses/OverviewLens.tsx`
- `src/components/ordo-details/lenses/ProvenanceLens.tsx`
- `src/components/ordo-details/lenses/FunnelLens.tsx`
- `src/components/ordo-details/lenses/PerformanceLens.tsx`
- `src/components/ordo-details/lenses/RelatedLens.tsx`
- `src/components/ordo-details/lenses/ActivityLens.tsx`

Suggested TypeScript shape:

```ts
import type { OrdoDetailLens, OrdoObjectKind } from "@/core/entities/ordo-object";
import type { RoleName } from "@/core/entities/user";
import type { OrdoCard, OrdoCardAction, OrdoSourceRef } from "@/lib/ordo-cards";

export interface OrdoDetailFact {
  id: string;
  label: string;
  value: string;
  sourceRef?: OrdoSourceRef;
}

export interface OrdoDetailTimelineItem {
  id: string;
  label: string;
  occurredAt: string;
  summary?: string;
  sourceRef?: OrdoSourceRef;
  diagnostic?: boolean;
}

export interface OrdoDetailLensModel {
  lens: OrdoDetailLens;
  label: string;
  summary?: string;
  facts?: readonly OrdoDetailFact[];
  cards?: readonly OrdoCard[];
  timeline?: readonly OrdoDetailTimelineItem[];
  actions?: readonly OrdoCardAction[];
  emptyState?: string;
}

export interface OrdoObjectDetailModel {
  object: {
    kind: OrdoObjectKind;
    id: string;
    label: string;
    status?: string;
    ownerUserId?: string | null;
  };
  title: string;
  summary: string;
  defaultLens: OrdoDetailLens;
  availableLenses: readonly OrdoDetailLens[];
  primaryCard: OrdoCard;
  sourceRefs: readonly OrdoSourceRef[];
  provenanceRefs: readonly OrdoSourceRef[];
  relatedCards: readonly OrdoCard[];
  lenses: readonly OrdoDetailLensModel[];
  diagnosticHref?: string;
  roleVisibility: readonly RoleName[];
}
```

Keep this model serializable. The detail route should be easy to inspect in
tests and future workflow review tools.

## Lens Behavior

### Overview

Show the object identity, current status, recent update, preview when available,
primary action, and short summary. This should be enough for a mobile user to
understand whether they need to act.

### Provenance

For produced objects, show:

- asset/source type (`user_file`, `blog_asset`, generated, uploaded, derived),
- producing job id when available,
- materialization key when available,
- workflow id when available,
- conversation id when available,
- operation id when available,
- tool name/model when available,
- inputs and source assets when available,
- durable history from job/operation donors when allowed.

Do not invent missing lineage. If the asset has no producing job or workflow,
show an honest empty state such as: "This asset is in the catalog, but no
producing workflow was recorded."

### Funnel

For business workflow context and referral objects, show:

- current stage,
- origin/referral source,
- related lead/consultation/deal/training/referral refs when permitted,
- milestone timeline,
- recommended next action,
- conversation link when permitted.

For regular users, keep this owner-visible and conversation-scoped. Admin-only
lead/deal diagnostics remain in admin pages until a permissioned person/account
index exists.

### Performance

For referral/QR objects, use existing referral analytics:

- introductions,
- started chats,
- registered,
- qualified opportunities,
- credit state,
- timeseries,
- pipeline,
- outcomes,
- recent milestones.

For media/content objects, performance is optional in this phase. Render a
truthful empty state until feed/download/view metrics exist.

### Activity

Use durable source events where they exist:

- job event history from job APIs/components,
- operation events from operation loader/timeline,
- referral milestones from referral analytics,
- activity read model items from `src/lib/activity/**` where applicable.

Do not show raw logs or unrestricted JSON payloads to regular users. The
operation diagnostic route can continue to show richer payloads to permitted
viewers.

### Related

Related should reuse Ordo cards when possible. A media detail can show the
workflow card, job card, conversation card, and derivative/source asset cards.
A referral detail can show QR/link card, recent milestone cards, and related
conversation cards.

## Required Work

1. Add the `ordo-details` model and pure projector tests.
2. Add a shared `OrdoDetailLayout` that works as:
   - mobile: header, preview, lens control, stacked lens content,
   - desktop: constrained object header plus a two-column body with detail and
     related/context rail.
3. Implement `/studio/media/[assetId]`.
4. Implement `/business/referrals/[referralCode]`.
5. Implement `/business/conversations/[conversationId]` only if it can reuse
   `BusinessWorkflowContextReader` without creating a fake person model.
6. Update Ordo card projectors after routes exist:
   - asset cards -> `/studio/media/[assetId]`,
   - referral link cards -> `/business/referrals/[referralCode]`,
   - business workflow context cards -> `/business/conversations/[conversationId]`,
   - media workflow cards -> `/studio/workflows/[workflowId]` when route exists;
     otherwise keep current jobs donor route.
7. Keep diagnostic links:
   - jobs -> `/jobs?...`,
   - operations -> `/operations/[operationId]`,
   - admin-only views -> admin routes.
8. Update docs and exit evidence with route, permission, and screenshot/test
   proof.

## Access Control Rules

- All Studio and Business detail routes require a signed-in user unless the
  object is explicitly public in a later phase.
- Asset detail must use `AssetCatalogReader.findByAssetId` and must not fall
  back to direct database reads that bypass owner checks.
- User-file previews must continue through `/api/user-files/[id]`.
- Blog asset preview/details must not expand access beyond the current owner or
  role policy. The current route comment around `blogasset_` access is not a
  sufficient security contract.
- Referral detail must be scoped to the owner/referrer user unless admin access
  is explicitly checked.
- Business conversation detail must not expose unrelated lead/deal/consultation
  data.
- Runtime logs and raw operation payloads stay diagnostic/admin unless a field
  is intentionally promoted into the owner-visible detail model.

## Positive Tests

- Media asset card `detailHref` opens `/studio/media/[assetId]`.
- Media detail renders overview and provenance from `AssetCatalogEntry`.
- Media detail links to producing job when `producedByJobId` exists.
- Media detail links to conversation when `conversationId` exists and the user
  can read it.
- Media detail shows the preview through `/api/user-files/[id]`.
- Referral card `detailHref` opens `/business/referrals/[referralCode]`.
- Referral detail renders performance and funnel metrics from
  `ReferralAnalyticsService`.
- Business conversation detail renders recommended action and permitted related
  refs from `BusinessWorkflowContextReader`.
- Operation cards still open `/operations/[operationId]`.
- Existing `/my/media`, `/jobs`, `/referrals`, and `/operations/[operationId]`
  tests continue to pass.

## Negative Tests

- User cannot open another user's media asset detail.
- User cannot preview another user's `user_file`.
- User cannot open another user's referral code detail.
- Regular user detail does not render admin-only lead/deal internals.
- Missing provenance does not generate fake job/workflow/model text.
- Missing performance data renders an empty state, not zeroes presented as
  measured results when no metrics source exists.
- Raw operation event payloads are not rendered in regular Studio/Business
  object details.

## Edge Tests

- Produced asset with no workflow run.
- Produced asset with `producedByJobId` but no available job history.
- Workflow run with multiple output assets.
- Audio/video asset with duration metadata.
- Image asset with dimensions only.
- Deleted media file with retained catalog/provenance record.
- Referral QR scan without registration.
- Referral registration without qualified opportunity.
- Conversation with no lead/deal/referral business context.

## Suggested Verification Commands

Use targeted tests first, then the broader route/card checks:

```bash
npm test -- --run \
  src/lib/ordo-details/load-studio-object-detail.test.ts \
  src/lib/ordo-details/load-business-object-detail.test.ts \
  src/lib/ordo-details/ordo-detail-projectors.test.ts \
  src/components/ordo-details/OrdoDetailLayout.test.tsx \
  src/lib/ordo-cards/ordo-card-projectors.test.ts \
  src/app/my/media/page.test.tsx \
  src/app/referrals/page.test.tsx \
  src/app/operations/[operationId]/page.test.tsx \
  src/app/api/user-files/[id]/route.test.ts

npm run typecheck
```

If routes are added with Playwright coverage, verify at minimum:

- `/studio/media/[assetId]` desktop and mobile,
- `/business/referrals/[referralCode]` desktop and mobile,
- `/business/conversations/[conversationId]` if implemented,
- `/operations/[operationId]` regression.

## Exit Criteria

- Ordo cards have a clear object-detail destination for the implemented Studio
  and Business object types.
- Produced media objects expose inspectable provenance grounded in real catalog,
  job, workflow, conversation, or operation records.
- Referral/QR objects expose funnel and performance grounded in the current
  referral analytics model.
- Business conversation detail uses current `BusinessWorkflowContext` instead
  of inventing a premature person/account object model.
- Existing donor pages continue to work until `01c3k` consolidates Studio and
  Business indexes.
- Permission tests cover the asset, referral, and business context boundaries.

## Implementation Evidence

Implemented files:

- `src/lib/ordo-details/ordo-detail-types.ts`
- `src/lib/ordo-details/ordo-detail-routes.ts`
- `src/lib/ordo-details/ordo-detail-projectors.ts`
- `src/lib/ordo-details/load-studio-object-detail.ts`
- `src/lib/ordo-details/load-business-object-detail.ts`
- `src/lib/ordo-details/index.ts`
- `src/components/ordo-details/OrdoDetailLayout.tsx`
- `src/components/ordo-details/OrdoDetailLensTabs.tsx`
- `src/app/studio/media/[assetId]/page.tsx`
- `src/app/studio/workflows/[workflowId]/page.tsx`
- `src/app/business/referrals/[referralCode]/page.tsx`
- `src/app/business/conversations/[conversationId]/page.tsx`

Updated existing projection surfaces:

- `src/lib/ordo-cards/ordo-card-projectors.ts`
  - media cards now route to `/studio/media/[assetId]`,
  - media workflow cards now route to `/studio/workflows/[workflowId]`,
  - referral cards now route to `/business/referrals/[referralCode]`,
  - business workflow context cards now route to
    `/business/conversations/[conversationId]`,
  - donor/diagnostic routes remain available through `diagnosticHref` or
    source refs.
- `src/lib/referrals/referral-milestones.ts`
  - referral activity now links to the typed referral detail route.

QA corrections:

- `src/components/ordo-details/OrdoDetailLayout.tsx`
  - orders rendered lens sections with `defaultLens` first so produced media
    opens on provenance and referral/QR details open on performance instead of
    merely highlighting the intended default tab.
- `src/lib/ordo-details/ordo-detail-projectors.ts`
  - missing referral performance now renders a truthful empty state instead of
    presenting default zeroes as measured metrics.

Implemented tests:

- `src/lib/ordo-details/ordo-detail-projectors.test.ts`
- `src/lib/ordo-details/load-studio-object-detail.test.ts`
- `src/lib/ordo-details/load-business-object-detail.test.ts`
- `src/components/ordo-details/OrdoDetailLayout.test.tsx`
- `src/app/studio/media/[assetId]/page.test.tsx`
- `src/app/studio/workflows/[workflowId]/page.test.tsx`
- `src/app/business/referrals/[referralCode]/page.test.tsx`
- `src/app/business/conversations/[conversationId]/page.test.tsx`
- Updated Ordo card/projector tests for typed detail routes.
- Added QA regression coverage for default-lens ordering and missing referral
  performance empty states.

Verification run:

```bash
npm run typecheck -- --pretty false

npm test -- --run \
  src/lib/ordo-details/load-studio-object-detail.test.ts \
  src/lib/ordo-details/load-business-object-detail.test.ts \
  src/lib/ordo-details/ordo-detail-projectors.test.ts \
  src/components/ordo-details/OrdoDetailLayout.test.tsx \
  src/lib/ordo-cards/ordo-card-projectors.test.ts \
  src/components/ordo-cards/OrdoCard.test.tsx \
  'src/app/studio/media/[assetId]/page.test.tsx' \
  'src/app/studio/workflows/[workflowId]/page.test.tsx' \
  'src/app/business/referrals/[referralCode]/page.test.tsx' \
  'src/app/business/conversations/[conversationId]/page.test.tsx' \
  src/app/my/media/page.test.tsx \
  src/app/referrals/page.test.tsx \
  'src/app/operations/[operationId]/page.test.tsx' \
  'src/app/api/user-files/[id]/route.test.ts'

npx eslint \
  src/lib/ordo-details/ordo-detail-types.ts \
  src/lib/ordo-details/ordo-detail-routes.ts \
  src/lib/ordo-details/ordo-detail-projectors.ts \
  src/lib/ordo-details/load-studio-object-detail.ts \
  src/lib/ordo-details/load-studio-object-detail.test.ts \
  src/lib/ordo-details/load-business-object-detail.ts \
  src/lib/ordo-details/load-business-object-detail.test.ts \
  src/lib/ordo-details/index.ts \
  src/components/ordo-details/OrdoDetailLayout.tsx \
  src/components/ordo-details/OrdoDetailLensTabs.tsx \
  'src/app/studio/media/[assetId]/page.tsx' \
  'src/app/studio/workflows/[workflowId]/page.tsx' \
  'src/app/business/referrals/[referralCode]/page.tsx' \
  'src/app/business/conversations/[conversationId]/page.tsx' \
  src/lib/ordo-cards/ordo-card-projectors.ts \
  src/lib/referrals/referral-milestones.ts
```

Result:

- Typecheck passed.
- Targeted suite passed: 14 test files, 56 tests.
- Focused lint run passed.
