# Test Failure Inventory — 2026-04-22

Status: Baseline snapshot
Scope: `npx vitest run` from repo root.

Raw counts

- Test Files: **47 failed | 510 passed (557)**
- Tests: **113 failed | 4230 passed | 2 skipped (4345)**
- Duration: ~170s

## Failing files (47)

Grouped heuristically for phase routing in [implementation-phases.md](./implementation-phases.md).

### Audio / TTS (owned by Phase 6)

- `src/components/AudioPlayer.test.tsx`
- `tests/tts-route-hardening.test.ts`
- `tests/chat-performance-a11y.test.tsx` (AudioPlayerCard region assertion — partial; this file also covers non-audio a11y and may remain failing after Phase 6 until a11y phase lands)

### Type-baseline / mock-shape drift (owned by Phase 1 + 2 together)

- `src/adapters/FileSystemBookRepository.test.ts`
- `src/core/capability-catalog/catalog.test.ts`
- `src/core/capability-catalog/e2e-catalog-flow.test.ts`
- `src/core/use-cases/tools/admin-web-search.tool.test.ts`
- `src/lib/chat/embed-conversation.test.ts`
- `src/lib/chat/provider-instrumentation.test.ts`
- `src/lib/chat/provider-policy.test.ts`
- `src/lib/db/data-access-canary.test.ts`
- `src/lib/media/browser-runtime/browser-capability-runtime.test.ts`
- `src/lib/user-files.test.ts`
- `tests/composition-root-decomposition.test.ts`
- `tests/composition-root-structure.test.ts`
- `tests/full-registry-coverage.test.ts`
- `tests/plugin-integration.test.tsx`
- `tests/tool-manifest-contract.test.ts`
- `tests/tool-registry.integration.test.ts`
- `tests/registry-executor-unification.test.ts`

### Capability / tool registry cohesion (owned by Phase 4 + 8)

- `src/lib/capabilities/local-external-target-inventory.test.ts`
- `tests/chat/tool-bundle-descriptors.test.ts`
- `tests/core-policy.test.ts`

### Chat runtime (Phase 4 / 8 spillover)

- `src/hooks/useGlobalChat.test.tsx`
- `tests/chat/chat-policy.test.ts`
- `tests/chat/chat-job-actions-route.test.ts`

### Deferred jobs / worker (owned by Phase 7)

- `tests/deferred-job-notifications.test.ts`
- `tests/job-status-summary-tools.test.ts`
- `tests/job-visibility-solid.test.ts`

### Admin surfaces (Phase 5 / 10 spillover)

- `tests/admin-attribution-page.test.tsx`
- `tests/admin-processes.test.ts`
- `tests/admin-shell-and-concierge.test.tsx`

### Auth / middleware / proxy / env (Phase 0–1 spillover; env also touched by Phase 6)

- `src/app/api/auth/auth-routes.test.ts`
- `src/middleware.test.ts`
- `src/proxy.test.ts`
- `tests/env-config.test.ts`
- `tests/hardening-audit.test.ts`

### Shell / navigation / homepage (Phase 10)

- `src/app/page.test.tsx`
- `src/components/ThemeSwitcher.test.tsx`
- `tests/browser-fab-chat-flow.test.tsx`
- `tests/homepage-shell-evals.test.tsx`
- `tests/homepage-shell-layout.test.tsx`
- `tests/shell-command-parity.test.ts`
- `tests/shell-navigation-model.test.ts`

### Content / pipelines / prompts (Phase 4 / 10)

- `tests/blog-pipeline-integration.test.ts`
- `tests/referral-tracking.test.ts`
- `tests/system-prompt-assembly.test.ts`

## Routing notes

- The inventory is heuristic. The executor of each phase is responsible for confirming the actual root cause before asserting the phase fixes a named file.
- Files appear in at most one group; files that span multiple concerns are placed with their dominant concern.
- `tests/chat-performance-a11y.test.tsx` explicitly has **mixed causes** and may survive Phase 6 partially green.

## Re-run instruction

```sh
npx vitest run --reporter=json --outputFile=/tmp/vitest.json
```

Then the current failing-file list is:

```sh
node -e "const r=require('/tmp/vitest.json');console.log(r.testResults.filter(t=>t.status==='failed').map(t=>t.name.replace(process.cwd()+'/','')).sort().join('\n'))"
```
