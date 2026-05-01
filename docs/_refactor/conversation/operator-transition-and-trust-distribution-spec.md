# Operator Transition And Trust Distribution Specification

## Objective

Define the first-run and return-user experience for people who are not only
managing an existing business, but trying to turn expertise, relationships, and
trust into income.

This is the missing product layer between install, conversation restore,
business workflow context, and the QR/referral system.

The app should help a solo operator or displaced knowledge worker answer:

- what can I offer
- who already trusts me
- what first action can create a real opportunity
- what link, QR card, message, or asset should I use to start
- what happened after I shared it
- what should I do next

## Product Principle

The customer should start with a conversation, not a configuration screen.

Install and setup are necessary, but they are not the user's desired outcome.
The desired outcome is agency: a useful offer, a trusted introduction path, a
first business object, and a visible next step.

## Current Grounding

The codebase already has important pieces:

- `/install` provisions provider keys and the first admin account.
- lifecycle and coach entities model activation, onboarding, tier changes, and
  next steps.
- `/r/{code}` and `/api/qr/{code}` turn referral codes into public share and QR
  surfaces.
- signed referral visit cookies preserve validated attribution.
- the referral ledger records visits, conversation starts, registration,
  leads, consultations, deals, training paths, and credit state.
- `/referrals` gives enabled affiliates a self-service workspace.
- `/admin/affiliates` gives admins a global review, exception, and payout
  surface.
- chat tools expose referral QR, affiliate summary, and referral activity.
- prompt assembly receives server-owned trusted referrer context.
- anonymous-to-authenticated migration links referral history to the real user.

The gap is not whether these systems exist. They do.

The gap is that first-run and restore do not yet treat them as a single product
journey for creating economic motion.

## Canonical Model

### Operator Transition Profile

`OperatorTransitionProfile` is the canonical activation model for a person who
is becoming an operator in the system.

```typescript
export interface OperatorTransitionProfile {
  id: string;
  userId: string;
  conversationId: string | null;
  status:
    | "not_started"
    | "discovering_offer"
    | "building_first_motion"
    | "sharing"
    | "following_up"
    | "operating";
  operatorMode:
    | "existing_business"
    | "new_solo_offer"
    | "career_transition"
    | "community_affiliate"
    | "internal_admin";
  expertiseRefs: readonly OperatorExpertiseRef[];
  audienceRefs: readonly OperatorAudienceRef[];
  offerRefs: readonly OperatorOfferRef[];
  trustDistributionRef: string | null;
  recommendedAction: OperatorTransitionAction | null;
  updatedAt: string;
}
```

This model should be compact. It does not duplicate profile, lifecycle,
referral, lead, or deal records. It records the activation frame that lets the
product guide the user through the next economic step.

### Trust Distribution Context

`TrustDistributionContext` is the canonical model for how human trust becomes
trackable distribution.

```typescript
export interface TrustDistributionContext {
  id: string;
  userId: string;
  conversationId: string | null;
  referralCode: string | null;
  referralUrl: string | null;
  qrCodeUrl: string | null;
  physicalShareAssets: readonly TrustShareAssetRef[];
  introScripts: readonly TrustIntroScript[];
  activeCampaignRefs: readonly TrustCampaignRef[];
  recentReferralRefs: readonly BusinessObjectRef[];
  recommendedAction: OperatorTransitionAction | null;
  updatedAt: string;
}
```

This context should let restore and chat answer:

- what can the user share right now
- what should they say when they share it
- who should they ask first
- what scans or conversations happened
- which referred people need follow-up
- which credits or exceptions need review

## First-Run Experience

First-run should not be a dashboard tour.

The product should start a conversation that can branch into these tracks:

1. existing business: clarify the business, current bottleneck, and first
   operating workflow
2. new solo offer: identify a useful offer from prior expertise
3. career transition: translate past white-collar work into a small service,
   training, or advisory path
4. community affiliate: create a trusted referral path for someone whose value
   is distribution, relationships, or local trust
5. admin setup: finish keys, health, and first-user provisioning only when it
   blocks useful work

The first successful session should produce at least one concrete artifact:

- a clarified offer
- a first lead or audience list
- a referral link or QR code
- a short intro script
- a shareable asset
- a follow-up task
- a setup blocker with a clear reason

## Restore Experience

Restore should load operator transition and trust distribution context after the
business workflow context.

The return surface should be able to say:

- you were shaping this offer
- you were preparing to ask these people
- your referral QR/link is ready
- this scan became a conversation
- this referred person registered or became a lead
- this credit needs review
- this setup blocker prevents sharing or follow-up

The user should never have to reconstruct their path from raw transcript.

## Relationship To Business Workflow Context

`BusinessWorkflowContext` answers what business work is currently in motion.

`OperatorTransitionProfile` answers where the operator is in becoming effective.

`TrustDistributionContext` answers how trust is being converted into reachable,
trackable business motion.

They should point to each other through compact refs, not duplicate payloads.

## Relationship To QR And Affiliate

QR/referral should be treated as infrastructure for trust, not as a marketing
afterthought.

The product should support:

- enabled affiliates sharing a QR/link from chat or `/referrals`
- admins reviewing affiliate exceptions and payout-ready credits
- first-run users creating their first trusted introduction asset
- operators generating physical-card-ready QR assets
- referred visitors carrying validated attribution into anonymous chat
- registration preserving referral linkage and downstream credit
- restore showing referral milestones as business momentum

## Non-Goals

This layer must not become a spam engine.

It must not encourage generic cold outreach.

It must not make affiliate payout logic automatic when human review is required.

It must not hide setup or runtime blockers behind motivational copy.

It must not require external CRMs, ad platforms, or email tools to be useful.

## Test Requirements

The test package must prove:

- first-run can create or resume an operator transition profile
- a user can ask chat for a referral QR and receive the canonical link and QR
  route when enabled
- disabled affiliate access produces a stable, non-deceptive path to `/referrals`
- a signed referral visit carries into anonymous chat restore
- anonymous registration preserves referral linkage
- referral milestones appear as business workflow refs
- restore can show a trust-distribution next action without transcript scanning
- admin exceptions and credit-review pressure remain reviewable, not hidden

## Definition Of Done

This spec is complete when first-run and restore help the user move from
conversation to agency:

- a clear offer or operating objective
- a trusted distribution path
- a shareable link or QR artifact
- a first follow-up action
- a durable record of what happened
- a next step that matches the user's real situation