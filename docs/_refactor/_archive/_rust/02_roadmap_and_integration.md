# Rust Expansion Roadmap & Node.js Integration Guide

This document outlines the strategic roadmap for expanding the Rust "Bare Metal" layer of Studio Ordo, along with explicit integration instructions for the Node.js Agent to ensure a seamless transition between ecosystems.

---

## 1. The Roadmap

### Phase 1: The Recovery Partition (`ordo-backup`) [COMPLETED]
- **Goal:** Autonomous background backups and restores of the SQLite database and media assets.
- **Architecture:** Asynchronous SQLite polling event bus. 
- **Status:** Fully tested and operational in `crates/ordo-backup`.

### Phase 2: The Token Ledger (`ordo-ledger`) [PLANNED]
- **Goal:** Track every token used across all AI inferences to monitor cost and prevent infinite loop runaway.
- **Architecture:** Asynchronous SQLite polling event bus. "Fire and Forget."
- **Why Rust?** Prevents the Node.js UI event loop from blocking while crunching token aggregation math. Rust will aggregate tokens and safely persist them to an isolated `ledger.db`.

### Phase 3: Vector Search & RAG (`ordo-rag`) [PLANNED]
- **Goal:** Millisecond-latency vector similarity search over the entire user corpus.
- **Architecture:** Synchronous Local REST API using the `axum` crate (Rust web framework).
- **Why Rust?** Bypasses the 2GB Node.js RAM limit. Rust will hold massive matrix embeddings entirely in memory without Garbage Collection stutters, allowing for enterprise-grade context retrieval.

---

## 2. Node.js Agent Integration Instructions

> [!IMPORTANT]
> **To the Node.js AI Agent:** Do NOT attempt to rewrite or modify the Rust code in `crates/`. Your boundary stops at the SQLite database and the local HTTP network. Use the specifications below to integrate with the Rust layer.

### Integrating Phase 1: Backups & Restores

The `system_commands` table is the sole interface between Node and the `ordo-backup` daemon.

**To trigger a backup:**
Execute the following query. You do not need a payload.
```sql
INSERT INTO system_commands (id, target, command, status) 
VALUES ('<uuid>', 'rust_daemon', 'backup', 'pending');
```

**To list available restore points:**
Query the database for completed backups to display to the user.
```sql
SELECT result_payload FROM system_commands 
WHERE command = 'backup' AND status = 'complete' 
ORDER BY created_at DESC;
-- Returns: {"snapshot_path": ".data/backups/snapshot_YYYYMMDD_HHMMSS.zip"}
```

**To trigger a restore:**
Pass the exact `snapshot_path` retrieved from the list above into the `payload_json`.
```sql
INSERT INTO system_commands (id, target, command, status, payload_json) 
VALUES ('<uuid>', 'rust_daemon', 'restore', 'pending', '{"snapshot_path": "<exact_path>"}');
```

---

### Integrating Phase 2: The Token Ledger (Future Spec)

When Phase 2 is built, Node.js will never wait for a response. It will log tokens immediately after an LLM call.

**The Fire-and-Forget Log:**
```sql
INSERT INTO system_commands (id, target, command, status, payload_json) 
VALUES ('<uuid>', 'rust_ledger', 'log_tokens', 'pending', '{
  "agent_id": "editor_agent",
  "prompt_tokens": 1250,
  "completion_tokens": 400,
  "model": "claude-3-opus"
}');
```

---

### Integrating Phase 3: Vector Search RAG (Future Spec)

Unlike Backups and Ledgers, RAG requires synchronous responses. You will not use the SQLite Event Bus.

Instead, the `ordo-rag` daemon will run a persistent local API on `localhost:3001`.

**To insert embeddings:**
```typescript
await fetch('http://localhost:3001/rag/insert', {
  method: 'POST',
  body: JSON.stringify({
    document_id: 'doc_123',
    content: 'The founding thesis of Studio Ordo...',
    vector: [0.12, -0.45, ...] // Handled by your local embedding model
  })
});
```

**To query context:**
```typescript
const response = await fetch('http://localhost:3001/rag/search?k=5', {
  method: 'POST',
  body: JSON.stringify({
    vector: [0.12, -0.45, ...] // The embedded search query
  })
});
const relevantChunks = await response.json();
```
