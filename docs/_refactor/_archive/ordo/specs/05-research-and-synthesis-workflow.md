# Spec 05: Research And Synthesis Workflow

## Goal

Create the research and synthesis spine for the first flagship content workflow.

## Current Code To Use

- `src/core/entities/research-packet.ts` defines sources, claims, confidence,
  and validation.
- `src/lib/factory/stage-executors/research-executor.ts` creates research
  packets in factory work.
- `src/core/platform/knowledge-access/KnowledgeAccessService.ts` grounds corpus
  retrieval.
- `src/core/platform/discovery-search/DiscoverySearchService.ts` discovers
  routes, corpus, and admin entities.
- `src/lib/chat/search-pipeline.ts` wires hybrid search.
- `src/core/capability-catalog/families/admin-capabilities.ts` exposes
  `admin_web_search`.
- `docs/_refactor/rust_projects/rag_architecture_spec.md` defines future Rust
  search direction.

## Required Work

- Generalize `ResearchPacket` into `ResearchBundle` without breaking factory
  uses.
- Add `SynthesisBrief` contract:
  - audience,
  - objective,
  - thesis,
  - key claims,
  - evidence refs,
  - contradictions,
  - risks,
  - open questions.
- Build adapters over corpus, conversation recall, web search, and discovery.
- Keep evidence/provenance mandatory.

## Cleanup After Replacement

- Avoid feature-specific research steps inside blog/content tools.
- Remove duplicated source/claim shapes after `ResearchBundle` is stable.

## Positive Tests

- Research bundle validates non-empty sources or explains missing evidence.
- Synthesis brief cites claims and evidence refs.
- Corpus-only, web-only, and hybrid research paths return consistent shape.

## Negative Tests

- Unsupported role cannot use admin web search.
- Claims cannot reference missing source IDs.
- Synthesis cannot silently invent evidence.

## Edge Tests

- No reliable evidence returns low confidence and explicit missing-evidence
  summary.
- Conflicting sources produce contradiction records.
- Rust search unavailable falls back to current Node search where configured.

