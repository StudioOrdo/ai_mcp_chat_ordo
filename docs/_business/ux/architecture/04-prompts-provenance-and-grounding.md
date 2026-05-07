# Prompts, Provenance, And Grounding

## UX Intent

Prompt behavior should be governed, inspectable, and tied to user-visible work.
The user should not see prompt internals during normal operation, but the
system must preserve enough evidence to explain why Ordo acted the way it did.

In the UX, this becomes:

- "Context used"
- "Instructions used"
- "Why Ordo recommended this"
- "See how this was made"

## Existing Code Evidence

Prompt runtime:

- `src/lib/chat/prompt-runtime.ts`
- `src/lib/chat/policy.ts`
- `src/lib/chat/stream-preparation.ts`
- `src/lib/chat/stream-route-handler.ts`
- `src/lib/chat/chat-turn.ts`
- `src/core/entities/role-directive-assembler.ts`
- `src/core/entities/role-directives.ts`

Prompt control plane:

- `src/lib/prompts/prompt-control-plane-service.ts`
- `src/lib/admin/prompts/admin-prompts.ts`
- `src/lib/admin/prompts/admin-prompts-actions.ts`
- `src/app/admin/prompts/page.tsx`
- `src/app/admin/prompts/[role]/[promptType]/page.tsx`

Prompt evidence:

- `src/lib/prompts/prompt-binding-service.ts`
- `src/lib/prompts/prompt-provenance-service.ts`
- `src/adapters/PromptBindingDataMapper.ts`
- `src/adapters/PromptProvenanceDataMapper.ts`
- `prompt_bindings`
- `prompt_provenance_records`

Grounding:

- `src/lib/chat/retrieval-envelope.ts`
- `src/lib/chat/current-page-context.ts`
- `src/lib/chat/summary-context.ts`
- `src/lib/operations/operation-prompt-grounding.ts`
- `src/core/use-cases/operations/OperationPromptGrounding.ts`

Tests:

- `src/lib/prompts/prompt-binding-service.test.ts`
- `src/lib/prompts/prompt-provenance-service.test.ts`
- `src/lib/prompts/prompt-provenance.test.ts`
- `src/lib/chat/prompt-runtime.ts` is covered through chat runtime tests
- `src/lib/chat/stream-preparation.operation-grounding.test.ts`
- `src/core/entities/role-directive-assembler.test.ts`
- `src/core/capability-catalog/prompt-directive-unification.test.ts`
- `src/adapters/PromptBindingDataMapper.test.ts`
- `src/adapters/PromptProvenanceDataMapper.test.ts`

## Current Functionality

The prompt runtime can assemble:

- base prompt slots
- role directives
- instance identity overlays
- current page context
- context window guards
- operation grounding
- extra request sections
- role-visible tool schemas

The admin prompt control plane can:

- list prompt slots
- show active/fallback prompt content
- create prompt versions
- activate prompt versions
- produce diffs
- trigger revalidation paths

Prompt evidence can:

- record prompt runtime sections
- store prompt bindings against messages/jobs/operations
- replay prompt runtime
- diff rebuilt prompt provenance against recorded provenance
- attach assistant messages to prompt turns

## UX Mapping

| Internal concept | UX wording | Surface |
| --- | --- | --- |
| prompt provenance | Context used / instructions used | Provenance detail |
| prompt binding | Instructions attached to this work | Provenance detail/admin |
| role directive | Role-specific behavior | Admin prompt governance |
| prompt slot | Prompt version | Admin prompt governance |
| operation grounding | Active protected work context | Hidden, surfaced as approval/work state |
| retrieval envelope | Content visible to you | Visibility/detail when relevant |

## Product Requirements

1. Regular users should not edit prompts directly.
2. Staff/admin can inspect and govern prompt versions.
3. User-facing provenance should summarize prompt/context evidence without
   dumping raw system prompts.
4. Prompt provenance must remain attached to produced work, jobs, operations,
   and important conversations.
5. Active operations must be grounded into prompts so the model cannot lose
   pending confirmation state.
6. Retrieval must respect viewer audience before context reaches the model.

## Gaps

- Provenance lenses need concise user-facing summaries of prompt evidence.
- Prompt evidence is rich but mostly admin/developer oriented.
- Public/private offer creation will need prompt evidence attached to offer
  drafts and sent offers.
- Workflow-template creation from a conversation needs prompt binding and
  replay evidence.

## Tests To Preserve Or Add

Existing:

- prompt binding persistence
- prompt provenance recording/replay/diff
- role directive assembly
- operation prompt grounding
- prompt directive/capability unification

Add:

- produced content detail shows "context used" without exposing raw hidden
  system instructions
- private content retrieval never includes audiences outside the viewer
- offer creation records prompt provenance
- workflow save/edit records prompt provenance and source conversation
