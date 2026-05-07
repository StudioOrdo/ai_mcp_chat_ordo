# Rust Strategy

Status: Planned
Date: 2026-05-04

## Principle

Use Rust where deterministic execution, filesystem safety, long-running local
work, media inspection, or local model performance materially improve the
product.

Do not move orchestration policy, user permissions, product copy, or UI state
into Rust. Those belong in the TypeScript application because they change with
product behavior and are already integrated with operations, roles, and chat.

## Current Rust Grounding

Current anchors:

- `Cargo.toml` and `crates/*` provide the existing Rust workspace.
- `crates/ordo-backup/*` is the strongest Rust proof so far: bounded command
  contract, deterministic archive behavior, and TypeScript service integration.
- `docs/_refactor/rust_projects/rag_architecture_spec.md` describes a future
  Rust search/RAG direction.
- Docker/appliance phases already build Rust binaries into the single image.

## Target Rust Responsibilities

Rust should be considered for:

- backup and restore execution;
- local search indexing and retrieval backends;
- file/media probing and checks such as duration, dimensions, codec, size, and
  basic integrity;
- audio transcription through a local Whisper-family runtime when the platform
  supports it;
- deterministic feed artifact validation before publish;
- optional local model runners or adapters where latency and privacy justify
  the boundary.

Rust should not own:

- choosing what a user is allowed to do;
- deciding whether to publish;
- role or audience policy;
- workflow template editing;
- prompt construction;
- operation presentation;
- admin UI state.

## Boundary Shape

Rust binaries should expose narrow command contracts:

- JSON input on stdin or explicit file path arguments;
- JSON output on stdout;
- structured error codes;
- no ungoverned writes outside configured runtime directories;
- versioned contracts recorded in TypeScript schema tests.

TypeScript should call Rust through adapter interfaces so tests can use fake
executors without shelling out.

## First Product Uses

1. Keep `ordo-backup` as the model for future Rust services.
2. Add media inspection before the short/audio workflow relies on generated
   media artifacts.
3. Add local transcription as an optional executor, not a required dependency.
4. Keep Rust search behind the existing knowledge/search service boundaries
   until the TypeScript workflow proves the product loop.

## Tests

Positive tests:

- Rust executor returns versioned JSON for valid input.
- TypeScript adapters normalize Rust success output into domain records.
- Docker image includes required Rust binaries.

Negative tests:

- invalid JSON input returns a structured error;
- missing files fail without partial writes;
- unsupported media/transcription inputs return actionable diagnostics.

Edge tests:

- large input paths and spaces in paths;
- timeout handling;
- empty output from Rust process;
- version mismatch between TypeScript schema and Rust binary.

