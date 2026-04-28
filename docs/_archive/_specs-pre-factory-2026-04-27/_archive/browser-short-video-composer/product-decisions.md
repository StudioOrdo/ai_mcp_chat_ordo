# Browser Short Video Composer Product Decisions

**Status:** Locked Decisions
**Date:** 2026-04-18
**Purpose:** Record the product decisions that are no longer open for debate unless explicitly revised.

## 1. Product Identity

The feature is a browser-first short explainer video generator.

It is not a general-purpose video editor.

Release 1 is optimized for:

1. math tutoring clips
2. worked-example explainers
3. recap videos
4. short educational social media videos

## 2. Client-First Constraint

Client-side video generation is a first-order affordability requirement.

That means:

1. supported routine requests must run on the client
2. the product contract must be shaped around client constraints
3. server-side composition is a fallback lane, not the intended normal operating model
4. features that routinely force server execution are out of scope unless they deliver exceptional value

## 3. Canonical Tool Model

`compose_media` remains the canonical top-level media orchestration tool.

We will not introduce a large new family of overlapping top-level video tools.

The tool model will follow the journal/blog pattern:

1. one high-level orchestration tool for the finished outcome
2. a small number of deterministic support tools for inspection, readiness, and exact control

## 4. Primary Release Contract

The primary release contract is `compose_media` with a browser-first explainer mode.

Working mode name:

1. `browser_short_explainer`

Required characteristics:

1. 30 to 60 second target duration
2. 1 to 5 visual beats, with 3 to 5 still the richer default pattern
3. 1 narration track
4. burned subtitles by default
5. chart and graph visuals rendered into stable still cards before composition
6. vertical output by default
7. intentionally conservative browser limits

## 5. Input Philosophy

The feature will use defaults plus explicit overrides.

Defaults should allow the agent to go directly from intent to a finished video.

Overrides should exist only for high-value control such as:

1. exact asset reuse
2. narration text or narration asset selection
3. pacing adjustments
4. orientation or resolution changes
5. beat ordering or pinned visual cards

## 6. Scope Cuts

The following surface area should be removed, deferred, or treated as non-release behavior until fully implemented.

1. `waveformPolicy`
2. subtitle modes that are not truly implemented end to end
3. arbitrary multi-track audio editing
4. broad browser timeline editing
5. unconstrained multi-video browser composition
6. speculative schema options without executor support

## 7. Quality Standard

The release is optimized for readability, stability, and repeatability.

Priority order:

1. chart and graph legibility on mobile
2. subtitle readability
3. truthful completion state
4. reliable browser execution for supported requests
5. consistent branded visual composition

The release is not optimized for maximum compositor flexibility.

## 8. Readiness Rule

High-cost video work should not start unless the system can prove the request is ready.

The feature may use explicit preflight or readiness checks for:

1. asset availability
2. browser eligibility
3. duration budget
4. narration and subtitle readiness

## 9. Deletion Rule

Dead, misleading, or partially implemented feature branches should be removed rather than preserved behind dormant schemas, prompts, or tests.

If a branch is not part of the approved release contract and is not implemented end to end, it should not remain in the active public surface.

## 10. Change Control

Any proposal that changes these decisions must update this document first.

Examples:

1. broadening the feature beyond short explainers
2. making server composition a normal operating mode
3. adding new public media contract fields
4. reintroducing removed speculative options