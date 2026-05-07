# Phase 11 Closeout Evidence

Status: Implemented and QA closed
Captured: 2026-05-03
Package: `docs/_refactor/agentos-operation-kernel`

## Closeout Summary

Phase 11 closed the AgentOS operation kernel package as the canonical layer for
complex work. The implemented system now treats chat, admin pages, help,
health, media, factory, backup/restore, and Rust native execution as projections
or executors behind operation truth.

The package is closed with these intentional exceptions:

- `system_diagnostic`, `tool_task`, and `content_publish` are registered future
  operation kinds, not complete migrations.
- Scheduled automatic backups remain an operation-null exception: policy and
  health are operation-aware, but the scheduled command is not yet represented
  as an operation.
- `compose_media` and `produce_product` remain capability names, but runtime
  binding routes user-facing execution into media/factory operations.
- Rust remains a deterministic executor and does not write operation tables.

## Phase Status

- Phase 00: baseline evidence captured.
- Phase 01: operation domain, state machine, policy, and kind registry
  implemented.
- Phase 02: SQLite operation ledger, mapper, repository, and read models
  implemented.
- Phase 03: typed operation action dispatch, stale-action safety, and API
  dispatch implemented.
- Phase 04: intent compiler/router implemented.
- Phase 05: operation prompt grounding and tool evidence implemented.
- Phase 06: backup/restore operation migration implemented.
- Phase 07: media workflow operation projection implemented.
- Phase 08: factory work-order operation projection implemented.
- Phase 09: admin/conversation operation surfaces, help flows, and onboarding
  operation cards/buttons implemented.
- Phase 10: Rust native command/result boundary and release checks implemented.
- Phase 11: package docs, role-gated handbook, product QA, guardrail evidence,
  and closeout matrix completed.

## Fixes Made During Phase 11 QA

### Role Access Test Mock

`src/lib/operations/operations-access.test.ts` failed because the auth mock did
not include `resolveSessionAuthorizationRole` and `sessionHasRole`. The mock was
updated so operation access tests exercise the same role helpers used by the
runtime.

### Browser Smoke Harness

`tests/browser-ui/operations-media.spec.ts` initially failed because the test
server and test process were not using the same SQLite path, `/register`
redirected through first-boot install setup, and `networkidle` waited forever
against normal polling routes.

The original fix:

- `playwright.config.ts` now sets `DATA_DIR` and `STUDIO_ORDO_DB_PATH` for the
  Playwright process and web server.
- `tests/browser-ui/helpers/public-form.ts` sets the install cookie before
  register-form helpers.
- `tests/browser-ui/operations-media.spec.ts` waits on UI readiness instead of
  `networkidle`.

The final QA rerun also found two harness-level reliability issues:

- A cold local production build plus search-index build can exceed the old
  240-second Playwright web-server timeout. The timeout is now 600 seconds so
  the smoke test measures product behavior instead of local build variance.
- A stale local media worker on port 3101 can make an unrelated browser smoke
  fail before Next is available. The Phase 11 browser smoke now defaults
  `DISABLE_MEDIA_WORKER=1` through `playwright.config.ts`, with an explicit
  `PLAYWRIGHT_DISABLE_MEDIA_WORKER` override for future browser tests that need
  the real worker.

### Operation Button Product Clarity

Operation actions were functionally correct but visually too subtle. The shared
`src/frameworks/ui/operations/OperationActionButton.tsx` styling was strengthened
with larger control affordance, stronger borders, clearer background states, and
danger/primary/secondary intent tones. This affects operation cards, rich
content, assistant bubbles, and action rails through one component.

## Final QA Rerun

Captured: 2026-05-03 local time

The full Phase 11 closeout matrix was rerun after the QA fixes above:

- Core operation matrix: passed, 11 files, 104 tests.
- Operation API/chat/UI matrix: passed, 20 files, 134 tests.
- Feature operation matrix: passed, 19 files, 61 tests.
- Admin/corpus/appliance/release matrix: passed, 21 files, 89 tests.
- Capability binding guardrails: passed, 4 files, 47 passed, 2 skipped.
- Browser smoke: passed, 2 tests.
- Rust checks: `cargo fmt --check`, `cargo test -p ordo-backup`, and
  `cargo clippy -p ordo-backup -- -D warnings` passed.
- Repository checks: typecheck, lint, and diff whitespace passed.

The two skipped tests are existing skipped capability-runtime cases in
`runtime-tool-binding.test.ts`, not Phase 11 regressions.

## Test Matrix

### Core Operation Matrix

Command:

```bash
npx vitest run \
  src/core/entities/operation.test.ts \
  src/core/use-cases/operations/OperationStateMachine.test.ts \
  src/core/use-cases/operations/OperationKindRegistry.test.ts \
  src/core/use-cases/operations/OperationActionPolicy.test.ts \
  src/core/use-cases/operations/OperationActionDispatch.test.ts \
  src/core/use-cases/operations/OperationIntentPolicy.test.ts \
  src/core/use-cases/operations/OperationIntentRouter.test.ts \
  src/core/use-cases/operations/OperationDraftFactory.test.ts \
  src/core/use-cases/operations/OperationPromptGrounding.test.ts \
  src/core/use-cases/operations/OperationStatusMapping.test.ts \
  src/adapters/OperationDataMapper.test.ts
```

Result: passed, 11 files, 104 tests.

### Operation API, Chat, And UI Matrix

Command:

```bash
noglob npx vitest run \
  src/app/api/operations/route.test.ts \
  src/app/api/operations/[operationId]/route.test.ts \
  src/app/api/operations/[operationId]/actions/[actionId]/route.test.ts \
  src/app/api/operations/[operationId]/events/route.test.ts \
  src/app/api/operations/[operationId]/artifacts/route.test.ts \
  src/lib/operations/operation-action-api.test.ts \
  src/lib/operations/operation-action-dispatch-root.test.ts \
  src/lib/operations/operation-action-view-model.test.ts \
  src/lib/operations/operation-action-markdown.test.ts \
  src/lib/operations/operation-intent-ingress.test.ts \
  src/lib/operations/operation-intent-projection.test.ts \
  src/lib/operations/operation-prompt-grounding.test.ts \
  src/lib/operations/operation-tool-evidence.test.ts \
  src/lib/operations/operation-presentation.test.ts \
  src/frameworks/ui/RichContentRenderer.test.tsx \
  src/frameworks/ui/useChatSurfaceState.test.tsx \
  src/frameworks/ui/MessageList.test.tsx \
  src/frameworks/ui/chat/bubbles/AssistantBubble.test.tsx \
  src/frameworks/ui/operations/OperationCard.test.tsx \
  src/frameworks/ui/operations/OperationActionButton.test.tsx
```

Result: passed, 20 files, 134 tests.

### Feature Operation Matrix

Command:

```bash
npx vitest run \
  src/lib/appliance/backup/backup-command-service.test.ts \
  src/lib/appliance/backup/backup-command-validation.test.ts \
  src/lib/appliance/backup/backup-restore-operation-executor.test.ts \
  src/lib/appliance/backup/backup-restore-operation-reconciler.test.ts \
  src/lib/appliance/backup/backup-self-service.test.ts \
  src/lib/appliance/backup/restore-safety-pipeline.test.ts \
  src/lib/appliance/native/native-command-contract.test.ts \
  src/lib/appliance/native/native-result-reconciler.test.ts \
  src/lib/appliance/native/native-binary-registry.test.ts \
  src/lib/media/workflows/media-workflow-operation-executor.test.ts \
  src/lib/media/workflows/media-workflow-operation-reconciler.test.ts \
  src/lib/media/workflows/media-workflow-architecture-guardrails.test.ts \
  src/lib/media/workflows/media-workflow-turn-hook.test.ts \
  src/lib/factory/factory-work-order-operation-executor.test.ts \
  src/lib/factory/factory-work-order-operation-reconciler.test.ts \
  src/lib/factory/factory-work-order-operation-launcher.test.ts \
  src/lib/factory/factory-work-order-operation-architecture-guardrails.test.ts \
  src/lib/operations/help-flow-operation.test.ts \
  src/lib/operations/onboarding-flow-operation.test.ts
```

Result: passed, 19 files, 61 tests.

### Admin, Corpus, Appliance, And Release Matrix

Command:

```bash
npx vitest run \
  src/app/operations/page.test.tsx \
  src/app/operations/[operationId]/page.test.tsx \
  src/app/operations/media/page.test.tsx \
  src/app/admin/system/operations/page.test.tsx \
  src/app/admin/system/backups/page.test.tsx \
  src/lib/operations/operations-access.test.ts \
  src/components/media/MediaOperationsWorkspace.test.tsx \
  src/lib/media/media-operations.test.ts \
  src/lib/corpus-library.test.ts \
  src/lib/corpus-access.test.ts \
  tests/corpus/book-discovery.test.ts \
  tests/corpus/librarian-tools.test.ts \
  tests/corpus/librarian-security.test.ts \
  src/lib/appliance/health-facade.test.ts \
  src/lib/appliance/probes/backup-restore-probe.test.ts \
  src/lib/appliance/probes/resource-pressure-probe.test.ts \
  tests/docker-runtime-contract.test.ts \
  tests/docker-appliance-lifecycle.contract.test.ts \
  tests/image-runtime-bundle-contract.test.ts \
  tests/appliance-lifecycle-smoke.test.ts \
  tests/appliance-image-release-cli.test.ts
```

Result: passed after the role access mock fix, 21 files, 89 tests.

### Role-Gated Handbook Focus

Command:

```bash
npx vitest run src/lib/corpus-library.test.ts
```

Result: passed, 1 file, 3 tests.

Coverage added:

- anonymous users can search/read only public system docs,
- authenticated users can read member docs,
- apprentices can read apprentice docs,
- staff can read staff docs,
- admins can read admin appliance docs,
- full-section reads apply the same role gates as search.

### Operation Button Focus

Command:

```bash
npx vitest run \
  src/frameworks/ui/operations/OperationActionButton.test.tsx \
  src/frameworks/ui/RichContentRenderer.test.tsx \
  src/frameworks/ui/MessageList.test.tsx \
  src/frameworks/ui/chat/bubbles/AssistantBubble.test.tsx
```

Result: passed, 4 files, 59 tests.

### Capability Binding Guardrails

Command:

```bash
npx vitest run \
  src/core/capability-catalog/runtime-tool-binding.test.ts \
  src/lib/chat/tool-capability-routing.test.ts \
  src/lib/media/workflows/media-workflow-architecture-guardrails.test.ts \
  src/lib/factory/factory-work-order-operation-architecture-guardrails.test.ts
```

Result: passed, 4 files, 47 passed, 2 skipped.

The skipped tests are existing skipped cases inside
`runtime-tool-binding.test.ts`, not Phase 11 failures.

### Browser Smoke

Command:

```bash
npx playwright test tests/browser-ui/operations-media.spec.ts
```

Result: passed, 2 tests.

Build warnings were observed during the Playwright web-server build:

- Turbopack broad dynamic filesystem trace in `src/lib/user-files.ts`.
- Turbopack broad dynamic filesystem trace in
  `src/lib/appliance/native/native-binary-registry.ts`.
- Unexpected NFT trace through `next.config.ts`.

The build completed and browser smoke passed. These are not Phase 11 blocking
failures but should be watched if image minimization or bundle tracing changes.

### Rust Checks

Commands:

```bash
cargo fmt --check
cargo test -p ordo-backup
cargo clippy -p ordo-backup -- -D warnings
```

Results:

- `cargo fmt --check`: passed.
- `cargo test -p ordo-backup`: passed, 19 tests total across lib and integration
  suites.
- `cargo clippy -p ordo-backup -- -D warnings`: passed.

### Repository Checks

Commands:

```bash
npm run typecheck -- --pretty false
npm run lint
git diff --check
```

Results:

- Typecheck: passed.
- Lint: passed with 214 warnings, 0 errors, 19 fixable warnings.
- Diff whitespace check: passed.

## Guardrail Search Results

### Rust Operation Ledger Ownership

Command:

```bash
rg -n "operation_events|operation_steps|operations" crates/ordo-backup
```

Result: no matches.

Classification: pass. Rust does not write operation ledger tables directly.

### Dangerous Phrase And Restore Text

Command:

```bash
rg -n "fire it|say \"fire|Create safety backup|Execute restore" src docs --glob '!docs/_refactor/**'
```

Result classifications:

- Allowed tests and action labels:
  - `OperationActionButton.test.tsx`
  - `RichContentRenderer.test.tsx`
  - `MessageList.test.tsx`
  - `AssistantBubble.test.tsx`
  - `MarkdownParserService.test.ts`
  - `OperationPromptGrounding.test.ts`
  - `BackupRestoreOperationActions.ts`
  - `appliance-backup.tool.ts`
- Allowed destructive classifier:
  - `operation-intent-compiler.ts` includes `fire it` and `execute restore` so
    the system treats those phrases as destructive intent rather than direct
    execution.
- Archived historical transcript:
  - `docs/_archive/_refactor-pre-factory-2026-04-27/...` contains old "fire it"
    language. It is archival evidence, not current product guidance.

Classification: pass. Current source does not instruct users to execute
dangerous work by chat phrase; action labels render as operation buttons.

### Chat Action Send Paths

Command:

```bash
rg -n "actionType: \"message\"|sendMessage\(|append\(.*operation" src/frameworks src/lib src/components
```

Result:

- `src/frameworks/ui/useChatSurfaceState.tsx` still sends normal suggestion and
  tool-action text through chat.

Classification: pass with scope note. Operation actions use the `operation`
handler, `postOperationAction`, confirmation dialog, and typed API dispatch.
The remaining `sendMessage` paths are normal chat/suggestion flows, not
operation action execution.

### Prompt-Visible Mutation Tools

Command:

```bash
rg -n "produce_product|compose_media|restore.request|backup.create" src/core/use-cases/tools src/lib/chat tests/mcp
```

Result classifications:

- `create_appliance_backup` and restore direct tool commands reject direct
  mutation and instruct callers to use operation actions.
- `produce_product` is filtered from normal prompt-visible chat exposure by
  `filterOperationBackedPromptTools`.
- Catalog runtime binding routes `produce_product` into
  `launchFactoryWorkOrderOperation`.
- Catalog runtime binding routes `compose_media` into
  `launchMediaWorkflowOperation` for user-facing execution.
- Same-turn media discovery guard remains active before `compose_media`.

Classification: pass. Names remain for capability compatibility and source
subsystem linkage, but user-facing mutation goes through operations.

### Operation Card/Button Projection

Command:

```bash
rg -n "operation-card|data-operation-action|OperationActionButton" src/frameworks src/components
```

Result:

- Operation cards/buttons render in `RichContentRenderer`, `MessageList`,
  `AssistantBubble`, `CapabilityActionRail`, and operation workspace components.

Classification: pass. Operation actions are first-class UI controls.

### Role-Gated System Docs

Command:

```bash
rg -n "system-docs|audience: admin|audience: staff|rolePersona" docs/_corpus src/lib/corpus* tests/corpus
```

Result:

- Current `docs/_corpus/system-docs` chapters include public, member,
  apprentice, staff, and admin role persona material.
- `corpus-library.test.ts` proves role-filtered search and full-section access.
- Archived corpus copies also match but are not the active corpus source.

Classification: pass.

### Native Binary References

Command:

```bash
rg -n "ORDO_BACKUP_EXECUTOR_PATH|bin/ordo-backup|ordo-runtime" Dockerfile scripts src/lib tests
```

Result:

- References are centralized in Dockerfile packaging, supervisor/dev scripts,
  native binary registry, release checks, probes, and tests.

Classification: pass. These are expected runtime-contract references.

## Product Review

The final product shape is substantially stronger than the baseline:

- The assistant can no longer make complex work true by saying it happened.
- Complex workflows produce durable operation records with status, steps,
  events, artifacts, actions, risk, role policy, and idempotency.
- Operation action buttons are visually stronger and route through typed
  dispatch, not synthetic chat text.
- Chat, `/operations`, admin operations, backup admin, media workspace, help,
  and onboarding can read the same operation truth.
- Role-gated system docs give public, member, apprentice, staff, and admin users
  different help surfaces.
- Rust remains behind a deterministic command/result contract.
- Docker remains the single-image appliance target.

Remaining non-blocking improvement areas:

- Migrate scheduled automatic backups into operation records in a future phase.
- Complete full migrations for `system_diagnostic`, `tool_task`, and
  `content_publish`.
- Reduce repo lint warnings over time.
- Monitor Turbopack/NFT dynamic filesystem warnings during image hardening.

## Closeout Decision

Phase 11 is closed. There are no open high-severity findings for the implemented
operation-backed families.
