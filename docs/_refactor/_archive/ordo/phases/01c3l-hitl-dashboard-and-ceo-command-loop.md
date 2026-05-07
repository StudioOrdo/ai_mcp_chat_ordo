# Phase 01c3l: HITL Dashboard And CEO Command Loop

Status: Implemented

Parent phase:

- `01c3-authenticated-workspace-tool-rail.md`

Depends on:

- `01c3k-studio-business-surface-consolidation.md`

## Goal

Make the signed-in dashboard the CEO's daily command surface.

The dashboard should show the user what needs a human decision, what Ordo is
doing, what Ordo produced, what moved the business, and what the user can tell
Ordo to do next.

## Implementation Note

Implemented as the owner command-loop baseline needed for 01c3m closeout:

- `/workspace` remains the owner dashboard.
- The product-facing dashboard copy now frames the surface as `Today`, the
  governance queue for chat-driven work.
- Dashboard blocks route to `/studio?bucket=needs_attention`,
  `/studio?bucket=in_motion`, `/studio?bucket=produced`, and `/business`.
- Dashboard cards now render shared `OrdoCard` projections from activity items
  instead of exposing raw activity cards as the product model.
- Every rendered dashboard card gets an explicit `Ask Ordo` secondary action.
  When the source activity has a conversation link, `Ask Ordo` preserves that
  conversation context; otherwise it falls back to the chat home surface.
- Referral milestone cards use `/business` as the primary action while
  preserving referral diagnostics as secondary evidence.
- Dashboard secondary actions are capped at the shared card-contract limit of
  three actions.
- Runtime/provider logs remain absent from regular-user dashboard copy.

Still deferred to later workflow/action phases:

- richer prefilled command templates for continuing/revising/approving work,
- publish/approval operation buttons beyond the action metadata already
  exposed by projected cards,
- scheduling/time-based decision queues.

Evidence:

- `docs/_refactor/ordo/evidence/phase-01c3l-hitl-dashboard-and-ceo-command-loop.md`
- `docs/_refactor/ordo/evidence/phase-01c3m-object-centered-ux-regression-closeout.md`

## Product Rule

The dashboard is not an analytics dump. It is a HITL decision queue.

Chat is the operating interface. The dashboard is the governance queue.

The user should be able to ask Ordo to continue, revise, approve, publish,
follow up, or explain from the dashboard, but the dashboard itself should not
become a second tool cockpit. It exists to prove what chat-driven work needs,
what it produced, why it matters, and what decision is safe now.

Every dashboard card should answer:

- What needs attention?
- Why does it matter?
- What is the safest next action?
- Can Ordo handle it if the CEO approves?

## Dashboard Sections

### Needs Decision

Examples:

- approve media,
- approve content publish,
- retry failed workflow,
- follow up with lead,
- resolve blocked operation,
- review generated QR/campaign result.

### In Motion

Examples:

- active research,
- media generation,
- workflow run,
- content QA,
- scheduled publication when scheduling lands.

### Produced

Examples:

- new image,
- audio episode,
- short video,
- article,
- QR code,
- feed item.

### Business Pulse

Examples:

- QR scans,
- referral conversations,
- leads,
- offer interest,
- content views/downloads.

### Ask Ordo

Conversation remains the command interface. The dashboard should provide
contextual action buttons that open or send safe, explicit intents to chat or
operation actions.

## Current Code Grounding

- `src/components/dashboard/UserDashboard.tsx`
  - Current dashboard blocks, `Today` governance copy, card rendering, and
    dashboard-specific `Ask Ordo` action projection.
- `src/lib/dashboard/load-user-dashboard.ts`
  - Current block loader.
- `src/components/AttentionInbox.tsx`
  - Donor for durable attention state.
- `src/frameworks/ui/operations/OperationActionButton.tsx`
  - Donor for safe operation actions.
- `src/frameworks/ui/chat/primitives/CapabilityActionRail.tsx`
  - Donor for conversation action buttons.
- `src/lib/activity/activity-read-model.ts`
  - Donor for attention and activity items.
- `src/lib/referrals/referral-analytics.ts`
  - Donor for business pulse.
- `docs/_business/ux/08-product-kernel-contract.md`
  - Governing contract: chat is the operating interface, UI surfaces are the
    governance layer.

## Required Work

- Replace dashboard source buckets with `OrdoCard` buckets:
  - `needs_attention`,
  - `in_motion`,
  - `produced`,
  - `business_loop`.
- Ensure card primary actions are HITL-safe:
  - publish/destructive/high-risk actions go through operation confirmation,
  - simple navigation actions open detail,
  - conversation actions are explicit.
- Reduce dashboard copy density.
- Use icons and compact labels.
- Keep mobile single-column first.
- Add a path for "ask Ordo about this" from every card detail.

## Positive Tests

- Dashboard renders needs-decision cards.
- Dashboard renders produced media/content cards.
- Dashboard renders business-pulse cards.
- Primary action links to detail or safe operation action.
- Mobile dashboard remains readable at 320px/360px.

## Negative Tests

- Dashboard does not show raw runtime logs.
- Dashboard does not show admin-only operations to regular users.
- Publish/destructive actions do not run without confirmation.
- Failed jobs are not presented as final produced assets.

## Edge Tests

- Empty new user.
- Many needs-attention cards.
- All cards completed.
- EventSource unavailable.
- User with business pulse but no media.

## Exit Criteria

- Dashboard feels like the CEO command surface.
- Work is inspectable without exposing machinery first.
- The user can approve, inspect, ask Ordo, or navigate deeper from every
  meaningful card.
