# Agent Tool Surface Hot Path Review

## Purpose
Review every current agent-facing tool/capability and identify what should stay,
what should be refactored, what can be merged, and what should be removed or
hidden from the default prompt surface.

This review is grounded in the current codebase, not the older review docs.

## Source Of Truth
- Catalog definitions: `src/core/capability-catalog/catalog.ts`
- Capability runtime projection:
  `src/core/platform/capability-runtime/CapabilityRuntime.ts`
- Runtime execution binding:
  `src/core/capability-catalog/runtime-tool-binding.ts`
- Chat tool composition root: `src/lib/chat/tool-composition-root.ts`
- Bundle registration: `src/lib/chat/tool-bundle-composition.ts`
- Job capability projection: `src/lib/jobs/job-capability-registry.ts`
- MCP export adapter registry:
  `src/lib/capabilities/mcp-export-adapter-registry.ts`
- Chat presentation registry:
  `src/frameworks/ui/chat/registry/capability-presentation-registry.ts`

## Current Shape
- 59 catalog capabilities.
- 11 runtime bundles: admin, affiliate, blog, calculator, conversation, corpus,
  job, media, navigation, profile, theme.
- 13 job-backed capabilities.
- 5 browser-runtime capabilities.
- 6 catalog-owned MCP exports.
- 20 blog/journal capabilities, which is the largest and most fragmented
  surface.

## High-Level Verdict
The catalog is now the correct control plane. The remaining problem is not a
missing registry. It is tool-surface sprawl: too many user-visible commands are
exposed as separate agent tools when they are really operations inside a smaller
set of product workflows.

The best direction is hard cutover, not compatibility:
- Keep the catalog as the single source of truth.
- Collapse related tools into fewer workflow-oriented tools where the current
  surface forces the model to choose implementation steps.
- Hide diagnostic and admin-only introspection from the default prompt unless
  explicitly needed by role/context.
- Delete legacy bundle helpers once all bundles are catalog-bound.
- Prefer read models and workflow commands over one tool per CRUD mutation.

## Findings
See:
- `tool-inventory.md` for the full per-tool inventory and disposition.
- `architecture-findings.md` for systemic cleanup recommendations.
- `workflow-opportunities.md` for common product workflows and system
  capabilities that are not cleanly exposed as tools.
- `implementation-plan.md` for a phased hard-cut refactor plan.
