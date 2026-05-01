# Current Surfaces

This inventory is the Stage 03 `Collect` step.

## Artifact-Like Surfaces

### Capability Result Artifacts

Current anchors:

- `src/core/entities/capability-result.ts`
- `src/core/tool-registry/ToolExecutionContext.ts`

Current shape:

- `CapabilityArtifactRef` carries kind, label, mime type, asset id, URI,
  retention class, dimensions, duration, source, tool invocation id, and
  derivative tool invocation id.
- `CapabilityResultEnvelope` can carry a list of capability artifact refs.

Use:

- tool and job result projection
- chat/tool result replay
- bridge from tool output to timeline artifacts

### Factory Outputs

Current anchors:

- `src/core/use-cases/FactoryRepository.ts`
- `src/lib/db/tables.ts`

Current shape:

- `FactoryOutputRecord` carries entity id, entity kind, work order id, stage run
  id, supersedes entity id, created timestamp, and payload.
- `factory_outputs` persists id, work order id, stage run id, entity kind,
  supersession, timestamp, and JSON payload.

Use:

- work-order stage outputs
- revision lineage through `supersedesEntityId`
- execution timeline artifact projection

### Factory Assets

Current anchors:

- `src/core/entities/factory-asset.ts`

Current shape:

- `FactoryAsset` carries work order id, kind, label, URI, mime type, generation
  params, generated timestamp, provenance, QA status, QA findings, and revision.
- `AssetProvenance` carries stage key, previous asset id, and source asset ids.

Use:

- generated media within factory work orders
- QA-linked artifact state
- lineage and revision tracking

### Research Packets

Current anchors:

- `src/core/entities/research-packet.ts`

Current shape:

- `ResearchPacket` carries work order id, query, search timestamp, summary,
  confidence, sources, claims, and search engine.
- `SourceReference` carries title, URL, retrieved timestamp, and relevance.
- `Claim` carries text, supporting source ids, confidence, and contradiction ids.

Use:

- research artifacts
- claim/evidence bridge
- publication QA support

### Blog Artifacts And Blog Assets

Current anchors:

- `src/core/entities/blog-artifact.ts`
- `src/core/entities/blog-asset.ts`
- `src/lib/blog/`
- `src/lib/db/tables.ts`

Current shape:

- `BlogPostArtifact` stores artifact type, payload, post id, creator, and
  created timestamp.
- `blog_post_artifacts` persists artifact type and JSON payload.
- `blog_assets` stores generated media for blog posts, including storage path,
  mime type, dimensions, alt text, prompt/provider metadata, visibility,
  selection state, and timestamps.

Use:

- article generation prompt/result
- article QA report/resolution
- hero image prompt/generation/selection
- existing content workflow proof case

### Media Assets, User Files, And Asset Catalog

Current anchors:

- `src/core/entities/media-asset.ts`
- `src/core/entities/user-file.ts`
- `src/core/entities/asset-catalog.ts`
- `src/lib/media/media-asset-projection.ts`
- `src/core/platform/asset-catalog/AssetCatalogProjector.ts`
- `src/lib/db/tables.ts`

Current shape:

- `MediaAssetDescriptor` carries kind, mime type, source, asset id or URI,
  dimensions, duration, conversation id, tool metadata, derivative refs, and
  retention class.
- `UserFile` persists generated/uploaded files with user id, conversation id,
  status, content hash, file type, filename, mime type, size, metadata, and
  created timestamp.
- `AssetCatalogEntry` projects user files and blog assets into a reusable asset
  catalog with owner, source type, status, label, mime type, retention,
  materialization key, job lineage, and derivative refs.

Use:

- reusable media assets
- conversation workspace assets
- bridge between user files, blog assets, materialization, and tool artifacts

### Materialization Records

Current anchors:

- `src/core/entities/materialization.ts`
- `src/lib/db/tables.ts`

Current shape:

- `MaterializationRecord` carries user/conversation scope, materialization key,
  tool name, pipeline version, status, reuse policy, input source refs, output
  refs, evidence refs, producing job id, supersession, and timestamps.
- `materialization_records` persists input refs, output refs, and evidence refs
  as JSON.

Use:

- reuse decisions
- generated output lineage
- bridge between source refs, outputs, evidence, and jobs

## Evidence-Like Surfaces

### Continuity And Canonical Evidence

Current anchors:

- `src/core/entities/conversation-continuity.ts`

Current shape:

- `ContinuitySourceRef` carries source kind, source id, user id, and
  conversation id.
- `CanonicalEvidenceRef` carries a source ref, observed timestamp, and summary.
- `CanonicalOwnership` and `CanonicalLifecycle` define owner and deletion state.

Use:

- cross-domain source references
- materialization evidence
- memory, prompt, business workflow, and relationship projections

### Research Evidence

Current anchors:

- `src/core/entities/research-packet.ts`
- `src/core/platform/knowledge-access/KnowledgeAccessService.ts`

Current shape:

- Research packet sources and claims provide source-backed evidence.
- Knowledge access responses expose citations and evidence records from local
  corpus search.

Use:

- local corpus evidence
- web/vector/hybrid research evidence
- claim verification

### Event And Log Evidence

Current anchors:

- `src/core/use-cases/FactoryRepository.ts`
- `src/core/platform/execution/ExecutionTimeline.ts`
- `src/core/platform/execution/ExecutionTimelineProjector.ts`
- `src/lib/db/tables.ts`

Current shape:

- Factory events carry work order id, stage run id, sequence, event type,
  payload, and created timestamp.
- Job events and execution timeline events expose durable, synthetic, and
  derived event records.

Use:

- bug reports
- QA reproduction evidence
- development workflow evidence

## Existing Projector Patterns To Reuse

- `media-asset-projection.ts` already projects user files into media descriptors
  and capability artifact refs.
- `AssetCatalogProjector.ts` already projects user files and blog assets into a
  reusable asset catalog.
- `ExecutionTimelineProjector.ts` already projects capability artifacts and
  factory outputs into timeline artifacts.

Stage 03 should reuse these patterns before adding new persistence.
