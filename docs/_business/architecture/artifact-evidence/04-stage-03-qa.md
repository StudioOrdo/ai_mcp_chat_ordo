# Stage 03 QA

This is the Stage 03 pre-implementation QA pass.

## Findings

### Finding 1 - New Storage Is Not Justified Yet

Severity: high

The current system already has durable storage for user files, blog assets, blog
artifacts, materialization records, factory outputs, factory stage runs, and
factory work orders.

Resolution:

- Stage 03 should define adapters and compatibility maps first.
- A new artifact/evidence table requires a later proof that existing storage and
  adapters cannot support the required projections.

### Finding 2 - Artifact And Evidence Must Stay Separate

Severity: high

Research packets, materialization records, and QA reports can all contain both
artifacts and evidence. Collapsing them into one object would lose the reason why
an artifact is trusted.

Resolution:

- Keep `ArtifactRecord`/`ArtifactRef` separate from
  `EvidenceRecord`/`EvidenceRef`.
- Allow artifacts to reference evidence, not absorb it.

### Finding 3 - Projections Are Already Doing Part Of The Work

Severity: medium

Media asset projection, asset catalog projection, and execution timeline
projection already convert domain records into reusable refs.

Resolution:

- Reuse these projection patterns in implementation.
- Avoid building a parallel artifact index before proving projection gaps.

### Finding 4 - Blog Artifacts Are Opaque

Severity: medium

`BlogPostArtifact.payload` is intentionally opaque. That preserves flexibility
but makes generic artifact indexing harder.

Resolution:

- Stage 03 adapters should map blog artifact metadata first.
- Payload-specific extraction should be opt-in by artifact type.

### Finding 5 - Research Claim Evidence Uses Packet-Local Ids

Severity: medium

Research claims reference source ids local to the packet.

Resolution:

- Evidence adapters must include the packet id when projecting source and claim
  refs.
- A claim ref should not be treated as globally stable without packet context.

## Positive Cases

- A factory output can appear in a work-order timeline as an artifact ref without
  copying its payload.
- A generated image can preserve tool, asset, retention, and derivative metadata.
- A research claim can point back to source refs and contradiction refs.
- A materialization decision can expose input source refs, output refs, evidence
  refs, and reuse policy.
- A blog article QA report can be indexed as an artifact while leaving the
  domain payload in the blog artifact table.

## Negative Cases

- Do not create one opaque `artifacts` table that stores every payload.
- Do not treat a citation as a full artifact when it is only evidence.
- Do not expose private evidence in public projections by default.
- Do not discard superseded factory outputs.
- Do not treat `AssetCatalogEntry` as the canonical asset record.

## Edge Cases

- An artifact can be public while supporting evidence remains private.
- An artifact can be a QA report or release record.
- Evidence can contradict other evidence and require QA resolution.
- A generated asset can be both a user file and a materialization output.
- A factory output can supersede an older output while both remain audit-relevant.
- A blog asset can be a durable public image while its generation prompt stays
  private.

## QA Verdict

The Stage 03 spec is implementation-ready only if implementation begins with
read-only adapters. Code changes that add storage, migrate payloads, or rewrite
domain models should be deferred until adapter gaps are proven.
