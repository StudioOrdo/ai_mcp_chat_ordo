# Phase 6 — Platform Delivery Boundary Cleanup

> Status: Complete
> Loop State: Exit criteria verified
> Goal: Make platform assembly rules explicit across repository access, route validation, shell behavior, and admin feature ownership.
> Prerequisites: Phase 0 complete

## Phase Intent

This phase is complete.

The current codebase now encodes the policy this phase set out to make explicit: [../../../../src/adapters/RepositoryFactory.ts](../../../../src/adapters/RepositoryFactory.ts#L1) documents the accepted RSC service-locator exception and process-cached singleton lifetime, [../../../../src/lib/chat/conversation-root.ts](../../../../src/lib/chat/conversation-root.ts#L1) documents the request-scoped composition-root exception for grouped workflow persistence, [../../../../src/lib/chat/direct-turn-intake.ts](../../../../src/lib/chat/direct-turn-intake.ts#L1) gives `/api/chat` the same explicit intake-stage shape that the stream route already had, [../../../../src/components/AppShell.tsx](../../../../src/components/AppShell.tsx#L1) now expresses all document-flow behavior through one shared branch, and [../../../../src/lib/admin/pipeline/admin-pipeline-attention.ts](../../../../src/lib/admin/pipeline/admin-pipeline-attention.ts#L1) gives overdue follow-ups an explicit cross-feature admin home backed by the lead and deal repository seams.

## Source Anchors To Refresh

- [../../../../src/adapters/RepositoryFactory.ts](../../../../src/adapters/RepositoryFactory.ts#L45)
- [../../../../src/lib/chat/conversation-root.ts](../../../../src/lib/chat/conversation-root.ts#L92)
- [../../../../src/lib/chat/direct-turn-intake.ts](../../../../src/lib/chat/direct-turn-intake.ts#L1)
- [../../../../src/app/api/chat/route.ts](../../../../src/app/api/chat/route.ts#L1)
- [../../../../src/app/api/chat/stream/route.ts](../../../../src/app/api/chat/stream/route.ts#L1)
- [../../../../src/lib/chat/http-facade.ts](../../../../src/lib/chat/http-facade.ts#L1)
- [../../../../src/app/layout.tsx](../../../../src/app/layout.tsx#L73)
- [../../../../src/components/AppShell.tsx](../../../../src/components/AppShell.tsx#L15)
- [../../../../src/app/admin/page.tsx](../../../../src/app/admin/page.tsx#L45)
- [../../../../src/lib/admin/leads/admin-leads-attention.ts](../../../../src/lib/admin/leads/admin-leads-attention.ts#L1)
- [../../../../src/lib/admin/pipeline/admin-pipeline-attention.ts](../../../../src/lib/admin/pipeline/admin-pipeline-attention.ts#L1)
- [../../../../src/lib/operator/loaders/admin-loaders.ts](../../../../src/lib/operator/loaders/admin-loaders.ts#L1)
- [../../../../src/lib/operator/loaders/admin-queue-loaders.ts](../../../../src/lib/operator/loaders/admin-queue-loaders.ts#L1)
- [../../../../src/lib/admin/jobs/admin-jobs.ts](../../../../src/lib/admin/jobs/admin-jobs.ts#L1)
- [../../../../src/lib/admin/jobs/admin-jobs-actions.ts](../../../../src/lib/admin/jobs/admin-jobs-actions.ts#L1)
- [../../../../src/lib/admin/jobs/admin-job-loaders.ts](../../../../src/lib/admin/jobs/admin-job-loaders.ts#L1)
- [../../../../src/components/admin/JobsTableClient.tsx](../../../../src/components/admin/JobsTableClient.tsx#L1)
- [../../../../src/lib/admin/leads/admin-leads.ts](../../../../src/lib/admin/leads/admin-leads.ts#L1)
- [../../../../src/lib/admin/leads/admin-lead-loaders.ts](../../../../src/lib/admin/leads/admin-lead-loaders.ts#L1)
- [../../../../src/components/admin/LeadsTableClient.tsx](../../../../src/components/admin/LeadsTableClient.tsx#L1)

## Phase Decisions

- Direct-turn and stream keep transport-specific intake modules, but Phase 6 now freezes the shared invariant and shared route-envelope rule through [../../../../src/lib/chat/validation.ts](../../../../src/lib/chat/validation.ts#L1) and [../../../../src/lib/chat/http-facade.ts](../../../../src/lib/chat/http-facade.ts#L1).
- Overdue follow-up summaries now live in [../../../../src/lib/admin/pipeline/admin-pipeline-attention.ts](../../../../src/lib/admin/pipeline/admin-pipeline-attention.ts#L1) as a cross-feature admin slice because they span both lead and deal records; operator loaders keep compatibility re-exports only.
- Jobs remains the reference colocation slice, and leads plus the new `admin/pipeline` slice complete the second ownership example needed to make the rule explicit.

## Drift Traps

- Reorganizing files without clarifying the ownership rule that justified the move.
- Treating `AppShell` as an unsolved policy problem when the real remaining issue is duplicated document-flow structure.
- Moving queue or dashboard loaders wholesale without deciding whether they are feature-owned or intentionally operator-owned.
- Treating type or style cleanup as delivery-boundary progress.

## Pre-Implementation QA Gate

- [x] Refresh current dependency-assembly patterns.
- [x] Refresh current route-validation patterns.
- [x] Refresh current shell branching and admin feature ownership map.
- [x] Pick a narrow pilot for admin colocation.

## Verified Current State

### Dependency-Assembly Rules Today

| Zone | Current rule | Evidence | Phase 6 ruling |
| --- | --- | --- | --- |
| RSC pages, route-adjacent admin loaders, and simple read models | Use [../../../../src/adapters/RepositoryFactory.ts](../../../../src/adapters/RepositoryFactory.ts#L1) as the accepted service-locator seam with process-cached singleton lifetime | Factory header comment, `@lifetime` tags, and admin loaders such as [../../../../src/lib/admin/jobs/admin-job-loaders.ts](../../../../src/lib/admin/jobs/admin-job-loaders.ts#L1) and [../../../../src/lib/admin/leads/admin-leads.ts](../../../../src/lib/admin/leads/admin-leads.ts#L1) all call `get*DataMapper()` exports directly | This packet is now the phase-owned rule table: new read-model and route-adjacent admin loader work should follow the `RepositoryFactory` seam unless a request-scoped composition-root exception is explicitly needed |
| Chat and workflow composition roots that need grouped persistence under one DB handle | Use request-scoped constructors in [../../../../src/lib/chat/conversation-root.ts](../../../../src/lib/chat/conversation-root.ts#L1) around a shared `getDb()` handle | `createConversationPersistence()`, `createEventRecorder()`, and `createWorkflowRepositories()` each document the approved request-scoped grouping exception | `conversation-root` is the frozen exception pattern for grouped persistence and workflow construction in this phase |
| Raw route-level `getDb()` access | Legacy pattern only; Phase 6 anchor files do not rely on direct raw DB reads | [../../../../src/adapters/RepositoryFactory.ts](../../../../src/adapters/RepositoryFactory.ts#L1) explicitly calls direct `getDb()` in route handlers legacy and migration-targeted | Raw route-level `getDb()` remains legacy-only and is outside the approved Phase 6 anchor patterns |

### Route-Validation Inventory

| Route family | Current intake pattern | Shared behavior | Evidence |
| --- | --- | --- | --- |
| Direct-turn chat route | [../../../../src/app/api/chat/route.ts](../../../../src/app/api/chat/route.ts#L1) now delegates request parsing to [../../../../src/lib/chat/direct-turn-intake.ts](../../../../src/lib/chat/direct-turn-intake.ts#L1), which trims message content, requires non-empty messages, and resolves the latest user text before the provider path runs | Error envelope, request id, metrics, and AppError-to-response mapping are standardized by [../../../../src/lib/chat/http-facade.ts](../../../../src/lib/chat/http-facade.ts#L1) through `runRouteTemplate()` | [../../../../tests/chat/chat-route.test.ts](../../../../tests/chat/chat-route.test.ts#L1) covers empty messages, missing user message, blank-after-trim content, success, and provider failure |
| Stream chat route | [../../../../src/app/api/chat/stream/route.ts](../../../../src/app/api/chat/stream/route.ts#L1) delegates intake to `executeChatStreamRoute()` and `ChatStreamPipeline.validateAndParse()`, while sharing the same latest-user-message invariant through [../../../../src/lib/chat/validation.ts](../../../../src/lib/chat/validation.ts#L1) | Same `runRouteTemplate()` wrapper and observability envelope as the direct-turn path | [../../../../tests/chat/chat-stream-route.test.ts](../../../../tests/chat/chat-stream-route.test.ts#L1) covers invalid attachment metadata, overlapping stream starts, unsafe context windows, and error observability |
| Route-level success and error contract | `runRouteTemplate()`, `successJson()`, `successText()`, and `errorJson()` already standardize request ids, metrics, AppError mapping, and fallback error handling | Both `/api/chat` and `/api/chat/stream` share the same envelope while keeping separate transport-specific intake modules | [../../../../src/lib/chat/http-facade.ts](../../../../src/lib/chat/http-facade.ts#L1) |

Accepted steady state: the error envelope is standardized, and both chat transports use explicit transport-specific intake seams while sharing the latest-user-message invariant. Further schema convergence is future design work, not a Phase 6 requirement.

### Shell Policy

- [../../../../src/components/AppShell.tsx](../../../../src/components/AppShell.tsx#L1) already owns route-surface detection for `home`, `admin`, `journal`, and `default` via `usePathname()`.
- The shell already exposes a stable route contract through `data-shell-route-mode`, `data-shell-route-surface`, `data-shell-main-surface`, and `data-shell-floating-chat-clearance`.
- The home route already uses the distinct `viewport-stage` mode, while admin and all other document routes use `document-flow`.
- [../../../../src/components/AppShell.test.tsx](../../../../src/components/AppShell.test.tsx#L1) already proves the home, journal, default, and admin route-surface mapping.
- The structural cleanup is complete: the shell now has one document-flow branch, and the only admin-versus-non-admin distinction is expressed as `data-shell-floating-chat-clearance` data rather than duplicated markup.

### Admin Ownership Map

| Slice | Current ownership shape | Evidence | Phase 6 implication |
| --- | --- | --- | --- |
| Jobs | Already close to the desired feature-local model: list/view-model logic in [../../../../src/lib/admin/jobs/admin-jobs.ts](../../../../src/lib/admin/jobs/admin-jobs.ts#L1), mutations in [../../../../src/lib/admin/jobs/admin-jobs-actions.ts](../../../../src/lib/admin/jobs/admin-jobs-actions.ts#L1), pagination wrapper in [../../../../src/lib/admin/jobs/admin-job-loaders.ts](../../../../src/lib/admin/jobs/admin-job-loaders.ts#L1), and client table in [../../../../src/components/admin/JobsTableClient.tsx](../../../../src/components/admin/JobsTableClient.tsx#L1) | [../../../../src/lib/admin/jobs/admin-jobs.test.ts](../../../../src/lib/admin/jobs/admin-jobs.test.ts#L1), [../../../../src/lib/admin/jobs/admin-jobs-actions.test.ts](../../../../src/lib/admin/jobs/admin-jobs-actions.test.ts#L1) | Jobs is the cleanest Phase 6 reference slice and should be treated as the baseline ownership model |
| Leads | Split model is now explicit: pipeline view-model logic still lives in [../../../../src/lib/admin/leads/admin-leads.ts](../../../../src/lib/admin/leads/admin-leads.ts#L1), pagination still lives in [../../../../src/lib/admin/leads/admin-lead-loaders.ts](../../../../src/lib/admin/leads/admin-lead-loaders.ts#L1), and lead, consultation, plus training attention blocks live in [../../../../src/lib/admin/leads/admin-leads-attention.ts](../../../../src/lib/admin/leads/admin-leads-attention.ts#L1) | [../../../../tests/admin-leads-pipeline.test.tsx](../../../../tests/admin-leads-pipeline.test.tsx#L1) plus dashboard aggregation in [../../../../src/app/admin/page.tsx](../../../../src/app/admin/page.tsx#L1) | Single-feature attention loaders stay with the owning feature slice |
| Cross-feature pipeline attention | The overdue follow-up summary now lives in [../../../../src/lib/admin/pipeline/admin-pipeline-attention.ts](../../../../src/lib/admin/pipeline/admin-pipeline-attention.ts#L1), backed by `getLeadRecordDataMapper().listOverdueFollowUps()` and `getDealRecordDataMapper().listOverdueFollowUps()`, while [../../../../src/lib/operator/loaders/admin-queue-loaders.ts](../../../../src/lib/operator/loaders/admin-queue-loaders.ts#L1) keeps a compatibility re-export | [../../../../src/lib/admin/pipeline/admin-pipeline-attention.test.ts](../../../../src/lib/admin/pipeline/admin-pipeline-attention.test.ts#L1), [../../../../tests/jobs-system-dashboard.test.ts](../../../../tests/jobs-system-dashboard.test.ts#L1) | Cross-feature admin summaries should move to `src/lib/admin/pipeline` instead of staying under the operator label |
| Dashboard aggregation | [../../../../src/app/admin/page.tsx](../../../../src/app/admin/page.tsx#L1) now pulls feature-owned attention blocks from [../../../../src/lib/admin/leads/admin-leads-attention.ts](../../../../src/lib/admin/leads/admin-leads-attention.ts#L1), cross-feature overdue attention from [../../../../src/lib/admin/pipeline/admin-pipeline-attention.ts](../../../../src/lib/admin/pipeline/admin-pipeline-attention.ts#L1), jobs from `src/lib/admin/jobs`, journal from `src/lib/journal`, and only system plus routing summaries from `src/lib/operator/loaders` | [../../../../tests/admin-shell-and-concierge.test.tsx](../../../../tests/admin-shell-and-concierge.test.tsx#L1) | The dashboard now reads as composed feature ownership rather than one ambiguous operator surface |

### Current Code Notes

- The service-locator versus composition-root split is already documented in source, but only locally.
- The route envelope is already unified by [../../../../src/lib/chat/http-facade.ts](../../../../src/lib/chat/http-facade.ts#L1), and `/api/chat` now uses [../../../../src/lib/chat/direct-turn-intake.ts](../../../../src/lib/chat/direct-turn-intake.ts#L1) to mirror the stream route's explicit intake-stage shape.
- Shell ownership is explicit and test-backed, and the duplicated document-flow branch is now removed without changing route policy.
- Jobs remains the reference admin feature colocation model; leads now owns single-feature attention loaders, while cross-feature overdue follow-ups now live under `src/lib/admin/pipeline` with operator compatibility re-exports.

### Current QA Notes

- Focused Phase 6 baseline bundle passed: 9 files and 114 tests.
- The bundle covered direct-turn route validation, stream-route intake and observability, AppShell route-surface behavior, admin shell integration, admin client boundaries, admin process diagnostics, the jobs reference slice, and the split leads pipeline slice.
- Focused Phase 6 implementation bundle passed: 6 files and 119 tests.
- The implementation bundle covered the new direct-turn intake seam, shared latest-user-message invariant on the stream path, the leads attention ownership move, and the preserved operator compatibility surface.
- Phase 6 closeout bundle passed: 4 files and 63 tests.
- The closeout bundle covered the deduplicated AppShell branch, admin dashboard wiring, leads workspace attention wiring, and the new cross-feature overdue loader behavior.
- Full Phase 6 confidence bundle passed: 23 files and 286 tests.
- The full confidence bundle covered the phase-specific route, shell, and admin ownership suites plus the wider architecture, hardening, dashboard split, job visibility, blog orchestration, referral governance, theme governance, and performance guardrails.
- Homepage shell verification passed: 3 files and 21 tests through `npm run test:homepage-shell`.
- Targeted source-assertion rerun passed: 1 file, 2 relevant tests green for the overdue follow-up ownership seam.
- `npm exec eslint` across the anchor files and the jobs or leads pilot files produced no output.
- `npm exec eslint` across the closeout files produced no output.
- `npm run build` passed on 2026-04-13.
- `npm run typecheck` currently reports unrelated test-only type drift outside the Phase 6 anchor files; the production build and all Phase 6 confidence bundles remained green.
- Editor diagnostics are clean across the Phase 6 anchors and pilot files.

```bash
npm exec vitest run tests/chat/chat-route.test.ts tests/chat/chat-stream-route.test.ts src/components/AppShell.test.tsx tests/admin-shell-and-concierge.test.tsx tests/admin-client-boundaries.test.ts tests/admin-processes.test.ts src/lib/admin/jobs/admin-jobs.test.ts src/lib/admin/jobs/admin-jobs-actions.test.ts tests/admin-leads-pipeline.test.tsx
npm exec vitest run tests/chat/chat-route.test.ts tests/chat/chat-validation.test.ts tests/chat/chat-stream-route.test.ts tests/admin-shell-and-concierge.test.tsx tests/admin-leads-pipeline.test.tsx src/lib/operator/operator-signal-loaders.test.ts
npm exec eslint src/adapters/RepositoryFactory.ts src/lib/chat/conversation-root.ts src/app/api/chat/route.ts src/app/api/chat/stream/route.ts src/lib/chat/http-facade.ts src/components/AppShell.tsx src/app/admin/page.tsx src/lib/admin/jobs/admin-jobs.ts src/lib/admin/jobs/admin-jobs-actions.ts src/lib/admin/jobs/admin-job-loaders.ts src/components/admin/JobsTableClient.tsx src/lib/admin/leads/admin-leads.ts src/lib/admin/leads/admin-lead-loaders.ts src/components/admin/LeadsTableClient.tsx src/lib/operator/loaders/admin-loaders.ts
npm exec vitest run src/components/AppShell.test.tsx tests/admin-shell-and-concierge.test.tsx tests/admin-leads-pipeline.test.tsx src/lib/admin/pipeline/admin-pipeline-attention.test.ts
npm exec vitest -- run tests/jobs-system-dashboard.test.ts -t "Overdue follow-ups loader"
npm exec eslint src/components/AppShell.tsx src/components/AppShell.test.tsx src/lib/admin/pipeline/admin-pipeline-attention.ts src/lib/admin/pipeline/admin-pipeline-attention.test.ts src/lib/operator/loaders/admin-queue-loaders.ts src/app/admin/page.tsx src/app/admin/leads/page.tsx tests/admin-shell-and-concierge.test.tsx tests/admin-leads-pipeline.test.tsx tests/jobs-system-dashboard.test.ts
npm exec vitest -- run tests/chat/chat-route.test.ts tests/chat/chat-validation.test.ts tests/chat/chat-stream-route.test.ts src/components/AppShell.test.tsx tests/admin-shell-and-concierge.test.tsx tests/admin-client-boundaries.test.ts tests/admin-processes.test.ts src/lib/admin/jobs/admin-jobs.test.ts src/lib/admin/jobs/admin-jobs-actions.test.ts tests/admin-leads-pipeline.test.tsx src/lib/operator/operator-signal-loaders.test.ts src/lib/admin/pipeline/admin-pipeline-attention.test.ts tests/jobs-system-dashboard.test.ts tests/architecture-cohesion-audit.test.ts tests/solid-architecture-audit.test.ts tests/hardening-audit.test.ts tests/dashboard-split.test.ts tests/performance-audit.test.ts tests/blog-orchestration-qa.test.ts tests/job-visibility-cohesion.test.ts tests/job-visibility-patterns.test.ts tests/referral-governance-qa.test.ts tests/theme-governance-qa.test.ts
npm run test:homepage-shell
npm run build
```

## Suggested Verification Commands

```bash
npm exec vitest run tests/chat/chat-route.test.ts tests/chat/chat-stream-route.test.ts src/components/AppShell.test.tsx tests/admin-shell-and-concierge.test.tsx tests/admin-client-boundaries.test.ts tests/admin-processes.test.ts src/lib/admin/jobs/admin-jobs.test.ts src/lib/admin/jobs/admin-jobs-actions.test.ts tests/admin-leads-pipeline.test.tsx
npm exec vitest run tests/chat/chat-route.test.ts tests/chat/chat-validation.test.ts tests/chat/chat-stream-route.test.ts tests/admin-shell-and-concierge.test.tsx tests/admin-leads-pipeline.test.tsx src/lib/operator/operator-signal-loaders.test.ts
npm exec eslint src/adapters/RepositoryFactory.ts src/lib/chat/conversation-root.ts src/app/api/chat/route.ts src/app/api/chat/stream/route.ts src/lib/chat/http-facade.ts src/components/AppShell.tsx src/app/admin/page.tsx src/lib/admin/jobs/admin-jobs.ts src/lib/admin/jobs/admin-jobs-actions.ts src/lib/admin/jobs/admin-job-loaders.ts src/components/admin/JobsTableClient.tsx src/lib/admin/leads/admin-leads.ts src/lib/admin/leads/admin-lead-loaders.ts src/components/admin/LeadsTableClient.tsx src/lib/operator/loaders/admin-loaders.ts
npm exec vitest run src/components/AppShell.test.tsx tests/admin-shell-and-concierge.test.tsx tests/admin-leads-pipeline.test.tsx src/lib/admin/pipeline/admin-pipeline-attention.test.ts
npm exec vitest -- run tests/jobs-system-dashboard.test.ts -t "Overdue follow-ups loader"
npm exec eslint src/components/AppShell.tsx src/components/AppShell.test.tsx src/lib/admin/pipeline/admin-pipeline-attention.ts src/lib/admin/pipeline/admin-pipeline-attention.test.ts src/lib/operator/loaders/admin-queue-loaders.ts src/app/admin/page.tsx src/app/admin/leads/page.tsx tests/admin-shell-and-concierge.test.tsx tests/admin-leads-pipeline.test.tsx tests/jobs-system-dashboard.test.ts
```

## Expected Evidence Artifacts

- A dependency-assembly rule table separating approved `RepositoryFactory` zones, request-scoped composition roots, and any remaining raw-DB exceptions.
- A route-validation inventory that distinguishes the canonical error envelope from the still-divergent intake seams.
- A shell-ownership note that treats `AppShell` route policy as solved and shows the final document-flow cleanup encoded in one branch.
- One admin ownership note that freezes jobs as the reference slice, feature-local attention in leads, and cross-feature pipeline attention in `src/lib/admin/pipeline`.

## Detailed Implementation Plan

1. Freeze the dependency-assembly rule table.
   - Keep [../../../../src/adapters/RepositoryFactory.ts](../../../../src/adapters/RepositoryFactory.ts#L1) as the approved RSC and route-adjacent service-locator seam.
   - Keep [../../../../src/lib/chat/conversation-root.ts](../../../../src/lib/chat/conversation-root.ts#L1) as the approved request-scoped composition-root exception for grouped persistence and workflow construction.
   - Do not broaden raw `getDb()` usage; convert any newly touched direct callers to one of the two approved patterns instead.
2. Standardize request validation entrypoints without rewriting the route envelope.
   - Preserve `runRouteTemplate()` as the canonical success and error wrapper.
   - Decide whether `/api/chat` should adopt an explicit intake seam comparable to the stream path or whether the direct-validator contract should be frozen as the approved simple-route pattern.
   - Add or tighten parity tests so invalid payload handling, request ids, and provider errors stay consistent across both chat transports.
3. Reduce shell duplication without changing shell policy.
   - Preserve the existing `home`, `admin`, `journal`, and `default` route-surface contract and all `data-shell-*` attributes.
   - Collapse the duplicated document-flow branches in [../../../../src/components/AppShell.tsx](../../../../src/components/AppShell.tsx#L1) only if the remaining admin-versus-non-admin difference can be expressed as data or configuration instead of duplicated markup.
   - Treat any AppShell work here as structural simplification, not a route-policy rediscovery exercise.
4. Freeze jobs as the reference admin slice, then make one explicit decision on a split slice.
   - Use jobs to document the target ownership model: page composition in `app`, feature logic in `src/lib/admin/<feature>`, and interactive table boundaries in `src/components/admin`.
   - Use leads and its dashboard queue blocks as the comparison slice.
   - Make one narrow follow-through: either migrate a split dashboard summary toward feature-local ownership, or document why it remains operator-owned and should not move.

## Scope Guardrails

- Do not reopen provider-runtime, prompt-runtime, or event-separation work here.
- Do not start a storage migration or a broad raw-DB cleanup.
- Do not broaden this phase into a full admin redesign or dashboard rewrite.
- Do not move every admin loader in one pass; prove or document the ownership rule on one slice first.

## Implementation Record

- Date: 2026-04-13
- Files changed: shell ownership files, admin pipeline ownership files, affected tests, this phase packet, the Phase Status Board, and the roadmap entry.
- Summary of what landed: `/api/chat` now uses an explicit schema-backed intake stage in [../../../../src/lib/chat/direct-turn-intake.ts](../../../../src/lib/chat/direct-turn-intake.ts#L1), the stream path reuses the shared latest-user-message invariant from [../../../../src/lib/chat/validation.ts](../../../../src/lib/chat/validation.ts#L1), [../../../../src/components/AppShell.tsx](../../../../src/components/AppShell.tsx#L1) now uses one shared document-flow branch, lead, consultation, plus training attention loaders live in [../../../../src/lib/admin/leads/admin-leads-attention.ts](../../../../src/lib/admin/leads/admin-leads-attention.ts#L1), and overdue follow-ups now live in [../../../../src/lib/admin/pipeline/admin-pipeline-attention.ts](../../../../src/lib/admin/pipeline/admin-pipeline-attention.ts#L1) while operator keeps compatibility re-exports.
- Deviations from the detailed plan: none beyond deliberately freezing transport-specific chat intake modules as the accepted steady state for now.

## Post-Implementation QA

- [x] Run targeted admin and route tests.
- [x] Run changed-file diagnostics.
- [x] Confirm platform rules are clearer in code structure.
- [x] Confirm admin ownership is easier to trace.

## Exit Criteria

- Dependency-assembly rules are explicit.
- Route validation uses one clear intake policy for the surfaces touched in the phase.
- Shell policy is explicit and duplicated document-flow branching is reduced or intentionally justified.
- At least one split admin feature area is easier to trace by ownership, with jobs as the reference model and one additional slice migrated or explicitly retained.

## Handoff

- What the next phase should now assume: `RepositoryFactory` versus `conversation-root` is a known assembly split, `runRouteTemplate()` is the shared route envelope, direct-turn and stream use explicit transport-specific intake modules with shared invariants, `AppShell` owns route-surface policy through a single document-flow branch, and admin ownership now follows three explicit shapes: feature-local (`jobs`, `leads` attention), cross-feature admin pipeline (`overdue_follow_ups`), and operator compatibility exports.
- Residual future work: no Phase 6 blocker remains. Future work can revisit deeper schema convergence or broader admin slice moves, but those are no longer required to understand the current platform-delivery rules.
- What docs need updating: keep this packet, the status board, and the roadmap aligned only if later phases intentionally revisit the accepted intake split or admin pipeline ownership rule.
