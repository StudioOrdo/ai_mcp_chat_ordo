# Browser Short Video Composer Implementation Phases

**Status:** Active Execution Plan Under Locked Product Direction
**Date:** 2026-04-18
**Goal:** Deliver a reliable production-ready browser-first short video system and remove dead, speculative, or conflicting media behavior along the way.

This plan executes the locked decisions in [product-decisions.md](./product-decisions.md).

Execution status for this plan is tracked in [production-readiness-checklist.md](./production-readiness-checklist.md). Use that checklist as the canonical tracker for implementation status, QA gates, blockers, and Phase 7 through 10 reliability alignment.

**Delivery Principle:** The supported happy path must run on the client for affordability. Server-side composition is a fallback lane, not the target architecture for everyday usage.

## Phase 0: Freeze The Product Contract

**Objective:** Stop feature drift before more code changes land.

Deliverables:

1. Approve the `browser_short_explainer` primary mode.
2. Approve defaults-plus-overrides as the agent-facing contract.
3. Approve the first-release scope cuts.
4. Approve client-first affordability as a release-defining constraint.

Required decisions:

1. Keep `compose_media` as the single canonical tool surface.
2. Add a mode or profile that explicitly selects the browser-short explainer contract.
3. Treat existing media reuse as a first-class input path.
4. Reuse the journal/blog pattern: one high-level orchestration tool plus narrow deterministic support tools.

Exit criteria:

1. One documented product contract exists.
2. No new speculative media options are added outside the approved contract.

## Phase 1: Remove Dead And Misleading Surface Area

**Objective:** Delete or collapse contract branches that make the system look broader than it really is.

Target cleanup:

1. Remove `waveformPolicy` from entities, schemas, prompts, executor input snapshots, and tests unless an implementation owner and date exist.
2. Reduce subtitle support to the modes actually implemented for release 1.
3. Remove duplicated tool authority for chart, graph, and audio where the capability catalog and legacy descriptors disagree.
4. Remove stale or compatibility-only behavior that is no longer part of the approved browser-short path.

Primary files likely affected:

1. `src/core/entities/media-composition.ts`
2. `src/lib/media/ffmpeg/media-composition-plan.ts`
3. `src/core/capability-catalog/families/media-capabilities.ts`
4. `src/core/capability-catalog/runtime-tool-binding.ts`
5. `src/core/use-cases/tools/generate-audio.tool.ts`
6. `src/core/use-cases/tools/generate-chart.tool.ts`
7. `src/core/use-cases/tools/generate-graph.tool.ts`

Exit criteria:

1. No unused media contract fields remain in the public feature surface.
2. Tool authority and runtime authority agree.
3. Tests reflect the reduced contract instead of preserving dead options.

## Phase 2: Define The Browser-Short Explainer Runtime

**Objective:** Make the browser path narrow, explicit, and reliable.

Implementation targets:

1. Add a dedicated browser-short composition profile.
2. Tighten browser routing limits to what succeeds reliably for 30 to 60 second output.
3. Make fallback deterministic and truthful when the browser route is not viable.
4. Define explicit progress phases for storyboard generation, visual rendering, subtitle prep, composition, upload, and finalization.
5. Ensure the profile is intentionally optimized for client affordability, not maximum compositor flexibility.

Recommended constraints:

1. max duration: 60 seconds in browser
2. max visual beats: 5
3. max audio tracks: 1
4. default resolution: 720x1280
5. default frame rate: 12 or 15 fps

Primary files likely affected:

1. `src/lib/media/ffmpeg/media-composition-profile.ts`
2. `src/lib/media/ffmpeg/media-execution-router.ts`
3. `src/lib/media/browser-runtime/ffmpeg-capability-probe.ts`
4. `src/lib/media/browser-runtime/ffmpeg-browser-executor.ts`

Exit criteria:

1. Browser routing and browser execution are aligned.
2. The browser path is intentionally conservative.
3. Fallback behavior is truthful and test-backed.

## Phase 3: Rebuild Composition Around Storyboards

**Objective:** Replace broad clip-mixing assumptions with a storyboard-driven short explainer pipeline.

Implementation targets:

1. Introduce a storyboard or beat model.
2. Convert content into 1 to 5 visual beats, with 3 to 5 as the richer default pattern.
3. Support chart, graph, title, and existing media beats.
4. Support direct agent-to-video generation through defaults.
5. Add an explicit readiness or preflight summary for borderline or long-running requests before expensive work starts.

Suggested beat types:

1. title or hook
2. concept card
3. worked step
4. chart or graph evidence
5. takeaway

Exit criteria:

1. The common video path no longer depends on generic multi-clip assumptions.
2. Agent intent can produce a finished video without manual asset wrangling.
3. Existing assets can still be supplied as overrides.

## Phase 4: Standardize Visual Card Rendering

**Objective:** Make charts and graphs video-safe and mobile-readable.

Implementation targets:

1. Create a shared visual card contract for chart, graph, and title assets.
2. Standardize safe areas, typography, title placement, footer treatment, and subtitle-safe regions.
3. Make chart and graph renderers produce predictable still assets for the composer.

Exit criteria:

1. Visuals remain legible in vertical mobile playback.
2. Chart and graph cards share one design contract.
3. The video composer consumes prepared visual cards rather than raw renderer-specific formats.

## Phase 5: Implement Burned Subtitles Properly

**Objective:** Make subtitles a real feature rather than a schema promise.

Implementation targets:

1. Promote subtitle timing from dormant helper code into the active composition pipeline.
2. Generate caption cues from narration or provided timing metadata.
3. Burn subtitle text into the browser-short output.

Primary files likely affected:

1. `src/lib/media/subtitle-timing.ts`
2. `src/lib/media/browser-runtime/ffmpeg.worker.ts`
3. `src/lib/media/ffmpeg/server/ffmpeg-server-executor.ts`

Exit criteria:

1. Burned subtitles work in the browser path.
2. Subtitle behavior is deterministic and test-backed.
3. The public subtitle contract matches the implemented subtitle behavior.

## Phase 6: Reliability Phase 7, Canonical Asset Identity And Compose Normalization

**Objective:** Ensure every executable or queued compose plan converges on governed canonical asset IDs before execution begins.

Implementation targets:

1. Canonicalize clip references into governed asset IDs before browser execution, deferred enqueue, or replay can treat a plan as executable.
2. Reject unresolved placeholder handles with explicit invalid-plan failures instead of optimistic execution.
3. Ensure browser recovery, deferred reroute, and transcript-visible snapshots all observe the same canonical compose identity.
4. Preserve governed provenance through `sourceAssetId` rather than relying on placeholder handles surviving later turns.

Exit criteria:

1. No executable or queued compose plan contains unresolved placeholder clip references.
2. Browser recovery and deferred enqueue consume the same canonicalized plan shape.
3. Transcript and replay state expose governed asset identity as the authoritative compose reference.

## Phase 7: Reliability Phase 8, Storage-Backed Source Rehydration And Derivative Continuity

**Objective:** Make governed source storage the primary authority for chart and graph rehydration in both browser and server paths.

Implementation targets:

1. Retrieve source-derived media inputs from governed storage by canonical asset ID rather than transcript-local tool payloads.
2. Align browser and server derivation around the same source retrieval and lineage contract.
3. Preserve derivative lineage metadata consistently through recomposition, replay, and import.
4. Ensure source retrieval failures are attributed as source-rehydration failures rather than transcript-missing drift.

Exit criteria:

1. Chart and graph recomposition no longer require transcript-local source lookup when governed source assets exist.
2. Browser and server derivation operate from the same governed-source authority model.
3. Derived media preserve consistent lineage semantics across both routes.

## Phase 8: Reliability Phase 9, Runtime Resilience, Worker Availability, And Deterministic Fallback

**Objective:** Make execution-target availability explicit and ensure reroute paths degrade deterministically instead of failing opaquely.

Implementation targets:

1. Classify worker transport and health failures into stable operational classes.
2. Expose worker availability and execution posture in diagnostics and operator-facing health surfaces.
3. Define and document the deterministic route chain for `compose_media`.
4. Preserve canonical result and failure semantics across worker-backed and in-process server execution.
5. Resolve the browser-short burned-caption fallback rule so browser capability failures are surfaced truthfully.

Exit criteria:

1. No media reroute path fails with opaque transport-only messaging when a more specific failure class is available.
2. Execution-target availability is visible in diagnostics and evidence.
3. Worker unavailability no longer creates an avoidable single point of failure for composition recovery.

## Phase 9: Reliability Phase 10, Reliability Operations, Chaos Coverage, And Permanent Gates

**Objective:** Turn the Phase 7 through 9 contracts into permanent scenario-driven gates, runbooks, and anti-drift rules.

Verification tracks:

1. unresolved placeholder asset ID scenarios
2. governed source present but transcript-local tool result absent scenarios
3. browser interruption and reconciliation scenarios
4. worker-unavailable and worker-execution-failure scenarios
5. derivative-lineage mismatch scenarios
6. governed media reuse, replay, and refresh continuity scenarios
7. release evidence for success, fallback, and failure classes

Release gate expectations:

1. runtime-integrity and release evidence name the browser-short contract directly
2. required reliability scenarios are exercised deliberately, not inferred from green-path tests
3. operator guidance, diagnostics, and automated evidence use the same failure vocabulary
4. future media changes cannot bypass the Phase 7 through 9 contracts without adding scenario coverage

## Cross-Cutting Maintainability Track

**Objective:** Break apart orchestration hotspots so the feature can stay maintainable without changing the production contract.

Implementation targets:

1. Decompose `useBrowserCapabilityRuntime.ts` into smaller planning, materialization, fallback, and finalization units.
2. Unify chart and graph card shell logic behind a shared visualization card abstraction.
3. Normalize result payload shapes for chart, graph, audio, and composed video.
4. Reduce ad hoc state reconstruction in browser runtime consumers.

Exit criteria:

1. Browser media orchestration is modular instead of monolithic.
2. The chart and graph UI surface no longer duplicates the same shell behavior.
3. Tool results no longer require ad hoc reconstruction in multiple consumers.

## Recommended Sequence

Execute the phases in this order:

1. Phase 0
2. Phase 1
3. Phase 2
4. Phase 3
5. Phase 4
6. Phase 5
7. Phase 6
8. Phase 7
9. Phase 8
10. Phase 9

The cross-cutting maintainability track can proceed in parallel once the contract is stable, but it must not change product behavior or outrun the reliability phases.

This order matters. Removing dead or conflicting surface area first will make the implementation smaller, the runtime cleaner, and the final browser-first product much easier to stabilize.