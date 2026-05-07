# Current Read Model Map

Issue: https://github.com/StudioOrdo/ai_mcp_chat_ordo/issues/1

Status: initial archaeology evidence

## Summary

Most major sections have read-model loaders. The issue is that they are
separate, and the UI often still feels like a dashboard because the read models
do not yet share a live event and brief system.

## Today

Status: implemented, needs better backend inputs

Code anchors:

- `src/lib/dashboard/load-user-dashboard.ts`
- `src/lib/dashboard/today-brief-read-model.ts`
- `src/components/dashboard/UserDashboard.tsx`

What is real:

- Today projects activity items into intent buckets:
  - decide
  - watch
  - inspect
  - learn
  - fix
- It sanitizes some owner-facing job/internal language.
- It maps source links away from `/jobs`, `/my/media`, `/operations`, and admin
  routes where possible.

Gap:

Today is still assembled from activity and other loaders. It does not yet come
from a durable section brief plus inbox/read state.

## Studio

Status: implemented, mixed inputs

Code anchors:

- `src/lib/studio/load-studio-workspace.ts`
- `src/components/studio/StudioWorkspace.tsx`
- `src/components/media/MediaAssetDetail.tsx`
- `src/lib/media/workflows/media-workflow-read-model.ts`
- `src/lib/jobs/load-user-jobs-workspace.ts`

What is real:

- Studio loads cards from jobs, media workflows, user files, content, and
  campaigns.
- It supports buckets and kinds.
- It can select a card and selected media.
- `/my/media` has been moved out of primary owner IA.

Gap:

Studio still merges several donor read models. It needs a cleaner produced-work
projection where every object has provenance and type-appropriate controls.

## People

Status: implemented

Code anchors:

- `src/lib/business/people-read-model.ts`
- `src/lib/business/load-business-workspace.ts`
- `src/components/business/BusinessWorkspace.tsx`

What is real:

- People merges relationship evidence from several sources.
- Referral evidence can appear as source/trail evidence.
- Tests now protect against leaking raw `job_events` strings into people
  output.

Gap:

People still needs the shared event/read-state layer so relationship changes
can update the UI reliably.

## Referrals

Status: implemented

Code anchors:

- `src/lib/referrals/load-referrals-workspace.ts`
- `src/components/referrals/ReferralsWorkspace.tsx`
- `src/app/referrals/page.tsx`

What is real:

- `/referrals` is the owner affiliate/referral dashboard.
- Referral/QR controls belong here, not `/profile`.

Gap:

Referral updates are not part of the shared realtime update system.

## Offers

Status: implemented, lifecycle still needs stronger event projection

Code anchors:

- `src/lib/offers/load-offers-workspace.ts`
- `src/components/offers/OfferSurfaces.tsx`
- `src/core/entities/offer.ts`
- `src/core/entities/offer-event.ts`

What is real:

- Offers have read-model loading and event concepts.
- Public/private/draft/sent/accepted/purchased language exists in the product
  direction and code.

Gap:

Accepted-offer lifecycle must be backed by offer events and related evidence,
not UI labels alone.

## Knowledge

Status: weak surface

Code anchors found in the broader repo:

- `src/core/platform/knowledge-access/*`
- `docs/_business/ux/architecture/09-corpus-research-search-and-visibility.md`

Gap:

Knowledge needs a real read model from stored content/references or a clean,
honest empty state. The current UI should not render unformatted raw content.

## System/Admin

Status: implemented in pieces

Code anchors:

- `src/app/admin/system/backups/*`
- `src/app/admin/system/operations/page.tsx`
- `src/components/admin/system/AdminSystemWorkspace.tsx`
- `src/lib/admin/jobs/*`
- `src/lib/appliance/backup/*`

What is real:

- Backup and restore admin flows exist.
- Admin jobs and operations exist.
- Diagnostics are available in admin/system surfaces.

Gap:

System should become the place where raw diagnostics live. Owner sections
should link to owner-safe summaries, not raw system internals.

## Shared Frame

Status: implemented but not enough by itself

Code anchors:

- `src/components/governance/GovernanceSectionFrame.tsx`
- `src/lib/shell/shell-navigation.ts`

Conclusion:

The shared frame is useful, but it cannot fix missing backend product state.

The next UI pass should wait until section briefs, inbox/read state, and realtime
invalidation are in place.
