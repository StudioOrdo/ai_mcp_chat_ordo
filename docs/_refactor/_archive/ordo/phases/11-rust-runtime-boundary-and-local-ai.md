# Phase 11: Rust Runtime Boundary And Local AI

Status: Planned

## Goal

Add the Rust/runtime boundary proof needed for deterministic media inspection,
future local transcription, and future Rust search without moving product
policy out of TypeScript.

## Current Code To Refresh

- `Cargo.toml`
- `crates/ordo-backup/*`
- TypeScript backup executor adapters and tests.
- `src/lib/media/**`
- `src/lib/evals/**`
- `docs/_refactor/rust_projects/rag_architecture_spec.md`
- Docker image build files from the appliance phases.

## Implementation Scope

- Define a shared Rust executor contract pattern for Ordo binaries.
- Add a TypeScript adapter interface for local runtime executors.
- Implement or stub the first deterministic media verifier if the media
  workflow from Phase 08 needs it.
- Add local transcription as a configured optional executor only if platform
  dependencies are available and tests can remain deterministic.
- Document Rust search as a backend replacement behind current search service
  contracts.

## Out Of Scope

- Rewriting orchestration in Rust.
- Moving access control, prompts, workflow templates, or UI state to Rust.
- Replacing the current search stack before workflow proof passes.

## Required Tests

Positive:

- adapter handles valid versioned Rust JSON;
- Docker/local binary discovery reports installed executors;
- media verifier returns metadata for a known fixture if implemented.

Negative:

- missing binary produces a clear diagnostic;
- invalid Rust output is rejected;
- unsupported media input does not produce a publishable artifact.

Edge:

- file paths with spaces;
- executor timeout;
- version mismatch between binary output and TypeScript schema.

## Cleanup

- Remove ad hoc shell calls that bypass typed executor adapters.
- Remove duplicate media-probe logic only after the Rust verifier covers it.

## Exit Criteria

- Rust boundaries are explicit, tested, optional where appropriate, and aligned
  with the product workflow.
