# Phase 1: Shared Test Infrastructure

## Objective

Consolidate fragmented test helpers into a single, well-typed `src/__test-utils__/` module that every test file in the codebase can import. Absorb the existing `tests/helpers/` fixtures, add the missing high-volume helpers (auth, repository factory, NextRequest), and prove the approach by migrating 3 representative test files.

## Current State (Research Findings)

### What Exists Today

There are **10 helper files** in `tests/helpers/` that only **15 test files** import:

| File | What It Provides | Used By |
|---|---|---|
| `workflow-route-fixture.ts` | `createAdminSessionUser()`, `createAuthenticatedSessionUser()`, `createAnonymousSessionUser()`, `createStaffSessionUser()`, `createRouteRequest()`, `createRouteParams()` | 9 files |
| `repository-fixture.ts` | `createDealRecordRepositoryMock()`, `createTrainingPathRecordRepositoryMock()`, `createConsultationRequestRepositoryMock()`, `createLeadRecordRepositoryMock()`, `createConversationEventRecorderMock()` | 2 files |
| `conversation-interactor-fixture.ts` | `createConversationInteractorMock()` | 1 file |
| `request.ts` | `createJsonRequest()` | unknown |
| `chat-stream-route-fixture.ts` | Stream route test setup | 2 files |
| `conversation-route-fixture.ts` | Conversation route test setup | unknown |
| `provider-boundary-harness.ts` | Provider boundary test setup | 2 files |
| `role-tool-sets.ts` | Role-to-tool mapping | unknown |
| `homepageEvalHarness.ts` | Homepage eval test setup | unknown |
| `customerWorkflowEvalHarness.ts` | Customer workflow eval test setup | unknown |

Meanwhile, the **top 3 mock patterns** that consume the most lines have **zero shared helpers:**

| Mock Target | Copies | Lines Wasted |
|---|---|---|
| `vi.mock("@/lib/auth")` | 42 files | ~210 lines (5 lines × 42) |
| `vi.mock("@/adapters/RepositoryFactory")` | 35 files | ~350 lines (10 lines × 35) |
| `vi.mock("@/lib/chat/conversation-root")` | 25 files | ~125 lines (5 lines × 25) |

### The `User` Type (Source of Truth)

From [src/core/entities/user.ts](file:///Users/kwilliams/Projects/ordoSite/src/core/entities/user.ts):

```typescript
export type RoleName = "ANONYMOUS" | "AUTHENTICATED" | "APPRENTICE" | "STAFF" | "ADMIN";
export type UserTier = "account" | "premium";

export interface User {
  id: string;
  email: string;
  name: string;
  roles: RoleName[];
  tier?: UserTier;
}
```

`SessionUser` is re-exported from `@/lib/auth` as `type SessionUser = User`.

### The `RepositoryFactory` Shape (All 25 Exports)

From [src/adapters/RepositoryFactory.ts](file:///Users/kwilliams/Projects/ordoSite/src/adapters/RepositoryFactory.ts):

```
getCorpusRepository()          getBlogPostRepository()
getBlogAssetRepository()       getBlogPostArtifactRepository()
getBlogPostRevisionRepository() getJournalEditorialMutationRepository()
getJobQueueRepository()        getJobQueueDataMapper()
getJobStatusQuery()            getPushSubscriptionRepository()
getUserDataMapper()            getLeadRecordDataMapper()
getConsultationRequestDataMapper() getDealRecordDataMapper()
getTrainingPathRecordDataMapper() getSystemPromptDataMapper()
getConversationDataMapper()    getMessageDataMapper()
getConversationEventDataMapper() getPromptProvenanceDataMapper()
getUserPreferencesDataMapper() getSystemSettingsDataMapper()
getUserFileDataMapper()        getVectorStore()
```

Tests mock a **subset** of these per file. The mock only needs to provide the getter functions the test's production code calls.

### Mock Patterns by Frequency

Tests construct user fixtures inline in these shapes (all identical across files):

```typescript
// Admin (most common)
{ id: "admin_1", email: "admin@example.com", name: "Admin", roles: ["ADMIN"] }

// Authenticated
{ id: "usr_1", email: "user@example.com", name: "User", roles: ["AUTHENTICATED"] }

// Anonymous
{ id: "anon_1", email: "anon@example.com", name: "Anon", roles: ["ANONYMOUS"] }

// Staff
{ id: "staff_1", email: "staff@example.com", name: "Staff", roles: ["STAFF"] }
```

These are byte-for-byte identical to what `tests/helpers/workflow-route-fixture.ts` already provides — but only 9 of 42 auth-mocking files use it.

### Path Alias Configuration

Current state:
- `tsconfig.json` has `"@/*": ["./src/*"]`
- `vitest.config.ts` has `"@": path.resolve(__dirname, "./src")`
- No alias for `tests/` or `__test-utils__`

This means `tests/helpers/` imports use ugly relative paths like `../../../../../tests/helpers/workflow-route-fixture`.

---

## Implementation Checklist

### Step 1.1: Create directory structure

```
src/__test-utils__/
├── index.ts              # barrel export
├── fixtures.ts           # entity builders (users, conversations, blog posts, jobs)
├── mock-auth.ts          # auth mock helpers
├── mock-repositories.ts  # RepositoryFactory mock builder
├── request-helpers.ts    # NextRequest construction
└── conversation-helpers.ts # conversation interactor + route service mocks
```

**Evidence gate:** `ls src/__test-utils__/` shows all 6 files.

---

### Step 1.2: Create `fixtures.ts` — Entity Builders

Absorb `tests/helpers/workflow-route-fixture.ts` user builders and add new builders.

Must provide:
- `createMockUser(role?: RoleName, overrides?: Partial<User>): User`
  - Convenience wrappers: `createAdminUser()`, `createAuthenticatedUser()`, `createAnonymousUser()`, `createStaffUser()`, `createApprenticeUser()`
  - These replace the 4 functions already in `workflow-route-fixture.ts` AND the 42 inline constructions

The function signatures must accept `Partial<User>` (not `Record<string, unknown>`) for type safety — the existing helpers use the untyped `Record<string, unknown>`.

**Evidence gate:**
```typescript
import { createAdminUser } from "@/__test-utils__";
const user = createAdminUser({ id: "custom_id" });
// user.id === "custom_id"
// user.roles === ["ADMIN"]
// user.email === "admin@example.com"
```

**Deterministic test:**
```typescript
it("createMockUser defaults to AUTHENTICATED with all required fields", () => {
  const user = createMockUser();
  expect(user.id).toBe("usr_test");
  expect(user.email).toBe("test@example.com");
  expect(user.name).toBe("Test User");
  expect(user.roles).toEqual(["AUTHENTICATED"]);
});

it("createAdminUser returns ADMIN role", () => {
  const user = createAdminUser();
  expect(user.roles).toEqual(["ADMIN"]);
});

it("overrides merge correctly without clobbering defaults", () => {
  const user = createMockUser("STAFF", { id: "custom" });
  expect(user.id).toBe("custom");
  expect(user.roles).toEqual(["STAFF"]);
  expect(user.email).toBe("test@example.com"); // default preserved
});
```

---

### Step 1.3: Create `mock-auth.ts` — Auth Mock Factory

The auth mock has a specific constraint: `vi.mock()` calls are **hoisted** by vitest. This means the actual `vi.mock("@/lib/auth", ...)` call must stay in each test file — it cannot be extracted into a helper function.

What CAN be extracted:
- The `getSessionUserMock` construction
- The default user shape
- A helper that configures the mock return value

```typescript
/**
 * Create a pre-configured getSessionUser mock function.
 * Usage in test files:
 *
 *   const getSessionUserMock = createGetSessionUserMock("ADMIN");
 *   vi.mock("@/lib/auth", () => ({ getSessionUser: getSessionUserMock }));
 */
export function createGetSessionUserMock(role: RoleName = "ADMIN") {
  return vi.fn().mockResolvedValue(createMockUser(role));
}
```

**Evidence gate:** A test file that currently has 5 lines of auth mock setup reduces to 2 lines.

**Deterministic test:**
```typescript
it("createGetSessionUserMock returns a vi.fn resolved with the correct role", async () => {
  const mock = createGetSessionUserMock("STAFF");
  const user = await mock();
  expect(user.roles).toEqual(["STAFF"]);
});
```

---

### Step 1.4: Create `request-helpers.ts` — NextRequest Construction

Absorb `tests/helpers/workflow-route-fixture.ts` request builders and `tests/helpers/request.ts`.

Must provide:
- `createRouteRequest(url, method?, body?, headers?): NextRequest`
- `createRouteParams(id): { params: Promise<{ id: string }> }`
- `createJsonRequest(url, payload): Request` (the old `Request`-based version for backward compat)

These are already defined in `workflow-route-fixture.ts`. Move them here with better typing.

**Evidence gate:**
```typescript
const req = createRouteRequest("/api/test", "POST", { key: "value" });
expect(req.method).toBe("POST");
const body = await req.json();
expect(body.key).toBe("value");
```

**Deterministic test:**
```typescript
it("createRouteRequest defaults to GET", () => {
  const req = createRouteRequest("/api/test");
  expect(req.method).toBe("GET");
});

it("createRouteRequest serializes JSON body for POST", async () => {
  const req = createRouteRequest("/api/test", "POST", { name: "test" });
  const body = await req.json();
  expect(body).toEqual({ name: "test" });
});

it("createRouteParams wraps id in a Promise", async () => {
  const params = createRouteParams("abc_123");
  const resolved = await params.params;
  expect(resolved.id).toBe("abc_123");
});
```

---

### Step 1.5: Create `conversation-helpers.ts` — Conversation Mock Factories

Absorb `tests/helpers/conversation-interactor-fixture.ts` and add the conversation-root service mock.

Must provide:
- `createConversationInteractorMock(overrides?)` — already exists, move + type properly
- `createConversationRuntimeServicesMock(overrides?)` — for the `createConversationRuntimeServices` mock used in chat stream tests

**Evidence gate:** Typed interactor mock with auto-completing method names.

---

### Step 1.6: Create `mock-repositories.ts` — RepositoryFactory Mock Builder

This is the most complex helper because 35 files mock different subsets.

Design principle: provide a **full factory** with all 25 getter functions returning `vi.fn()` stubs by default. Tests override only the methods they care about.

```typescript
export function createMockRepositoryFactory(overrides?: {
  getBlogPostRepository?: () => Record<string, unknown>;
  getJobQueueRepository?: () => Record<string, unknown>;
  // ... all 25 getters
}): Record<string, () => Record<string, unknown>> {
  return {
    getBlogPostRepository: overrides?.getBlogPostRepository ?? (() => ({
      findById: vi.fn(),
      listPublished: vi.fn().mockResolvedValue([]),
      listForAdmin: vi.fn().mockResolvedValue([]),
      countForAdmin: vi.fn().mockResolvedValue(0),
    })),
    getJobQueueRepository: overrides?.getJobQueueRepository ?? (() => ({
      createJob: vi.fn(),
      appendEvent: vi.fn(),
    })),
    // ... all other repos with safe empty defaults
  };
}
```

**Important constraint:** We do NOT need to mock all 25 repos in the initial version. Research the 35 test files to find which repos are actually mocked, and only include those. The rest can return `() => ({})`.

**Evidence gate:** A test that currently has 12 lines of RepositoryFactory mock reduces to 3-4 lines.

**Deterministic test:**
```typescript
it("createMockRepositoryFactory provides safe defaults for all common repos", () => {
  const factory = createMockRepositoryFactory();
  expect(factory.getBlogPostRepository).toBeDefined();
  expect(factory.getJobQueueRepository).toBeDefined();
  const blogRepo = factory.getBlogPostRepository();
  expect(blogRepo.listPublished).toBeDefined();
});

it("overrides replace the default getter", () => {
  const customFindById = vi.fn().mockResolvedValue({ id: "post_1" });
  const factory = createMockRepositoryFactory({
    getBlogPostRepository: () => ({ findById: customFindById }),
  });
  expect(factory.getBlogPostRepository().findById).toBe(customFindById);
});
```

---

### Step 1.7: Create `index.ts` — Barrel Export

```typescript
export * from "./fixtures";
export * from "./mock-auth";
export * from "./request-helpers";
export * from "./conversation-helpers";
export * from "./mock-repositories";
```

**Evidence gate:** `import { createAdminUser, createRouteRequest, createGetSessionUserMock } from "@/__test-utils__"` compiles.

---

### Step 1.8: Register path alias

Add `@/__test-utils__` alias to both `vitest.config.ts` and `tsconfig.json`:

**vitest.config.ts:**
```typescript
alias: {
  "@": path.resolve(__dirname, "./src"),
  "@/__test-utils__": path.resolve(__dirname, "./src/__test-utils__"),
  // Note: this alias is technically redundant since @/* already maps to src/*
  // but making it explicit documents the convention
}
```

**tsconfig.json** — verify `"@/*": ["./src/*"]` already covers `@/__test-utils__/*`. If so, no change needed.

**Evidence gate:** `npx vitest run src/__test-utils__/__test-utils__.test.ts` passes.

---

### Step 1.9: Write self-test for the helpers

Create `src/__test-utils__/__test-utils__.test.ts` with all the deterministic tests listed above. This file proves the helpers work before any migration begins.

**Evidence gate:** All tests in this file pass.

---

### Step 1.10: Migrate 3 proof-of-concept files

Pick 3 files that represent the 3 main patterns:

1. **API route test with auth + repo factory mock** — pick a small one under 100 lines
   - Candidate: `src/app/api/profile/route.test.ts` (67 lines, already imports from `tests/helpers/`)
   
2. **Page test with auth mock + user fixture** — pick one from `src/app/`
   - Candidate: `src/app/admin/journal/page.test.tsx` (uses auth + repo factory + 3 inline user shapes)
   
3. **Library test with no auth** — pick one from `src/core/` or `src/lib/` that constructs entity fixtures inline
   - Candidate: A use-case test that builds mock documents/sections

For each migration:
1. Replace inline user construction with `createMockUser()` / `createAdminUser()`
2. Replace inline `vi.mock("@/lib/auth")` body with `createGetSessionUserMock()`
3. Replace inline RepositoryFactory mock with `createMockRepositoryFactory()`
4. Replace inline request construction with `createRouteRequest()`
5. Run the individual test file
6. Count lines before and after

**Evidence gate:**
- All 3 migrated files pass
- Each file has a measurable line reduction (record before/after)
- Full suite still passes (no regressions from the new helpers)

---

### Step 1.11: Deprecate `tests/helpers/`

Add a `README.md` to `tests/helpers/` explaining:
```markdown
# DEPRECATED — Use src/__test-utils__/ instead

These helpers are being migrated to src/__test-utils__/.
Do not add new helpers here. Import from @/__test-utils__ instead.

Remaining helpers will be migrated or removed in Phase 3-6.
```

Do NOT delete the old helpers yet — other files still import them. They'll be migrated in later phases.

**Evidence gate:** `tests/helpers/README.md` exists.

---

## Acceptance Criteria (All Must Pass)

| # | Criterion | How to Verify |
|---|---|---|
| 1 | `src/__test-utils__/` exists with 6 files + 1 test file | `ls src/__test-utils__/` shows 7 files |
| 2 | Self-test passes | `npx vitest run src/__test-utils__/__test-utils__.test.ts` — 0 failures |
| 3 | `createMockUser()` returns typed `User` with all required fields | Covered by self-test |
| 4 | Role-specific user factories match the shapes from `tests/helpers/workflow-route-fixture.ts` | Covered by self-test |
| 5 | `createGetSessionUserMock()` returns a `vi.fn()` that resolves to a `User` | Covered by self-test |
| 6 | `createRouteRequest()` builds valid `NextRequest` with method+body | Covered by self-test |
| 7 | `createMockRepositoryFactory()` returns a factory covering all repos used in tests | Covered by self-test |
| 8 | 3 proof-of-concept files migrated and passing | `npx vitest run <file1> <file2> <file3>` — 0 failures |
| 9 | Full test suite passes with same count as before | `npx vitest run` — pass count ≥ 4495 |
| 10 | `tests/helpers/README.md` deprecation notice exists | `cat tests/helpers/README.md` |
| 11 | No new `tests/helpers/` files created | Verified by convention |

## Estimated Scope

- **New files:** 7 (6 helpers + 1 self-test)
- **Modified files:** 3 (proof-of-concept migrations)
- **Deprecated files:** 0 (just a README added)
- **Net line change:** +~250 (new infra), -~30 (migrations) = +~220 net
- **Time:** This is foundation work. The payoff comes in Phases 3-6 when these helpers are applied at scale.
