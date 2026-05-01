# Artifact And Evidence Model

This directory is the Stage 03 spec pack.

Stage 03 translates the kernel artifact and evidence contracts into an
implementation-ready model grounded in current code. It does not create a new
artifact store by default.

## Decision

Use an adapter-first model.

The current system already has durable artifact-like and evidence-like records.
Stage 03 should define a shared vocabulary and compatibility adapters over those
records before introducing new storage.

## Spec Files

1. [Current Surfaces](01-current-surfaces.md)
2. [Adapter Spec](02-adapter-spec.md)
3. [Compatibility Map](03-compatibility-map.md)
4. [Stage 03 QA](04-stage-03-qa.md)
5. [Implementation Phases](05-implementation-phases.md)

## Output Standard

Stage 03 is complete when:

- current artifact/evidence surfaces are inventoried
- artifact record/ref and evidence record/ref semantics are clear
- existing records have compatibility mappings
- privacy, retention, lineage, QA, and release relationships are preserved
- implementation is phased without requiring a new table first
