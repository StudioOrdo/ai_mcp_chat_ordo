# 02 UI Surface Realignment: Route And Surface Inventory

Status: Draft spec

Governing instruction:

- `docs/_refactor/ordo/letters/refactor1.md`

Governing contracts:

- `docs/_business/ux/08-product-kernel-contract.md`
- `docs/_business/ux/09-canonical-ux-architecture.md`
- `docs/_business/ux/00-ux-north-star.md`
- `docs/_business/ordo_process.md`

## Goal

Create a grounded route and surface inventory for the next UI realignment pass.
This document classifies every discovered page route as public, owner, admin,
donor, redirect, hidden, or placeholder so later implementation phases can move
or hide surfaces without guessing.

## Current Code Grounding

Research commands used:

```bash
rg --files src/app | rg '/page\.tsx$|/layout\.tsx$|/route\.ts$'
sed -n '1,760p' src/lib/shell/shell-navigation.ts
sed -n '1,260p' src/components/AppShell.tsx
sed -n '1,260p' src/components/SiteNav.tsx
sed -n '1,560p' src/components/AccountMenu.tsx
sed -n '1,260p' src/components/governance/GovernanceSectionFrame.tsx
sed -n '1,260p' src/core/entities/ordo-object.ts
```

Primary code anchors:

- `src/lib/shell/shell-navigation.ts`
- `src/components/AppShell.tsx`
- `src/components/SiteNav.tsx`
- `src/components/AuthenticatedWorkRail.tsx`
- `src/components/AccountMenu.tsx`
- `src/components/governance/GovernanceSectionFrame.tsx`
- `src/core/entities/ordo-object.ts`
- `src/core/entities/brief.ts`
- `src/lib/dashboard/load-user-dashboard.ts`
- `src/lib/studio/load-studio-workspace.ts`
- `src/lib/business/load-business-workspace.ts`
- `src/lib/offers/load-offers-workspace.ts`
- `src/lib/about/load-about-workspace.ts`
- `src/lib/referrals/load-referrals-workspace.ts`
- `src/lib/admin/system/load-admin-system-workspace.ts`

## Verified Current State

- The current shell registry already names `ordo-chat` as `Conversations`.
- `ACCOUNT_MENU_ROUTE_IDS` currently resolves to `profile` and `referrals`.
- Authenticated owner rail currently exposes Conversations, Today, Studio,
  People, Offers, and About through registry ids.
- Admin rail currently exposes Admin, Jobs, and System.
- `GovernanceSectionFrame` already provides the target second-column selector,
  section brief, selected detail, and mobile list/detail mechanics.
- Today, Studio, People, Offers, About, Account, and System have partial or
  complete second-column implementations.
- `blog`, `journal`, and `library` base routes currently exist but are donor or
  hidden relative to the canonical product IA.
- `/jobs`, `/activity`, `/operations`, and `/my/media` remain routable donor or
  diagnostic surfaces even though their product meaning should be projected into
  Today, Studio, People, Offers, or System.

## Route Decision Matrix

Classification key:

- `public`: visible to anonymous users as a primary public surface.
- `owner`: signed-in owner governance surface.
- `admin`: role-gated admin/system surface.
- `donor`: keep for code/data reuse but remove from primary IA.
- `redirect`: should converge to another canonical route.
- `hidden`: not a product route, e2e/dev/internal route, or intentionally 404.
- `placeholder`: may render honest deterministic placeholder content until the
  durable read model exists.

| Route | Current anchor | Current exposure | Target class | Decision |
| --- | --- | --- | --- | --- |
| `/` | `src/app/page.tsx`, `ChatSurface` | Public and signed-in chat entry | public/owner | Keep as Home and Conversations entry; signed-in view should include second-column conversation selector. |
| `/login` | `src/app/login/page.tsx` | Public access | public | Keep. |
| `/register` | `src/app/register/page.tsx` | Public access | public | Keep. |
| `/signup` | `src/app/signup/page.tsx` | Public access alias | redirect | Converge to `/register` unless needed by campaigns. |
| `/welcome` | `src/app/welcome/page.tsx` | Onboarding | public | Keep as access/onboarding, not public nav. |
| `/access-denied` | `src/app/access-denied/page.tsx` | System message | public | Keep as access boundary. |
| `/install` | `src/app/install/page.tsx` | Setup wizard | admin/hidden | Keep role-gated or setup-only; not product nav. |
| `/feed` | `src/app/feed/page.tsx` | Public content | public/placeholder | Show in public nav only when public content exists. |
| `/feed/[slug]` | `src/app/feed/[slug]/page.tsx` | Public content detail | public | Keep as public content detail. |
| `/offers` | `src/app/offers/page.tsx`, `OfferSurfaces` | Public or owner by session | public/owner | Keep dual-mode. Public shows selling surface; owner shows governance workspace. |
| `/offers/[slug]` | `src/app/offers/[slug]/page.tsx` | Offer detail | public/owner | Keep. Enforce visibility/private offer rules. |
| `/about` | `src/app/about/page.tsx`, `AboutSurfaces` | Public or owner by session | public/owner | Keep dual-mode. Owner mode governs business story sections. |
| `/workspace` | `src/app/workspace/page.tsx`, `UserDashboard` | Owner Today | owner | Keep as Today brief. Must not become a dashboard pile. |
| `/studio` | `src/app/studio/page.tsx`, `StudioWorkspace` | Owner production workspace | owner | Keep. Studio owns work, media, content, campaigns, and jobs-as-work. |
| `/studio/media/[assetId]` | `src/app/studio/media/[assetId]/page.tsx` | Media detail | owner | Keep as canonical media detail. |
| `/studio/content/[contentId]` | `src/app/studio/content/[contentId]/page.tsx` | Content detail | owner | Keep as canonical content detail. |
| `/studio/workflows/[workflowId]` | `src/app/studio/workflows/[workflowId]/page.tsx` | Workflow detail | owner | Keep as work/provenance detail, not raw jobs. |
| `/studio/campaigns/[campaignId]` | `src/app/studio/campaigns/[campaignId]/page.tsx` | Campaign detail | owner/placeholder | Keep if evidence-backed; otherwise placeholder with limitation. |
| `/business` | `src/app/business/page.tsx`, `BusinessWorkspace` | People workspace | owner | Keep as People. |
| `/business/people/[personId]` | `src/app/business/people/[personId]/page.tsx` | Person detail | owner | Keep if it shares People read model and access rules. |
| `/business/conversations/[conversationId]` | `src/app/business/conversations/[conversationId]/page.tsx` | Conversation evidence | owner | Keep as relationship evidence/detail, not primary nav. |
| `/business/referrals/[referralCode]` | `src/app/business/referrals/[referralCode]/page.tsx` | Referral evidence detail | owner | Keep as referral evidence detail. |
| `/referrals` | `src/app/referrals/page.tsx`, `ReferralsWorkspace` | Affiliate dashboard | owner | Keep as account-menu shortcut to affiliate/referral workspace. |
| `/profile` | `src/app/profile/page.tsx`, `ProfileSettingsPanel` | Account | owner | Keep as My Account with User info, Password, Preferences only. |
| `/profile?section=referrals` | `src/app/profile/page.tsx` | Legacy query | redirect | Redirect to `/referrals`. |
| `/my/media` | `src/app/my/media/page.tsx`, `UserMediaWorkspace` | Media workspace | donor/redirect | Move media selection and playback into Studio; route should redirect or remain hidden donor. |
| `/jobs` | `src/app/jobs/page.tsx`, `JobsWorkspace` | Owner-accessible job workspace | donor | Reframe into Studio/System. Not primary owner surface. |
| `/activity` | `src/app/activity/page.tsx` | Activity surface | donor | Project into Today evidence and object trails. Hide from primary nav. |
| `/operations` | `src/app/operations/page.tsx` | Operations diagnostics | admin/donor | Hide from owner. Link from System/Admin only. |
| `/operations/[operationId]` | `src/app/operations/[operationId]/page.tsx` | Operation detail | admin/donor | Keep as admin diagnostic or source detail behind role gates. |
| `/operations/media` | `src/app/operations/media/page.tsx` | Media operations diagnostics | admin/donor | Keep admin-only; owner media is Studio. |
| `/blog` | `src/app/blog/page.tsx` | Currently hidden/notFound | hidden/donor | Donor for Feed/Knowledge Base. Not primary product route. |
| `/blog/[slug]` | `src/app/blog/[slug]/page.tsx` | Content detail | donor/public | Migrate public content to Feed canonical route unless SEO requires redirect. |
| `/journal` | `src/app/journal/page.tsx` | Currently hidden/notFound | hidden/donor | Donor for content/admin publishing. |
| `/journal/[slug]` | `src/app/journal/[slug]/page.tsx` | Journal detail | donor | Reframe to Feed/Studio detail or hide. |
| `/library` | `src/app/library/page.tsx` | Currently hidden/notFound | donor/placeholder | Donor for Knowledge Base. Do not expose as public library. |
| `/library/[document]` | `src/app/library/[document]/page.tsx` | Document detail | donor/placeholder | Move into Knowledge Base with access rules. |
| `/library/[document]/[section]` | `src/app/library/[document]/[section]/page.tsx` | Document section | donor/placeholder | Move into Knowledge Base with access rules. |
| `/library/section/[slug]` | `src/app/library/section/[slug]/page.tsx` | Section detail | donor/placeholder | Move into Knowledge Base with access rules. |
| `/r/[code]` | `src/app/r/[code]/page.tsx` | Referral landing | public/redirect | Keep as public referral validation and attribution route. |
| `/t/[code]` | `src/app/t/[code]/page.tsx` | Tracked link redirect | redirect | Keep as tracking redirect. Never primary nav. |
| `/admin` | `src/app/admin/page.tsx` | Admin dashboard | admin | Keep role-gated. |
| `/admin/jobs` | `src/app/admin/jobs/page.tsx` | Admin jobs | admin | Keep. Rename visible owner-adjacent concept to Jobs, not Factory. |
| `/admin/jobs/[id]` | `src/app/admin/jobs/[id]/page.tsx` | Job detail | admin | Keep role-gated diagnostics. |
| `/admin/system` | `src/app/admin/system/page.tsx` | System workspace | admin | Keep as admin System brief and sections. |
| `/admin/system/backups` | `src/app/admin/system/backups/page.tsx` | Backup/restore | admin | Keep; System section should link/render linked content. |
| `/admin/system/keys` | `src/app/admin/system/keys/page.tsx` | Provider keys | admin | Keep role-gated. |
| `/admin/system/operations` | `src/app/admin/system/operations/page.tsx` | System operations | admin | Keep role-gated. |
| `/admin/system/tools` | `src/app/admin/system/tools/page.tsx` | Tool diagnostics | admin | Keep role-gated. |
| `/admin/users` | `src/app/admin/users/page.tsx` | User admin | admin | Keep. |
| `/admin/users/[id]` | `src/app/admin/users/[id]/page.tsx` | User admin detail | admin | Keep. |
| `/admin/conversations` | `src/app/admin/conversations/page.tsx` | Conversation admin | admin | Keep. Owner conversations stay in `/`. |
| `/admin/conversations/[id]` | `src/app/admin/conversations/[id]/page.tsx` | Conversation admin detail | admin | Keep, including human takeover/handoff controls. |
| `/admin/leads` | `src/app/admin/leads/page.tsx` | Leads admin | admin/donor | Keep admin-only; People owns owner relationship projection. |
| `/admin/leads/[id]` | `src/app/admin/leads/[id]/page.tsx` | Lead detail | admin/donor | Keep admin-only. |
| `/admin/deals/[id]` | `src/app/admin/deals/[id]/page.tsx` | Deal detail | admin/donor | Keep admin-only; Offers/People get owner-safe state. |
| `/admin/journal` | `src/app/admin/journal/page.tsx` | Content admin | admin/donor | Keep as donor/admin for Feed/Studio content governance. |
| `/admin/journal/[id]` | `src/app/admin/journal/[id]/page.tsx` | Content admin detail | admin/donor | Keep. |
| `/admin/journal/preview/[slug]` | `src/app/admin/journal/preview/[slug]/page.tsx` | Preview | admin/donor | Keep role-gated. |
| `/admin/journal/attribution` | `src/app/admin/journal/attribution/page.tsx` | Attribution admin | admin/donor | Keep. Owner-safe attribution appears in People/Offers/Studio. |
| `/admin/training` | `src/app/admin/training/page.tsx` | Training admin | admin/donor | Donor for Knowledge Base. |
| `/admin/training/[bookSlug]` | `src/app/admin/training/[bookSlug]/page.tsx` | Training detail | admin/donor | Donor for Knowledge Base. |
| `/admin/training/[bookSlug]/[chapterSlug]` | `src/app/admin/training/[bookSlug]/[chapterSlug]/page.tsx` | Training chapter | admin/donor | Donor for Knowledge Base. |
| `/admin/prompts` | `src/app/admin/prompts/page.tsx` | Prompt admin | admin | Keep role-gated under System. |
| `/admin/prompts/[role]/[promptType]` | `src/app/admin/prompts/[role]/[promptType]/page.tsx` | Prompt detail | admin | Keep role-gated. |
| `/admin/affiliates` | `src/app/admin/affiliates/page.tsx` | Affiliate admin | admin | Keep as global affiliate dashboard, not user account shortcut. |
| `/admin/content-visibility` | `src/app/admin/content-visibility/page.tsx` | Visibility admin | admin | Keep under System/Knowledge Base governance. |
| `/e2e/media-lab` | `src/app/e2e/media-lab/page.tsx` | Test lab | hidden | Keep hidden test-only route. |

API routes are not product UI surfaces. They remain implementation routes and
must be consumed through read models or service/use-case boundaries.

| Route handler family | Current purpose | Target class | Decision |
| --- | --- | --- | --- |
| `/api/auth/*` | Login, logout, registration, session, role switching | public/owner/admin | Keep as access boundary; do not expose as product nav. |
| `/api/chat/*` | Chat, stream, uploads, chat jobs, contact capture | public/owner | Keep as operating interface backend. Owner UI consumes via chat components, not dashboards. |
| `/api/conversations/*` | Conversation CRUD, active conversation, import/export/restore | owner/admin | Keep. Owner `/` uses active conversations; admin detail remains role-gated. |
| `/api/activity/*` | Activity receipts and receipt detail | donor | Project into Today and object trails; not a primary owner surface. |
| `/api/jobs/*` | Job list, job detail, job events | donor/admin | Owner-safe status projects into Today/Studio; raw job diagnostics stay admin. |
| `/api/operations/*` | Operations, events, artifacts, actions | admin/donor | Keep role-gated or source-detail only. |
| `/api/admin/*` | Admin affiliates, jobs, routing review, factory work orders, system backups, keys, tools | admin | Keep role-gated under Admin/System. |
| `/api/admin/system/backups/*` | Backup, restore plan, validation, policy, execution | admin | Keep. This is the durable command model for future brief updates. |
| `/api/profile/*` | Account info and password | owner | Keep behind session; no password hashes in responses/logs. |
| `/api/preferences` | User preferences | owner | Keep behind My Account preferences. |
| `/api/referral/*` | Referral lookup and visit attribution | public/owner | Keep as attribution backend. Owner surface is `/referrals`; detail is `/business/referrals/[referralCode]`. |
| `/api/qr/*` | QR generation/tracked QR | public/owner | Keep as backend for referral/tracked link surfaces. |
| `/api/tracked-links` | Tracked link creation | owner | Keep behind product read models in People/Offers/Studio. |
| `/api/offers/*` | Offer CRUD/detail | public/owner | Keep. Enforce public/private visibility before render. |
| `/api/deals/*` | Deal records and responses | owner/admin/donor | Project owner-safe state into People/Offers; diagnostics stay admin. |
| `/api/consultation-requests/*` | Consultation leads | owner/admin/donor | Project into People/Today; admin detail remains diagnostic. |
| `/api/training-paths/*` | Training path records | donor | Donor for People/Knowledge Base until product surface is explicit. |
| `/api/user-files/*` | Governed media/file access | owner | Keep. Canonical UI is Studio, not `/my/media`. |
| `/api/blog/assets/*` | Blog/content assets | donor/admin | Donor for Studio/Feed content. |
| `/api/campaign/context` | Campaign context | owner/placeholder | Keep only with deterministic evidence-backed campaign read model. |
| `/api/lifecycle/context` | Chat lifecycle context | owner | Keep as chat context backend. |
| `/api/notifications/*` | Notification feed/push | owner | Keep as backend; owner attention appears in Today/rail badges. |
| `/api/hero/proof-points` | Public proof copy/data | public/placeholder | Keep only if deterministic and evidence-backed. |
| `/api/install/*` | Installation and provider setup | hidden/admin | Keep setup-only. |
| `/api/health/*` | Liveness/readiness | hidden/admin | Keep diagnostics only. |
| `/api/diagnostics/*` | Diagnostic detail | admin | Keep role-gated. |
| `/api/e2e/*` | Test-only media routes | hidden | Keep test-only. |
| `/api/tts` and `/api/web-search` | Tool/provider endpoints | owner/admin/donor | Keep behind chat/workflows; do not expose raw provider details in owner UI. |
| `/api/workspace/restore` | Workspace restore | owner/admin | Keep behind explicit restore UX and access controls. |

## Target Behavior

- Public top nav is Home through logo, Offers, About, and Feed only when public
  content exists.
- Owner rail is Conversations, Today, Studio, People, Offers, About, plus
  Knowledge Base only after the Knowledge Base read model exists.
- Account menu is My Account, Affiliate Dashboard, theme toggle, and Sign out.
- Admin rail is Admin, Jobs, System.
- Donor routes stay linkable from source evidence or admin diagnostics only
  until redirected or retired.
- Base owner routes render section briefs. Query/detail routes render one
  selected object.

## Reuse / Move / Hide / Mock Decisions

- Reuse `GovernanceSectionFrame` for all owner/admin selector/detail surfaces.
- Reuse `SectionBrief` and brief executor contracts for brief storage.
- Move `/my/media` capability into Studio before retiring `/my/media`.
- Move library/corpus/training donors into a Knowledge Base surface.
- Hide `/jobs`, `/activity`, and `/operations` from owner primary IA.
- Mock only deterministic placeholders with explicit limitations.

## Positive Tests

- Public nav includes Offers and About, and Feed only when public feed items
  exist.
- Owner rail resolves Conversations, Today, Studio, People, Offers, About.
- Account menu resolves My Account and Affiliate Dashboard only.
- Admin rail resolves Admin, Jobs, System for admin users.
- Canonical routes load using existing loaders without raw diagnostics in owner
  UI.

## Negative Tests

- Public nav never shows jobs, activity, operations, library, journal, blog,
  referrals, admin, or system.
- Account menu never shows Change Password, My Media, My Conversations,
  My Offers, My Content, System, QR, or Preferences as top-level items.
- Owner rail never shows raw Jobs, Activity, Operations, Logs, Provider Keys, or
  Factory.
- Donor routes are not linked from public or normal owner nav.

## Edge Tests

- Anonymous users see public mode for `/`, `/offers`, and `/about`.
- Signed-in users see owner mode for `/offers` and `/about`.
- Users without admin role cannot reach admin/system routes.
- `/profile?section=referrals` redirects to `/referrals`.
- Feed disappears from public nav when no public feed items exist.

## Acceptance Criteria

- Every route above has a target classification and route decision.
- Any implementation phase derived from this matrix names the route class it is
  changing.
- No public, owner, or account-menu decision contradicts the product kernel.
- Donor routes are preserved for reuse until their canonical owner/admin
  replacement is verified.

## Non-Goals

- No UI changes in this spec package.
- No route redirects implemented here.
- No new database schema.
- No fake live intelligence.

## Required Commands

```bash
rg --files src/app | rg '/page\.tsx$|/layout\.tsx$|/route\.ts$'
rg -n "ACCOUNT_MENU_ROUTE_IDS|AUTHENTICATED_WORK_RAIL_ROUTE_IDS|PRIMARY_NAV_ROUTE_IDS" src/lib/shell/shell-navigation.ts
rg -n "data-shell|data-governance|data-dashboard|data-studio|data-business|data-offers|data-about|data-admin-system" src/components src/app
npm run typecheck
npm run lint -- src/lib/shell/shell-navigation.ts src/components/AccountMenu.tsx src/components/SiteNav.tsx src/components/AuthenticatedWorkRail.tsx
```

## Closeout Evidence Required

- Updated route decision matrix if implementation changes route status.
- Test output proving public nav, owner rail, account menu, and admin rail.
- Static scan proving donor routes are not exposed in public or owner primary
  navigation.
- Screenshot evidence for desktop and mobile shell if any implementation phase
  changes navigation.
