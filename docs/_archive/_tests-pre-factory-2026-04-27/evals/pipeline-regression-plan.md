# Pipeline Regression Prevention Plan

**Source:** Live session analysis of `conv_f5dd9a19` (2026-04-26)  
**Verified against codebase:** 2026-04-27

This document defines the exact tests needed to prevent a recurrence of the five bugs discovered during live testing of the media pipeline. Each entry maps to a specific bug, a specific test file, and a specific location in the codebase.

---

## Bug 1 — Retrograde Job State Rendering

**What happened:** Job cards briefly showed `failed → queued → failed` because the UI rendered `job_status` message parts in message insertion order, not by `sequence` number. When a `queued` update arrived in a later message than the `failed` update, the card appeared to go backward.

**Where to fix:**
- `src/frameworks/ui/chat/plugins/system/SystemJobCard.tsx` (or wherever parts are sorted before rendering)
- `src/frameworks/ui/chat/plugins/system/SystemJobCard.test.tsx` — add sequence ordering tests

**Tests to add in `SystemJobCard.test.tsx`:**

```typescript
it("renders the status from the highest sequence number, not insertion order", () => {
  // Simulate a failed update (seq=22) arriving before a queued update (seq=19)
  // The card should show "failed" (seq=22 wins), not "queued"
});

it("does not regress to an earlier status when a lower-sequence part arrives later", () => {
  // Given: failed @ seq=22 already rendered
  // When: queued @ seq=19 arrives in a subsequent message
  // Then: card remains "failed"
});
```

**Current gap:** `SystemJobCard.test.tsx` has no sequence ordering assertions. Confirmed by grep.

---

## Bug 2 — Wall of Failure Cards / No Succession

**What happened:** 8+ failed `compose_media` job cards remained visible in the conversation UI after the job eventually succeeded. Every attempt produced its own permanent failure card with no concept of "superseded."

**Where to fix:**
- UI rendering logic for job card lists in the message thread — needs a `superseded` concept
- `src/frameworks/ui/chat/plugins/system/SystemJobCard.test.tsx`

**Tests to add:**

```typescript
it("marks earlier failed cards as superseded when a succeeded card for the same tool exists", () => {
  // Given: two failed compose_media cards + one succeeded card
  // Then: the two failed cards have superseded=true, are visually de-emphasized
  // Then: the succeeded card is visually dominant
});

it("multiple compose_media attempts with the same plan.id render as a single UI track", () => {
  // Given: three job_status parts, all with plan.id="plan_test_001"
  // Then: only one UI card is rendered, showing the highest-sequence state
});
```

**Design decision needed:** Should superseded cards be hidden automatically or visually de-emphasized (dimmed)? This doc recommends de-emphasis (add `data-superseded="true"` attribute) rather than deletion, to preserve audit trail.

---

## Bug 3 — `generate_audio` Silent Inline Failure (Already Fixed)

**What happened:** `generate_audio` failed inline with no queue entry, no retry, no progress card. The tool had no deferred job handler registered and no MCP sidecar configured.

**Status:** ✅ Fixed — MCP sidecar (`mcp/generate-audio-server.ts`) and catalog registration added.

**Regression test needed in `tests/media-architecture-audit.test.ts`:**

```typescript
it("generate-audio MCP server is registered in mcp-process-metadata", () => {
  const src = readSource("src/core/capability-catalog/mcp-process-metadata.ts");
  expect(src).toContain('"generate-audio"');
});
```

**Current gap:** This architectural assertion does not exist. If someone removes the MCP registration, no test will catch it.

---

## Bug 4 — Asset ID Confusion: `blogasset_*` and `job_*` IDs in Audio Clips

**What happened:** The LLM passed `blogasset_*` and `job_*` IDs as audio clip asset IDs in `compose_media` plans. This caused silent failures because those IDs are not governed user files (`uf_*`). The validation layer (`validatePlanConstraints`) checks `clip.kind === "audio"` but does not check `clip.assetId` prefix.

**Where to fix:**
- `src/lib/media/ffmpeg/media-composition-plan.ts` — `validatePlanConstraints` function at line ~61
- `src/lib/media/ffmpeg/media-composition-plan.ts` — add guard: audio clips must have `assetId` starting with `uf_` or `asset_`

**Current code (line 61):**
```typescript
if (plan.audioClips.some((clip) => clip.kind !== "audio")) {
  return "Audio clips must be audio assets.";
}
```

**Fix to add after that check:**
```typescript
if (plan.audioClips.some((clip) => !clip.assetId.startsWith("uf_") && !clip.assetId.startsWith("asset_"))) {
  return "Audio clip asset IDs must reference governed user files (uf_* or asset_*). Blog images (blogasset_*) and job IDs (job_*) are not valid audio sources.";
}
```

**Tests to add in a new file `src/lib/media/ffmpeg/media-composition-plan.asset-validation.test.ts`:**

```typescript
it("rejects blogasset_ IDs in audio clips")
it("rejects job_ IDs in audio clips")
it("accepts uf_ IDs in audio clips")
it("accepts asset_ IDs in audio clips")
it("accepts blogasset_ IDs in visual clips") // blog images ARE valid visuals
it("rejects uf_ IDs as visual clips if kind is wrong") // belt-and-suspenders
```

**Note:** Visual clips may use `blogasset_*` — a blog hero image is a valid visual source. Only *audio* clips have the prefix constraint.

**Canonical coverage path (line 179):** The `canonicalizeClip` function already validates `uf_` or `asset_` for asset references, but this runs *after* plan validation, not before. The explicit validation guard is still missing from `validatePlanConstraints`.

---

## Bug 5 — `admin_web_search` Eager `UserFileRepository` Crash (Already Fixed)

**What happened:** `requireUserFileRepository(deps)` was called at executor *construction* time rather than inside the async function body. Any path that created the executor without providing `userFileRepository` immediately threw, producing "Catalog runtime binding for media discovery tools requires a UserFileRepository."

**Status:** ✅ Fixed — `requireUserFileRepository` moved inside the `async (input, context)` body in `runtime-tool-binding.ts`.

**Regression test needed — add to `src/core/capability-catalog/runtime-tool-binding.test.ts`:**

```typescript
describe("admin_web_search executor construction", () => {
  it("does not throw when creating executor with empty deps", () => {
    expect(() => RUNTIME_BINDINGS.admin_web_search.createExecutor({})).not.toThrow();
  });

  it("does not throw when creating executor without userFileRepository", () => {
    expect(() => RUNTIME_BINDINGS.admin_web_search.createExecutor({
      adminWebSearchDepsFactory: undefined,
    })).not.toThrow();
  });
});
```

**Current gap:** No such test exists. Confirmed by grep of `runtime-tool-binding.test.ts`.

---

## Bug 6 — Media Worker Server Not Auto-Started (Already Fixed)

**What happened:** The media worker HTTP server (`scripts/media-worker-server.ts`) was not started by `npm run dev`. Every `compose_media` job hit `ECONNREFUSED` on port 3101.

**Status:** ✅ Fixed — `scripts/dev.mjs` now spawns `mediaWorkerProcess`.

**Regression test needed — add to `tests/media-architecture-audit.test.ts`:**

```typescript
it("media worker server is managed by the dev process script", () => {
  const src = readSource("scripts/dev.mjs");
  expect(src).toContain("media-worker-server.ts");
  expect(src).toContain("mediaWorkerProcess");
});

it("admin_web_search executor calls requireUserFileRepository lazily (inside async body)", () => {
  const src = readSource("src/core/capability-catalog/runtime-tool-binding.ts");
  const binding = src.slice(
    src.indexOf("admin_web_search: {"),
    src.indexOf("admin_search: {")
  );
  const asyncStart = binding.indexOf("return async");
  const requireCallPos = binding.indexOf("requireUserFileRepository");
  expect(requireCallPos).toBeGreaterThan(asyncStart);
});
```

---

## Implementation Order

| Priority | Test | Effort | File |
|---|---|---|---|
| 1 | `validatePlanConstraints` audio ID prefix guard | Low | `media-composition-plan.ts` + new test file |
| 2 | Architecture audit: `dev.mjs` has media worker | Low | `tests/media-architecture-audit.test.ts` |
| 3 | Architecture audit: lazy `requireUserFileRepository` | Low | `tests/media-architecture-audit.test.ts` |
| 4 | Architecture audit: `generate-audio` MCP registration | Low | `tests/media-architecture-audit.test.ts` |
| 5 | `admin_web_search` executor construction test | Low | `src/core/capability-catalog/runtime-tool-binding.test.ts` |
| 6 | Job card sequence ordering (unit) | Medium | `SystemJobCard.test.tsx` |
| 7 | Job card succession / superseded (UI) | Medium | `SystemJobCard.test.tsx` or new `media-job-card-rendering.test.tsx` |

---

## Eval Scenarios to Add to `src/lib/evals/scenarios.ts`

The existing eval catalog has no media-pipeline scenarios beyond `integrity-audio-recovery-deterministic`. The following four scenarios should be added:

| Scenario ID | What it asserts |
|---|---|
| `media-compose-asset-id-discipline` | LLM only uses `uf_*` IDs in `compose_media` audio clips |
| `media-audio-generation-deferred-entry` | `generate_audio` is called and a job enters the queue (not a silent inline failure) |
| `media-compose-failure-diagnosis-before-retry` | After `compose_media` fails, LLM calls `list_my_jobs` or `get_deferred_job_status` before retrying |
| `media-job-card-succession-clarity` | After a succeeded job, LLM does not re-trigger the same tool unnecessarily |

These belong in a new `tests/evals/media-pipeline-integrity.test.ts` that uses `runDeterministicEvalScenario`.
