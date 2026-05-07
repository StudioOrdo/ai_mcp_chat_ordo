# Phase 01c3m Evidence: Object-Centered UX Regression Closeout

Generated: 2026-05-04

Last refreshed: 2026-05-05

## Result

Status: Passed

QA refresh: 2026-05-05. Rechecked the phase document against the current
implementation after the 01c3l dashboard command-loop refresh, updated the
phase grounding for `Today` / `Ask Ordo`, reran the focused object-centered
suite, reran policy/visibility tests, reran typecheck/lint, and reran the
stale-surface scans.

The owner-facing shell now closes on the object-centered model:

- regular signed-in navigation is Dashboard, Studio, Business, Profile;
- staff/admin additionally see Media Ops where policy allows;
- Jobs, Activity, My Media, and Referrals remain direct donor/diagnostic routes
  but are no longer primary regular-user navigation;
- `/workspace` dashboard sections now render shared `OrdoCard` projections
  instead of raw activity cards, and every rendered card exposes `Ask Ordo` as
  the operating path back into conversation;
- `/studio` and `/business` root surfaces exist and are covered by loaders,
  components, page tests, and shell route tests.

## Current Route Map

Route source: `src/lib/shell/shell-navigation.ts`.

Anonymous:

- Primary: `home:/`, `offers:/offers`, `about:/about`
- Account: none
- Work rail: none
- Footer: `information[home|offers|about]`, `access[login|register]`

Authenticated and Apprentice:

- Primary: `home:/`, `offers:/offers`, `about:/about`
- Account/work rail: `workspace-overview:/workspace`, `studio:/studio`,
  `business:/business`, `profile:/profile`
- Footer: `information[home|offers|about]`,
  `workspace[workspace-overview|studio|business|profile]`

Staff and Admin:

- Primary: `home:/`, `offers:/offers`, `about:/about`
- Account/work rail: `workspace-overview:/workspace`, `studio:/studio`,
  `business:/business`, `operations-media:/operations/media`,
  `profile:/profile`
- Footer: `information[home|offers|about]`,
  `workspace[workspace-overview|studio|business|operations-media|profile]`

Public Feed remains content-gated by `hasPublicFeedItems`.

## Implemented Surfaces

- `src/app/studio/page.tsx`
- `src/components/studio/StudioWorkspace.tsx`
- `src/lib/studio/load-studio-workspace.ts`
- `src/app/business/page.tsx`
- `src/components/business/BusinessWorkspace.tsx`
- `src/lib/business/load-business-workspace.ts`

Studio projects media workflows, raw job fallbacks, and user media into shared
Ordo cards. It suppresses linked jobs when a media workflow is already the
better object.

Business projects referral links and referral activity into shared Ordo cards,
and links public offer visibility without inventing unsupported offer
conversion metrics.

Dashboard now projects activity items through
`projectActivityItemToOrdoCard()` and renders `OrdoCard`; referral milestones
route primary action to `/business` while preserving referral diagnostics as a
secondary action. The dashboard projection layer also adds `Ask Ordo` to every
rendered dashboard card, preserving the source conversation link when the
activity supplied one.

## Stale Scan Classification

### Shell Route Gap Scan

Command:

```bash
rg -n "AUTHENTICATED_WORK_RAIL_ROUTE_IDS|ACCOUNT_MENU_ROUTE_IDS|CURRENT_OBJECT_CENTERED_SURFACE_GAPS|plannedRoute: \"/studio\"|plannedRoute: \"/business\"" src/lib/shell tests
```

Classification:

- `CURRENT_OBJECT_CENTERED_SURFACE_GAPS` is intentionally empty.
- `ACCOUNT_MENU_ROUTE_IDS` and `AUTHENTICATED_WORK_RAIL_ROUTE_IDS` intentionally
  resolve to `workspace-overview`, `studio`, `business`, `operations-media`,
  and `profile`.
- Test hits are valid assertions of the final route contract.
- 2026-05-05 refresh: the scan still only hits the route contract and tests.
  No planned `/studio` or `/business` gaps remain.

### Jobs/Activity/Media/Referral Label Scan

Command:

```bash
rg -n "My Jobs|Your Jobs|My Media|Referrals|Activity|Jobs" src/components/AuthenticatedWorkRail.tsx src/components/AccountMenu.tsx src/components/ShellWorkspaceMenu.tsx src/lib/shell tests
```

Classification:

- `AuthenticatedWorkRail` still mounts `JobsRail` as a utility control. Valid:
  jobs are status/utility, not primary route labels.
- `ShellWorkspaceMenu` still has `My Jobs` and `Global Jobs` label handling.
  Valid donor/admin context; no regular-user rail test exposes them.
- `src/lib/shell/shell-navigation.ts` still defines donor/diagnostic routes
  `jobs`, `activity`, `my-media`, and `referrals`. Valid direct routes during
  migration.
- Browser/admin test hits are valid diagnostic/admin coverage.
- No stale primary regular-user navigation remains.
- 2026-05-05 refresh: `My Jobs` only remains in the workspace-menu donor label
  branch, `Global Jobs` remains admin/global context, and `JobsRail` remains a
  utility/status control. Regular owner navigation still routes through
  Dashboard/Studio/Business/Profile.

### Donor URL Scan

Command:

```bash
rg -n "/jobs\\?|/my/media|/referrals|/activity" src/components/dashboard src/app/workspace src/lib/dashboard src/app/studio src/app/business src/components/studio src/components/business tests
```

Classification:

- `src/components/studio/StudioWorkspace.test.tsx` uses `/jobs?...` as an
  explicit diagnostic href. Valid.
- `src/components/dashboard/UserDashboard.test.tsx` fixtures retain donor
  source URLs because activity still records its original source; the rendered
  dashboard projects through Ordo cards and routes business primary action to
  `/business`. Valid.
- `tests/evals/runtime-integrity-evidence.test.ts` still lists media hardening
  suites for `/my/media`. Valid donor route regression coverage.
- Browser tests that directly visit `/jobs`, `/my/media`, or `/referrals`
  remain donor-route coverage until deletion/redirect is explicitly planned.
- 2026-05-05 refresh: donor URL hits are still limited to diagnostics,
  fixtures, and donor-route browser coverage. Dashboard cards keep source
  evidence but primary owner action routes to `/business` or chat governance.

### Runtime/Input Leak Scan

Command:

```bash
rg -n "inputSnapshot|provider log|runtime log|raw log|two-column|detail panel|opened in the detail panel" src/components src/lib src/app tests
```

Classification:

- `inputSnapshot` hits are internal job, capability, media, and eval state.
  Valid because the Ordo card/detail tests assert that raw snapshots do not
  surface to regular cards.
- `provider log` hit in dashboard test asserts absence. Valid negative test.
- `provider/runtime logs` in activity taxonomy is source-of-truth metadata for
  diagnostics. Valid.
- Browser README references old jobs detail-panel coverage. Deferred doc
  cleanup, not product code.
- 2026-05-05 refresh: production owner UI scans found no `provider log`,
  `raw log`, `runtime log`, `inputSnapshot`, raw `job_...`, or raw `asset_...`
  leakage in Dashboard, Studio, Business, OrdoCard, or detail components.

### Asset/Job Identity Scan

Command:

```bash
rg -n "assetId.*job|jobId.*asset|job_.*asset|asset_.*job" src/lib/ordo-cards src/lib/ordo-details src/components src/app tests
```

Classification:

- Projector and detail tests use paired `jobId`/`assetId` fixtures to prove
  provenance links. Valid.
- `src/lib/ordo-cards/ordo-card-projectors.ts` uses artifact asset ids when
  present and only falls back to a job-derived source id for anonymous artifact
  source refs. Valid; it does not route a job id as an asset id.
- 2026-05-05 refresh: the only intentionally bad `assetId: "job_..."`
  fixture remains the negative eval that proves compose plans must use asset ids
  rather than job ids. Product cards and detail routes did not regress.

## Failures Found And Fixed

- Staff runtime tools included `produce_product`, but
  `tests/helpers/role-tool-sets.ts` still expected the older staff set.
  Fixed by adding `produce_product` to the staff expected set.
- Runtime inventory route visibility treated donor routes with no explicit
  account/header visibility as public. Fixed
  `src/lib/evals/runtime-integrity-evidence.ts` to use
  `getShellRouteVisibilitySnapshot()`.
- Runtime inventory test still expected public `/library`. Fixed the eval to
  assert `/offers` and `/about`, and to assert `/library` and `/jobs` are not
  anonymous shell routes.
- Shell visual/model tests still protected `Jobs` as the account-menu work
  route and rejected `Studio` in the footer. Fixed those tests to enforce
  Dashboard, Studio, Business, Profile.
- Dashboard still rendered raw `ActivityCard` objects. Fixed
  `src/components/dashboard/UserDashboard.tsx` to render shared `OrdoCard`
  projections.
- Browser `/jobs` coverage still expected the stale two-column jobs heading
  `Your Jobs`, card-level click selection, and unscoped `Open conversation`
  links. Fixed `tests/browser-ui/jobs-page.spec.ts` to assert the current
  `Work Index` donor surface, click the explicit `Details` disclosure action,
  and scope conversation links to the detail panel.

## Commands Run

```bash
npx vitest run src/lib/studio/load-studio-workspace.test.ts src/components/studio/StudioWorkspace.test.tsx src/app/studio/page.test.tsx src/lib/business/load-business-workspace.test.ts src/components/business/BusinessWorkspace.test.tsx src/app/business/page.test.tsx src/lib/shell/shell-navigation.test.ts src/components/AuthenticatedWorkRail.test.tsx src/components/AccountMenu.test.tsx src/components/ShellWorkspaceMenu.test.tsx src/components/dashboard/UserDashboard.test.tsx tests/shell-acceptance.test.tsx tests/job-visibility-solid.test.ts tests/core-policy.test.ts tests/evals/runtime-integrity-evidence.test.ts
```

Result: passed, 15 files, 82 tests.

```bash
npx vitest run src/lib/shell/shell-navigation.test.ts src/components/AuthenticatedWorkRail.test.tsx src/components/AccountMenu.test.tsx src/components/ShellWorkspaceMenu.test.tsx tests/shell-navigation-model.test.ts tests/shell-command-parity.test.ts tests/shell-command-parity.test.tsx tests/shell-acceptance.test.tsx tests/shell-visual-system.test.tsx tests/site-shell-composition.test.tsx tests/homepage-shell-ownership.test.tsx src/lib/ordo-cards/ordo-card-projectors.test.ts src/components/ordo-cards/OrdoCard.test.tsx src/lib/ordo-details/load-studio-object-detail.test.ts src/lib/ordo-details/load-business-object-detail.test.ts src/lib/ordo-details/ordo-detail-projectors.test.ts src/components/ordo-details/OrdoDetailLayout.test.tsx 'src/app/studio/media/[assetId]/page.test.tsx' 'src/app/studio/workflows/[workflowId]/page.test.tsx' 'src/app/business/referrals/[referralCode]/page.test.tsx' 'src/app/business/conversations/[conversationId]/page.test.tsx' src/lib/activity/activity-read-model.test.ts src/components/activity/ActivityWorkspace.test.tsx src/app/activity/page.test.tsx src/lib/dashboard/load-user-dashboard.test.ts src/components/dashboard/UserDashboard.test.tsx src/lib/studio/load-studio-workspace.test.ts src/components/studio/StudioWorkspace.test.tsx src/app/studio/page.test.tsx src/lib/business/load-business-workspace.test.ts src/components/business/BusinessWorkspace.test.tsx src/app/business/page.test.tsx tests/evals/runtime-integrity-evidence.test.ts tests/core-policy.test.ts tests/job-visibility-solid.test.ts
```

Result: passed, 35 files, 198 tests.

```bash
npm run typecheck -- --pretty false
```

Result: passed.

QA refresh result: passed.

```bash
npm run lint -- src/lib/shell/shell-navigation.ts src/components/AuthenticatedWorkRail.tsx src/components/dashboard/UserDashboard.tsx src/components/ordo-cards/OrdoCard.tsx src/components/ordo-details/OrdoDetailLayout.tsx
```

Result: passed.

## Post-QA Runtime Fix: Business Surface

After the closeout, browser testing found that `/business` existed but failed
for a signed-in user because the shared `OrdoCard` rendered a button
`onClick` from server-rendered workspace pages. The failing path was the
Business referral card copy action, but the underlying issue was shared across
any server page that rendered a non-link card action.

Fix:

- `src/components/ordo-cards/OrdoCard.tsx` is now a client component boundary.
- Built-in `copy` actions execute client-side without requiring a caller
  `onAction` prop.
- Non-link, non-copy actions remain disabled unless an interactive caller
  explicitly provides an action handler.
- `src/components/ordo-cards/OrdoCard.test.tsx` now covers copy actions without
  a caller handler and verifies unsupported non-link actions stay disabled.
- `tests/browser-ui/business-workspace.spec.ts` signs up a real browser user,
  opens `/business`, and asserts the Business surface renders without the
  RSC action-boundary error page.

Commands:

```bash
npx vitest run src/components/ordo-cards/OrdoCard.test.tsx src/components/business/BusinessWorkspace.test.tsx src/app/business/page.test.tsx src/lib/business/load-business-workspace.test.ts src/components/studio/StudioWorkspace.test.tsx src/components/dashboard/UserDashboard.test.tsx src/components/ordo-details/OrdoDetailLayout.test.tsx
```

Result: passed, 7 files, 21 tests.

```bash
npm run typecheck -- --pretty false
```

Result: passed.

```bash
npm run lint -- src/components/ordo-cards/OrdoCard.tsx src/components/business/BusinessWorkspace.tsx src/app/business/page.tsx src/lib/business/load-business-workspace.ts tests/browser-ui/business-workspace.spec.ts
```

Result: passed.

```bash
npx playwright test tests/browser-ui/business-workspace.spec.ts
```

Result: passed, 1 test.

```bash
npx playwright test tests/browser-ui/jobs-page.spec.ts
```

Result: passed, 2 tests.

```bash
npx playwright test tests/browser-ui/home-shell-header.spec.ts tests/browser-ui/mobile-public-reading.spec.ts tests/browser-ui/jobs-page.spec.ts
```

Result: passed, 18 tests.

Build-server notes from the browser run:

- Turbopack still warns about broad dynamic filesystem tracing in
  `src/lib/user-files.ts`, `src/lib/appliance/native/native-binary-registry.ts`,
  and `next.config.ts`.
- These warnings did not fail the build or browser suite, but they remain good
  candidates for a later image/build-hardening cleanup.

## 2026-05-05 QA Pass 1

Purpose: verify the current implementation against the 01c3m phase and the
product kernel after the 01c3l dashboard command-loop refresh.

Commands:

```bash
npx vitest run src/lib/shell/shell-navigation.test.ts src/components/AuthenticatedWorkRail.test.tsx src/components/AccountMenu.test.tsx src/components/ShellWorkspaceMenu.test.tsx tests/shell-navigation-model.test.ts tests/shell-command-parity.test.ts tests/shell-command-parity.test.tsx tests/shell-acceptance.test.tsx tests/shell-visual-system.test.tsx tests/site-shell-composition.test.tsx tests/homepage-shell-ownership.test.tsx src/lib/ordo-cards/ordo-card-projectors.test.ts src/components/ordo-cards/OrdoCard.test.tsx src/lib/ordo-details/load-studio-object-detail.test.ts src/lib/ordo-details/load-business-object-detail.test.ts src/lib/ordo-details/ordo-detail-projectors.test.ts src/components/ordo-details/OrdoDetailLayout.test.tsx 'src/app/studio/media/[assetId]/page.test.tsx' 'src/app/studio/workflows/[workflowId]/page.test.tsx' 'src/app/business/referrals/[referralCode]/page.test.tsx' 'src/app/business/conversations/[conversationId]/page.test.tsx' src/lib/activity/activity-read-model.test.ts src/components/activity/ActivityWorkspace.test.tsx src/app/activity/page.test.tsx src/lib/dashboard/load-user-dashboard.test.ts src/components/dashboard/UserDashboard.test.tsx
```

Result: passed, 26 files, 158 tests.

```bash
npx vitest run src/lib/studio/load-studio-workspace.test.ts src/components/studio/StudioWorkspace.test.tsx src/app/studio/page.test.tsx src/lib/business/load-business-workspace.test.ts src/components/business/BusinessWorkspace.test.tsx src/app/business/page.test.tsx
```

Result: passed, 6 files, 15 tests.

```bash
npx vitest run tests/core-policy.test.ts tests/job-visibility-solid.test.ts tests/evals/runtime-integrity-evidence.test.ts
```

Result: passed, 3 files, 27 tests.

```bash
npx vitest run src/lib/business/load-business-workspace.test.ts src/components/business/BusinessWorkspace.test.tsx src/app/business/page.test.tsx src/lib/studio/load-studio-workspace.test.ts src/components/studio/StudioWorkspace.test.tsx src/app/studio/page.test.tsx src/lib/dashboard/load-user-dashboard.test.ts src/components/dashboard/UserDashboard.test.tsx
```

Result: passed, 8 files, 24 tests.

```bash
npm run typecheck -- --pretty false
```

Result: passed.

```bash
npm run lint -- src/lib/shell/shell-navigation.ts src/components/AuthenticatedWorkRail.tsx src/components/dashboard/UserDashboard.tsx src/components/ordo-cards/OrdoCard.tsx src/components/ordo-details/OrdoDetailLayout.tsx src/components/studio/StudioWorkspace.tsx src/components/business/BusinessWorkspace.tsx
```

Result: passed.

Issues found and fixed in pass 1: none. The only stale artifact found was
documentation/evidence drift around the 01c3l `Today` and `Ask Ordo` dashboard
language; this file and the phase spec were refreshed.

## 2026-05-05 QA Pass 2

Purpose: rerun the phase and focused related suites after documentation
refresh, then run stale-surface scans and browser coverage.

Commands:

```bash
npx vitest run src/lib/shell/shell-navigation.test.ts src/components/AuthenticatedWorkRail.test.tsx src/components/AccountMenu.test.tsx src/components/ShellWorkspaceMenu.test.tsx tests/shell-navigation-model.test.ts tests/shell-command-parity.test.ts tests/shell-command-parity.test.tsx tests/shell-acceptance.test.tsx tests/shell-visual-system.test.tsx tests/site-shell-composition.test.tsx tests/homepage-shell-ownership.test.tsx src/lib/ordo-cards/ordo-card-projectors.test.ts src/components/ordo-cards/OrdoCard.test.tsx src/lib/ordo-details/load-studio-object-detail.test.ts src/lib/ordo-details/load-business-object-detail.test.ts src/lib/ordo-details/ordo-detail-projectors.test.ts src/components/ordo-details/OrdoDetailLayout.test.tsx 'src/app/studio/media/[assetId]/page.test.tsx' 'src/app/studio/workflows/[workflowId]/page.test.tsx' 'src/app/business/referrals/[referralCode]/page.test.tsx' 'src/app/business/conversations/[conversationId]/page.test.tsx' src/lib/activity/activity-read-model.test.ts src/components/activity/ActivityWorkspace.test.tsx src/app/activity/page.test.tsx src/lib/dashboard/load-user-dashboard.test.ts src/components/dashboard/UserDashboard.test.tsx src/lib/studio/load-studio-workspace.test.ts src/components/studio/StudioWorkspace.test.tsx src/app/studio/page.test.tsx src/lib/business/load-business-workspace.test.ts src/components/business/BusinessWorkspace.test.tsx src/app/business/page.test.tsx tests/core-policy.test.ts tests/job-visibility-solid.test.ts tests/evals/runtime-integrity-evidence.test.ts
```

Result: passed, 35 files, 200 tests.

```bash
npm run typecheck -- --pretty false
```

Result: passed.

```bash
npm run lint -- src/lib/shell/shell-navigation.ts src/components/AuthenticatedWorkRail.tsx src/components/dashboard/UserDashboard.tsx src/components/ordo-cards/OrdoCard.tsx src/components/ordo-details/OrdoDetailLayout.tsx src/components/studio/StudioWorkspace.tsx src/components/business/BusinessWorkspace.tsx
```

Result: passed.

Static scans:

```bash
rg -n "AUTHENTICATED_WORK_RAIL_ROUTE_IDS|ACCOUNT_MENU_ROUTE_IDS|CURRENT_OBJECT_CENTERED_SURFACE_GAPS|plannedRoute: \"/studio\"|plannedRoute: \"/business\"" src/lib/shell tests
rg -n "My Jobs|Your Jobs|My Media|Referrals|Activity|Jobs" src/components/AuthenticatedWorkRail.tsx src/components/AccountMenu.tsx src/components/ShellWorkspaceMenu.tsx src/lib/shell tests
rg -n "/jobs\\?|/my/media|/referrals|/activity" src/components/dashboard src/app/workspace src/lib/dashboard src/app/studio src/app/business src/components/studio src/components/business tests
rg -n "inputSnapshot|provider log|runtime log|raw log|two-column|detail panel|opened in the detail panel" src/components src/lib src/app tests
rg -n "assetId.*job|jobId.*asset|job_.*asset|asset_.*job" src/lib/ordo-cards src/lib/ordo-details src/components src/app tests
rg -n "fake|placeholder|dummy|sample|Math\\.random|random" src/components/dashboard src/components/studio src/components/business src/components/ordo-cards src/components/ordo-details src/lib/dashboard src/lib/studio src/lib/business --glob '!*.test.ts' --glob '!*.test.tsx'
rg -n "provider|runtime log|provider log|raw log|inputSnapshot|job_[A-Za-z0-9_:-]+|asset_[A-Za-z0-9_:-]+" src/components/dashboard src/components/studio src/components/business src/components/ordo-cards src/components/ordo-details --glob '!*.test.ts' --glob '!*.test.tsx'
rg -n "roleVisibility|ownerUserId|userId|requireUser|requireRole|redirect\\(\"/login\"\\)|notFound\\(" src/app/studio src/app/business src/app/workspace src/lib/studio src/lib/business src/lib/dashboard src/lib/ordo-details --glob '!*.test.ts' --glob '!*.test.tsx'
```

Result: passed classification. No fake metrics, ungrounded claims, private
leaks, or raw job/log/provider details were found in regular owner UI. Search
placeholder text was the only placeholder hit in production owner surfaces.

```bash
npx playwright test tests/browser-ui/home-shell-header.spec.ts tests/browser-ui/mobile-public-reading.spec.ts tests/browser-ui/jobs-page.spec.ts tests/browser-ui/business-workspace.spec.ts
```

Result: passed, 19 tests.

Issues found and fixed in pass 2: none. Browser startup still emitted the known
Turbopack broad dynamic filesystem tracing warnings already listed above; they
remain deferred build-hardening work and did not fail the suite.

## Deferred Cleanup

- Donor routes `/jobs`, `/my/media`, `/referrals`, and `/activity` are still
  intentionally accessible. A later deletion/redirect phase should decide
  whether each donor remains, redirects, or becomes admin-only.
- Browser specs still exercise donor pages. Keep them until replacement browser
  coverage for `/workspace`, `/studio`, and `/business` fully proves parity.
- Admin/global navigation remains intentionally deferred to `01c4`.
