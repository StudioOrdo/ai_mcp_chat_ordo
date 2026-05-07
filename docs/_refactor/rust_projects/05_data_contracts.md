# Specification: Data Contracts & Schema Synchronization

**Audience:** Implementation AI Agent
**Context:** This specification solves the DRY (Don't Repeat Yourself) violation that occurs when domain models are split across TypeScript (Next.js) and Rust (`serde`). 

## 1. The Threat of Schema Drift
Because the appliance architecture relies heavily on the SQLite Database and IPC bridges as integration layers, TypeScript and Rust must agree perfectly on JSON structures.
If `MediaCompositionPlan` is defined using Zod in TypeScript, and manually re-typed as a `struct` with `#[derive(Deserialize)]` in Rust, they will inevitably drift, causing catastrophic serialization panics in production.

## 2. The Single Source of Truth
We must establish a single authoritative source for inter-process communication schemas. Because OrdoSite relies heavily on Next.js Server Actions and deeply nested Zod validation for UI governance, **TypeScript/Zod MUST remain the source of truth.**

## 3. The Implementation Strategy
The Agent must implement an automated build pipeline that ensures Rust code cannot compile if the TypeScript Zod definitions change without the Rust structs being updated.

*   **Step 1:** Write a Node.js utility that exports the Zod schemas (e.g., `JobRequest`, `MediaCompositionPlan`, `GenerationStatusUpdate`) to a standard JSON Schema file (`schema.json`).
*   **Step 2:** Use a Rust `build.rs` script alongside a crate like `schemafy` or `typify` to automatically generate the Rust structs from the JSON Schema at compile time.
*   **Step 3:** Establish strict serialization boundary rules: Ensure Zod's `camelCase` maps perfectly to Rust's idiomatic `snake_case` (e.g., via `#[serde(rename_all = "camelCase")]`).

By automating this contract, we achieve the "Zero TS Protocol Changes" mandate outlined in the Execution Engine specification.
