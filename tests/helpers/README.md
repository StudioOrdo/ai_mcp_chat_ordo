# DEPRECATED — Use `src/__test-utils__/` instead

These helpers are being migrated to `src/__test-utils__/`.

**Do not add new helpers here.** Import from `@/__test-utils__` instead:

```typescript
import { createAdminUser, createRouteRequest, createGetSessionUserMock } from "@/__test-utils__";
```

Remaining helpers will be migrated or removed in Phase 3–6 of the test refactoring plan.
See `docs/_refactor/testing/test-refactoring-plan.md` for details.
