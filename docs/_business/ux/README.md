# Ordo UX Canon

This folder defines the user experience contract for Ordo.

Ordo helps a solo operator create useful work, manage people, sell public and
private offers, publish public and private content, and understand what is
producing results.

It translates the business canon into product language, navigation,
information architecture, visibility rules, and interaction patterns. The goal
is to keep Ordo simple enough for a solo operator to understand on a phone,
while preserving the provenance, review, access control, and execution depth
that makes the system real.

## Status

These documents are normative for UX work.

- **Must** means new product work should follow it.
- **Should** means follow it unless the current code makes that impossible.
- **May** means useful guidance, not a gate.

When implementation and this canon disagree, update the canon or the
implementation before adding another user-facing surface.

## Core Claim

Ordo is a humane operating system for individuals who have to build and run
their own businesses.

The product should feel like a capable small team inside the user's own site:
chief of staff, researcher, producer, reviewer, publisher, and relationship
keeper. It should not feel like a bundle of tools, queues, logs, and
dashboards.

## Canonical Precedence

When UX documents, planning specs, and implementation phases conflict, use this
order:

1. `docs/_business/ux/08-product-kernel-contract.md`
2. `docs/_business/ux/09-canonical-ux-architecture.md`
3. `docs/_business/ux/00-ux-north-star.md`
4. `docs/_business/ux/01-language-and-vocabulary.md`
5. Current phase spec and current-code evidence

`docs/_refactor/planning` is implementation planning. It can propose changes,
but it does not override this UX canon until the canon is updated.

## Documents

1. [UX North Star](00-ux-north-star.md)
2. [Language and Vocabulary](01-language-and-vocabulary.md)
3. [Message and Tone](02-message-and-tone.md)
4. [Interface Principles](03-interface-principles.md)
5. [Code Archaeology Functionality Map](04-code-archaeology-functionality-map.md)
6. [Product Story Reuse Map](05-product-story-reuse-map.md)
7. [Decisions And Next Research](06-open-questions-and-next-research.md)
8. [System Inventory Raw Evidence](07-system-inventory-raw-evidence.md)
9. [Product Kernel Contract](08-product-kernel-contract.md)
10. [Canonical UX Architecture](09-canonical-ux-architecture.md)
11. [UX Architecture Archeology](architecture/README.md)

## Product Rule

Before adding a user-facing feature, answer these questions:

1. What human job does this help the solo operator complete?
2. Which object does it belong to: brief, work, media, content, person, offer,
   tracked link, conversation, system health, backup/restore, or business
   result?
3. Who can see it: public visitor, signed-in member, account owner, premium
   member, apprentice, staff, or admin?
4. Is it a public offer/content item or a private offer/content item?
5. What is the one obvious next action?
6. Where is the provenance, relationship trail, or performance trail?
7. Which existing code surface can carry it before a new surface is invented?
8. Which progressive disclosure level does it occupy: chat command, section
   brief, second-column evidence index, selected detail, provenance/trail, or
   admin diagnostic?

If those answers are unclear, the feature is not ready for UI.

## Visibility Rule

Content visibility must reuse the existing audience model where possible:
`src/lib/access/content-access.ts` defines `ContentAudience` as `public`,
`member`, `account`, `premium`, `apprentice`, `staff`, and `admin`.

Offer visibility does not yet have an equivalent durable model. Until it does,
UX specs must call out whether an offer is public, private to a person,
private to signed-in users, or staff/admin only.
