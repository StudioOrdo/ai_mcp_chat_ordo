# Phase 01c3x: Relationship Brief Current Summary

Status: Planned

Parent phase:

- `01c3-authenticated-workspace-tool-rail.md`

Depends on:

- `01c3w-person-detail-header-facts-and-source-actions.md`
- `docs/_business/ux/08-product-kernel-contract.md`

Blocks:

- `01c3y-relationship-trail-and-source-linking.md`

## Goal

Rename and reshape the current person/conversation summary into a Relationship
Brief.

The brief should be Ordo's current synthesized understanding of the person and
relationship.

## Product Rule

The Relationship Brief is the latest useful synthesis. It is not a help panel
and not a raw conversation transcript.

It should answer:

- What does this person want?
- What happened recently?
- What is the best next action?
- What uncertainty or risk matters, if any?

## Current Code Grounding

- `src/lib/business/people-read-model.ts`
  - Current summary/recommended next step donor fields.
- `src/core/platform/business-workflow/BusinessWorkflowContextReader.ts`
  - Reads conversation-scoped relationship/business context.
- `src/core/platform/business-workflow/BusinessWorkflowContextProjector.ts`
  - Projects conversation context and recommended action.
- `src/app/business/conversations/[conversationId]/page.tsx`
  - Existing relationship/conversation context route.
- `src/lib/ordo-details/ordo-detail-projectors.ts`
  - Current detail lens content donor.
- `src/lib/prompts/prompt-provenance.ts`
  - Potential grounding for future prompt/summary provenance if already wired.

## UX Target

Show:

```text
Relationship Brief
As of May 8, 2025

- Ava asked about timeline and what happens after the strategy call.
- She is interested in a workflow audit and wants a clear next step.
- Best next action: send a short follow-up with scope and available times.
```

Rules:

- use "Relationship Brief";
- show an as-of date;
- remove explanatory help text about summary policy;
- update/generate only when new relationship activity exists;
- link prior brief versions through Relationship Trail events in the next
  phase.

## Required Work

- Rename owner-facing "Conversation summary" copy to Relationship Brief.
- Project current brief from existing summary/recommended-action donors.
- Add as-of date using stable formatting.
- Suppress policy/help copy in normal People UI.
- Preserve source/provenance references in data, but do not show raw prompt,
  job, provider, or table names in regular UI.
- If no current brief exists, show a quiet empty state with a chat-oriented next
  action, not a large placeholder.

## Tests

Add or update tests proving:

- Relationship Brief appears above Relationship Trail.
- Current summary and as-of date render.
- No "daily summary" or implementation-policy help text appears in owner UI.
- Brief content is not generated from nothing in empty states.
- Raw prompt/job/provider/table labels do not appear in owner brief copy.

Suggested anchors:

- `src/app/business/people/[personId]/page.test.tsx`
- `src/lib/ordo-details/load-business-object-detail.test.ts`
- `src/lib/business/people-read-model.test.ts`

## Non-Goals

- Do not implement a full editable brief version store unless existing
  evidence already supports it.
- Do not implement the Relationship Trail event list here.
- Do not expose prompt provenance in normal People UI.

