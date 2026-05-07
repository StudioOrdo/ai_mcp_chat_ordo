# Spec 13: Rust Boundaries, Local AI, And Deterministic Verifiers

Status: Planned

## Goal

Define where Rust belongs in the Ordo product shape so local, deterministic,
and media-heavy work becomes more reliable without moving product policy out of
the TypeScript application.

## Current Code To Reuse Or Modify

- `Cargo.toml` and `crates/*` for the current Rust workspace.
- `crates/ordo-backup/*` for the strongest current Rust command pattern.
- TypeScript backup executor adapters that call the Rust binary.
- `docs/_refactor/rust_projects/rag_architecture_spec.md` for planned Rust
  search architecture.
- `src/lib/media/**` and media workflow tests for future verifier boundaries.

## Required Work

- Standardize Rust executor contracts: JSON input/output, version field,
  structured errors, and no ungoverned writes.
- Add TypeScript adapter interfaces for Rust executors.
- Keep product decisions, permissions, workflow policy, and UI in TypeScript.
- Plan local Whisper-family transcription as an optional executor.
- Plan deterministic media verifiers for generated audio, images, charts,
  graphs, and shorts.
- Plan Rust search as a backend behind existing knowledge/search services.

## Cleanup After Replacement

- Remove shell-command assumptions that bypass typed adapters.
- Remove duplicate Node-side media probing only after Rust verifier tests pass.
- Do not remove TypeScript search/indexing until Rust search proves parity.

## Positive Tests

- Valid Rust executor input returns versioned JSON.
- TypeScript adapter maps valid Rust output into domain records.
- Docker/local runtime can find the expected Rust binaries.

## Negative Tests

- Invalid JSON fails with a structured error.
- Missing binary produces an actionable setup error.
- Unsupported media input fails without creating misleading artifacts.

## Edge Tests

- Paths with spaces.
- Large files.
- Timeout/cancel behavior.
- Rust/TypeScript contract version mismatch.
