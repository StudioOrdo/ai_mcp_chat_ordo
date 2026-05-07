# Capabilities, Tools, And Routing

## UX Intent

Capabilities are internal contracts. Users should experience them as skills
Ordo can perform, not as a tool catalog.

The capability system should help the model choose safe, appropriate actions
while the UI projects outputs as Work, Media, Content, People, Offers, Links, or
Admin diagnostics.

## Existing Code Evidence

Capability catalog:

- `src/core/capability-catalog/capability-definition.ts`
- `src/core/capability-catalog/catalog.ts`
- `src/core/capability-catalog/catalog-input-schemas.ts`
- `src/core/capability-catalog/runtime-tool-binding.ts`
- `src/core/capability-catalog/runtime-tool-projection.ts`
- `src/core/capability-catalog/execution-planning-policy.ts`
- `src/core/capability-catalog/families/**`

Import-based inventory on 2026-05-04 found 69 catalog capabilities in
`CAPABILITY_CATALOG`. Regex-only inventory is insufficient because appliance
backup/restore capabilities are declared through a helper function.

Tool executors:

- `src/core/use-cases/tools/**`
- `src/lib/chat/tool-bundles/**`
- `src/lib/capabilities/**`
- `src/core/tool-registry/**`

MCP/export/runtime:

- `src/core/capability-catalog/mcp-export.ts`
- `src/lib/capabilities/mcp-export-adapter-registry.ts`
- `src/lib/capabilities/mcp-process-runtime.ts`
- `mcp/**`

Tests:

- `src/core/capability-catalog/catalog-coverage.test.ts`
- `src/core/capability-catalog/registry-convergence.test.ts`
- `src/core/capability-catalog/runtime-tool-binding.test.ts`
- `src/core/capability-catalog/prompt-directive-unification.test.ts`
- `src/core/capability-catalog/mcp-export.test.ts`
- `src/lib/chat/tool-capability-routing.test.ts`
- `src/lib/chat/tool-composition-root.test.ts`
- `src/core/use-cases/tools/tool-schema-compatibility.test.ts`

## Current Capability Families

| Family | Examples | UX object |
| --- | --- | --- |
| Admin | backup, restore, runtime logs, routing risk, tool availability | Admin diagnostics/governance |
| Affiliate | affiliate summary, referral activity, referral exceptions | People/Results |
| Blog/journal | draft, QA, resolve QA, publish, hero image, revisions | Content |
| Calculator | calculator, chart, graph | Media/content support |
| Conversation | relationship memory, transcript recall | People/conversation continuity |
| Corpus | search, sections, summary, checklist, practitioners | Research/help |
| Job/profile system | get/list job status, profile, referral QR | Today/Account/diagnostic |
| Media | list assets, generate chart, graph, audio, compose media | Studio/Media |
| Navigation/theme | current page, route nav, runtime context, theme, UI adjustment | Shell/Account/Admin |

Full catalog names are captured in
`12-capability-certification-and-complete-inventory.md`.

## Important Contract Facets

Every catalog definition can carry:

- role access
- execution mode
- deferred job policy
- presentation family and card kind
- prompt hints
- prompt exposure
- schema
- runtime binding
- validation binding
- local execution targets
- MCP export metadata

This is a strong foundation for standardizing tools without exposing the tool
catalog to users.

## UX Mapping

| Capability facet | UX implication |
| --- | --- |
| `roles` | Determine who can ask for or execute a capability. |
| `executionMode` | Decide whether UI should show immediate output or Work in progress. |
| `presentation.cardKind` | Decide which card component to use. |
| `promptExposure` | Decide whether the LLM should see the tool by default. |
| `job` | Decide whether the output belongs in Work/Studio. |
| `mcpExport` | Keep useful for developer/open-source extension story. |
| `localExecutionTargets` | Useful for future Rust/native/local AI boundaries. |

## Product Requirements

1. Do not expose broad capability catalogs as a regular UX feature.
2. Group capabilities by human outcome, not tool family.
3. Project tool outputs into Ordo objects.
4. Capabilities that create business-visible change need confirmation or review.
5. Admin-only capabilities must remain absent from regular user prompts and UI.
6. Tool visibility must stay test-backed through catalog and registry tests.
7. New tools should be added through catalog facets, not one-off UI plumbing.

## Gaps

- Offer creation is not a first-class capability family yet.
- Owner-safe web research needs a non-admin capability path.
- QA loops exist for blog/factory work but are not generalized as a reusable
  user-facing QA capability.
- Some old tools are still named around implementation surfaces.

## Tests To Preserve Or Add

Existing:

- catalog coverage and registry convergence
- prompt directive unification
- runtime binding compatibility
- MCP export parity
- schema derivation and compatibility

Add:

- every user-facing capability maps to an Ordo object kind or diagnostic area
- no admin-only capability is prompt-visible to regular users
- offer/content visibility tools cannot publish private material publicly by
  accident
- new capability families include presentation, schema, validation, and tests
