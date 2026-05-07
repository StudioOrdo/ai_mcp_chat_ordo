# Phase 2 — My Media Route V1

> Status: Complete
> Loop State: Exit criteria verified
> Goal: Ship a user-facing `/my/media` route with summary, filter, preview, and safe deletion behavior.
> Prerequisites: Phase 1 complete

## Phase Intent

This phase exists to deliver the first visible user value from the media specs. It should expose governed media through a server-first route that uses the existing accounting and delivery seams rather than bypassing them.

## Source Anchors To Refresh

- [../../../../src/app/api/user-files/[id]/route.ts](../../../../src/app/api/user-files/[id]/route.ts#L1)
- [../../../../src/app/api/user-files/[id]/route.test.ts](../../../../src/app/api/user-files/[id]/route.test.ts#L1)
- [../../../../src/app/jobs/page.tsx](../../../../src/app/jobs/page.tsx#L1)
- [../../../../src/app/jobs/page.test.tsx](../../../../src/app/jobs/page.test.tsx#L1)
- [../../../../src/lib/admin/jobs/admin-jobs.ts](../../../../src/lib/admin/jobs/admin-jobs.ts#L1)
- [../../../../src/components/AudioPlayer.tsx](../../../../src/components/AudioPlayer.tsx#L1)
- [../../../../src/frameworks/ui/chat/plugins/custom/MediaRenderCard.tsx](../../../../src/frameworks/ui/chat/plugins/custom/MediaRenderCard.tsx#L1)
- [../../../../src/components/ShellWorkspaceMenu.tsx](../../../../src/components/ShellWorkspaceMenu.tsx#L1)

## Current-State Questions

- What route-loader pattern should `/my/media` mirror most closely?
- Should deletion live on `DELETE /api/user-files/[id]` or a separate action seam?
- What reverse-derivative safety is realistically enforceable before schema promotion?
- Which presentational components can be reused directly for preview without dragging chat-specific concerns into the route?

## Drift Traps

- Building a client-only gallery that duplicates server filtering and summary logic.
- Creating a second asset-serving route for previews.
- Allowing delete semantics to outrun derivative-safety guarantees.
- Pulling chat-plugin UI directly into a page route without a route-owned workspace component.

## Pre-Implementation QA Gate

- [x] Refresh current diagnostics for the route, preview, and loader-adjacent files.
- [x] Refresh current owner-gating and range-delivery tests for `/api/user-files/[id]`.
- [x] Confirm the source anchors still represent the preferred server-first route pattern.
- [x] Record exact verification commands for page, route, component, and browser proof.
- [x] Update this packet's verified-state notes before writing the detailed plan.

## Verified Current State

### Current Code Notes

- `/my/media` now follows the thin server-page pattern used elsewhere in the app: auth gate in the page, data loading in `src/lib/media/user-media.ts`, and route-owned UI in `src/components/media/UserMediaWorkspace.tsx`.
- The route reuses existing repository browse seams and Phase 1 accounting summaries instead of introducing route-local storage queries.
- Preview continues to flow through the governed owner-gated delivery route at `/api/user-files/[id]`.
- `DELETE /api/user-files/[id]` is now enabled only for owner-owned, unattached files. Attached assets return a conflict instead of widening policy beyond current repository guarantees.
- Signed-in shell navigation now exposes `My Media` alongside `Jobs` and `Profile`.

### Current QA Notes

- `npm exec vitest run 'src/app/api/user-files/[id]/route.test.ts' 'src/app/my/media/page.test.tsx' 'src/components/media/UserMediaWorkspace.test.tsx' 'src/lib/shell/shell-navigation.test.ts'`
	- 4 files passed, 20 tests passed.
- `npm exec eslint 'src/app/my/media/page.tsx' 'src/app/my/media/page.test.tsx' 'src/components/media/UserMediaWorkspace.tsx' 'src/components/media/UserMediaWorkspace.test.tsx' 'src/lib/media/user-media.ts' 'src/app/api/user-files/[id]/route.ts' 'src/app/api/user-files/[id]/route.test.ts' 'src/lib/shell/shell-navigation.ts' 'src/lib/shell/shell-navigation.test.ts'`
	- clean.

## Suggested Verification Commands

```bash
npm exec vitest run src/app/api/user-files/[id]/route.test.ts src/app/jobs/page.test.tsx src/frameworks/ui/chat/plugins/custom/MediaRenderCard.test.tsx src/components/AudioPlayer.test.tsx
npm exec eslint src/app/my/media/page.tsx src/lib/media/user-media.ts src/components/media/UserMediaWorkspace.tsx src/app/api/user-files/[id]/route.ts
npx playwright test tests/browser-ui/media-live-workflows.spec.ts
```

## Expected Evidence Artifacts

- A route-owned loader module for `/my/media`.
- A route-owned workspace component for user media browsing.
- Route tests proving owner-only view and delete behavior.
- Browser proof for filter, preview, and safe deletion on an eligible asset.

1. Add the `/my/media` page, loader, and workspace component.
2. Extend `/api/user-files/[id]` with safe delete behavior if the refresh confirms that is the cleanest seam.
3. Add page, route, component, and browser tests for happy path, forbidden path, and edge states.

## Scope Guardrails

- Do not build the operator workspace in this phase.
- Do not expose host free-space data on the user route.

## Implementation Record

- Date: 2026-04-16
- Files changed:
	- `src/app/my/media/page.tsx`
	- `src/app/my/media/page.test.tsx`
	- `src/lib/media/user-media.ts`
	- `src/components/media/UserMediaWorkspace.tsx`
	- `src/components/media/UserMediaWorkspace.test.tsx`
	- `src/app/api/user-files/[id]/route.ts`
	- `src/app/api/user-files/[id]/route.test.ts`
	- `src/lib/shell/shell-navigation.ts`
	- `src/lib/shell/shell-navigation.test.ts`
- Summary of what landed:
	- Added a signed-in `/my/media` route that loads the current user's governed assets, current storage summary, and typed filters.
	- Added a route-owned workspace with summary cards, server-backed filter form, governed preview pane, and optimistic safe-delete action for eligible unattached assets.
	- Extended the governed asset route with conservative delete support that refuses attached assets and preserves owner-only enforcement.
	- Added focused tests for the page, workspace, route, and shell navigation exposure.
- Deviations from the detailed plan:
	- Browser proof was deferred. The server-first route, delete boundary, and navigation exposure are covered by focused unit tests and lint for this loop.

## Post-Implementation QA

- [x] Run targeted route, component, and page tests.
- [x] Run changed-file diagnostics.
- [x] Re-read the source anchors and confirm the route stayed server-first and seam-respecting.
- [x] Record residual risks around derivative safety and delete policy.

## Exit Criteria

- `/my/media` exists and shows only the current user's assets.
- Preview flows through the governed asset-delivery route.
- Safe deletion is enforced only for eligible assets.
- Positive, negative, and edge-case route behavior is proven.

## Handoff

- What the next phase should now assume:
	- Signed-in users have a governed personal media workspace backed by reusable list and summary seams.
	- Conservative delete behavior exists only for unattached assets and should remain the baseline until stronger attachment and derivative guarantees exist.
- What remains unresolved:
	- There is still no browser-level proof for the full `/my/media` interaction loop.
	- Delete semantics still intentionally stop short of derivative-aware policy and attached-asset cleanup.
- What docs need updating:
	- Phase 3 can now reference `/my/media` as the user-facing baseline when defining the operations workspace and metadata-promotion path.
