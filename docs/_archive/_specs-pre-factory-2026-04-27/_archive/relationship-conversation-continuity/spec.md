# Relationship Conversation Continuity - Ultimate System Spec

> **Status:** Active Draft v1.0
> **Date:** 2026-04-18
> **Scope:** Replace the hard active-conversation message ceiling with a durable relationship-thread model built on the existing active conversation, summarization, archive, embedding, transcript, and analytics architecture.
> **Dependencies:** Active conversation restore, conversation persistence, summarization, prompt runtime, vector search, transcript export, admin conversation analytics, and current chat stream execution.
> **Affects:** `src/core/entities/conversation.ts`, `src/core/use-cases/ConversationInteractor.ts`, `src/core/use-cases/MessageRepository.ts`, `src/core/use-cases/SummarizationInteractor.ts`, `src/lib/chat/context-window.ts`, `src/lib/chat/stream-preparation.ts`, `src/lib/chat/stream-intake.ts`, `src/lib/chat/stream-execution.ts`, `src/lib/chat/embed-conversation.ts`, `src/core/use-cases/tools/search-my-conversations.tool.ts`, `src/hooks/chat/useChatConversationSession.ts`, `src/hooks/chat/chatConversationApi.ts`, admin conversation analytics, and future relationship-thread persistence surfaces.
> **Requirement IDs:** `RCC-001` through `RCC-099`

---

## 1. Product Thesis

### 1.1 Core claim

This system should behave like an ongoing operator relationship, not like a generic multi-thread chat inbox. A user should feel that the system remembers the business, the work, the prior decisions, and the operating context across time, while still keeping prompt construction and storage costs bounded. `[RCC-001]`

The right product model is:

1. one visible active conversation flow per user
2. many hidden archival spans underneath that flow
3. rolling summaries for prompt efficiency
4. searchable historical recall for long-term memory
5. durable transcript and event evidence for audit, support, and analytics

### 1.2 What must change

The current runtime already limits model context using prompt-window trimming and summary anchoring. The remaining hard ceiling is a persistence rule: the active conversation rejects writes after 200 stored messages. That is the wrong constraint level. `[RCC-002]`

This feature removes that product limitation by introducing a relationship-thread architecture built on the existing system primitives rather than replacing them.

### 1.2A Locked phase-1 product contract

These decisions are locked for the first delivery slice.

1. The user keeps one visible conversation flow.
2. The system must never surface a 200-message hard stop during normal chat sending.
3. When the active span is full, the system transparently archives it and continues on a new active span.
4. Archived spans remain independently truthful and exportable.
5. Phase 1 reuses current conversation records rather than introducing thread-linkage schema immediately.
6. Phase 1 continuity comes from active restore, summaries, archived embedding, and explicit archived search.
7. Automatic archived recall in prompt assembly is deferred to a later slice.

This locks the immediate feature shape tightly enough to guide code without waiting for the full thread-linkage model. `[RCC-002A]`

### 1.3 Non-goals

This feature does not turn the product into:

1. a many-tab thread manager
2. a user-facing conversation workspace with branching and forking
3. an unbounded literal single database conversation row with infinite replay in one prompt
4. a general-purpose CRM separate from chat

The system remains chat-native and conversation-first. `[RCC-003]`

---

## 2. Verified Current Architecture

### 2.1 What already exists and should be preserved

The repository already contains the core building blocks required for this feature.

1. **One active conversation per user**
   `ConversationInteractor.ensureActive(...)` and `getActiveForUser(...)` already enforce and restore one active conversation. `[RCC-010]`

2. **Server-authoritative active restore**
   `GET /api/conversations/active` plus `useChatRestore()` already hydrate the active conversation on load. `[RCC-011]`

3. **Archive and start-fresh behavior**
   `archiveActive(...)`, `/api/conversations/active/archive`, and the slash-command clear flow already rotate from one active conversation to the next. `[RCC-012]`

4. **Automatic summarization**
   `SummarizationInteractor.summarizeIfNeeded(...)` already compacts older context into `summary` and `meta_summary` system messages. `[RCC-013]`

5. **Prompt-window bounding**
   `buildContextWindow(...)` already keeps the live prompt within message and character budgets while preserving the most recent summary anchor. `[RCC-014]`

6. **Archived conversation embedding**
   `embedConversation(...)` and `ConversationChunker` already produce searchable conversation memory for archived spans. `[RCC-015]`

7. **Conversation retrieval tool**
   `search_my_conversations` already exists as a role-scoped tool for signed-in users. `[RCC-016]`

8. **Transcript durability and analytics**
   `TranscriptStore`, `conversation_events`, and conversation analytics tools already provide replay and inspection surfaces. `[RCC-017]`

### 2.2 Current mismatch

The current active conversation has two independent controls:

1. a **runtime context window** controlled by `context-window.ts`
2. a **storage row-count ceiling** controlled by `MAX_MESSAGES_PER_CONVERSATION` in `ConversationInteractor.ts`

The first one is valid and necessary.

The second one is a product bug. It blocks continuity even though the runtime already knows how to keep prompt size bounded. `[RCC-018]`

### 2.3 Current architecture liabilities

1. summaries reduce prompt load but do not reduce stored row count
2. summary rows themselves consume message-count budget
3. archived conversation retrieval is optional and model-invoked rather than guaranteed by the pipeline
4. archived and active spans are not yet grouped under an explicit logical relationship-thread identity

These are extension problems, not rewrite problems. `[RCC-019]`

---

## 3. Target Product Model

### 3.1 Relationship thread

The user experiences one ongoing thread. Internally, that thread is composed of one or more conversation spans.

Definitions:

1. **Relationship thread**
   The long-lived logical memory container for one user's ongoing operator relationship.

2. **Active span**
   The currently writable conversation record.

3. **Archived span**
   A prior conversation record that has been finalized, embedded, and retained for recall, audit, export, and analytics.

4. **Relationship summary state**
   The compact representation of prior work used to bridge active spans efficiently.

5. **Historical recall set**
   The retrieved historical excerpts injected when the current request depends on prior spans.

This keeps the UX simple while keeping storage, search, and prompt assembly tractable. `[RCC-020]`

### 3.2 User-facing behavior

The user should observe these behaviors:

1. the system resumes where they left off
2. the system does not fail because the conversation is "full"
3. older work remains available for recall and export
4. the user can start fresh intentionally, but the system can also roll forward transparently when needed
5. prior decisions can be recovered when the new request depends on them

This is the intended product contract for a business AI, tutor AI, or solopreneur operator system. `[RCC-021]`

### 3.3 Phase-1 user-facing behavior

For the first shipped slice, the user-visible behavior must be:

1. a long-running conversation continues instead of erroring when it reaches storage budget
2. the next assistant answer streams into the new active span without the user manually creating a new chat
3. the old span is archived and remains available to admin inspection, export, and future retrieval
4. the current page restore path lands on the latest active span after rollover

This slice does not yet promise cross-span automatic memory injection. It promises continuity without hard failure. `[RCC-021A]`

---

## 4. Clean Architecture Shape

### 4.1 Core principles

This feature must stay aligned with the current clean architecture direction.

Rules:

1. entities define relationship-thread and span concepts
2. use cases coordinate lifecycle, rollover, recall, and summary policy
3. repository ports describe persistence and query needs
4. adapters implement database, vector search, transcript, and route plumbing
5. React hooks remain transport/UI orchestration only
6. prompt assembly uses prepared context from use cases rather than reaching into storage ad hoc

### 4.2 Domain layers

### 4.2.1 Entities

Add or extend domain concepts to represent:

1. relationship thread identity
2. conversation span role in that thread
3. rollover reason
4. recall package shape
5. summary state metadata

### 4.2.2 Use Cases

Primary orchestration should live in use cases, not routes or hooks:

1. `ConversationInteractor` continues to own active span lifecycle
2. a new `RelationshipThreadInteractor` or equivalent use-case seam should own thread-level continuity policy
3. `SummarizationInteractor` remains focused on within-span compaction
4. recall preparation should be coordinated before prompt assembly, not delegated to UI or ad hoc model luck

### 4.2.3 Ports

Repository and search ports should describe:

1. fetch active span for thread
2. fetch prior spans for thread
3. persist rollover linkage
4. read and write relationship summary state
5. query relevant archived spans for recall

### 4.2.4 Adapters

Adapters should reuse current SQLite persistence, vector search, transcript export, and event recording infrastructure.

This feature should primarily add structure and orchestration, not replace implementation foundations. `[RCC-030]`

---

## 5. Target Domain Model

### 5.1 Conversation span model

The current `Conversation` entity should remain the persisted span record.

Recommended extension:

```typescript
interface Conversation {
  id: string;
  userId: string;
  relationshipThreadId: string;
  spanIndex: number;
  status: "active" | "archived";
  rolloverReason?: "manual_clear" | "system_rollover" | "retention" | null;
  priorConversationId?: string | null;
  nextConversationId?: string | null;
}
```

This preserves the current conversation storage model while adding thread-level linkage. `[RCC-040]`

### 5.2 Relationship summary state

The system should maintain thread-level memory state separate from raw span messages.

Recommended shape:

```typescript
interface RelationshipSummaryState {
  relationshipThreadId: string;
  latestSummaryText: string | null;
  latestSummarySourceConversationId: string | null;
  latestSummaryUpdatedAt: string | null;
}
```

This state is not a replacement for message-level summaries. It is the bridge across spans. `[RCC-041]`

### 5.3 Recall package

Prompt preparation should consume a structured recall package.

```typescript
interface RelationshipRecallPackage {
  summaryText: string | null;
  excerpts: Array<{
    conversationId: string;
    turnIndex: number;
    relevance: "high" | "medium" | "low";
    content: string;
  }>;
}
```

This should be produced by use cases and passed into prompt assembly as prepared context. `[RCC-042]`

---

## 6. Lifecycle Contract

### 6.1 Active span creation

If a user has no active span, the system should continue to use `ensureActive(...)` to create one.

If a user already has an active span, the system should continue to restore it on load. `[RCC-050]`

### 6.2 Transparent rollover

When the active span reaches a configured rollover threshold, the system should:

1. finalize assistant/user persistence for the current turn
2. ensure summaries are up to date
3. archive the current span
4. embed the archived span
5. create the next active span in the same relationship thread
6. carry forward relationship summary state
7. continue the user experience without surfacing a hard failure

This is the core replacement for the hard 200-message wall. `[RCC-051]`

### 6.3 Manual fresh start

Intentional user actions like clear/new chat should continue to reuse the same archive-and-create-next-span mechanism, but with `rolloverReason = "manual_clear"`. `[RCC-052]`

### 6.4 Archived continuity

Archived spans remain:

1. exportable
2. transcript-replayable
3. admin-inspectable
4. searchable for recall
5. linked into the same relationship thread

Archived does not mean forgotten. `[RCC-053]`

---

## 7. Prompt Assembly Contract

### 7.1 Active-span context

The system should keep using `buildContextWindow(...)` over the active span. This remains the primary prompt source for the current conversation. `[RCC-060]`

### 7.2 Thread summary bridge

If the active span is not the first span in the relationship thread, prompt preparation should append the thread summary bridge before final prompt assembly.

This bridge should come from structured summary state, not from arbitrary message scraping. `[RCC-061]`

### 7.3 Automatic historical recall

Before final prompt assembly in `stream-preparation.ts`, the system should be able to retrieve relevant archived-span excerpts when one of these is true:

1. the user asks to revisit earlier work
2. the routing analyzer indicates prior context is likely required
3. the turn references known entities or prior decisions that are absent from the active span

This recall should not rely only on the model deciding to call `search_my_conversations`. `[RCC-062]`

### 7.4 Tool preservation

`search_my_conversations` should remain available as an explicit tool for intentional recall and user-visible search behavior. Automatic recall does not replace the tool; it makes continuity reliable. `[RCC-063]`

---

## 8. Persistence And Query Design

### 8.1 Preserve current message storage

The current `messages` table and `MessageDataMapper` remain valid for span-local message storage.

This feature should not require a rewrite of message persistence. `[RCC-070]`

### 8.2 Add thread linkage

The minimum recommended persistence addition is thread linkage on conversations.

Required new persisted fields:

1. `relationship_thread_id`
2. `span_index`
3. `prior_conversation_id`
4. `next_conversation_id`
5. `rollover_reason`

This is enough to make archived and active spans behave like one logical thread. `[RCC-071]`

### 8.3 Preserve events and transcript truth

`conversation_events` and transcript export should remain span-local records. Thread-level views can aggregate them later.

This keeps existing observability surfaces stable and composable. `[RCC-072]`

### 8.4 Retrieval indexing

Archived spans should continue to be embedded. The retrieval source identity should remain user-scoped and conversation-scoped.

If thread-level retrieval is later needed, it should be implemented as an aggregation over existing archived-span embeddings rather than a replacement of span-level indexes. `[RCC-073]`

---

## 9. Implementation Boundaries

### 9.1 What belongs in `ConversationInteractor`

Keep these responsibilities in `ConversationInteractor`:

1. ensure active span
2. archive active span
3. append span-local messages
4. list and restore span records
5. record span-local events

### 9.2 What should move into a thread-focused use case

Add a thread-level orchestrator for:

1. threshold-based rollover policy
2. creating the next span with inherited thread identity
3. maintaining thread summary state
4. preparing archived recall packages
5. future thread-level analytics or support surfaces

This avoids bloating `ConversationInteractor` into a god object. `[RCC-080]`

### 9.3 What should stay out of React hooks

Hooks should not own:

1. rollover policy
2. message-cap logic
3. archived-span retrieval decisions
4. thread-linkage logic

Hooks should only coordinate UI session state, fetches, and optimistic rendering. `[RCC-081]`

---

## 10. Migration Strategy

### 10.1 Phase 1: remove user-facing hard stop

Use the existing archive/start-next-span machinery.

Goal:

1. no more user-visible 200-message failure
2. automatic system rollover when threshold is reached
3. no change to visible single-thread UX

Exact contract for Phase 1:

1. detect limit pressure during stream-time user message persistence
2. archive the current active conversation span
3. embed the archived span for signed-in users
4. create the next active span with existing `ensureActive(...)`
5. persist the current user message into the new span
6. continue prompt preparation and stream execution against the new span id
7. reuse the existing restore API so the client lands on the new active span naturally

Phase 1 intentionally does not change the database schema. `[RCC-090A]`

### 10.2 Phase 2: add thread linkage

Introduce `relationshipThreadId` and span linkage fields.

Goal:

1. archived spans are formally grouped with the active span
2. analytics and support can inspect a whole relationship across spans

### 10.3 Phase 3: automatic recall in stream preparation

Add a retrieval-backed pre-prompt recall step.

Goal:

1. archived history becomes reliable continuity, not just optional search
2. recall remains bounded and explainable

### 10.4 Phase 4: thread-level support surfaces

Extend admin and export surfaces to show thread-level continuity views while preserving span truth. `[RCC-090]`

---

## 11. Acceptance Criteria

The feature is complete when all of the following are true.

1. Users can continue the same visible conversation experience past the old 200-message limit without a hard failure.
2. The system rolls from one active span to the next transparently.
3. Archived spans remain exportable, searchable, transcript-replayable, and admin-inspectable.
4. Prompt assembly continues to use bounded active-span context and summary anchoring.
5. Archived recall is available as a deterministic pipeline capability, not only as an optional model tool call.
6. The implementation reuses the current clean architecture seams instead of collapsing logic into routes or hooks.
7. The final design remains conversation-first from the user's point of view. `[RCC-099]`
