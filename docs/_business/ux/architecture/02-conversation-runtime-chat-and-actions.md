# Conversation Runtime, Chat, And Actions

## UX Intent

Conversation is Ordo's front door and command surface. The chat should help the
operator express intent, then project real work, approvals, media, content, and
relationship state back into the thread.

The product should never rely on prose alone for complex actions. When a user
needs to approve, publish, send, restore, retry, or inspect, the conversation
should expose clear cards and unmistakable buttons.

## Existing Code Evidence

Chat UI:

- `src/frameworks/ui/ChatSurface.tsx`
- `src/frameworks/ui/ChatContentSurface.tsx`
- `src/frameworks/ui/MessageList.tsx`
- `src/frameworks/ui/RichContentRenderer.tsx`
- `src/frameworks/ui/useChatSurfaceState.tsx`
- `src/frameworks/ui/chat/plugins/**`
- `src/frameworks/ui/chat/registry/**`

Chat runtime:

- `src/lib/chat/stream-route-handler.ts`
- `src/lib/chat/stream-preparation.ts`
- `src/lib/chat/stream-execution.ts`
- `src/lib/chat/stream-pipeline.ts`
- `src/lib/chat/chat-turn.ts`
- `src/lib/chat/tool-composition-root.ts`
- `src/lib/chat/tool-capability-routing.ts`
- `src/lib/chat/session-resolution.ts`
- `src/lib/chat/conversation-root.ts`
- `src/hooks/chat/**`

Persistence:

- `conversations`
- `messages`
- `conversation_events`
- `prompt_provenance_records`
- `prompt_bindings`
- `relationship_memory_records`
- `job_events`

Tests:

- `src/frameworks/ui/ChatSurface.test.tsx`
- `src/frameworks/ui/RichContentRenderer.test.tsx`
- `src/frameworks/ui/MessageList.test.tsx`
- `src/frameworks/ui/useChatSurfaceState.test.tsx`
- `src/hooks/chat/**.test.tsx`
- `src/lib/chat/chat-turn.test.ts`
- `src/lib/chat/stream-preparation.test.ts`
- `src/lib/chat/stream-execution.test.ts`
- `src/lib/chat/tool-composition-root.test.ts`
- `src/lib/chat/retrieval-envelope.test.ts`

## Current Functionality

The chat runtime already supports:

- role-aware session resolution
- current page context
- retrieval envelope audience filtering
- tool bundle composition
- operation grounding in prompt preparation
- structured rich message rendering
- action links that can route, send text, open conversations, or invoke job
  actions
- streaming and interruption handling
- browser-runtime job orchestration for client-side media work
- conversation import/export/restore APIs
- attachment/upload handling

Custom chat cards already exist for:

- audio
- chart
- graph
- media rendering
- media workflows
- profile
- referral QR
- relationship memory
- transcript recall
- web search
- lifecycle/coach/system job cards
- operation cards/actions

## UX Mapping

| Current concept | UX meaning | Disposition |
| --- | --- | --- |
| Assistant prose | Explanation and summary | Keep |
| Rich content/action links | Conversation buttons | Keep and make visually stronger |
| Job status cards | Work status | Reframe |
| Operation cards | Approval/protected action cards | Reframe |
| Tool plugin cards | Object previews | Keep |
| Browser job state | Client-side production progress | Reframe as Work |
| Conversation restore | Continuity/provenance | Keep |

## Product Requirements

1. The chat may initiate work, but durable state must live outside the prose.
2. Every multi-step or risky flow must project a card with clear next action.
3. Chat buttons must be visibly button-like, especially for confirmations.
4. A model should not claim a tool completed unless the tool result exists.
5. Job polling should not become a conversation loop; live updates and
   reconciled cards should carry status.
6. Generated work should link to Studio or detail lenses.
7. Relationship outcomes should link to People or a relationship trail.
8. Offer creation must work conversationally and through UI once the durable
   offer model exists.

## Gaps

- The chat can send action text for "Draft offer", but there is no durable offer
  creation operation yet.
- Some cards still expose implementation labels like job/tool names.
- The visual distinction between suggestions and action buttons needs to stay
  strong.
- Complex workflow editing from a successful conversation is not yet first
  class.

## Tests To Preserve Or Add

Existing:

- rich renderer action-link tests
- chat state action routing tests
- stream preparation and prompt grounding tests
- chat send/retry/recovery tests
- custom tool card rendering tests

Add:

- offer-creation chat card creates a durable draft offer
- public/private visibility choices are shown before publishing or sending
- chat cannot display "done" for missing tool output
- repeated job polling does not create duplicate conversation noise
- action cards remain accessible by keyboard and screen reader
