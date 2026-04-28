# Phase 5: Tame the 3,334-Line Monster

## Objective

Reduce `src/hooks/chat/useBrowserCapabilityRuntime.test.tsx` from **3,334 lines** to **~500 lines** by extracting fixture builders, consolidating variant tests with `it.each()`, and organizing with nested `describe()` blocks.

## Current State

```
Target file:     src/hooks/chat/useBrowserCapabilityRuntime.test.tsx (3,334 lines)
Hook under test: src/hooks/chat/useBrowserCapabilityRuntime.ts (69 lines)
Core runtime:    src/hooks/chat/browserCapabilityRuntimeCore.ts (849 lines)
Test cases:      31 it() blocks across 4 domains (chart, graph, audio, compose_media)
```

## Strategy

1. **5A**: Extract browser capability test helpers
2. **5B**: Consolidate chart/graph pairs with `it.each()`
3. **5C**: Consolidate compose_media variants with `it.each()`
4. **5D**: Apply fixture builders to all remaining tests
5. **5E**: Organize with nested `describe()` blocks

## Acceptance Criteria

| # | Criterion | How to Verify |
|---|---|---|
| 1 | Test file under 600 lines | `wc -l` |
| 2 | All 31 original behaviors covered | Same test count via `npx vitest run` |
| 3 | Fixture builders in `@/__test-utils__` | Barrel export check |
| 4 | Full suite passes | `npx vitest run` |
| 5 | No production code changed | Only test files + `@/__test-utils__/` |
