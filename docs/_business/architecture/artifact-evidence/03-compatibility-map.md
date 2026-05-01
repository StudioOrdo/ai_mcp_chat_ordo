# Compatibility Map

This map is the Stage 03 `Ground` output. It names how current records should
map to artifact/evidence vocabulary without creating duplicate storage.

## Artifact Compatibility

| Current surface | Record or ref | Maps to | Preserve | Gap |
| --- | --- | --- | --- | --- |
| `CapabilityArtifactRef` | ref | `ArtifactRef` | kind, label, mime type, asset id, URI, retention, dimensions, source, tool invocation, derivative tool invocation | no owner, lifecycle, work-order context unless caller supplies it |
| `CapabilityResultEnvelope.artifacts` | ref list | `ArtifactRef[]` | tool name, execution mode, input snapshot context, artifact refs | payload ownership stays domain-specific |
| `FactoryOutputRecord` | record wrapper | `ArtifactRecord` and `ArtifactRef` | entity id, entity kind, work order id, stage run id, supersession, created timestamp, payload | payload-specific lifecycle and privacy need adapter rules |
| `FactoryAsset` | record payload | `ArtifactRecord` | kind, label, URI, mime type, generation params, generated timestamp, provenance, QA status/findings, revision | no generic visibility or retention field |
| `ResearchPacket` | record payload | `ArtifactRecord` | work order id, query, timestamp, summary, confidence, sources, claims, search engine | source/claim evidence must be mapped separately |
| `BlogPostArtifact` | record payload | `ArtifactRecord` | post id, artifact type, payload, creator, created timestamp | payload is opaque; no lifecycle, evidence refs, or lineage except by artifact type |
| `blog_assets` | record | `ArtifactRecord` | post id, storage path, mime type, dimensions, alt text, prompt/provider metadata, visibility, selection state, creator, timestamps | needs adapter to normalize storage path and selection state |
| `MediaAssetDescriptor` | descriptor | `ArtifactRecord` or `ArtifactRef` | kind, mime type, source, asset id/URI, dimensions, duration, conversation id, tool metadata, derivative refs, retention | no owner unless resolved from source |
| `UserFile` | record | `ArtifactRecord` | user id, conversation id, status, hash, file type, filename, mime type, size, metadata, created timestamp | no updated timestamp; lifecycle differs from artifact lifecycle |
| `AssetCatalogEntry` | projection/read model | `ArtifactRef` | asset id, kind, owner, source type, status, label, mime type, retention, timestamps, conversation id, job/materialization lineage, derivatives | projection only; do not treat as canonical payload owner |
| `MaterializationOutputRef` | ref | `ArtifactRef` | output kind, id, user id, conversation id | no label, mime type, or lifecycle without resolving output |
| `QAReport` | record payload | `ArtifactRecord` when produced as output | work order id, disposition/status, criteria, findings, fixes, decision requirement, timestamp | generic QA envelope is Stage 06 |
| `Release` | record payload | `ArtifactRecord` when produced as output | work order id, version, destinations, released/approved by, notes, archive URI, social posts, metrics | broader platform release contract is partial |

## Evidence Compatibility

| Current surface | Record or ref | Maps to | Preserve | Gap |
| --- | --- | --- | --- | --- |
| `ContinuitySourceRef` | ref | `EvidenceRef.source` | source kind, source id, user id, conversation id | no observed time or summary by itself |
| `CanonicalEvidenceRef` | ref | `EvidenceRef` | source ref, observed timestamp, summary | no evidence id, lifecycle, confidence, or payload location |
| `ResearchPacket.sources` | source record | `EvidenceRecord` and `EvidenceRef` | title, URL, retrieved timestamp, relevance score | no owner or privacy fields |
| `ResearchPacket.claims` | claim record | `EvidenceRecord` | claim text, supporting source ids, confidence, contradiction ids | source refs are packet-local ids and need stable resolution |
| `KnowledgeEvidenceRecord` | evidence record | `EvidenceRecord` | corpus result evidence from local knowledge access | needs adapter-specific source kind and retention policy |
| `MaterializationRecord.inputSourceRefs` | refs | `EvidenceRef[]` | input source refs used for materialization | source details require resolving original records |
| `MaterializationRecord.evidenceRefs` | refs | `EvidenceRef[]` | evidence used for materialization decisions | already close to canonical evidence refs |
| `FactoryEventRecord` | event record | `EvidenceRecord` | work order id, stage run id, sequence, event type, payload, timestamp | payload may contain private details; needs redaction policy |
| `JobEvent` | event record | `EvidenceRecord` | job id, event type, payload, sequence, timestamp | source shape differs by job subsystem |
| Human review note | new workflow record | `EvidenceRecord` | reviewer, timestamp, summary, decision context | needs implementation in QA/development workflow stages |

## Adapter Output Rules

Every adapter should return:

- a small ref shape for projections
- a lazy resolver path back to the current source record
- source-surface metadata
- owner/conversation scope when available
- privacy/retention when available
- lineage when available

Every adapter should avoid:

- copying opaque payloads into a generic table
- flattening all evidence into artifact records
- treating projections as canonical write models
- losing supersession or derivative relationships

## Initial Adapter Priority

1. Factory outputs to artifact refs.
2. Capability artifacts to artifact refs.
3. User files/media assets to artifact refs.
4. Research packet sources/claims to evidence refs.
5. Materialization evidence/output refs to artifact/evidence refs.
6. Blog artifacts/assets to artifact refs.

This order follows current reuse pressure: work orders, timelines, media reuse,
research QA, materialization, then content workflow migration.
