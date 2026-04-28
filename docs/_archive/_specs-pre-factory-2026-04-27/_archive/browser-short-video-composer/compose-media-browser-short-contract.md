# Compose Media Contract For Browser Short Explainer

**Status:** Provisional Contract Under Active Implementation
**Date:** 2026-04-18
**Purpose:** Define the exact `compose_media` request shape for the client-first browser short explainer path.

Execution status for this contract is tracked in [production-readiness-checklist.md](./production-readiness-checklist.md). Use that checklist as the canonical tracker for implementation status, QA gates, blockers, and Phase 7 through 10 reliability alignment.

## Current Contract Status

This document describes the intended release contract.

The burned-caption browser-short fallback rule is now implemented in the current runtime and covered by focused unit tests. A live planner eval now proves planner-to-video completion for a one-image browser-short request, but live browser-proof validation is still incomplete because that passing run executed on the server path.

Validation status as of 2026-04-20:

1. focused unit validation covers the active `browser_short_explainer` beat envelope and prompt guidance contract
2. the old planner-visible rejection for one-image browser-short requests has been removed at the validation layer
3. burned-caption browser-short reroute to deferred server execution is covered at the helper, hook, and server executor layers
4. a live planner eval now completes successfully for a one-image `browser_short_explainer` plan and persists the expected single-beat plan plus governed MP4 output
5. the latest passing live planner eval rendered through the server execution path, so browser-first live proof remains incomplete

## 1. Contract Intent

This contract exists to keep routine video generation on the client.

It is intentionally narrower than a general composition API.

The common case should let the agent go straight from user intent to finished video without assembling a low-level timeline by hand.

## 2. Canonical Tool

`compose_media`

The tool remains the single top-level orchestration surface for finished video generation.

## 3. Primary Mode

`mode: "browser_short_explainer"`

This mode means:

1. client-first composition
2. short explainer pacing
3. one narration track
4. one to five visual beats, with three to five as the richer default pattern
5. burned subtitles by default
6. conservative browser-safe defaults

## 4. Request Shape

```json
{
  "plan": {
    "id": "lesson-derivatives-2026-04-18-a",
    "conversationId": "conv_123",
    "mode": "browser_short_explainer",
    "visualClips": [
      { "assetId": "uf_title_card", "kind": "image" },
      { "assetId": "uf_graph_card", "kind": "image" },
      { "assetId": "uf_takeaway_card", "kind": "image" }
    ],
    "audioClips": [
      { "assetId": "uf_narration_track", "kind": "audio" }
    ],
    "subtitlePolicy": "burned",
    "outputFormat": "mp4",
    "resolution": { "width": 720, "height": 1280 },
    "beatOrder": ["hook", "evidence", "takeaway"],
    "defaults": {
      "orientation": "vertical",
      "pace": "balanced",
      "transitionStyle": "cut",
      "durationTargetSeconds": 45,
      "captionPreset": "educational_short"
    },
    "overrides": {
      "title": "Derivatives In 45 Seconds",
      "hookText": "A derivative tells you how fast something changes.",
      "closingText": "Think slope, but at a single point."
    }
  }
}
```

## 5. Required Fields

Required top-level fields inside `plan`:

1. `id`
2. `conversationId`
3. `mode`
4. `visualClips`
5. `audioClips`

Required behavior:

1. `mode` must be `browser_short_explainer` for the primary release path.
2. `visualClips` should usually contain 3 to 5 prepared still-card assets, but the runtime may accept a single prepared still-card asset for narrow one-beat explainers.
3. `audioClips` must contain at most one narration asset in the primary release path.
4. clip asset references must be governed canonical asset IDs before execution or deferred enqueue begins.

## 6. Supported Visual Inputs

Allowed visual inputs for the primary release path:

1. `image`
2. materialized chart cards represented as governed image assets
3. materialized graph cards represented as governed image assets
4. existing governed still images

The release path should not depend on raw chart or graph timeline composition.

Charts and graphs should be rendered into stable still-card assets before composition begins.

If a caller references prior conversation media, the request must use governed asset identity rather than prompt-only references or placeholder handles.

## 7. Supported Audio Inputs

Allowed audio inputs for the primary release path:

1. one narration track

The release path does not support arbitrary multi-track audio editing.

## 8. Supported Policies

Release 1 policies:

1. `subtitlePolicy`: `none | burned`
2. `outputFormat`: `mp4`

Out-of-scope release 1 policies:

1. waveform generation
2. sidecar subtitle export
3. dual subtitle outputs
4. general webm-first workflow

Notes:

1. the underlying entity surface may still contain compatibility seams outside this document
2. this contract defines the intended production release path, not every tolerated compatibility input

## 9. Defaults

The browser-short explainer mode should apply these defaults unless the caller supplies overrides.

1. orientation: `vertical`
2. resolution: `720x1280`
3. frame rate: `12` or `15`
4. subtitle policy: `burned`
5. transition style: `cut`
6. duration target: `30` to `60` seconds
7. visual budget: `3` to `5` beats
7. visual budget: `1` to `5` beats, with `3` to `5` as the richer default pattern
8. audio budget: `1` narration track

## 10. Overrides

Allowed high-value overrides:

1. exact asset IDs
2. narration asset override
3. title or hook text
4. closing text
5. pacing bias
6. orientation override
7. resolution override when still client-safe
8. beat ordering

Overrides should remain narrow.

They should not reopen a broad editor-style composition surface.

## 11. Preflight Expectations

Before expensive composition work starts, the runtime may validate:

1. browser capability availability
2. governed asset availability
3. canonical asset identity
4. visual count budget
5. audio count budget
6. duration budget
7. governed source rehydration readiness for chart and graph derived visuals
8. subtitle readiness

If the request violates the client-safe contract, the system should fail truthfully or explicitly reroute.

Current blocker:

1. the latest passing planner eval does not yet prove browser-first execution target selection for the same scenario
2. live browser-proof evidence is still needed before this contract can be treated as fully release-grade behavior

## 12. Release 1 Non-Goals

This contract does not try to support:

1. general multi-video editing
2. arbitrary clip timelines
3. waveform generation
4. sidecar subtitle packaging
5. complex transition editing
6. multiple simultaneous audio tracks

This contract also does not promise:

1. generic timeline editing in the browser
2. unrestricted server-first execution for routine requests
3. transcript-local source lookup as the authoritative recovery path when governed source exists

## 13. Why This Contract Is Narrow

The purpose of the narrow contract is to keep routine usage on the client.

This is what makes the feature affordable enough to use broadly for educational help.

## 14. Reliability Alignment

The production contract depends on the following reliability closures:

1. Phase 7: executable compose plans use canonical governed asset identity
2. Phase 8: chart and graph recovery use storage-backed governed source rehydration
3. Phase 9: reroute and worker availability are explicit, deterministic, and truthful
4. Phase 10: the required reliability scenarios are enforced by permanent release gates

Those execution and QA requirements are tracked in [production-readiness-checklist.md](./production-readiness-checklist.md).