# Phase 0 — Asset Resolution Repair

**Fixes**: user-visible failure
`Compose media plan contains unresolved asset references: audio_intelligence_explosion_narration, blogasset_0ad8449c-01bf-4377-a2b5-95fdfa14db65`.

> **Pre-implementation QA notes** (April 2026). Facts below supersede the
> original summary drafted from memory; read before opening a PR.
>
> **Corrected line anchors** in
> [media-composition-plan.ts](../../../src/lib/media/ffmpeg/media-composition-plan.ts):
> - `looksLikeCanonicalMediaAssetId` — L82
> - `buildCanonicalAssetIdentityIndex` — L86
> - `resolveUniquePrefixedAssetId` — L121
> - `resolveCanonicalAssetId` — L131
> - `canonicalizeMediaCompositionPlan` — L167
> - throw site — L214
>
> **Three call sites of `canonicalizeMediaCompositionPlan`**, not one. All
> three must surface `repairs`:
> 1. [`useBrowserCapabilityRuntime.ts:1034`](../../../src/hooks/chat/useBrowserCapabilityRuntime.ts) — browser WASM path; catches at L1043 inside `resolveComposeMediaPlanFromCandidate` returning `{ plan, error, failureCode, failureStage }`, and at L1458 (second call site). Repairs surface on envelope `replaySnapshot.repairs`.
> 2. [`compose-media.tool.ts:40`](../../../src/core/use-cases/tools/compose-media.tool.ts) — `executeComposeMedia` (tool executor, no try/catch today — throw propagates). Only passes user-file candidates (no chat-message aliases). Repairs must flow into the tool's return envelope so the assistant sees them.
> 3. [`compose-media-deferred-job.ts:90`](../../../src/lib/jobs/compose-media-deferred-job.ts) — server deferred path; wraps error as `InvalidComposeMediaDeferredJobError` (L97). Repairs must be attached to `DeferredJobResultPayload` so admin diagnostics see them.
>
> **Good news — slug-based underscore/hyphen normalization is already half
> done.** `slugifyAlias` ([media-composition-asset-identity.ts:40](../../../src/lib/media/media-composition-asset-identity.ts)) replaces `[^a-z0-9]+` with `-`, so every alias registered via `collectAliasVariants` (L47) already has a hyphen-normalized slug form. The miss is at **lookup** time: `resolveCanonicalAssetId` does a direct `aliasToAssetId.get(reference)` without slugifying the reference first.
>
> **Minimal fix for Phase 0.1:** inside `resolveCanonicalAssetId`, before returning null, also try `aliasToAssetId.get(slugifyAlias(reference))`. No change to `collectAliasVariants` needed. This is simpler than registering both forms and keeps the alias Map smaller. (Spec §2.1 below should be read as "apply slug normalization at the lookup site".)
>
> **`looksLikeCanonicalMediaAssetId` pass-through is a real risk.** Any
> reference matching `/^(uf|asset)[_-]…/i` is returned verbatim **even if not
> in `candidateByAssetId`** (L156, L162). This means a reference like
> `asset-999-not-real` passes canonicalization silently and then fails
> downstream at storage lookup. Phase 0 repair strategies all require the
> candidate to exist, so this hole is unchanged here — flag for Phase 4
> (error taxonomy will add explicit `asset_not_found` after storage probe).
>
> **Screenshot-error reproduction path.** `blogasset_` does NOT match
> `^(uf|asset)[_-]` (prefix is `blogasset_`, not `asset_` or `asset-`), so
> pass-through correctly rejects it. The only fix route for that reference
> is UUID-fragment fallback (§2.2).
>
> **Existing canonicalizer tests** at
> [media-composition-plan.test.ts:300-422](../../../src/lib/media/ffmpeg/media-composition-plan.test.ts)
> — 5 existing `canonicalizeMediaCompositionPlan` cases. New tests append at
> end of that `describe` block; do not mutate the existing ones.
>
> **Envelope surface scope.** `src/lib/media/browser-runtime/ffmpeg-browser-executor.ts` constructs the envelope; but the `repairs` data originates in `resolveComposeMediaPlanFromCandidate` (L1020) before the executor is called. The hook must thread repairs from the canonicalizer return value → compose job metadata → executor envelope. Design: widen `ComposeMediaPlanResolution` to include `repairs: readonly AssetReferenceRepair[]` and pass forward.
>
> **`COMPOSE_MEDIA_INVALID_PLAN_FAILURE_CODE`** already exists in
> `src/lib/media/compose-media-errors.ts` — re-use for the "unrepaired"
> terminal error; no new failure code needed for Phase 0.

## 1. Problem statement

[src/lib/media/ffmpeg/media-composition-plan.ts](../../../src/lib/media/ffmpeg/media-composition-plan.ts)
canonicalizes a `MediaCompositionPlan` by resolving every clip's `assetId` to a
governed, stored asset. `resolveCanonicalAssetId` (line 136) accepts only:

1. Exact `assetId` match in `candidateByAssetId`.
2. Unique prefix expansion (e.g. `uf_0ad` → `uf_0ad8449c-…`).
3. Registered alias in `aliasToAssetId`.
4. Strings matching `/^(uf|asset)[_-]…/` (pass-through on the presumption the
   caller knows it exists).

LLMs confabulate identifier forms that violate all four:

- **Invented human-readable slugs** — `audio_intelligence_explosion_narration`
  (the model rewrote the narrative title into snake_case).
- **Invented prefixes on real UUID fragments** —
  `blogasset_0ad8449c-01bf-4377-a2b5-95fdfa14db65`
  (the UUID is the real `uf_0ad8449c-…` fragment; the `blogasset_` prefix is
  hallucinated).

When canonicalization fails, [useBrowserCapabilityRuntime.ts](../../../src/hooks/chat/useBrowserCapabilityRuntime.ts)
(lines 1043 and 1458) catches
`InvalidMediaCompositionPlanAssetReferenceError` and renders the message verbatim
— the user sees raw invented identifiers with no path to recovery.

## 2. Target design

Three cooperating layers, simplest-first:

### 2.1 Underscore/hyphen tolerance at lookup time

Inside `resolveCanonicalAssetId`, after the existing exact/prefix/alias
lookups fail, retry with the slug form of the reference:

```ts
// after alias lookup fails, before looksLikeCanonicalMediaAssetId fallback
const slugged = slugifyAlias(reference);
if (slugged && slugged !== reference) {
  const slugMatchedAssetId = options.aliasToAssetId.get(slugged);
  if (slugMatchedAssetId) {
    const cand = options.candidateByAssetId.get(slugMatchedAssetId);
    if (cand && kindMatches(options.expectedKind, cand.kind)) {
      return { resolvedAssetId: cand.assetId, strategy: "underscore_normalization" };
    }
  }
}
```

`slugifyAlias` already collapses `_`, spaces, and other non-alphanumerics to
`-`, so both `signal_stack_chart` and `Signal Stack Chart` slugify to
`signal-stack-chart` and match any alias already registered via
`collectAliasVariants`. No change to the alias Map is required.

### 2.2 UUID-fragment fallback

Inside `resolveCanonicalAssetId`, after (1) exact, (2) prefix, and (3) alias
fail, extract the first `[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}` UUID (or
its first `[0-9a-f]{8,}` fragment if no full UUID present) from the reference
and look up any candidate whose `assetId` contains that fragment with a
kind-compatible match. Resolve on **exactly one** such candidate; otherwise
treat as unresolved.

### 2.3 Kind-singleton repair (last resort)

After the per-clip resolution loop completes, if `unresolvedReferences.size > 0`,
group the unresolved clips by `kind`. For any kind where:

- exactly one unresolved clip has that `kind`, **and**
- exactly one candidate in `candidateByAssetId` has that `kind`,

bind the unresolved reference to that candidate. Record every such binding on a
**new return field** `repairs: Array<{ reference, resolvedAssetId, strategy }>`.

If any unresolved reference remains after all three layers, throw the existing
`InvalidMediaCompositionPlanAssetReferenceError` — but its `message` now
includes the full set of **available** asset IDs + first alias per kind (the
UI surface is unchanged but operators get actionable logs).

### 2.4 Envelope surface

Three propagation paths must carry `repairs`:

1. **Browser compose (primary).** `ComposeMediaPlanResolution` (defined in
   [useBrowserCapabilityRuntime.ts](../../../src/hooks/chat/useBrowserCapabilityRuntime.ts))
   widens to include `repairs: readonly AssetReferenceRepair[]`.
   `resolveComposeMediaPlanFromCandidate` calls the new
   `canonicalizeMediaCompositionPlanWithRepairs` and threads the result.
   `ffmpeg-browser-executor.ts` appends `replaySnapshot.repairs` on the
   `CapabilityResultEnvelope` from the resolution value passed in.
2. **Tool executor.** `executeComposeMedia` returns a shape that includes
   `repairs: repairs.length > 0 ? [...repairs] : undefined`. Assistant sees
   it via tool result. No retry loop, no caught exceptions — the tool
   result shape simply grows an optional field.
3. **Deferred job.** `enqueueComposeMediaDeferredJob` attaches `repairs` to
   the `DeferredJobResultPayload` so admin diagnostics / audit logs record
   them. `InvalidComposeMediaDeferredJobError` is only thrown when repairs
   fail to resolve.

The envelope field is optional on the Zod schema; absence means "no repair
was needed" (preferred over `[]`).

### 2.5 Tool-prompt contract

Extend the compose_media tool description
([media-capabilities.ts](../../../src/core/capability-catalog/families/media-capabilities.ts#L62))
with an inline `availableAssets: Array<{ assetId, kind, label }>` paragraph
sourced from `list_conversation_media_assets`. Instruction appended:

> "You MUST use the exact `assetId` values listed in `availableAssets`. Do not
> invent new identifier forms; do not rename UUIDs."

(Prompt work only — no runtime semantics change.)

## 3. API changes

```ts
// media-composition-plan.ts
export interface CanonicalizeMediaCompositionPlanResult {
  plan: MediaCompositionPlan;
  repairs: ReadonlyArray<AssetReferenceRepair>;
}

export interface AssetReferenceRepair {
  reference: string;           // what the LLM wrote
  resolvedAssetId: string;     // canonical governed id we bound to
  strategy: "underscore_normalization" | "uuid_fragment" | "kind_singleton";
}

// New (additive):
export function canonicalizeMediaCompositionPlanWithRepairs(
  plan: MediaCompositionPlan,
  options: CanonicalizeMediaCompositionPlanOptions = {},
): CanonicalizeMediaCompositionPlanResult;

// Existing (unchanged signature, internally calls the new function and throws
// on unresolved):
export function canonicalizeMediaCompositionPlan(...): MediaCompositionPlan;
```

The existing function remains back-compat so current callers continue to work.
New orchestration sites use `canonicalizeMediaCompositionPlanWithRepairs` and
surface `repairs` on the envelope.

## 4. Acceptance criteria

- [ ] The exact production failure string from the screenshot
      (`audio_intelligence_explosion_narration` + `blogasset_<uuid>`) resolves
      without throwing when the conversation has exactly one audio asset and
      one image asset, producing `repairs` entries of strategies
      `kind_singleton` and `uuid_fragment` respectively.
- [ ] A plan with `[signal_stack_chart]` alias registered as
      `signal-stack-chart` resolves without throwing.
- [ ] A plan whose only unresolved reference is a UUID-fragment that matches
      **two** candidates does **not** silently pick one — it still throws.
- [ ] Kind-singleton repair does **not** trigger when the conversation has
      two audio candidates (ambiguity → still throw).
- [ ] `repairs: []` is returned (never `undefined`) when everything resolved
      cleanly via exact match.
- [ ] `npm run test` passes with ≥ 8 new test cases in
      `media-composition-plan.test.ts` and 0 regressions elsewhere.
- [ ] `npm run qa:runtime-integrity` exits 0.
- [ ] Error message when still unresolved includes the `availableAssetIds`
      list (server logs only; user message stays user-friendly).

## 5. Test plan

Test file: `src/lib/media/ffmpeg/media-composition-plan.test.ts` (extend
existing suite). Every case below is an atomic `it(…)` block.

### Positive tests

1. **Underscore → hyphen alias repair.** Given `assetCandidates: [{ assetId:
   "uf_chart_1", kind: "chart", aliases: ["signal-stack-chart"] }]` and a clip
   referencing `signal_stack_chart`, expect resolution to `uf_chart_1` with a
   single repair entry `strategy: "underscore_normalization"`.

2. **Full UUID fragment fallback.** Given
   `{ assetId: "uf_0ad8449c-01bf-4377-a2b5-95fdfa14db65", kind: "image" }`
   and a clip referencing
   `blogasset_0ad8449c-01bf-4377-a2b5-95fdfa14db65`, expect resolution to the
   `uf_…` id with repair `strategy: "uuid_fragment"`.

3. **Short hex fragment fallback.** Given `{ assetId: "uf_0ad8449c", kind:
   "audio" }` and a clip referencing `audio_0ad8449c`, expect resolution via
   `uuid_fragment`.

4. **Kind-singleton audio repair.** Given exactly one audio candidate and one
   unresolved audio-kind clip with an invented slug, expect binding to that
   candidate with `strategy: "kind_singleton"`.

5. **Reproduces screenshot failure.** Conversation state: one audio
   (`uf_audio_x`) and one image (`uf_image_x`). Plan references
   `audio_intelligence_explosion_narration` (audio) and
   `blogasset_<uf_image_x uuid>` (image). Expect both resolved, two repair
   entries, no throw.

6. **No-op when everything already canonical.** Plan with governed `uf_…`
   IDs; expect `repairs: []` and the plan returned structurally unchanged.

7. **Back-compat wrapper still works.** The old
   `canonicalizeMediaCompositionPlan` returns a plan (not a result wrapper)
   and does not expose `repairs`, but its behavior matches the new function on
   success paths.

8. **Hyphen-to-underscore is symmetric.** Alias registered as
   `signal_stack_chart`, clip references `signal-stack-chart`. Resolves.

### Negative tests

9. **UUID fragment matches two candidates → throw.** Two candidates share the
   fragment `0ad8449c`. No repair performed; `InvalidMediaComposition…` thrown.

10. **Kind-singleton ambiguity → throw.** Two audio candidates; one unresolved
    audio clip. No repair; thrown error includes both candidate IDs in its
    message (server-visible).

11. **Kind mismatch → throw.** Alias `signal-stack-chart` maps to a candidate
    whose `kind: "audio"`, but the clip is `kind: "chart"`. Must continue to
    throw (existing test already covers this — preserve behavior).

12. **Unknown invented reference with no UUID, no alias, no singleton →
    throw.** Reference `my-custom-name`, no aliases, two+ candidates per kind.

13. **Prefix collision still throws.** Two candidates share a prefix; a clip
    referencing that prefix must not resolve (existing behavior preserved).

### Edge cases

14. **Empty candidates.** No `assetCandidates` at all; all references are
    non-governed slugs. Throw cleanly; `unresolvedReferences` contains every
    clip's original id in deterministic sorted order.

15. **Mixed case UUID.** Reference uses uppercase hex
    `blogasset_0AD8449C-01BF-4377-A2B5-95FDFA14DB65`; stored id is lowercase.
    Expect resolution (fragment match is case-insensitive).

16. **UUID fragment in middle of reference.** Reference
    `user-uploaded-0ad8449c-01bf-4377-a2b5-95fdfa14db65-v2`. Still resolves if
    the fragment uniquely identifies one candidate.

17. **Multiple unresolved of same kind with multiple singleton candidates.**
    Two unresolved audio clips and two audio candidates — `kind_singleton`
    must NOT run (cardinality rule is `1 unresolved ↔ 1 candidate`).

18. **Underscore normalization does not cross kind boundaries.** Alias
    `foo-bar` registered for an audio candidate; clip references `foo_bar`
    but with `kind: "image"`. Must throw (kind mismatch takes precedence).

19. **Source asset repair.** A clip's `sourceAssetId` is also unresolved via
    invented slug; repair strategies apply equally to source lineage.

20. **`repairs` is always the same array identity shape** — stable order,
    serializable to JSON with no circular references.

### Envelope / UI tests

Test file: `src/lib/media/browser-runtime/ffmpeg-browser-executor.test.ts`
(extend existing).

21. **Envelope includes `repairs` when canonicalization repaired anything.**
    Mock canonicalizer to return 2 repairs → envelope's
    `replaySnapshot.repairs` contains 2 entries.

22. **Envelope omits `repairs` (or has `[]`) when nothing repaired.** Prefer
    omit for economy; either is acceptable but test the chosen convention.

### Hook-level tests

Test file: `src/hooks/chat/useBrowserCapabilityRuntime.test.tsx`.

23. **Unresolved-with-repair flow produces a `succeeded` envelope, not
    `failed`.** Given conversation state with exact singleton
    audio+chart+image, a plan with three invented slugs — executor runs
    normally; card shows `Completed` with a diagnostics note.

24. **Still-unresolved plan produces `failed` envelope with the old error.**
    Preserves current error contract for ambiguous cases.

## 6. Implementation notes

- `canonicalizeMediaCompositionPlanWithRepairs` wraps the existing resolver
  loop. The three new strategies live in three small helpers that each
  **only** run on references that the first-pass resolver could not resolve —
  keeps the fast path allocation-free.
- UUID extraction regex: `const UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;`
  Short-fragment fallback only if full UUID regex misses:
  `/\b[0-9a-f]{8,}\b/i`. Reject ambiguous matches.
- Repair ordering rule (when the same reference could be fixed by multiple
  strategies): underscore_normalization > uuid_fragment > kind_singleton. This
  gives the most specific strategy precedence.
- `repairs` array is frozen (`Object.freeze`) before being returned.

## 7. Risk register

| Risk | Likelihood | Mitigation |
| ---- | ---------- | ---------- |
| Kind-singleton mis-binds when the LLM genuinely meant a different asset | Medium | Only fires when cardinality is `1 ↔ 1`; logs repair on envelope so users can see the auto-match; planned prompt tightening (§2.5) reduces frequency. |
| UUID fragment false-positive across unrelated assets | Low | Requires unique match; ambiguity throws. Minimum fragment length ≥ 8 hex chars. |
| Envelope schema widening breaks snapshot tests | Medium | Schema version bump path available; for now `repairs` is optional and defaults absent. |
| Prompt update changes model output shape | Low | Prompt change is additive (append), not restrictive; existing plans still validate. |

## 8. Rollback

All three strategies are behind **layered fallbacks** — if 2.2 or 2.3 misbehave
in production, set a feature flag
`COMPOSE_MEDIA_PLAN_REPAIR_STRATEGIES = "underscore"` (or empty) to disable
uuid-fragment and kind-singleton paths. The existing strict path is always the
outermost fallback.

## 9. Blast radius

| File | Change |
| ---- | ------ |
| `src/lib/media/ffmpeg/media-composition-plan.ts` | Add repairs, `canonicalizeMediaCompositionPlanWithRepairs`, slug-normalization at lookup, UUID-fragment fallback, kind-singleton pass, enriched throw message |
| `src/lib/media/ffmpeg/media-composition-plan.test.ts` | +20 test cases appended after existing L300–422 block |
| `src/lib/media/browser-runtime/ffmpeg-browser-executor.ts` | Thread `replaySnapshot.repairs` from resolution metadata |
| `src/lib/media/browser-runtime/ffmpeg-browser-executor.test.ts` | +2 envelope tests |
| `src/hooks/chat/useBrowserCapabilityRuntime.ts` | Widen `ComposeMediaPlanResolution`; call `withRepairs` variant; propagate repairs into envelope builder |
| `src/hooks/chat/useBrowserCapabilityRuntime.test.tsx` | +2 orchestration tests |
| `src/core/use-cases/tools/compose-media.tool.ts` | Return `repairs` on tool result (optional field) |
| `src/core/use-cases/tools/compose-media.tool.test.ts` *(may need creation)* | +1 test for repairs surfacing |
| `src/lib/jobs/compose-media-deferred-job.ts` | Attach repairs to `DeferredJobResultPayload`; throw only when unresolved remain |
| `src/lib/jobs/compose-media-deferred-job.test.ts` | +1 test for repairs propagation |
| `src/core/capability-catalog/families/media-capabilities.ts` | Prompt contract addition (§2.5) |
| `src/lib/media/media-composition-asset-identity.ts` | **No change** (slug form already collected) |

~10 files changed; additive; no deletions.
