# Browser Short Video Composer Specification Plan

**Status:** Active Draft Under Locked Product Direction
**Date:** 2026-04-18
**Goal:** Write and execute a feature specification that turns the current media stack into a reliable browser-first short video product.

This document expands the locked decisions in [product-decisions.md](./product-decisions.md) into a full feature specification.

## Execution Tracking

Execution status for this spec track is maintained in [production-readiness-checklist.md](./production-readiness-checklist.md).

Use that checklist as the canonical progress tracker for:

1. implementation stages
2. QA gates
3. blockers and decision points
4. Phase 7 through 10 reliability alignment

## 0. Non-Negotiable Constraint

Client-side composition is a product and affordability requirement, not just a technical preference.

Implications:

1. The browser path is the default operating mode for supported requests.
2. The feature contract must be narrow enough that the client path succeeds reliably.
3. Server execution is a fallback for unsupported, oversized, or capability-blocked cases.
4. Any feature that materially pushes routine usage off the client path should be treated as out of scope unless it delivers exceptional value.

## 1. Product Thesis

The feature should not behave like a general-purpose video editor.

The production target is a short explainer generator for educational and short-form media:

1. 30 to 60 second output
2. 9:16 vertical MP4 by default
3. charts, graphs, title cards, and existing governed media as visual inputs
4. one narration track
5. burned subtitles by default
6. browser-first execution for the common path
7. truthful fallback to server execution only when browser constraints are exceeded or browser capability is unavailable

This is not only a UX choice. It is also the cost model that keeps the feature affordable at scale.

This is the right product shape for math tutoring, worked-example clips, recap videos, and short social education content because it optimizes for readability, speed, and repeatability instead of broad editing flexibility.

## 2. What The Full Specification Must Decide

The final feature specification should answer these questions explicitly.

## 2A. Patterns To Reuse From Journal And Blog Tools

The journal and blog system provides a strong pattern for how this feature should be structured.

Patterns worth reusing:

1. One high-level orchestration tool exists for the full outcome.
2. Narrow deterministic tools exist for inspection, readiness, and targeted edits.
3. The orchestration tool takes a concise input contract with strong defaults.
4. Progress phases are explicit and operator-readable.
5. Readiness checks are separated from the final high-impact action.

Why this matters for media:

1. `compose_media` should remain the single tool for “make the finished video.”
2. Media discovery, readiness checks, and exact asset selection should stay deterministic and separate.
3. The agent should not have to manually run the internal media workflow step by step in the common case.
4. The system should still expose narrower tools when the user needs exact control.

### 2.1 User Outcome

1. What does a successful end-to-end request look like from agent command to finished video?
2. What is the minimum acceptable latency for a browser-first composition?
3. What output quality matters most for the use case: text readability, subtitle clarity, chart legibility, stable timing, or codec fidelity?

### 2.2 Supported Scenarios

1. New video built entirely from an agent-generated storyboard.
2. New video built from agent-generated chart or graph cards plus narration.
3. New video built from existing governed media assets selected from the conversation.
4. Mixed mode: defaults for a complete auto-generated explainer, plus overrides for users who want to reuse or pin specific assets.

### 2.3 Explicit Scope Cuts

The spec should remove or defer anything that is not required for the first reliable production release.

Candidates to cut from the active feature contract:

1. `waveformPolicy`
2. `subtitlePolicy` values `sidecar` and `both`
3. arbitrary multi-track audio editing
4. general browser timeline editing
5. unconstrained multi-video composition in the browser
6. speculative media options that have schema presence but no executor support

### 2.4 Tool Surface

The feature spec should settle the tool/API question clearly.

Recommended direction:

1. Keep one primary high-level tool contract for the agent-facing path.
2. Prefer a defaults-plus-overrides design rather than many narrowly overlapping tools.
3. Preserve reuse of existing governed media assets as first-class inputs.
4. Follow the journal/blog pattern: one orchestration tool for outcome delivery, plus a small set of deterministic support tools.
5. Bias the contract toward client-feasible requests by default rather than exposing a broad surface that routinely falls back to server execution.

Recommended tool shape:

1. High-level intent entry point:
   `compose_media` remains the canonical execution tool.
2. Add a stronger structured plan surface for the marquee path:
   `mode: "browser_short_explainer"`
3. Defaults cover:
   output aspect ratio, duration target, subtitle behavior, pacing, transition style, and card layout.
4. Overrides cover:
   selected asset IDs, narration text or asset, title, pacing bias, resolution, orientation, and visual ordering.
5. Support tools stay narrow:
   asset discovery, readiness/preflight summary, and exact asset selection only when they reduce ambiguity.

This gives the agent a straight path from command to finished video while still letting advanced callers reuse media or pin specific beats.

## 3. Proposed Product Contract

The final specification should formalize a single primary contract for production.

### 3.1 Core Mode

`browser_short_explainer`

Characteristics:

1. 30 to 60 second duration budget
2. 1 to 5 visual beats, with 3 to 5 still the richer default pattern
3. 1 narration track
4. burned subtitles required by default
5. chart and graph inputs are rendered into branded still cards before composition
6. transitions limited to cuts or short fades
7. vertical output by default
8. designed so the supported happy path completes on the client

### 3.2 Asset Rules

1. Existing governed assets can be reused directly.
2. Charts and graphs must be materialized into stable visual card assets before video composition.
3. If the request references a prior conversation asset, the system must use the governed asset identity, not a prompt-only reference.

### 3.3 Defaults And Overrides Model

Defaults should handle the common case so the agent can go directly from intent to finished video.

Suggested defaults:

1. orientation: vertical
2. resolution: 720x1280
3. frame rate: 12 or 15 fps
4. subtitle mode: burned
5. clip count budget: 1 to 5 beats
6. transition style: cut
7. composition style: lesson card sequence

Suggested overrides:

1. use these asset IDs exactly
2. use this narration asset or narration text
3. prefer 1:1 or 16:9 instead of 9:16
4. prefer slower pacing or faster pacing
5. pin title card or closing card text
6. override beat order

## 4. What Must Be Verified Before The Spec Is Complete

The specification is not ready for implementation until these are decided and written down.

1. Browser execution envelope and capability requirements, including SharedArrayBuffer isolation.
2. Exact browser routing thresholds for duration, visual count, and narration size.
3. Subtitle generation and burn-in contract.
4. Storyboard model and beat schema.
5. Visual card design contract for charts, graphs, and title cards.
6. Truthful fallback semantics when browser execution cannot complete.
7. Release-gate evidence for browser success, fallback success, and asset reuse continuity.

## 5. Authoring Plan For The Final Spec

Write the full feature specification in this order.

1. Problem statement and product goal.
2. Supported scenarios and non-goals.
3. Browser-short explainer contract.
4. Tool surface and input model.
5. Storyboard and visual card system.
6. Subtitle and narration rules.
7. Browser execution limits and fallback policy.
8. Cleanup and deletion plan for dead or speculative branches.
9. Test strategy and release gates.
10. Migration plan from the current `compose_media` behavior.

## 6. Decisions Already Recommended

These decisions are strong enough to treat as provisional defaults now.

1. The marquee feature should be optimized for explainers, not generic editing.
2. The browser path should be the primary happy path.
3. The input model should use defaults plus explicit overrides.
4. Existing media reuse should remain supported.
5. Dead or unimplemented feature branches should be removed rather than preserved behind dormant schema.
6. The tool model should mirror blog production: concise orchestration by default, deterministic support tools for inspection and exact control.
7. Affordability depends on the client path being the default for routine usage, so the feature must be shaped around client constraints.