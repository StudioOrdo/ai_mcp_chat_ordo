# Release Contract

## Purpose

A release is a durable published or shipped output.

## Source Of Truth Owner

Release repository or release adapter for each recipe domain.

## Current Status

`partial`

## Current Anchors

- `src/core/entities/release.ts`
- `src/core/use-cases/FactoryRepository.ts`
- `src/core/entities/blog.ts`

## Required Contract

A release must record:

- release id
- schema version
- work order id when applicable
- recipe id and version when applicable
- release version
- release number
- source artifact refs
- approved by actor when applicable
- released by actor or process
- release timestamp
- destination refs
- archive ref
- release notes
- derivative refs
- metrics refs when available
- supersedes or rollback refs when applicable

## Current Implementation Coverage

Current factory release already records:

- id
- schema version
- work order id
- semantic version
- release number
- composition id
- published destinations
- release timestamp
- released by actor
- approved by actor
- release notes
- archive URI
- social posts
- metrics

## Contract Additions

The platform contract still needs:

- recipe id and version when applicable
- source artifact refs beyond `compositionId`
- destination refs with partial-failure visibility
- derivative refs
- supersedes and rollback refs
- mapping for blog publish, scrollytelling pages, social derivatives, and Ordo
  code releases

## Lifecycle

- `candidate`
- `approved`
- `released`
- `partially_failed`
- `superseded`
- `rolled_back`
- `archived`

## Event And Projection Expectations

- Release candidate creation, approval, publication, partial failure,
  supersession, rollback, and archive should be auditable.
- Release projections should show destination status and source artifact refs.
- Public release projections should hide private QA/evidence details unless the
  recipe explicitly publishes them.
- Metrics should be projected through read models and should not mutate the
  release record as the only analytics source.

## Boundaries

Releases record what shipped. Publishing capabilities perform the shipping.

## Must Not Absorb

- publication connector implementation
- full artifact payloads
- QA report payloads
- recipe definition
- projection state

## Migration Notes

Factory release already has version, release number, destinations, approval,
notes, archive URI, social posts, and metrics. Future work should map article
publish state, scrollytelling pages, social derivatives, and Ordo code releases
to the same release vocabulary.

## Positive Cases

- A scrollytelling page release references the final page, audio, charts, and
  social derivative artifacts.
- A blog article release records the published URL and selected hero image.
- An Ordo development release records merged change, verification evidence, and
  release notes.

## Negative Cases

- A release should not be created before required QA gates are satisfied or
  explicitly waived.
- A release should not hide partial publication failures.
- A release should not be the only place artifact lineage exists.

## Edge Cases

- A release can publish to multiple destinations.
- A release can succeed on one channel and fail on another.
- A release can have scheduled derivative posts after the main release.
- A release can be archived while public URLs remain live.
