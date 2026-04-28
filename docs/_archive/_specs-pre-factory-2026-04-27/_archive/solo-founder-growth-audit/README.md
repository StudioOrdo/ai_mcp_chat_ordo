# Solo Founder Growth Audit

Date: 2026-04-21

## Why this document exists

This audit reviews the current codebase as if the product is meant to help a laid-off white-collar professional start a solo business for the first time.

Primary persona examples:

- Teacher who now needs to sell coaching, courses, tutoring, or consulting.
- Designer who needs to package services, share proof, and close clients.
- Software engineer who needs to turn expertise into consulting, implementation, or productized services.

This review focuses on the systems that matter most for that outcome:

- QR code and referral distribution.
- Anonymous-to-signed-in-to-paid account progression.
- Lead and consultation funnel behavior.
- Staff/admin business-assistant surfaces.
- Places where the current code is strong.
- Places where the current code is misaligned or overcomplicated for a beginner solo operator.

## Scope reviewed

The research focused on the implementation under `src`, especially:

- `src/app/r/[code]/page.tsx`
- `src/app/api/qr/[code]/route.ts`
- `src/app/referrals/page.tsx`
- `src/components/referrals/ReferralsWorkspace.tsx`
- `src/lib/referrals/*`
- `src/lib/profile/*`
- `src/lib/auth.ts`
- `src/lib/access/content-access.ts`
- `src/core/entities/user.ts`
- `src/core/entities/role-directive-assembler.ts`
- `src/core/capability-catalog/families/admin-capabilities.ts`
- `src/core/capability-catalog/families/affiliate-capabilities.ts`
- `src/core/capability-catalog/families/navigation-capabilities.ts`
- `src/app/api/chat/contact-capture/route.ts`
- `src/lib/operator/*`

## Executive summary

The product already contains the bones of a credible solo-business operating system:

- A validated referral and QR entry path exists.
- Referral attribution is materially stronger than a naive cookie-based system.
- A self-service referral workspace exists for signed-in users with affiliate capability.
- Admin/operator tooling exists for lead prioritization, offer prioritization, routing risk, and affiliate review.
- Anonymous visitors can be converted into leads through chat-driven capture and downstream workflows.

The main problem is not lack of systems. The problem is product fit and simplification.

Right now the code reads more like an internal operations platform plus customer chat product than a simple beginner-friendly solo-founder growth machine. It has strong internal infrastructure, but the user-facing funnel still makes too many assumptions:

- The user already understands referrals.
- The user already knows what offer they are selling.
- The user is willing to send people directly into chat.
- The user can interpret funnel metrics without coaching.
- The role model maps cleanly to business tiers.

For a first-time solo operator, those assumptions are too strong.

## What the system does well already

### 1. Referral trust is real, not fake

The referral flow is materially better than a typical MVP:

- Legacy `/?ref=` links are redirected to canonical `/r/{code}` in `src/proxy.ts`.
- Referral visits use a signed cookie payload in `src/lib/referrals/referral-visit.ts`.
- Referral public URLs are canonicalized in `src/lib/referrals/referral-origin.ts` and `src/lib/referrals/referral-links.ts`.
- The referral landing page validates the code before continuing in `src/app/r/[code]/page.tsx`.
- QR generation only works for enabled affiliate accounts in `src/app/api/qr/[code]/route.ts`.

This is a strong foundation. It means the team already solved the integrity problem that usually breaks affiliate/referral systems.

### 2. There is a real referral workspace

The app already has a dedicated signed-in referrals workspace:

- `src/app/referrals/page.tsx`
- `src/lib/referrals/load-referrals-workspace.ts`
- `src/components/referrals/ReferralsWorkspace.tsx`

That workspace includes:

- Canonical referral link.
- QR code asset.
- Copy-to-clipboard CTA text.
- Summary metrics.
- Time series.
- Funnel stage counts.
- Recent referral activity feed.

This is much better than “just show a referral code in profile settings.”

### 3. Staff/admin already have meaningful operator tools

The admin layer is not empty. It already includes internal decision support:

- `admin_prioritize_leads`
- `admin_prioritize_offer`
- `admin_triage_routing_risk`
- `admin_search`
- global affiliate analytics and exception review

Relevant files:

- `src/core/capability-catalog/families/admin-capabilities.ts`
- `src/core/capability-catalog/families/navigation-capabilities.ts`
- `src/lib/referrals/admin-referral-analytics.ts`

This means the codebase already supports a “business operator assistant” concept. It just is not yet packaged in a way that feels like a beginner founder assistant.

### 4. Lead and consultation flow exists

There is a working demand-capture path:

- Chat contact capture route in `src/app/api/chat/contact-capture/route.ts`.
- Lead queue and consultation queue surfaced through operator loaders in `src/lib/operator/*`.
- Admin leads workspace surfaces leads, consultations, training paths, and follow-ups.

So the funnel is not imaginary. It is already operational.

## Current issues found earlier and confirmed here

### 1. The account model is not a good business-tier model

Current roles in `src/core/entities/user.ts` are:

- `ANONYMOUS`
- `AUTHENTICATED`
- `APPRENTICE`
- `STAFF`
- `ADMIN`

This is not the same as a growth/product tier model.

What is missing:

- A clear premium or paid tier.
- A clean separation between customer plans and internal operator permissions.

What the code currently implies:

- `APPRENTICE` behaves like a special signed-in product role, but the language is education-specific.
- `affiliateEnabled` is a capability flag on the profile, not a plan or role.
- `STAFF` and `ADMIN` are internal operator roles.

Why this is a problem:

For a laid-off teacher, designer, or engineer, `APPRENTICE` is not an intuitive paid or premium concept. It sounds like a student-program role, not a business upgrade.

Result:

- The code has permission structure.
- The product does not yet have a clean monetization structure.

### 2. The referral workspace is useful, but not beginner-friendly

The referrals workspace in `src/components/referrals/ReferralsWorkspace.tsx` is competent, but it assumes the user already knows how to run a referral program.

What it offers today:

- One link.
- One QR.
- One generic CTA sentence.
- Metrics and milestone reporting.

What it does not offer:

- Campaign naming.
- Channel-specific QR codes.
- Friend-and-family vs paid-campaign segmentation.
- Persona-specific copy templates.
- Offer-specific landing variants.
- Suggested next actions when numbers are weak.
- Beginner coaching on what to do first.

The current CTA string is hardcoded as:

> I use Studio Ordo for real AI work. Start with my link or QR code: ...

That is too generic for real campaign use.

### 3. QR is implemented as an asset generator, not a growth system

The QR route in `src/app/api/qr/[code]/route.ts` generates a PNG for a referral code and points it at the canonical referral URL.

That is fine technically, but it is only the first 20% of what a growth-oriented QR system should do.

Missing capabilities:

- Campaign-level QR variants.
- Query tagging or campaign IDs.
- Landing-page selection per campaign.
- Offline handout use cases.
- Print-friendly templates.
- Distinction between “share with friend” and “run ad campaign.”

For the target solo founder, that means the QR system works, but it does not yet help them think like a marketer.

### 4. The referral landing page validates attribution, but it does not sell

The referral landing page in `src/app/r/[code]/page.tsx` is technically solid, but product-light.

What it does now:

- Validates referral.
- Shows referrer name and credential.
- Provides `Start chat` and `Open library` actions.

What it does not do:

- Explain the offer.
- Explain why the visitor should care.
- Match specific personas.
- Present social proof.
- Route visitors into different conversion paths.
- Capture email before the user disappears.

For a beginner solo founder, sending traffic directly to chat can work, but it is usually too abstract unless there is a clearer promise first.

### 5. Funnel reporting exists, but campaign intelligence does not

Referral analytics in `src/lib/referrals/referral-analytics.ts` are solid for raw lifecycle reporting:

- introductions
- started chats
- registered
- qualified opportunities
- credit states
- outcomes like lead submitted or consultation requested

What is missing for real growth work:

- Campaign source grouping.
- Cost or spend tracking.
- A/B landing comparison.
- Friend/family vs organic social vs paid ads.
- Conversion by persona.
- Conversion by offer.
- Recommendations based on weak stages.

Right now the workspace tells the user what happened. It does not help them decide what to do next.

### 6. The solo-founder assistant exists internally, but not as a guided founder experience

The admin/operator prompts are intentionally internal and useful:

- `admin_prioritize_leads`
- `admin_prioritize_offer`
- `admin_triage_routing_risk`

And the admin role framing in `src/core/entities/role-directive-assembler.ts` already pushes an operator lens.

That is good.

The gap is that this is framed like internal ops tooling, not a founder guidance system for someone who has never built a business before.

Missing assistant behaviors:

- Help me define my starter offer.
- Help me pick one niche and one promise.
- Help me decide whether to send traffic to chat, a lead form, or a consult page.
- Help me craft outreach to friends and family.
- Help me create a first ad test.
- Help me interpret low conversion numbers.
- Help me choose the next three highest-leverage actions this week.

### 7. The role language is too narrow for the broader persona you described

In `src/core/entities/role-directive-assembler.ts`:

- `AUTHENTICATED` is framed as a registered customer or practitioner.
- `APPRENTICE` is framed as a student with referral and assignment capabilities.

That does not map cleanly to:

- laid-off teacher building a tutoring/coaching business
- laid-off designer building a freelance studio
- laid-off software engineer building consulting or productized services

The product can support them, but the role semantics currently come from a different worldview.

### 8. There is no visible premium upgrade story in the code path reviewed

Across the reviewed `src` surfaces, there is no coherent premium/business-plan model.

What exists:

- signed-in roles
- affiliate capability flag
- internal roles
- some restricted tools

What does not clearly exist:

- a paid plan level
- premium feature packaging
- a clear progression from anonymous to registered to premium business user

For the product you described, this is a major gap.

## Solo-founder persona fit assessment

### Teacher persona

What works:

- Referral link and QR for community distribution.
- Library and chat surface for expertise delivery.
- Lead and consultation funnel infrastructure.

What does not yet fit:

- No guided transformation from “I can teach” to “here is my first offer.”
- `APPRENTICE` wording is confusing if the teacher is the business owner.
- Referral workspace does not help them tailor family/community outreach.

### Designer persona

What works:

- Media systems and asset workflows are unusually strong.
- QR and referral distribution can support client acquisition.
- Operator tools can help triage leads.

What does not yet fit:

- No campaign-specific share flows.
- No landing variants by offer type.
- No clear productized-service funnel layer.

### Software engineer persona

What works:

- Chat-first interaction model.
- Strong internal systems.
- Search, library, and media generation fit technical workflows.

What does not yet fit:

- Too much infrastructure exposed before clear business packaging.
- No simple “here is how to sell your expertise” track.
- Referral workspace is reporting-heavy and strategy-light.

## Simplification direction

### Recommendation 1: Separate product tiers from internal roles

Keep internal roles for operations:

- `STAFF`
- `ADMIN`

Simplify customer-facing tiers to something like:

- `ANONYMOUS`
- `MEMBER`
- `PREMIUM`

Then keep capabilities such as `affiliateEnabled` as flags.

This is a cleaner model for the business you described.

Reason:

- Product tiers should answer “what kind of customer am I?”
- Internal roles should answer “what control do I have over the system?”

Current code mixes those ideas.

### Recommendation 2: Reframe the referrals workspace as a campaign studio

The existing workspace should become less like a dashboard and more like a launch tool.

Minimum simplification target:

- One “Start here” section.
- One “Choose campaign type” step.
- One “Generate assets” step.
- One “What to do next” section.

Suggested campaign types:

- Friends and family
- Past coworkers
- Local community
- Social post
- Paid ad test

Each campaign should generate:

- channel-specific share copy
- persona-specific copy
- campaign-specific QR
- tagged referral URL
- recommended CTA

### Recommendation 3: Add campaign identity to the QR and referral model

The current QR endpoint is code-only.

For a real solo-growth system, add campaign parameters such as:

- campaign ID
- channel
- audience
- offer slug
- landing variant

This does not mean the public referral trust model should be weakened. It means campaign metadata should sit on top of it.

Desired outcome:

- Same trusted referral core.
- Better attribution and coaching.

### Recommendation 4: Make `/r/{code}` a lightweight sales page, not only a validation page

Keep the validation behavior, but add a better conversion layer.

The landing experience should support:

- a clear promise
- an offer choice
- proof or credibility
- one primary CTA
- chat as one option, not the only option

Possible CTA options:

- Start chat
- Book a consult
- Get the starter guide
- See examples

For beginners, this will convert better than “Start chat” alone.

### Recommendation 5: Add a beginner founder assistant surface

The admin/operator system already contains pieces of a business assistant. Add a dedicated founder guidance layer that uses the same underlying tools but speaks to the beginner.

Core jobs for that assistant:

- define offer
- define audience
- define first campaign
- review funnel weak point
- plan outreach
- review follow-up backlog
- suggest weekly priorities

This can remain backed by existing admin/operator loaders and capability systems.

The change needed is packaging and prompt framing, not a wholesale architecture rewrite.

### Recommendation 6: Treat referrals as one acquisition path, not the whole funnel

The current code gives referrals disproportionate structure relative to the front-end acquisition journey.

A beginner solo founder usually needs:

- direct share/referral
- social proof content
- basic lead magnet or starter guide
- consult request path
- simple nurture flow

The system already has lead and consultation pieces, but the public funnel does not present them simply enough yet.

### Recommendation 7: Replace generic copy with persona and offer-aware copy

The current referral CTA copy is too generic.

The system should generate starter copy based on:

- persona: teacher, designer, engineer
- goal: consulting, coaching, productized service, course, tutoring
- relationship: friend/family, coworker, community, cold audience
- call to action: chat, consult, starter guide, examples

This is a high-leverage simplification because it helps non-marketers act immediately.

## Suggested target product model

### Audience model

- Anonymous: visitor evaluating value.
- Member: signed-in user setting up profile, offer, workspace, and simple sharing.
- Premium: serious business builder with guided funnel tools, campaign studio, advanced analytics, and automations.
- Staff/Admin: internal operator controls.

### Core founder journey

1. Anonymous arrives.
2. System clarifies the offer and next best action.
3. Visitor signs up as Member.
4. Member gets a simple launch checklist.
5. Member creates one offer, one campaign, one referral/QR asset.
6. Premium unlocks deeper campaign analytics, assistant guidance, and automation.
7. Staff/Admin layers remain available for power users or internal teams.

### Core business-assistant jobs

- “Help me choose my first paid offer.”
- “Help me explain what I do.”
- “Turn this into a share link and QR campaign for family and friends.”
- “Write outreach for three channels.”
- “Tell me where my funnel is weak.”
- “Tell me what to do this week to get my first client.”

## Concrete code issues to prioritize

1. Product-tier ambiguity.
   Current roles do not express `premium` or paid business progression.

2. Referral workspace UX is analytics-first instead of action-first.
   `src/components/referrals/ReferralsWorkspace.tsx` should guide action before charts.

3. QR system lacks campaign semantics.
   `src/app/api/qr/[code]/route.ts` is technically sound but strategically shallow.

4. Referral landing page is trustworthy but under-selling.
   `src/app/r/[code]/page.tsx` needs a stronger conversion layer.

5. Assistant framing is internal-ops heavy.
   `src/core/entities/role-directive-assembler.ts` and related capabilities should add a beginner founder mode.

6. Generic share copy is not good enough for real-world distribution.
   `buildCtaCopy()` in `src/components/referrals/ReferralsWorkspace.tsx` should be replaced by generated, context-aware variants.

7. Funnel reporting lacks campaign segmentation.
   `src/lib/referrals/referral-analytics.ts` should be extended beyond lifecycle counts.

## What I would do first

### Phase 1: Product simplification

- Define the customer-facing tier model: Anonymous, Member, Premium.
- Keep Staff/Admin separate.
- Decide whether `APPRENTICE` is removed, renamed, or re-scoped.

### Phase 2: Referral and QR simplification

- Turn the referrals page into a campaign launch workflow.
- Add campaign labels and channel presets.
- Generate campaign-specific QR and link variants.
- Replace generic CTA with persona-aware templates.

### Phase 3: Public conversion improvement

- Upgrade `/r/{code}` from validation page to simple sales page.
- Add one primary offer CTA and one secondary CTA.
- Keep chat as an option, not the only answer.

### Phase 4: Founder assistant

- Create a founder-guidance surface using the existing admin/operator logic.
- Focus the assistant on acquisition, offer selection, follow-up, and weekly priorities.

## Bottom line

This codebase already has enough infrastructure to become a strong solo-founder operating system.

What it lacks is not capability. It lacks simplification, packaging, and beginner-first growth framing.

If the product goal is to help a laid-off teacher, designer, or engineer build a business from scratch, the highest-leverage move is not adding more infrastructure. The highest-leverage move is to:

- simplify the tier model,
- turn referrals and QR into a true campaign studio,
- improve the referral landing page into a real conversion surface,
- and repackage the internal operator assistant into a founder guidance assistant.

That would make the current system much more legible, much more useful, and much more aligned with a typical solo person trying to get their first real business moving.