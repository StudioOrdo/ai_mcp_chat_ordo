# Adapter Spec

This is the Stage 03 `Spec` output.

The spec defines shared vocabulary for adapters. It is intentionally not a table
schema.

## Core Decision

Build artifact and evidence adapters first.

Adapters should:

- read existing durable records
- project shared refs and summaries
- preserve domain-specific payloads
- expose lineage, QA, release, privacy, and retention relationships
- avoid copying full payloads into generic blobs

## Artifact Record

An `ArtifactRecord` is a durable source artifact or generated output.

Required logical fields:

- `id`
- `kind`
- `sourceSurface`
- `owner`
- `visibility`
- `lifecycle`
- `producerRef`
- `workOrderId`
- `stageRunId`
- `payloadRef`
- `storageRef`
- `media`
- `sourceRefs`
- `evidenceRefs`
- `qaRefs`
- `lineageRefs`
- `retention`
- `createdAt`
- `updatedAt`

Field rules:

- `payloadRef` points to the durable domain record or payload owner.
- `storageRef` points to files, URLs, asset ids, or storage paths.
- `media` carries mime type, dimensions, duration, and media source when
  applicable.
- `owner` must distinguish user, anonymous session, system, and role ownership
  where current data supports it.
- `visibility` must not be inferred from projection alone.
- `lifecycle` should map from the source surface without mutating the source.

## Artifact Ref

An `ArtifactRef` is a small pointer suitable for timelines, QA reports, release
records, artifact indexes, and projections.

Required logical fields:

- `id`
- `kind`
- `label`
- `sourceSurface`
- `ownerScope`
- `visibility`
- `workOrderId`
- `stageRunId`
- `entityRef`
- `storageRef`
- `mimeType`
- `lifecycle`
- `lineageSummary`

Ref rules:

- Do not embed full payloads.
- Do not duplicate large evidence lists.
- Include enough information for access checks and resolution.
- Include stage/work-order context when the artifact came from workflow
  execution.

## Evidence Record

An `EvidenceRecord` is durable evidence used to support a claim, QA finding,
bug report, approval, or materialization decision.

Required logical fields:

- `id`
- `sourceKind`
- `sourceId`
- `owner`
- `visibility`
- `observedAt`
- `capturedBy`
- `summary`
- `excerptRef`
- `storageRef`
- `confidence`
- `relevance`
- `claimRefs`
- `contradictionRefs`
- `retention`
- `deletionState`

Field rules:

- A source citation, screenshot, event, log, claim, source excerpt, and human
  review note can all be evidence.
- Evidence should be ref-counted by usage through refs, not duplicated into each
  artifact or QA report.
- Private evidence can support public artifacts without exposing the private
  payload.

## Evidence Ref

An `EvidenceRef` is a small pointer to evidence.

Required logical fields:

- `id`
- `sourceKind`
- `sourceId`
- `observedAt`
- `summary`
- `visibility`
- `ownerScope`

Ref rules:

- Keep enough context for QA/release reviewers.
- Do not embed private source payloads by default.
- Preserve links to source records for audit.
- Allow contradiction and dispute workflows to resolve back to original
  evidence.

## Source Surfaces

Initial artifact source surfaces:

- `capability_artifact`
- `factory_output`
- `factory_asset`
- `research_packet`
- `blog_artifact`
- `blog_asset`
- `media_asset`
- `user_file`
- `asset_catalog_entry`
- `materialization_output`
- `qa_report`
- `release`

Initial evidence source surfaces:

- `continuity_source_ref`
- `canonical_evidence_ref`
- `research_source`
- `research_claim`
- `knowledge_evidence`
- `materialization_evidence`
- `factory_event`
- `job_event`
- `human_review_note`

## Lifecycle Mapping

Artifact lifecycle should map to the closest source status:

- `draft`
- `ready`
- `under_review`
- `approved`
- `rejected`
- `released`
- `superseded`
- `archived`
- `deleted`

Evidence lifecycle should map to:

- `observed`
- `accepted`
- `disputed`
- `superseded`
- `redacted`
- `deleted`

If a current source lacks lifecycle state, adapters should return the safest
non-final state and document the gap.

## Privacy And Retention

Adapters must preserve:

- user id where available
- conversation id where available
- retention class where available
- deletion state where available
- visibility where available
- source privacy when evidence is more private than the artifact

Public projections must use refs and summaries unless a release policy explicitly
allows full evidence disclosure.

## Lineage

Adapters must preserve:

- supersession
- derivative asset refs
- source asset refs
- producing job id
- producing tool name
- producing stage run id
- materialization key
- previous work order ids when relevant

Lineage should be available through refs even when full payloads stay in their
domain repositories.
