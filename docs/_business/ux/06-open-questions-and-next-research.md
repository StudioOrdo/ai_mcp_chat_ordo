# Decisions And Next Research

This document separates decisions from true unknowns. Future phases should not
re-debate settled language unless implementation proves the decision wrong.

## Product Language Decisions

| Decision | Rationale |
| --- | --- |
| Use **People** in navigation. | The surface is about relationships, not abstract business metrics. |
| Keep `/business` during migration if needed. | Route stability can lag product language. |
| Use **Work** in broad copy. | It is understandable and flexible. |
| Use **Run** inside detail/provenance. | It explains process without saying "job." |
| Use **Relationship Trail** in UI. | It is clearer than relationship provenance. |
| Reserve **Trust Ledger** for docs/admin/business canon. | It is powerful but too abstract for regular cards. |
| Public offers and private offers are both required. | Solopreneurs need public selling pages and tailored proposals. |
| Public content and private content are both required. | Public content drives discovery; private content supports delivery and trust. |
| Content visibility should reuse `ContentAudience`. | The code already enforces audience access in corpus/search/chat retrieval. |
| Jobs and notifications should collapse into Today/Studio/People. | Separate top-right icons create clutter and split attention. |
| Admin belongs in a separate rail/mode. | Daily operator work and system governance are different contexts. |
| Conversations is the first authenticated navigation item. | Chat is the operating interface. Ordo is the active agent conversation today; later human handoffs should join the same selector. |
| Account menu contains My Account, Affiliate Dashboard, theme, and Sign out. | Change Password lives only in the My Account second-column rail. Affiliate Dashboard links to `/referrals`; QR/referral management stays there, while media, conversations, offers, content, and System belong in domain/admin surfaces. |
| Each major section has a base brief and a second-column evidence index. | People proved the pattern; Today, Studio, Offers, Account, and System should converge. |
| Brief generation should copy backup/restore command-result-reconcile rigor. | The backup/restore system is the strongest durable background-work pattern in the codebase. |

## Implementation Gaps To Research Next

1. Durable offer data model and migrations.
   - Required fields likely include title, promise, price, status, visibility,
     owner, optional recipient/person, public slug, and purchase state.
2. Offer creation through chat and UI.
   - Must support public offer creation and private offer creation.
3. Offer visibility.
   - Research whether it should reuse `ContentAudience`, add person-specific
     visibility, or support both.
4. Person/relationship read model from conversations, referrals, leads, deals,
   and relationship memory.
5. Generic tracked links and QR codes for any public URL.
6. Content/feed item read model that can carry article, audio, and short-form
   video.
7. Private content sharing.
   - Research whether `ContentAudience` is enough or whether person/account
     grants are needed.
8. Content performance events: view, click, play, download, subscribe.
9. Owner-safe web research capability and source pack storage.
10. Workflow template/run editing after a conversation proves a repeatable loop.
11. Admin left rail and removal of top-right jobs/notification clutter.
12. Public About rewrite around the humane mission and open-source operator
    system.
13. Shared `GovernanceSectionModel` and `SectionBrief` implementation.
14. Durable brief storage and evidence manifest model.

## True Open Questions

1. Should private offers be addressed to one person, one account, a role, or all
   three?
2. Should private content use only `ContentAudience`, or should it also support
   explicit person/account grants?
3. What is the minimum simulated purchase model needed before real payments?
4. Which events count as "business result" for the first release: view, click,
   conversation, registration, qualified lead, accepted offer, purchase?
5. How much content performance should appear in Today versus Studio detail?
6. Should public Feed include audio RSS immediately, or start with web-only
   content and add RSS in a later phase?
7. What is the correct migration path from `/business` to People without
   breaking route state and tests?

## UX Test Questions

Use these questions during implementation review:

1. Can a first-time solo operator explain what Ordo does after seeing Home and
   About?
2. Can the owner find the next thing that needs them within five seconds?
3. Can the owner tell whether content or QR sharing is creating business
   motion?
4. Can the owner inspect how a media asset was made?
5. Can the owner inspect how a relationship moved from visitor to offer?
6. Can the owner tell whether an offer/content item is public or private before
   publishing or sending it?
7. Can a developer see which existing subsystem a surface reuses?
8. Are admin diagnostics separated from daily operator work?
9. Does a selected object detail avoid repeating section-wide dashboard totals?
10. Can mobile users move from list to detail and back without losing context?

## Evidence To Preserve

Future UX phases should preserve evidence in docs and tests:

- route screenshots for mobile and desktop
- card examples for empty, active, needs-review, ready, failed
- seeded data for Studio, People, Offers, and Feed
- visibility test cases for public, member/account, premium, staff, and admin
- private offer and private content negative tests
- Playwright coverage for public nav, authenticated nav, and key object details
- unit tests for each projector that turns raw state into user-facing cards
