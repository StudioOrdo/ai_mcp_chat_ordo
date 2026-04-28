# Data Lifecycle and Governance: Context and Continuity

## Overview

The platform is engineered for long-term operational health and strict data sovereignty. managing the lifecycle of data—from the real-time compaction of conversational context to the automated purging of old session state—is a core system responsibility.

---

## Context Compaction

As conversations grow, they threaten to exceed the LLM's context window and degrade reasoning performance. To mitigate this, the platform utilizes an automated **Context Compaction** strategy implemented via the `SummarizationInteractor.ts`.

### 1. The Compaction Trigger
When a transcript exceeds a predefined token or message threshold, the system triggers a background summarization task. The agent processes the oldest portion of the thread, extracting key conceptual metadata, entity states, and unresolved tasks.

### 2. Compaction Markers (`compaction_marker`)
The original messages are not simply deleted. They are replaced by a **Compaction Marker**—a specialized message part that contains the generated summary and pointers to the original raw data (persisted in long-term storage). This allows the agent to maintain a coherent "mental model" of the entire thread while significantly reducing the active context size.

### 3. Progressive Compaction
Summaries can themselves be compacted into "Meta-Summaries" for extremely long-running sessions, ensuring that the system can theoretically support conversations of infinite length without losing the core narrative thread.

---

## Retention and Purging Policies

The platform provides granular controls over the "right to be forgotten" and automated data minimization.

### 1. Soft-Delete Lifecycle
Conversations are rarely hard-deleted immediately. Instead, they enter a **Soft-Delete** state where the `status` is set to `archived` and a `deleted_at` timestamp is recorded. In this state, the data is invisible to the primary UI but recoverable by an administrator if needed.

### 2. Automated Purge (`purge_after`)
Every soft-deleted conversation is assigned a `purge_after` date based on the system's retention policy. A background job periodically identifies records exceeding this date and performs a **Hard Purge**, permanently removing all message parts, attachments, and associated vector embeddings from the manifold.

### 3. Purge Governance and Audits
Transparency is maintained through the `conversation_purge_audits` system. Every hard purge event is recorded with:
*   **The Actor**: Who initiated the delete or which automated policy triggered it.
*   **The Reason**: User request, privacy policy, or retention timeout.
*   **Metadata**: A fingerprint of what was deleted (without storing the actual sensitive content).

---

## Transactional Integrity

All data lifecycle operations use **SQLite Transactions** to ensure that multi-table changes (e.g., deleting a message and its associated vector entry) are atomic. This prevents "orphaned" data fragments and maintains the system's strict architectural integrity.

**Summary**: By combining real-time compaction with disciplined retention and audit governance, the platform ensures that agentic sessions remain high-performance, secure, and fully compliant with modern data sovereignty standards.
