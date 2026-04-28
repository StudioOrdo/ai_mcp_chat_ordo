# Phase 0 — Baselines + verify script groundwork

Status: Complete
Date: 2026-04-23
Commit SHA: `b20f61d780bcde59afca7d16ddf328c45637a11e`

Working tree at capture time: **not clean** (315 modified / deleted / untracked entries). Baselines below reflect the working tree state at this SHA, which is the canonical starting point for Phases 1–11. The same commands will be re-run post-commit at the Phase 11 release gate.

## Tool outputs (captured 2026-04-23)

### `npx tsc --noEmit`

- Exit code: `1`
- Total `error TS` lines: **33**
- Top error codes:
  - `11` × `TS2322` (type assignment)
  - `6` × `TS2741` (missing property)
  - `6` × `TS2353` (unknown object literal property)
  - `2` × `TS2352` (invalid cast)
  - `2` × `TS2300` (duplicate identifier)
  - `2` × `TS18048` (possibly undefined)
  - `1` × each: `TS2739`, `TS2345`, `TS2339`, `TS2304`
- First error: `next.config.ts(8,3): error TS2353: Object literal may only specify known properties, and 'eslint' does not exist in type 'NextConfig'`.
- Other early hotspots: `src/adapters/InMemoryVectorStore.test.ts` (missing `sourceType` on `ChunkMetadata`), `src/core/capability-catalog/runtime-tool-binding.test.ts` (`UserFileRepository` shape mismatch), `tests/prompt-control-plane.service.test.ts` (`PromptSlotType` "coach" not assignable to `"base" | "role_directive"`).

Delta vs. spec expectation: spec estimated ~51 errors (F1 inventory); actual is 33. Fewer errors to close than projected — F1's list is a superset. Phase 1 target remains exit 0.

### `npm run lint`

- Exit code: `1`
- Final summary: `✖ 168 problems (49 errors, 119 warnings)` — `0 errors and 4 warnings potentially fixable with --fix`.
- Dominant rules:
  - `@typescript-eslint/no-unused-vars` — `src/lib/chat/conversation-portability.ts`, `src/lib/media/server/compose-media-plan-materialization.ts`, `ConfigurationService.ts`, others.
  - `@typescript-eslint/no-explicit-any` — `src/lib/media/ffmpeg/media-composition-plan.test.ts`, `src/lib/evals/runner.ts`, `ConfigurationService.test.ts`.
  - `@typescript-eslint/no-non-null-assertion` — concentrated in test files.
  - A few `consistent-type-imports` warnings.

### `npx vitest run`

- Exit code: `1`
- Summary: **`Test Files 48 failed | 509 passed (557)`** / **`Tests 114 failed | 4229 passed | 2 skipped (4345)`**
- Duration: 199.33s.

Delta vs. spec expectation: spec cited 47 failed files / 113 failed tests (snapshot 2026-04-22). Today is 48 / 114 — effectively identical; one additional file / test has drifted since the inventory was captured. [test-failure-inventory-2026-04-22.md](../test-failure-inventory-2026-04-22.md) remains representative.

### Failing test files (48, deduplicated)

```
src/adapters/FileSystemBookRepository.test.ts
src/app/api/auth/auth-routes.test.ts
src/app/page.test.tsx
src/components/AudioPlayer.test.tsx
src/components/ThemeSwitcher.test.tsx
src/core/capability-catalog/catalog.test.ts
src/core/capability-catalog/e2e-catalog-flow.test.ts
src/core/use-cases/tools/admin-web-search.tool.test.ts
src/hooks/useGlobalChat.test.tsx
src/lib/capabilities/local-external-target-inventory.test.ts
src/lib/chat/embed-conversation.test.ts
src/lib/chat/provider-instrumentation.test.ts
src/lib/chat/provider-policy.test.ts
src/lib/db/data-access-canary.test.ts
src/lib/media/browser-runtime/browser-capability-runtime.test.ts
src/lib/media/server/compose-media-plan-materialization.test.ts
src/lib/user-files.test.ts
src/middleware.test.ts
src/proxy.test.ts
tests/admin-attribution-page.test.tsx
tests/admin-processes.test.ts
tests/admin-shell-and-concierge.test.tsx
tests/blog-pipeline-integration.test.ts
tests/browser-fab-chat-flow.test.tsx
tests/chat-performance-a11y.test.tsx
tests/chat/chat-job-actions-route.test.ts
tests/chat/chat-policy.test.ts
tests/chat/tool-bundle-descriptors.test.ts
tests/composition-root-decomposition.test.ts
tests/composition-root-structure.test.ts
tests/core-policy.test.ts
tests/deferred-job-notifications.test.ts
tests/env-config.test.ts
tests/full-registry-coverage.test.ts
tests/hardening-audit.test.ts
tests/homepage-shell-evals.test.tsx
tests/homepage-shell-layout.test.tsx
tests/job-status-summary-tools.test.ts
tests/job-visibility-solid.test.ts
tests/plugin-integration.test.tsx
tests/referral-tracking.test.ts
tests/registry-executor-unification.test.ts
tests/shell-command-parity.test.ts
tests/shell-navigation-model.test.ts
tests/system-prompt-assembly.test.ts
tests/tool-manifest-contract.test.ts
tests/tool-registry.integration.test.ts
tests/tts-route-hardening.test.ts
```

## `verify` script added

[package.json](../../../../package.json) now exposes:

```json
"verify": "npm run lint && npx tsc --noEmit && npx vitest run"
```

At this baseline commit `npm run verify` exits non-zero (fails at the lint step). That is the expected Phase 0 state. Phase 11 will re-run it and require exit 0.

## Quantified starting point for later phases

| Metric | Phase 0 baseline | Phase 11 target |
| --- | --- | --- |
| `npx tsc --noEmit` errors | 33 | 0 |
| `npm run lint` errors | 49 | 0 |
| `npm run lint` warnings | 119 | 0 (via `lint:strict`) or documented cap |
| Failing test files | 48 | 0 |
| Failing tests | 114 | 0 |
| `npm run verify` exit | 1 | 0 |

## Notes for Phase 1

- `next.config.ts` stale `eslint` key is the easiest first kill (TS2353).
- The Phase 1 F1 touch-point list in [implementation-phases.md](../implementation-phases.md) is a superset of today's 33 errors; executor should treat the live `tsc` output as the authoritative driver.
- The single-test drift vs. the 2026-04-22 inventory is negligible; do not regenerate the inventory.
