# Validation Checklist

Status: Planned
Date: 2026-05-04

Use this checklist when QAing the package and each phase.

## Package-Level Checks

- Every spec names current code to reuse or modify.
- Every spec names cleanup candidates.
- Every spec includes positive, negative, and edge tests.
- Every phase has a clear goal, current-code anchors, implementation scope,
  required tests, cleanup, and exit criteria.
- Canonical UX governance phases preserve the shared section model:
  chat command, section brief, second-column evidence index, selected detail,
  trail/provenance, and admin diagnostics.
- Today, Studio, People, Offers, Account, and System must converge on the same
  section layout before the canonical UX package closes.
- Rust responsibilities are explicit and do not absorb product policy.
- Public `/library` exposure is not assumed to be on by default.
- QR/referral, content feed, audio, charts, graphs, and shorts remain in scope.
- Workflow templates/runs are first-class artifacts, not chat-only output.
- Evals produce durable artifacts that can be inspected after execution.

## Phase QA Checks

- Refresh `code-grounding.md` or phase-specific evidence before editing code.
- Record exact files and tests in the phase doc before implementation.
- Run deterministic tests first.
- Add live/eval coverage only where deterministic assertions still leave a
  product risk.
- Update cleanup notes after implementation.
- Do not delete donor systems until replacement tests pass.

## Product Checks

- A first-time public user understands what Ordo does from the homepage
  conversation and CTAs.
- A solopreneur can publish useful public content without understanding the
  internal tool list.
- An admin can inspect workflow runs, operation state, assets, and metrics.
- A public agent can read safe business views without seeing private state.
- A future developer can add a workflow step by following docs and tests rather
  than copying ad hoc tools.

## Technical Checks

- Operation state remains the source of truth for complex or risky actions.
- Confirmation buttons exist for publishing and irreversible work.
- Access control uses current role/audience gates.
- Feed items reference assets and source workflow runs where relevant.
- Review output is stored as evidence, not only prose in chat.
- Media artifacts have inspectable metadata.
- Rust executors have versioned JSON contracts and adapter tests.
