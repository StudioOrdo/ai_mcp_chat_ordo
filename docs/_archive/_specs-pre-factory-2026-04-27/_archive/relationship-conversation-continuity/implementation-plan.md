# Relationship Conversation Continuity - Implementation Plan

**Status:** Working Delivery Plan
**Date:** 2026-04-18
**Goal:** Deliver the relationship-thread continuity feature by reusing the current conversation architecture and extending it in clean architecture layers.

## 1. Delivery Strategy

The implementation should prefer extension over replacement.

The current system already has:

1. active conversation restore
2. archive and create-next-span behavior
3. automatic summarization
4. archived embedding and search
5. transcript replay and analytics

The plan is to turn those into a transparent continuity system in stages.

## 2. Phase 1 - Replace The Hard Stop

### 2.1 Goal

Remove the user-facing 200-message product limit without changing the visible one-thread experience.

### 2.2 Work

1. Replace the `MessageLimitError` path in `ConversationInteractor.appendMessage(...)` with a rollover-aware path.
2. Add a rollover threshold policy below the hard failure threshold.
3. Reuse `archiveActive(...)` plus `ensureActive(...)` to rotate to the next active span.
4. Trigger `embedConversation(...)` for the archived span after rollover.
5. Preserve the current conversation restore path so the client simply continues with the new active span.

### 2.3 Exact Engineering Sequence

1. Update stream-time user message persistence to return the resolved conversation id, not just the message id.
2. When persistence hits `MessageLimitError`, call `archiveActive(...)`, then `ensureActive(...)`, then retry the same user message in the new span.
3. If rollover happened and the request includes attachments, reassign those attachments to the new conversation id.
4. If rollover happened for a signed-in user, trigger archived embedding for the prior span.
5. Run the rest of stream preparation, prompt assembly, and Claude execution against the resolved conversation id.
6. Add route-level tests proving the stream emits the new conversation id and the old span is embedded when appropriate.

### 2.4 File-By-File Implementation Order

1. `src/lib/chat/stream-intake.ts`
   Add rollover-aware persistence result shape and retry-on-new-span behavior.
2. `src/lib/chat/stream-route-handler.ts`
   Consume the resolved conversation id, trigger embedding after rollover, and reassign attachments when needed.
3. `src/app/api/chat/stream/route.test.ts`
   Add rollover coverage for anonymous and authenticated paths.
4. `src/core/use-cases/ConversationInteractor.ts`
   Leave the hard limit in place for low-level append semantics during Phase 1 so the rollover seam remains explicit and localized.

This sequencing keeps the first delivery slice minimal and reversible. It removes the product failure without forcing the later thread-linkage schema into the same patch.

### 2.5 Constraints

1. Do not break anonymous conversation continuity.
2. Do not move thread policy into hooks or route handlers.
3. Do not remove current transcript and analytics truth.

### 2.6 Candidate Files

1. `src/core/use-cases/ConversationInteractor.ts`
2. `src/lib/chat/stream-intake.ts`
3. `src/lib/chat/stream-execution.ts`
4. `src/app/api/conversations/active/archive/route.ts`
5. `src/hooks/chat/useChatConversationSession.ts`

Revised primary files for Phase 1 execution:

1. `src/lib/chat/stream-intake.ts`
2. `src/lib/chat/stream-route-handler.ts`
3. `src/app/api/chat/stream/route.test.ts`

Secondary follow-up files if needed:

1. `src/hooks/chat/useChatConversationSession.ts`
2. `src/hooks/chat/chatConversationApi.ts`
3. `src/core/use-cases/ConversationInteractor.ts`

## 3. Phase 2 - Add Logical Thread Identity

### 3.1 Goal

Allow many archived and active spans to behave as one logical relationship thread.

### 3.2 Work

1. Extend the `conversations` persistence model with thread linkage fields.
2. Add migration support for existing conversations.
3. Assign one `relationshipThreadId` to the existing active span for each user.
4. Ensure rollover-created spans inherit the same thread id.
5. Persist span ordering and predecessor/successor linkage.

### 3.3 Candidate Files

1. `src/core/entities/conversation.ts`
2. `src/core/use-cases/ConversationRepository.ts`
3. `src/adapters/ConversationDataMapper.ts`
4. database migration files
5. admin conversation loaders and analytics queries

## 4. Phase 3 - Add Automatic Recall

### 4.1 Goal

Make prior archived spans part of reliable continuity rather than optional model luck.

### 4.2 Work

1. Introduce a thread recall use case that can prepare a bounded recall package.
2. Call that use case from `stream-preparation.ts` before final prompt assembly.
3. Append thread summary state and relevant archived excerpts into prompt sections.
4. Preserve `search_my_conversations` as a user-visible tool while decoupling continuity from tool invocation.

### 4.3 Candidate Files

1. `src/lib/chat/stream-preparation.ts`
2. `src/core/use-cases/tools/search-my-conversations.tool.ts`
3. new thread recall use-case file(s)
4. prompt runtime builder integration

## 5. Phase 4 - Strengthen Support And Admin Surfaces

### 5.1 Goal

Let operators and admins inspect continuity across spans without changing the user-facing single-thread model.

### 5.2 Work

1. Add relationship-thread level views to admin conversation inspection.
2. Aggregate span-local transcript and event records into thread views.
3. Keep export surfaces span-safe while optionally allowing thread-level exports later.
4. Extend analytics to report span rollover and thread continuity quality.

### 5.3 Candidate Files

1. `src/lib/capabilities/shared/analytics-tool.ts`
2. `src/lib/capabilities/shared/analytics-domain.ts`
3. admin conversation loaders and pages
4. transcript export surfaces

## 6. Testing Strategy

### Unit coverage

1. rollover threshold policy
2. thread id inheritance
3. archived recall package selection
4. prompt assembly with thread summary and excerpts

### Integration coverage

1. active span rolls over without user-visible hard failure
2. archived span is embedded after rollover
3. restore path lands on the new active span
4. analytics still see archived and active spans correctly

### Regression coverage

1. anonymous-to-authenticated conversation migration
2. `/clear` and archive behavior
3. failed-send retry
4. transcript export and admin transcript surfaces

## 7. Definition Of Done

This implementation track is done when:

1. the 200-message limit no longer blocks the user experience
2. one visible active conversation flow remains intact
3. archived spans are linked into a logical relationship thread
4. archived recall can be injected automatically before prompt assembly
5. the implementation remains aligned with clean architecture boundaries
