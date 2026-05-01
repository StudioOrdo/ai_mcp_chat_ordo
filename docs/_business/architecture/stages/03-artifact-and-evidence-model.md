# Stage 03 - Artifact And Evidence Model

## Goal

Unify produced outputs, imported inputs, sources, claims, QA evidence, and
release assets.

## Decision

Use an adapter-first model.

The current system already has durable artifact-like and evidence-like records.
Stage 03 defines shared record/ref vocabulary and compatibility adapters over
those records before introducing new storage.

## Spec Pack

- [Artifact And Evidence Model](../artifact-evidence/README.md)
- [Current Surfaces](../artifact-evidence/01-current-surfaces.md)
- [Adapter Spec](../artifact-evidence/02-adapter-spec.md)
- [Compatibility Map](../artifact-evidence/03-compatibility-map.md)
- [Stage 03 QA](../artifact-evidence/04-stage-03-qa.md)
- [Implementation Phases](../artifact-evidence/05-implementation-phases.md)

## Build

- Define artifact identity and ownership.
- Define artifact kinds.
- Define evidence refs.
- Define source refs and citation metadata.
- Define artifact lineage and supersession.
- Define privacy and retention fields.
- Map user files, blog assets, factory outputs, materialization records, QA
  reports, and releases.
- Distinguish artifact records from artifact refs.
- Distinguish evidence records from evidence refs.
- Define compatibility maps for current durable surfaces.
- Define stop rules before any new artifact/evidence storage.

## Current Surfaces To Reuse

- `CapabilityArtifactRef`
- `CapabilityResultEnvelope.artifacts`
- `FactoryOutputRecord`
- `FactoryAsset`
- `ResearchPacket`
- `BlogPostArtifact`
- `blog_assets`
- `MediaAssetDescriptor`
- `UserFile`
- `AssetCatalogEntry`
- `MaterializationRecord`
- `ContinuitySourceRef`
- `CanonicalEvidenceRef`
- `KnowledgeEvidenceRecord`
- factory and job events

## Done

- Research packets, scrollytelling media, QA reports, and Ordo development
  evidence can use the same artifact/evidence vocabulary.
- Existing asset/materialization records are not duplicated.
- Shared adapter semantics are specified before implementation.
- Compatibility maps identify current source surfaces and gaps.
- Implementation starts read-only and adapter-first.
- New storage is explicitly deferred unless adapter gaps prove it necessary.

## Positive Cases

- A factory output can become an artifact ref in a timeline without copying its
  payload.
- A research claim can become evidence while preserving packet/source context.
- A materialization record can expose input source refs, output refs, evidence
  refs, reuse policy, and producing job id.
- A blog QA report can be indexed as an artifact while the payload stays in the
  blog artifact table.

## Negative Cases

- Do not create one opaque artifact table for every payload.
- Do not collapse evidence into artifacts.
- Do not treat asset catalog entries as canonical write records.
- Do not expose private evidence in public projections by default.
- Do not drop supersession, derivative, or materialization lineage.

## Edge Cases

- An artifact can be public while its evidence remains private.
- A generated asset can be both a user file and materialization output.
- A QA report or release can also be an artifact when produced by a stage.
- Research claim ids are packet-local and need packet context.
- A superseded artifact can remain required for audit.

## Guardrails

- Do not collapse all artifacts into one opaque blob.
- Do not lose source, claim, or provenance data during generation.
- Do not add storage until read-only adapters prove current storage is
  insufficient.
- Do not make projections source-of-record state.
