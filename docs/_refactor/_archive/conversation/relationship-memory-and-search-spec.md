# Relationship Memory And Search Specification

## Objective

Define the target memory and search architecture for a long-lived customer
conversation system.

## Current Finding

The current search stack has useful infrastructure, but conversation search is
not a relationship memory system.

Current conversation recall is mostly:

- serialized transcript content
- conversation chunking
- embeddings
- vector similarity

That is useful for recall, but insufficient for continuity.

## Target Split

The system should split search into four product services.

### 1. Relationship Memory Retrieval

Purpose:

- continue the customer relationship
- recall goals, preferences, decisions, open loops, and important assets
- support next-action recommendations

Primary data:

- structured memory records
- workspace snapshot
- memory evidence refs
- key transcript and job refs

### 2. Transcript Recall

Purpose:

- answer what was said before
- support forensic history
- cite prior turns
- search archived conversations

Primary data:

- transcript chunks
- summary chunks
- message metadata

### 3. Corpus Grounding

Purpose:

- answer questions against library, docs, or business corpus
- provide citations
- support grounded reasoning

Primary data:

- corpus chunks
- hybrid search results
- citation records

### 4. Product Discovery

Purpose:

- find routes, admin entities, jobs, media, and product surfaces
- help operators navigate

Primary data:

- product entities
- route metadata
- admin objects

## Relationship Memory Projection

Memory should be updated continuously from events.

Inputs:

- user messages
- assistant messages
- explicit corrections
- summaries
- job results
- asset catalog changes
- identity migration events

Outputs:

- active goals
- preferences
- decisions
- commitments
- open questions
- milestones
- asset context

## Evidence Rules

Every memory record should keep evidence refs.

Evidence refs may point to:

- message IDs
- job IDs
- asset IDs
- summary IDs
- prompt binding IDs
- external corpus refs

Memory without evidence is allowed only for explicitly user-provided profile or
preference data.

## Search API Shape

Suggested relationship memory API:

```typescript
export interface RelationshipMemorySearchRequest {
  userId: string;
  conversationId: string;
  query: string;
  memoryTypes?: readonly string[];
  includeEvidence?: boolean;
  limit?: number;
}

export interface RelationshipMemorySearchResponse {
  query: string;
  results: readonly RelationshipMemorySearchResult[];
  coverage: "strong" | "partial" | "none";
}
```

## Prompt Integration

The chat prompt should receive compact memory context, not raw search dumps.

The memory context should include:

- active objective
- next best action
- unresolved open loops
- relevant preferences
- relevant asset refs
- recent decisions

## Definition Of Done

This spec is satisfied when:

- active conversations are indexed into memory before archival
- restore does not depend on archived transcript embeddings
- user asks about prior work and receives memory-backed answers with evidence
- transcript recall remains available but does not own continuity
- corpus grounding remains separate from relationship memory
