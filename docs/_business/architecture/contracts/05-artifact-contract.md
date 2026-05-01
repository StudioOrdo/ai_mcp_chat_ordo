# Artifact Contract

## Purpose

An artifact is anything produced, imported, reviewed, or released by Ordo.

## Source Of Truth Owner

Artifact adapters over existing factory, media, blog, and materialization
surfaces.

## Current Status

`partial`

## Current Anchors

- `src/core/entities/capability-result.ts`
- `src/core/use-cases/FactoryRepository.ts`
- `src/core/entities/blog-artifact.ts`
- `src/core/entities/media-asset.ts`
- `src/core/entities/materialization.ts`
- `src/lib/media/`
- `src/lib/blog/`

## Required Contract

An artifact record must record:

- artifact id
- artifact kind
- owner or scope
- lifecycle state
- producer ref
- work order id when applicable
- stage run id when applicable
- payload ref or storage ref
- mime type or media type when applicable
- source refs
- evidence refs
- QA state or QA refs
- lineage refs
- supersedes or derivative refs
- retention class
- created and updated timestamps

An artifact ref must record:

- artifact id
- artifact kind
- label or summary when useful for projection
- owner or visibility scope when needed for access checks
- storage ref, URI, or entity ref when needed to resolve the record
- work order id and stage run id when the artifact came from workflow execution

The ref must stay small enough to embed in timelines, QA reports, releases, and
artifact indexes without duplicating the full record.

## Current Implementation Coverage

Current artifact-like shapes include:

- capability artifact refs
- factory output records
- factory assets
- research packets
- blog artifacts
- media assets
- materialization outputs

## Contract Additions

Stage 03 must define the adapter boundary between existing artifact-like records
and the shared artifact ref/record vocabulary.

## Lifecycle

- `draft`
- `ready`
- `under_review`
- `approved`
- `rejected`
- `released`
- `superseded`
- `archived`
- `deleted`

## Event And Projection Expectations

- Artifact creation, QA state changes, release, supersession, archive, and delete
  should be projectable.
- Artifact indexes should rely on refs and summaries unless a full payload is
  explicitly requested.
- Artifact projections must preserve lineage and supersession visibility.
- Public projections may show an artifact while hiding private evidence refs or
  payload details.

## Boundaries

Artifacts carry outputs and lineage. Evidence explains why an artifact or claim
is trusted. QA reports judge quality.

## Must Not Absorb

- full work order state
- recipe definition
- all evidence payloads
- release destination state
- projection-only summaries

## Migration Notes

Stage 03 must build a compatibility map before any new artifact storage is
introduced. Current overlapping shapes include:

- capability artifacts
- factory outputs
- factory assets
- research packets
- blog artifacts
- media assets
- materialization outputs

## Positive Cases

- A draft article is an artifact.
- A research packet is an artifact with source and claim evidence.
- A generated image is an artifact with producer and derivative refs.
- A QA report can itself be referenced as an artifact when produced by a stage.

## Negative Cases

- A citation alone is evidence, not necessarily a full artifact.
- A UI card is not an artifact unless it points to a durable output.
- A temporary chat answer should not become an artifact without explicit
  persistence.

## Edge Cases

- An artifact can be imported rather than generated.
- An artifact can be private while its projection is public.
- An artifact can be superseded but still required for audit history.
- An artifact can be a container that references child artifacts.
