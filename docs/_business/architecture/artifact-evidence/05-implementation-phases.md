# Implementation Phases

This is the Stage 03 `Phase` output. It keeps implementation small and
reviewable.

## Phase 03.1 - Read-Only Type Contracts

Goal:

- Add shared artifact/evidence ref types if needed.

Scope:

- Types only.
- No database changes.
- No source model rewrites.

Done:

- Types distinguish record vs ref.
- Types include source surface metadata.
- Tests cover type-level adapter examples where useful.

## Phase 03.2 - Factory Output Artifact Adapter

Goal:

- Project `FactoryOutputRecord` into artifact refs.

Scope:

- Factory outputs.
- Stage run linkage.
- Supersession metadata.

Done:

- Existing execution timeline behavior is preserved.
- Superseded outputs remain visible.
- No payload copying.

## Phase 03.3 - Capability And Media Artifact Adapter

Goal:

- Normalize capability artifacts, media descriptors, user files, and asset
  catalog entries into artifact refs.

Scope:

- `CapabilityArtifactRef`
- `MediaAssetDescriptor`
- `UserFile`
- `AssetCatalogEntry`

Done:

- Tool result artifacts retain media metadata.
- User files retain owner, conversation, status, retention, and metadata.
- Asset catalog remains a projection, not the canonical store.

## Phase 03.4 - Research Evidence Adapter

Goal:

- Project research packet sources and claims into evidence refs.

Scope:

- `ResearchPacket`
- `SourceReference`
- `Claim`
- knowledge access evidence

Done:

- Source ids remain packet-scoped.
- Claim refs include packet context.
- Contradiction refs remain visible.

## Phase 03.5 - Materialization Adapter

Goal:

- Project materialization input source refs, output refs, and evidence refs into
  shared artifact/evidence refs.

Scope:

- `MaterializationRecord`
- `MaterializationOutputRef`
- `CanonicalEvidenceRef`
- `ContinuitySourceRef`

Done:

- Reuse policy remains visible.
- Producing job id remains visible.
- Superseded materializations remain traceable.

## Phase 03.6 - Blog Artifact Adapter

Goal:

- Project blog artifacts and blog assets into artifact refs.

Scope:

- `BlogPostArtifact`
- `blog_assets`
- blog article production artifacts

Done:

- Blog artifact type is preserved.
- Blog asset visibility and selection state are preserved.
- Payload extraction is opt-in by artifact type.

## Phase 03.7 - Projection Integration

Goal:

- Feed shared refs into timeline, artifact index, QA, and release projections.

Scope:

- Read models and projectors only.
- No write-model migration.

Done:

- Work-order timelines can show normalized artifact refs.
- Artifact indexes can list current surfaces consistently.
- Public projections respect privacy and retention.

## Stop Rules

Stop and respec before implementation if:

- an adapter requires copying full payloads into a generic table
- an adapter cannot preserve owner or privacy data
- source/claim evidence cannot be traced back to original records
- supersession or derivative lineage is lost
- projections need query speed that current repositories cannot provide

Only the last condition can justify a materialized artifact/evidence read model.
