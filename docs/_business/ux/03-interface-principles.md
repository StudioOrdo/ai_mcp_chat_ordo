# Interface Principles

## Principle 1: Conversation Is The Front Door

The home page and authenticated workspace should be chat-first. The primary
action is not "browse the site"; it is "tell Ordo what you need."

Existing anchor: `src/app/page.tsx` renders `ChatSurface` directly.

Authenticated navigation should put Conversations first because chat is the
operating interface. Ordo is the active agent conversation today; future human
handoff chats should appear in the same selector without becoming separate
top-level surfaces. The remaining surfaces govern and inspect what chat starts.

## Principle 2: Cards Are Receipts

Every meaningful thing Ordo does should become a durable card somewhere:

- produced media
- article draft
- workflow run
- approval request
- referral link
- person or conversation
- public offer
- private offer
- public content
- private content
- campaign

Existing anchors:

- `src/components/ordo-cards/OrdoCard.tsx`
- `src/lib/ordo-cards/ordo-card-projectors.ts`
- `src/core/entities/ordo-object.ts`

Cards should not become mini dashboards. They should help the user recognize
the object and choose the next action.

Card contract:

- one primary action
- no more than three secondary actions
- no more than four metrics
- status and visibility must be visible when they affect the user's decision
- diagnostics stay behind details/admin links

## Principle 3: Details Are Lenses

The detail view should support lenses instead of separate unrelated pages:

- Overview
- Provenance
- Relationship Trail
- Performance
- Actions
- History
- Related
- Visibility

Existing anchor: `src/core/entities/ordo-object.ts` already defines
`ORDO_DETAIL_LENSES`, though the user-facing labels need refinement.

Lens rules:

- Provenance belongs to work, media, content, and offers.
- Relationship Trail belongs to people, conversations, referrals, and deals.
- Performance belongs to public content, links, offers, and relationship motion.
- Visibility belongs to content, offers, cards, and admin/staff views.

## Principle 4: Today Is The CEO Daily Brief

The authenticated landing surface should answer:

- What needs my decision?
- What is Ordo doing?
- What is ready to use?
- What business motion happened?
- What should I do next?

Existing anchor: `src/components/dashboard/UserDashboard.tsx`.

Today should not be a stacked dashboard. The main pane should be a concise
brief, and the second column should be the evidence index behind the brief.
Selecting one item opens a single detail explaining why it matters, what
evidence put it there, and what Ordo recommends.

## Principle 5: Studio Owns Production

Studio should own everything Ordo produces or is producing: content, media,
workflows, campaigns, produced outputs, and jobs translated into Work. Raw jobs
are diagnostics. Users should not need to visit a separate jobs page to
understand normal work.

Existing anchors:

- `src/components/studio/StudioWorkspace.tsx`
- `src/lib/studio/load-studio-workspace.ts`
- `src/lib/media/workflows/media-workflow-read-model.ts`
- `job_requests`
- `media_workflows`
- `user_files`

Studio must distinguish:

- public content ready for the feed
- private content meant for a person, account, role, or internal use
- draft work that is not shareable yet

## Principle 6: People Owns Relationship Motion

People should own the relationship side of the business:

- anonymous visitor
- authenticated user
- referral
- lead
- customer
- affiliate
- collaborator
- conversation
- follow-up

Existing anchors:

- `src/components/business/BusinessWorkspace.tsx`
- `src/lib/business/load-business-workspace.ts`
- `src/lib/referrals/referral-analytics.ts`
- `referrals`
- `referral_events`
- `lead_records`
- `deal_records`
- `relationship_memory_records`

The current route is `/business`. The product language should evolve toward
"People" where the user is managing relationships, while still preserving
business metrics.

## Principle 7: Offers Have Two Modes

Public offers and private offers are different product objects.

- Public offers appear on `/offers` and help visitors understand what they can
  buy or request.
- Private offers are tailored to a person, account, or role and should not
  appear on the public offer page.
- Internal offer drafts stay visible only to the owner/staff/admin until
  published or sent.

Existing anchors:

- `src/app/offers/page.tsx`
- `config/services.json`
- `src/lib/config/defaults.ts`

Gap: the current offer model is static config. A durable offer visibility model
is required before private offer UX can be complete.

## Principle 8: Public Site Is Minimal

The public site should be:

- Home
- Offers
- About
- Feed, only if public published content exists

Library, internal corpus, blog, journal, and diagnostics should not appear as
default public navigation. The public visitor should not have to understand the
backend of Ordo.

Existing anchors:

- `src/lib/shell/shell-navigation.ts`
- `src/components/public/PublicRouteLinks.tsx`
- `src/app/feed/page.tsx`
- `src/app/offers/page.tsx`
- `src/app/about/page.tsx`

Private content belongs in authenticated Studio, People, help/corpus surfaces,
or a role-gated route. It should not leak into the public Feed.

## Principle 9: Visibility Is Product, Not Decoration

Visibility affects trust. If a thing is public, private, role-gated, or admin
only, the user should be able to tell before taking action.

Existing content anchors:

- `src/lib/access/content-access.ts`
- `src/adapters/FileSystemCorpusRepository.ts`
- `src/core/platform/knowledge-access/KnowledgeAccessService.ts`
- `src/lib/chat/retrieval-envelope.ts`
- `src/app/admin/content-visibility/page.tsx`

Existing operation/card anchors:

- `src/core/entities/operation.ts`
- `src/lib/activity/activity-taxonomy.ts`
- `src/lib/ordo-cards/ordo-card-types.ts`

## Principle 10: No Right Drawer For Core Navigation

Right-side drawers and floating notification/job icons make the product feel
like an admin console. For the final shape:

- public navigation belongs in top nav and footer
- authenticated primary navigation belongs in a left rail on desktop and a
  hamburger menu on mobile
- notifications collapse into Today, Studio, and People
- jobs collapse into Work and Studio, with diagnostics available from detail

## Principle 11: Mobile Is The Default Operating Context

The solo operator will often use Ordo between meetings, at events, or while
sharing a QR code. Mobile must not be a squeezed desktop.

Mobile rules:

- one column
- thumb-friendly primary action
- no dense tables
- no hidden critical state
- cards before charts
- detail lenses below summary
- QR/share actions always easy to reach
- safe-area aware bottom controls

## Principle 12: Progressive Disclosure Is Architecture

Every authenticated section should follow the same path:

1. chat command,
2. section brief,
3. second-column selector/evidence index,
4. selected detail,
5. trail/provenance,
6. admin diagnostic.

Do not mix all of these into one screen. Base routes should show briefs.
Selected routes should show one selected object. Section-wide totals belong in
briefs or compact second-column overviews, not above every selected detail.

## Principle 13: Briefs Are Durable Staff Reports

Briefs should eventually be updated by background jobs, but they must behave
like governed work:

- evidence-backed,
- versioned or historically traceable,
- scoped to a section or object,
- role-aware,
- safe on failure,
- inspectable through evidence links.

The backup/restore command-result-reconcile pattern is the model for brief
generation rigor.

## Principle 14: Admin Is A Different Mode

Admin functionality should move toward a vertical rail, similar to developer
tools, and stay visually separate from daily operator work.

Admin is for:

- users and roles
- prompts and tool availability
- queue diagnostics
- system health
- backups and restores
- provenance audit
- content visibility audit

Admin should not leak into the regular user's Today/Studio/People language.

## Accessibility And Layout Requirements

Every shipped surface must preserve:

- keyboard navigation
- visible focus state
- screen-reader labels for icon-only actions
- minimum 44px touch targets for mobile actions
- readable contrast for status and visibility labels
- no text overlap at mobile or desktop widths
- no layout shift when badges, metrics, or status labels change

## Quick UX Review Checklist

Before shipping a screen, ask:

1. Can a new user name what this page is for in five seconds?
2. Is there one obvious next action?
3. Can the user see what changed without reading logs?
4. Can the user inspect provenance or relationship trail if they care?
5. Can the user tell whether the object is public, private, or role-gated?
6. Does the mobile version preserve the same core action?
7. Are implementation words hidden unless this is admin/diagnostic?
