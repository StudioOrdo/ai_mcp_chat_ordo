# Evidence Contract

## Purpose

Evidence is the basis for a decision, claim, QA finding, bug report, or release
approval.

## Source Of Truth Owner

Continuity and evidence-reference layer.

## Current Status

`partial`

## Current Anchors

- `src/core/entities/conversation-continuity.ts`
- `src/core/entities/research-packet.ts`
- `src/core/entities/materialization.ts`

## Required Contract

An evidence record must record:

- evidence id or stable ref
- source kind
- source id
- source owner or scope
- observed timestamp
- captured by actor or process when known
- summary
- excerpt or location when available
- URI or storage ref when available
- confidence or relevance when available
- related claim ids when available
- retention and privacy policy

An evidence ref must record:

- evidence id or stable source ref
- source kind
- source id
- observed timestamp when known
- short summary when useful for projection
- access or privacy scope when needed

The ref should support review and audit without forcing every consumer to embed
the excerpt, screenshot, log payload, or source document.

## Current Implementation Coverage

Current evidence-like shapes include:

- `CanonicalEvidenceRef`
- `ContinuitySourceRef`
- `ResearchPacket.sources`
- `ResearchPacket.claims`
- `MaterializationRecord.evidenceRefs`

## Contract Additions

Stage 03 must define a shared evidence record/ref adapter without throwing away
domain-specific source, claim, or materialization details.

## Lifecycle

- `observed`
- `accepted`
- `disputed`
- `superseded`
- `redacted`
- `deleted`

## Event And Projection Expectations

- Evidence creation, acceptance, dispute, redaction, and supersession should be
  auditable.
- Public projections should summarize evidence without exposing private payloads.
- QA and release projections should show evidence refs that explain decisions.
- Contradictory evidence should be visible to QA resolution workflows.

## Boundaries

Evidence supports judgment. It should be referenced by artifacts, QA reports,
bug reports, releases, and materialization records.

## Must Not Absorb

- full artifact payloads
- QA disposition
- release approval policy
- recipe definition
- user profile state

## Migration Notes

Current evidence is spread across:

- `CanonicalEvidenceRef`
- `ContinuitySourceRef`
- `ResearchPacket.sources`
- `ResearchPacket.claims`
- `MaterializationRecord.evidenceRefs`

Stage 03 should define one adapter shape that can reference these without
throwing away domain detail.

## Positive Cases

- A citation supports a research claim.
- A screenshot supports a QA finding.
- A job event supports a development bug report.
- A human review note supports release approval.

## Negative Cases

- A claim without a source is not sufficient evidence for publication.
- A prompt instruction is not evidence that work succeeded.
- A dashboard metric without source context should not be used as release
  evidence.

## Edge Cases

- Evidence can be private even when the artifact is public.
- Evidence can be redacted while preserving an audit ref.
- Evidence can support multiple claims or findings.
- Evidence can contradict other evidence and require QA resolution.
