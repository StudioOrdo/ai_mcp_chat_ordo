# Phase 0 — Groundwork: Evidence

## Summary

Phase 0 expands the access taxonomy and corpus metadata surface without
changing any UI, policy, or user-visible behavior. This is foundation work;
all downstream phases depend on it.

## Carry-forward reality (verified)

- `src/lib/access/content-access.ts` was the sole source of truth for
  audience values; 4 self-references existed for `"member"`.
- Corpus sweep: **zero** `audience: member` values in `docs/_corpus/**`.
  All 20+ field-guide chapters declare `audience: public`. No `book.json`
  manifests reference `member`. Corpus migration scope: **none**.
- Downstream consumers of `canAccessAudience`: 9 call sites across
  `LibrarySearchInteractor`, `GetChapterInteractor`, `CorpusIndexInteractor`,
  `CorpusSummaryInteractor`, `ChecklistInteractor`, `PractitionerInteractor`,
  `CorpusTools`. All operate on the function signature, not on literal enum
  values, so expansion is backward-compatible.
- `CapabilityFamily.system` already existed in
  `src/core/entities/capability-presentation.ts` — no change required.
- `CapabilityCardKind` did **not** include `"lifecycle"` — added.
- `CARD_KIND_TONE_MAP` in `capability-card-tone.ts` requires an entry for
  every kind (it is a `Record<CapabilityCardKind, ...>`); `lifecycle: "neutral"`
  added.

## Changes

### `src/lib/access/content-access.ts`
- `ContentAudience` expanded from 4 values (`public | member | staff | admin`)
  to 6 values: `public | account | premium | apprentice | staff | admin`.
- `AUDIENCE_ROLES` updated:
  - `public`: all roles.
  - `account` (replaces `member`): `AUTHENTICATED | APPRENTICE | STAFF | ADMIN`.
  - `premium`: conservatively restricted to `STAFF | ADMIN` at the role layer.
    Phase 1 introduces tier-aware access (`SessionUser.tier === "premium"`)
    at the use-case layer so authenticated premium tier users reach premium
    content without widening the role mapping here.
  - `apprentice`: `APPRENTICE | STAFF | ADMIN`.
  - `staff`, `admin`: unchanged.
- `isContentAudience` updated to check all 6 values.
- `DENIED_AUDIENCE_PRIORITY` updated to reflect the new hierarchy:
  - `ANONYMOUS`: `[account, premium, apprentice, staff, admin]`
  - `AUTHENTICATED`: `[premium, apprentice, staff, admin]`
  - `APPRENTICE`: `[premium, staff, admin]`
  - `STAFF`: `[admin]`
  - `ADMIN`: `[]`

### `src/core/entities/corpus.ts`
- Added optional `ContentClass` type: `"manual" | "guide" | "training" |
  "reference" | "article"` with `isContentClass` type guard.
- Added optional `RolePersona` type: `"sales" | "scheduling" | "front_desk" |
  "operator" | "founder"` with `isRolePersona` type guard. Personas are
  corpus classification only; they are **not** RBAC dimensions.
- `Document` interface gained optional `class?: ContentClass` and
  `rolePersona?: RolePersona` fields.
- `Section` class constructor gained two trailing optional parameters:
  `contentClass?: ContentClass` and `rolePersona?: RolePersona`.

### `src/adapters/FileSystemCorpusRepository.ts`
- `DocumentManifest` accepts optional `class` and `rolePersona` with
  validation at discovery time.
- `DocumentMeta` carries `contentClass` and `rolePersona` through to
  `parseSection`.
- `parseSection` honors frontmatter `class:` and `rolePersona:` values
  (validated via the new type guards), falling back to document-level
  defaults.
- `getAllDocuments` passes `class` and `rolePersona` through to the
  `Document` projection.

### `src/core/entities/capability-presentation.ts`
- `CapabilityCardKind` gained `"lifecycle"` for the lifecycle coach card
  kind introduced in Phase 2.

### `src/frameworks/ui/chat/primitives/capability-card-tone.ts`
- `CARD_KIND_TONE_MAP` gained `lifecycle: "neutral"` to keep the
  `Record<CapabilityCardKind, ...>` exhaustive.

### `tests/error-standardization.test.ts`
- `ContentAccessDeniedError` fixture literal migrated from
  `"member"` → `"account"` to track the enum rename.

## What this phase does NOT do

- No UI surfaces reference the new audience values, `class`, `rolePersona`,
  or `lifecycle` cardKind yet.
- No capability descriptor uses `family: "system"` + `cardKind: "lifecycle"`
  yet. The lifecycle coach descriptor is registered in Phase 2.
- No `SessionUser.tier` field yet. Phase 1 introduces tier plumbing.
- No corpus content changes. Zero files under `docs/_corpus/**` were
  modified.
- No changes to deferred-job runtime, server-side media pipeline, chat
  event recorder, or install wizard.

## QA gate

### Focused tests

```
npx vitest run \
  src/lib/access \
  src/core/use-cases/LibrarySearchInteractor \
  src/frameworks/ui/chat/primitives/capability-card-tone \
  src/frameworks/ui/chat/registry/capability-presentation-registry \
  tests/error-standardization.test.ts
```

Result: **4 test files passed, 43 tests passed, exit 0**.

### Type-check (Phase 0 surface)

```
npx tsc --noEmit 2>&1 | grep -E \
  "content-access|corpus|capability-presentation|capability-card-tone|FileSystemCorpusRepository|error-standardization"
```

Result: **no matches** — zero TS errors in any file touched by Phase 0.

### Pre-existing unrelated errors

Full-project `tsc --noEmit` reports 24 errors that all pre-date Phase 0
and live in unrelated subsystems (media pipeline tests, `next.config.ts`
`eslint` key, `job-capability-registry` null coalescing, `runtime-tool-binding.test.ts`
mock typings, `deferred-job-worker.test.ts` abort signal typing, mermaid
worker options). None are caused by the Phase 0 changes and none are
introduced by this phase. They are tracked as the Phase 0 baseline and
are out of scope per the spec's hotspot-avoidance rule.

### Truth check

No UI-visible claim of Phase 0 completion is published to users. This is
groundwork only. README "Current phase" and the tracker reflect status.

## Regression coverage preserved

- `LibrarySearchInteractor.test.ts` (4 tests) — content access filtering
  still honors `canAccessAudience` on the expanded enum.
- `capability-card-tone.test.ts` (4 tests) — tone resolution intact with
  the new `lifecycle` entry.
- `capability-presentation-registry.test.ts` (4 tests) — descriptor
  projection unaffected.
- `error-standardization.test.ts` (31 tests) — `ContentAccessDeniedError`
  flow unchanged (literal updated only).

## Exit criteria met

- [x] `ContentAudience` expanded to 6 values; callers unchanged.
- [x] `Document` / `Section` carry optional `class` and `rolePersona`.
- [x] Corpus parser accepts and validates new frontmatter keys.
- [x] `CapabilityCardKind` accepts `"lifecycle"`; tone map exhaustive.
- [x] Focused tests pass; no new TS errors.
- [x] Zero corpus content changes; zero UI changes; zero hotspot edits.
