# Spec 15 — Capability Registration Developer Experience

## Goal

Reduce the number of files required to register a new tool capability from 6+ to 2 (the catalog definition + the executor), and validate completeness at build time.

---

## Current Registration Surface

To add a new tool today, a developer must touch:

| # | File / Layer | What to add |
|---|---|---|
| 1 | `src/core/capability-catalog/families/*.ts` | `CapabilityDefinition` with all facets |
| 2 | `src/core/use-cases/tools/*.tool.ts` | Executor function |
| 3 | `src/lib/chat/tool-bundles/*-tools.ts` | `registerXTools()` — call `registry.register()` |
| 4 | `src/lib/chat/tool-composition-root-impl.ts` | Import the bundle and add to `TOOL_BUNDLE_REGISTRATIONS` |
| 5 | `src/frameworks/ui/chat/registry/...` | UI renderer registration (if custom card) |
| 6 | `src/lib/jobs/job-capability-registry.ts` | Job capability entry (if deferred) |

Missing any one of these silently degrades the system:
- Forget step 3 → tool exists in catalog but is never registered at runtime.
- Forget step 4 → bundle is defined but never loaded.
- Forget step 6 → deferred tool runs but can't be retried.

### The Catalog Is Already the Source of Truth

The `CapabilityDefinition` type in `capability-definition.ts` already contains **everything** needed: core identity, runtime config, presentation metadata, job config, browser config, schema, executor binding, and local execution targets. The problem is that no code auto-derives the registration steps from the catalog. Each layer reads the catalog separately and must be manually kept in sync.

---

## Proposed Changes

### Feature A: Auto-Registration from Catalog

Create `src/core/capability-catalog/catalog-auto-register.ts`:

```typescript
import { CAPABILITY_CATALOG } from "./catalog";
import type { ToolRegistry } from "@/core/tool-registry/ToolRegistry";

export function registerAllCapabilities(registry: ToolRegistry): void {
  for (const definition of CAPABILITY_CATALOG) {
    const descriptor = projectToolDescriptor(definition);
    const executor = resolveExecutor(definition);
    registry.register(descriptor, executor);

    if (definition.job) {
      registerJobCapability(definition.core.name, definition.job);
    }
  }
}
```

This replaces:
- All `register*Tools()` functions in `tool-bundles/`.
- The `TOOL_BUNDLE_REGISTRATIONS` array in `tool-composition-root-impl.ts`.
- Individual `registerJobCapability()` calls.

### Feature B: Build-Time Catalog Validation

Create `src/core/capability-catalog/catalog-validator.ts`:

```typescript
export interface CatalogValidationError {
  capability: string;
  field: string;
  message: string;
}

export function validateCatalog(catalog: CapabilityDefinition[]): CatalogValidationError[] {
  const errors: CatalogValidationError[] = [];
  const names = new Set<string>();

  for (const def of catalog) {
    // Duplicate name check
    if (names.has(def.core.name)) {
      errors.push({ capability: def.core.name, field: "core.name", message: "Duplicate capability name" });
    }
    names.add(def.core.name);

    // Deferred tool must have job facet
    if (def.runtime.executionMode === "deferred" && !def.job) {
      errors.push({ capability: def.core.name, field: "job", message: "Deferred tool missing job facet" });
    }

    // Executor binding must resolve to a known executor
    if (def.executorBinding && !resolverExists(def.executorBinding.executorId)) {
      errors.push({ capability: def.core.name, field: "executorBinding.executorId", message: "Unresolvable executor" });
    }

    // Schema must have at least one property
    if (Object.keys(def.schema.inputSchema.properties).length === 0) {
      errors.push({ capability: def.core.name, field: "schema", message: "Empty input schema" });
    }
  }

  return errors;
}
```

Run this in the test suite and/or as a build step:

```typescript
// catalog.test.ts
test("all catalog definitions are valid", () => {
  const errors = validateCatalog(CAPABILITY_CATALOG);
  expect(errors).toEqual([]);
});
```

### Feature C: Presentation Auto-Projection

The UI renderer registry (`ToolPluginContext.tsx`) currently falls back to `JobStatusFallbackCard` for unknown tools. Modify it to auto-derive a renderer from `definition.presentation.cardKind`:

```typescript
function autoResolveRenderer(cardKind: CapabilityCardKind): ToolComponent {
  switch (cardKind) {
    case "media": return MediaRenderCard;
    case "editorial": return EditorialWorkflowCard;
    case "audio": return AudioPlayerCard;
    case "chart": return ChartRendererCard;
    case "graph": return GraphRendererCard;
    default: return SystemJobCard;
  }
}
```

This eliminates the need for manual UI renderer registration for tools that use standard card types.

---

## Migration Path

Since this is greenfield:

1. Keep existing `register*Tools()` functions temporarily.
2. Implement `registerAllCapabilities()`.
3. Replace `tool-composition-root-impl.ts` to use auto-registration.
4. Delete individual bundle registration functions.
5. Add catalog validator to test suite.

---

## Files

| Action | File |
|---|---|
| **NEW** | `src/core/capability-catalog/catalog-auto-register.ts` |
| **NEW** | `src/core/capability-catalog/catalog-validator.ts` |
| **MODIFY** | `src/lib/chat/tool-composition-root-impl.ts` — replace manual bundles |
| **MODIFY** | `src/frameworks/ui/chat/registry/ToolPluginContext.tsx` — auto-resolve from cardKind |
| **DELETE** | Individual `register*Tools()` calls (after migration) |

---

## Test Cases

**Positive:**
- New capability added to catalog: auto-registered at runtime without touching any other file.
- Catalog validation catches missing `job` facet on a deferred tool.
- Catalog validation catches duplicate tool name.

**Negative:**
- Capability with `executionMode: "inline"` and no `job` facet: valid, no error.
- Capability with `cardKind: "custom"`: falls back to `SystemJobCard`, no error.

**Edge:**
- Capability with `roles: []` (empty array, not `"ALL"`): should the validator warn? Probably yes — a tool that nobody can execute is likely a mistake.

---

## Success Criteria

1. Adding a new tool requires exactly 2 files: the catalog definition and the executor implementation.
2. Missing a required facet produces a build-time error, not a silent runtime degradation.
3. The `TOOL_BUNDLE_REGISTRATIONS` array is deleted — registration is catalog-driven.
