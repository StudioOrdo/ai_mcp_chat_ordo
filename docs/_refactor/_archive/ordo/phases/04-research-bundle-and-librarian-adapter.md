# Phase 04: Research Bundle And Librarian Adapter

Status: Planned

Related specs:

- `../specs/05-research-and-synthesis-workflow.md`
- `../specs/08-media-shorts-and-internal-asset-catalog.md`

## Goal

Create the reusable research and librarian layer for content workflows.

The librarian is an internal service, not a public library page. It may retrieve
from corpus, assets, conversation recall, discovery, and web research according
to role policy. Public users only see published feed/offer/about projections.

## Current Code To Research

- `src/core/entities/research-packet.ts`
- `src/lib/factory/stage-executors/research-executor.ts`
- `src/core/platform/knowledge-access/KnowledgeAccessService.ts`
- `src/core/platform/discovery-search/DiscoverySearchService.ts`
- `src/core/platform/asset-catalog/AssetCatalogReader.ts`
- `src/lib/chat/search-pipeline.ts`
- `src/core/capability-catalog/families/corpus-capabilities.ts`
- `src/core/capability-catalog/families/conversation-capabilities.ts`
- `src/core/capability-catalog/families/admin-capabilities.ts`

## Required Work

- Define `ResearchBundle`.
- Define `SynthesisBrief`.
- Build adapters over current search/corpus/web/discovery surfaces.
- Build initial librarian query service over current asset catalog and corpus
  access.
- Enforce role-aware source visibility before synthesis or artifact creation.

## Tests

Positive:

- corpus-only research produces sources and claims.
- synthesis brief cites evidence.
- librarian can return assets and corpus refs.

Negative:

- claims cannot reference missing source IDs.
- unsupported role cannot use admin web search.
- librarian does not expose another user's private assets.
- anonymous/public requests cannot browse internal corpus or asset inventory.

Edge:

- no reliable evidence.
- conflicting claims.
- Rust search unavailable.

## Cleanup

- Keep factory research compatible.
- Avoid adding a universal asset table in this phase.

## Exit Criteria

- The content workflow can depend on one research/synthesis contract.
