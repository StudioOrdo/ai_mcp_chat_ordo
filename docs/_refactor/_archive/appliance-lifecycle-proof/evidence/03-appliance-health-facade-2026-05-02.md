# Phase 03 Appliance Health Facade Evidence

Date: 2026-05-02

Status: complete

## Implemented Scope

- Added `getApplianceHealthReport()` as the shared async appliance lifecycle facade.
- Added appliance health DTOs with component status, impact, metadata, remediation, warnings, and aggregation summary.
- Added component probes for runtime, data boundary, SQLite, provider, tool availability, media worker, deferred worker, search, and backup/restore placeholder.
- Routed `/api/health/ready`, admin health sweep, admin health loader, and release evidence generation through the async health surface.
- Preserved legacy public readiness response shape: `status: "ok" | "error"` with existing provider readiness fields.
- Added `MediaWorkerClient.checkHealth()` for bounded media-worker HTTP health checks.
- Kept backup/restore informational until Phase 04 so the placeholder cannot degrade top-level appliance health.
- Kept deferred worker health limited to configured mode plus static runtime contract validation; no false heartbeat/liveness claim was added.
- Lazy-loaded deferred job handler contracts from the deferred-worker probe to avoid pulling the tool catalog into unrelated import/mocking paths.
- Added facade-level probe timeout handling so slow probes return component degradation/unknown results without blocking the whole report.

## Design Checks

- SOLID: probes each own one component, the facade only orchestrates and aggregates.
- Clean Architecture: route, admin, CLI, and release evidence callers depend on the appliance facade/read model instead of raw subsystem internals.
- GOF: facade pattern for lifecycle health; strategy pattern for probes; adapter pattern for provider, DB, media worker, and search status surfaces.
- Prompt exposure: no lifecycle diagnostic tool was added to the default chat surface.

## Verification

Commands run:

```bash
npm run typecheck
npm exec vitest run src/lib/appliance/health-facade.test.ts src/lib/appliance/probes/appliance-probes.test.ts tests/health-probes.test.ts src/lib/health/probes.test.ts tests/admin-processes.test.ts tests/evals/eval-release-evidence.test.ts
npm exec vitest run tests/referral-governance-qa.test.ts src/core/use-cases/tools/UiTools.test.ts src/core/use-cases/tools/tool-schema-compatibility.test.ts src/app/api/chat/stream/route.test.ts src/lib/chat/tool-bundles/media-tools.test.ts src/app/api/chat/jobs/route.test.ts src/lib/operator/operator-signal-loaders.test.ts 'src/app/api/admin/factory/work-orders/[workOrderId]/revision/route.test.ts'
npm exec vitest run src/lib/appliance/probes/appliance-probes.test.ts
npm exec vitest run src/lib/appliance/health-facade.test.ts src/lib/appliance/probes/appliance-probes.test.ts tests/health-probes.test.ts tests/health-routes.test.ts tests/admin-processes.test.ts src/lib/health/probes.test.ts
npm test
```

Final verification result:

- `npm run typecheck`: passed.
- `npm test`: passed, 691 test files, 4994 tests passed, 2 skipped.

## QA Notes

- The first full-suite pass exposed eager import coupling in the deferred-worker probe. The probe now lazy-loads deferred handler contracts only when the probe actually runs.
- The admin health loader now tolerates legacy/mocked health sweep payloads without an `appliance` field while production health sweeps include the facade report.
- Release evidence generation now awaits the async health sweep in artifact generation. The synchronous evidence builder remains usable with an explicit health input and otherwise produces a conservative blocked health placeholder.
- Final Phase 03 QA found that the original facade caught thrown probes but did not bound slow probes. This was corrected with `timeoutMs` handling in `runProbeSafely()` and a focused aggregation test.
