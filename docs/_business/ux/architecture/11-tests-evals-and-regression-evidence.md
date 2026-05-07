# Tests, Evals, And Regression Evidence

## UX Intent

Tests are part of archeology. They reveal what the system claims to support,
what contracts are already protected, and where UX changes can safely reuse
existing behavior.

The UX program should preserve durable evidence for every important surface:

- public navigation
- chat actions
- tool/capability routing
- prompt provenance
- work execution
- media/content production
- relationship trails
- offer visibility
- content visibility
- admin separation

## Existing Test Distribution

Second-pass repository inventory on 2026-05-04 found 836 `*.test.*` and
`*.spec.*` files outside `node_modules`, `.next`, `.git`, and `.data`.

Top observed test concentrations:

| Area | Approximate count from inventory | Meaning |
| --- | ---: | --- |
| `app/api` | 58 | Route/API behavior is heavily covered. |
| `core/use-cases` | 48 | Domain operations and tool use cases have useful contracts. |
| `frameworks/ui` | 45 | Chat and UI presentation are test-backed. |
| `lib/media` | 39 | Media runtime has strong coverage. |
| `lib/chat` | 32 | Chat orchestration and routing are mature enough to mine. |
| `hooks/chat` | 28 | Client chat orchestration has meaningful coverage. |
| `lib/appliance` | 24 | Appliance/backup work is well protected. |
| `core/platform` | 22 | Platform read models and projections are available. |
| `lib/jobs` | 18 | Deferred job runtime is test-backed. |
| `lib/operations` | 13 | Operation action/presentation contracts exist. |
| `lib/capabilities` | 13 | Capability runtime/export architecture is tested. |
| `core/capability-catalog` | 13 | Catalog convergence and prompt exposure are protected. |

## Critical Test Families To Mine

### Shell And Public Site

- `src/lib/shell/shell-navigation.test.ts`
- `src/lib/shell/public-shell-state.test.ts`
- `src/components/SiteNav.test.tsx`
- `src/components/AppShell.test.tsx`
- `src/app/sitemap.test.ts`

Use these to validate public/private route visibility and feed gating.

### Chat And Actions

- `src/frameworks/ui/RichContentRenderer.test.tsx`
- `src/frameworks/ui/useChatSurfaceState.test.tsx`
- `src/frameworks/ui/chat/plugins/custom/**.test.tsx`
- `src/hooks/chat/**.test.tsx`
- `src/lib/chat/**.test.ts`

Use these to protect custom cards, action buttons, interruption/retry, browser
runtime jobs, and conversation state.

### Capability And Tool Registry

- `src/core/capability-catalog/catalog-coverage.test.ts`
- `src/core/capability-catalog/registry-convergence.test.ts`
- `src/core/capability-catalog/runtime-tool-binding.test.ts`
- `src/core/capability-catalog/prompt-directive-unification.test.ts`
- `src/core/use-cases/tools/tool-schema-compatibility.test.ts`

Use these to prevent silent drift between catalog, prompt exposure, runtime
binding, validation, and UI presentation.

### Prompt Provenance

- `src/lib/prompts/prompt-binding-service.test.ts`
- `src/lib/prompts/prompt-provenance-service.test.ts`
- `src/adapters/PromptBindingDataMapper.test.ts`
- `src/adapters/PromptProvenanceDataMapper.test.ts`
- `src/lib/chat/stream-preparation.operation-grounding.test.ts`

Use these to prove work can explain what context and instructions were used.

### Work Execution

- `src/lib/jobs/**.test.ts`
- `src/core/use-cases/operations/**.test.ts`
- `src/lib/operations/**.test.ts`
- `src/lib/media/workflows/**.test.ts`
- `src/lib/factory/**.test.ts`

Use these to protect queues, operations, media workflows, and factory work
orders as separate runtime contracts projected into a unified UX.

### Studio, Media, And Content

- `src/components/studio/StudioWorkspace.test.tsx`
- `src/lib/studio/load-studio-workspace.test.ts`
- `src/lib/media/**.test.ts`
- `src/core/use-cases/tools/compose-media.tool.test.ts`
- `src/core/use-cases/tools/journal-write.tool.test.ts`
- `src/lib/blog/blog-production-root.test.ts`

Use these to build content/media workflow regression packs.

### People And Results

- `src/components/business/BusinessWorkspace.test.tsx`
- `src/lib/business/load-business-workspace.test.ts`
- `src/lib/referrals/**.test.ts`
- `src/core/platform/business-workflow/**.test.ts`
- `src/core/platform/relationship-memory/**.test.ts`
- `src/core/platform/operator-transition/**.test.ts`

Use these to create the People/Relationship Trail tests.

### Access Control

- `src/lib/access/content-access.test.ts`
- `src/lib/chat/retrieval-envelope.test.ts`
- `src/adapters/InMemoryVectorStore.test.ts`
- `src/core/platform/knowledge-access/KnowledgeAccessService.test.ts`

Use these to prove public/private content visibility.

### Admin And Appliance

- `src/app/admin/**.test.tsx`
- `src/lib/admin/**.test.ts`
- `src/lib/appliance/**.test.ts`
- `src/app/api/admin/**.test.ts`
- `src/lib/health/probes.test.ts`

Use these to keep governance and diagnostics separate from regular UX.

## Test Commands

Current package scripts include:

- `npm run test`
- `npm run typecheck`
- `npm run lint:strict`
- `npm run quality`
- `npm run test:homepage-shell`
- `npm run test:browser-ui`
- `npm run browser:smoke`
- `npm run eval:live`
- `npm run eval:live-tools`
- `npm run eval:live-tool-workflows`
- `npm run rust:test`

## Regression Requirements For UX Refactors

Each UX phase should specify:

1. Unit tests for projection/read-model changes.
2. Component tests for cards, rails, and detail lenses.
3. API tests for visibility and state transitions.
4. Playwright/browser tests for mobile and desktop route behavior when the
   surface is visual.
5. Negative tests for private/public leakage.
6. Durable conversation or workflow artifacts for complex chat-driven flows.

## Missing Test Packages

Add targeted coverage for:

- public offer vs private offer visibility
- private content vs public Feed
- People object merge across referral/conversation/lead/deal/memory
- Relationship Trail ordering and evidence
- generic tracked links and QR attribution
- content performance events
- workflow template creation from conversation history
- admin rail isolation from regular operator navigation
