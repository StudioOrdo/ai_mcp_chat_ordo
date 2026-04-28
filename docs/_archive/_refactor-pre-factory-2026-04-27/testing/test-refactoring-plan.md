# Test Suite Refactoring Plan

## Current State

354 test files. 64,211 lines. 2,292 test cases. 5,494 assertions. 178-second full run. 17 failures.

The suite was built incrementally by AI agents over 55 days. Each agent wrote self-contained test files with all mocks, fixtures, and setup inline. The result is comprehensive coverage with significant structural debt: no shared helpers, copy-pasted mock blocks, one 3,334-line outlier, and no way to run fast tests separately from slow ones.

The goal of this refactoring is not to rewrite the test suite. It is to extract the patterns that already exist, eliminate the duplication, fix the broken tests, and establish infrastructure so that every test written from this point forward is shorter, more consistent, and more strategic.

Each phase is designed to land independently and leave the suite in a passing state before the next phase begins.

---

## Phase 1: Shared Test Infrastructure

**Goal:** Create the foundation that every subsequent phase depends on.

**Why first:** Every other phase will either consume these helpers or produce new ones. Without this foundation, each subsequent phase re-creates the same boilerplate.

### 1.1 Create `src/__test-utils__/index.ts`

Barrel export file for all shared test utilities. Convention: every test file can `import { ... } from "@/__test-utils__"`.

### 1.2 Create `src/__test-utils__/mock-auth.ts`

Extract the auth mock pattern that appears in 42 files:

```typescript
// Current pattern (repeated 42 times):
const getSessionUserMock = vi.fn();
vi.mock("@/lib/auth", () => ({
  getSessionUser: getSessionUserMock,
}));

// New shared helper:
export function mockAuth(role: RoleName = "ADMIN") {
  const user = buildMockUser({ role });
  const getSessionUserMock = vi.fn().mockResolvedValue(user);
  return { getSessionUserMock, user };
}
```

The helper returns the mock function so tests can override per-case behavior. It does NOT call `vi.mock()` — each test file still declares its own `vi.mock("@/lib/auth")` because vitest hoists those calls. The helper just eliminates the object construction.

### 1.3 Create `src/__test-utils__/mock-repositories.ts`

Extract the RepositoryFactory mock pattern that appears in 35 files. Each file mocks a different subset of repository methods. The helper should provide a complete factory with sensible defaults that individual tests override:

```typescript
export function buildMockRepositoryFactory(
  overrides?: Partial<RepositoryFactoryMocks>
): RepositoryFactoryMocks {
  return {
    getBlogPostRepository: () => ({
      findById: vi.fn(),
      listPublished: vi.fn().mockResolvedValue([]),
      listForAdmin: vi.fn().mockResolvedValue([]),
      countForAdmin: vi.fn().mockResolvedValue(0),
      ...overrides?.getBlogPostRepository?.(),
    }),
    getJobQueueRepository: () => ({
      createJob: vi.fn(),
      appendEvent: vi.fn(),
      ...overrides?.getJobQueueRepository?.(),
    }),
    // ... all other repositories with safe defaults
  };
}
```

### 1.4 Create `src/__test-utils__/fixtures.ts`

Common entity shapes used across many test files:

```typescript
export function buildMockUser(overrides?: Partial<SessionUser>): SessionUser {
  return {
    id: "usr_test",
    email: "test@example.com",
    name: "Test User",
    role: "AUTHENTICATED",
    ...overrides,
  };
}

export function buildMockConversation(overrides?: Partial<Conversation>): Conversation { ... }
export function buildMockBlogPost(overrides?: Partial<BlogPost>): BlogPost { ... }
export function buildMockJob(overrides?: Partial<Job>): Job { ... }
```

### 1.5 Create `src/__test-utils__/request-helpers.ts`

NextRequest construction helpers used in the 42 API route tests:

```typescript
export function makeJsonRequest(
  url: string,
  method: string,
  body?: unknown,
  headers?: Record<string, string>
): NextRequest { ... }

export function makeGetRequest(
  url: string,
  params?: Record<string, string>
): NextRequest { ... }
```

### 1.6 Register the path alias

Add `@/__test-utils__` to `vitest.config.ts` aliases and `tsconfig.json` paths so imports resolve cleanly.

### Acceptance Criteria

- [ ] `src/__test-utils__/index.ts` exists and exports all helpers
- [ ] Path alias `@/__test-utils__` resolves in vitest
- [ ] All existing tests still pass (no regressions)
- [ ] At least 3 existing test files are migrated to use the new helpers as proof-of-concept
- [ ] Full suite runs, same pass count as before

---

## Phase 2: Fix Broken Tests

**Goal:** Get from 17 failures to 0 failures.

**Why second:** The shared infrastructure from Phase 1 makes it easier to update tests that need new fixture shapes. And we want a green baseline before doing any bulk refactoring.

### 2.1 Fix identity/prompt text mismatches (4 tests)

These tests hardcode old prompt text ("Bring me the messy workflow...", "All-in-One AI Workspace", etc.) that was replaced during the corpus/identity update.

Files:
- `tests/config-loader.test.ts` — hardcoded identity fallback text
- `tests/first-message-flow.test.tsx` — hardcoded first message defaults (3 cases)

Fix: Update expected strings to match the new Studio Ordo identity.

### 2.2 Fix corpus expectation tests (4 tests)

These tests assert that specific books (`operators-handbook`, `architecture-reference`) exist in `docs/_corpus/`. We archived those books.

File: `tests/phase-5-scope.test.ts`

Fix: Either update the assertions to check `docs/_corpus/_archive/` or delete these tests since they were scope-validation tests for a phase that is no longer the active target.

### 2.3 Fix bootstrap text tests (3 tests)

These tests in `useGlobalChat.test.tsx` assert old bootstrap messages for AUTHENTICATED and ADMIN roles.

Fix: Update expected bootstrap text to match `config/prompts.json`.

### 2.4 Fix hero/MessageList tests (3 tests)

These tests in `MessageList.test.tsx` assert old service chips and hero text.

Fix: Update expected strings. Consider whether these tests should read from config instead of hardcoding strings, so they don't break every time the marketing copy changes.

### 2.5 Investigate pre-existing failures (3 tests)

- `tests/chat/chat-job-actions-route.test.ts` — chat job cancellation
- `tests/evals/eval-runner.test.ts` — eval deterministic runner
- `src/lib/media/server/compose-media-plan-materialization.test.ts` — Mermaid materialization

These appear to be pre-existing failures unrelated to our changes. Investigate root cause and fix or skip with documentation.

### Acceptance Criteria

- [ ] Full suite: 0 failures
- [ ] No tests skipped without a documented reason
- [ ] Any newly skipped tests have a `// TODO:` explaining the root cause

---

## Phase 3: Deduplicate Auth and Navigation Mocks

**Goal:** Replace the 42 copy-pasted auth mocks and remove the 24 redundant navigation mocks.

**Why third:** This is the highest-volume DRY violation. After Phase 1 provides the helpers, this phase applies them at scale.

### 3.1 Remove redundant `next/navigation` mocks (24 files)

`tests/setup.ts` already mocks `next/navigation` globally. 24 test files mock it again locally. Delete the local mocks.

For each file:
1. Remove the `vi.mock("next/navigation", ...)` block
2. Run the individual test file to confirm it still passes
3. If a test needs a non-default router mock (e.g., custom pathname), keep the local mock but add a comment explaining why

### 3.2 Migrate auth mocks to shared helper (42 files)

For each file that has `vi.mock("@/lib/auth", ...)`:
1. Import `buildMockUser` from `@/__test-utils__`
2. Replace the inline user construction with `buildMockUser({ role: "ADMIN" })`
3. Keep the `vi.mock()` call (it must stay in each file for hoisting) but simplify it to use the shared factory
4. Run the individual test file

### 3.3 Migrate conversation-root mocks (25 files)

Same pattern for the `@/lib/chat/conversation-root` mock.

### Acceptance Criteria

- [ ] No test file contains a `vi.mock("next/navigation")` unless it needs a non-default configuration (documented)
- [ ] All 42 auth mock sites use `buildMockUser()` from shared helpers
- [ ] Full suite: 0 failures
- [ ] Net line reduction: ~800–1,200 lines

---

## Phase 4: API Route Test Harness

**Goal:** Extract the common boilerplate from 42 API route tests into a reusable harness.

**Why fourth:** The route tests are the most uniform group. After Phase 3 handles auth mocks, the remaining boilerplate is request construction and response assertion.

### 4.1 Create `src/__test-utils__/route-harness.ts`

```typescript
export interface RouteTestContext {
  makeRequest: (method: string, body?: unknown, params?: Record<string, string>) => NextRequest;
  mockUser: (role?: RoleName) => void;
  expectJson: (response: Response, status: number, bodyMatcher?: (body: unknown) => void) => Promise<void>;
  expectError: (response: Response, status: number, message?: string) => Promise<void>;
}

export function createRouteTestContext(basePath: string): RouteTestContext { ... }
```

### 4.2 Migrate small route tests first (16 files under 100 lines)

Start with the simplest files to validate the harness pattern. These tests typically have 3-5 test cases each.

### 4.3 Migrate medium route tests (15 files, 100-200 lines)

Apply the harness to the mid-sized route tests.

### 4.4 Migrate large route tests (11 files, 200+ lines)

The largest route tests (auth, chat stream, chat jobs, uploads) may need additional helpers specific to their domain. Extract those too.

### Acceptance Criteria

- [ ] Route harness exists and is used by all 42 API route test files
- [ ] Each route test file focuses only on its unique assertions, not boilerplate
- [ ] Full suite: 0 failures
- [ ] Net line reduction: ~2,000–3,000 lines

---

## Phase 5: Tame the 3,334-Line Monster

**Goal:** Reduce `useBrowserCapabilityRuntime.test.tsx` from 3,334 lines to ~500 lines.

**Why fifth:** This is the single largest opportunity for line reduction, but it requires careful analysis of what the 31 test cases actually cover and which are redundant.

### 5.1 Audit the 31 test cases

Categorize each `it()` block:
- **Unique behavior:** Tests a distinct code path in the 69-line hook
- **Variant:** Tests the same code path with a slightly different input
- **Redundant:** Tests something already covered by another case

### 5.2 Extract browser capability test helpers

The test file likely constructs complex FFmpeg worker messages, MediaStream mocks, and capability registry shapes repeatedly. Extract:

```typescript
// src/__test-utils__/browser-capability-helpers.ts
export function buildFFmpegMessage(type: string, data?: unknown): MessageEvent { ... }
export function buildMockCapabilityRegistry(): CapabilityRegistry { ... }
export function renderBrowserCapabilityHook(overrides?: Partial<HookOptions>) { ... }
```

### 5.3 Consolidate redundant test cases

Replace multiple similar `it()` blocks with parameterized tests using `it.each()`:

```typescript
it.each([
  ["compose_video", "ffmpeg", expectedResult1],
  ["generate_chart", "canvas", expectedResult2],
  ["render_diagram", "mermaid", expectedResult3],
])("dispatches %s to %s runtime", async (capability, runtime, expected) => {
  // single test body handles all variants
});
```

### 5.4 Separate registry tests from hook tests

If the hook delegates to a capability registry, test the registry as a pure unit (no React, no JSDOM) and test the hook integration with only a few cases.

### Acceptance Criteria

- [ ] `useBrowserCapabilityRuntime.test.tsx` is under 600 lines
- [ ] All original behaviors are still covered (no reduced coverage)
- [ ] Any extracted capability tests pass independently
- [ ] Full suite: 0 failures

---

## Phase 6: Migrate Repository Factory Mocks

**Goal:** Replace the 35 hand-rolled RepositoryFactory mocks with the shared factory from Phase 1.

**Why sixth:** This is the second-highest volume DRY violation after auth mocks, but each mock site has a slightly different shape (different repos, different methods). Phase 1 established the factory; this phase applies it.

### 6.1 Catalog all RepositoryFactory mock shapes

Map each of the 35 files to which repositories and methods they mock:
- Which repos? (BlogPost, JobQueue, Conversation, UserFile, etc.)
- Which methods? (findById, listPublished, createJob, etc.)
- What return values?

### 6.2 Ensure the shared factory covers all shapes

Update `buildMockRepositoryFactory()` to include default mocks for every repository and method discovered in 6.1.

### 6.3 Migrate each file

For each of the 35 files:
1. Replace the inline RepositoryFactory mock with `buildMockRepositoryFactory({ ... overrides })`
2. Keep method-specific overrides inline in the test (e.g., `findById: vi.fn().mockResolvedValue(specificPost)`)
3. Run the individual test

### Acceptance Criteria

- [ ] All 35 RepositoryFactory mock sites use the shared factory
- [ ] Each test overrides only the methods it actually tests
- [ ] Full suite: 0 failures
- [ ] Net line reduction: ~1,000–1,500 lines

---

## Phase 7: Reduce Mock Density in Heavy-Mock Files

**Goal:** Refactor the 16 test files with 5+ `vi.mock()` calls to test more strategically.

**Why seventh:** Heavy mocking is a code smell. By this phase, shared helpers handle most common mocks. The remaining high-mock files likely indicate production code that should use dependency injection instead of module-level imports.

### 7.1 Identify the 16 files and their mock targets

For each file, list:
- What function/component is being tested
- What are the 5+ mocks
- How many of those mocks are exercised by assertions vs. just silencing import errors

### 7.2 Categorize mocks as "essential" vs. "structural"

- **Essential mock:** The test asserts something about how this dependency is called
- **Structural mock:** The mock exists only because the import graph pulls in the dependency, but the test never checks it

### 7.3 Refactor structural mocks

Options per case:
- **Move the mock to `tests/setup.ts`** if it's needed by many files (like the `next/navigation` pattern)
- **Refactor production code** to accept the dependency via injection instead of module import
- **Create an auto-mock** via vitest's `__mocks__/` directory convention for modules that are always mocked

### 7.4 Consider integration tests for heavily-integrated components

For components like `ChatSurface` or `useChatSurfaceState` that need 8 mocks, consider whether a few integration tests with real (but lightweight) dependencies would provide more confidence than many unit tests with heavy mocking.

### Acceptance Criteria

- [x] No test file has more than 4 `vi.mock()` calls
- [x] Any file that still needs 4+ mocks has a comment explaining why
- [x] Production code changes (if any) are reviewed separately
- [x] Full suite: 0 failures

---

## Phase 8: Test Grouping and Fast Feedback

**Goal:** Enable fast test runs for development and separate slow UI tests from fast domain logic tests by partitioning Vitest workspaces.

### 8.1 Categorize test files by speed tier

| Tier | Workspace Name | Target Coverage | Environment |
|---|---|---|---|
| **fast** | `unit` | `src/core/**/*.test.ts`, `src/adapters/**/*.test.ts` | Node |
| **medium** | `lib` | `src/lib/**/*.test.ts`, `mcp/**/*.test.ts` | Node |
| **integration** | `integration` | `tests/**/*.test.ts` | Node |
| **slow** | `ui` | `**/*.test.tsx`, `src/hooks`, `src/app`, `src/components`, `src/frameworks` | JSDOM |

### 8.2 Configure vitest workspaces

```typescript
// vitest.workspace.ts
import { defineWorkspace } from "vitest/config";
import path from "node:path";

const resolve = {
  alias: {
    "@": path.resolve(__dirname, "./src"),
    "@mcp": path.resolve(__dirname, "./mcp"),
  },
};

export default defineWorkspace([
  {
    extends: "./vitest.config.ts",
    resolve,
    test: {
      name: "unit",
      environment: "node",
      include: ["src/core/**/*.{test,spec}.ts", "src/adapters/**/*.{test,spec}.ts"],
    },
  },
  {
    extends: "./vitest.config.ts",
    resolve,
    test: {
      name: "lib",
      environment: "node",
      include: ["src/lib/**/*.{test,spec}.ts", "mcp/**/*.{test,spec}.ts"],
    },
  },
  {
    extends: "./vitest.config.ts",
    resolve,
    test: {
      name: "integration",
      environment: "node",
      include: ["tests/**/*.{test,spec}.ts"],
    },
  },
  {
    extends: "./vitest.config.ts",
    resolve,
    test: {
      name: "ui",
      environment: "jsdom",
      include: [
        "src/**/*.{test,spec}.tsx",
        "tests/**/*.{test,spec}.tsx",
        "src/app/**/*.{test,spec}.ts",
        "src/hooks/**/*.{test,spec}.ts",
        "src/components/**/*.{test,spec}.ts",
        "src/frameworks/**/*.{test,spec}.ts"
      ],
      setupFiles: ["./tests/setup-ui.ts"],
    },
  },
]);
```

### 8.3 Add npm scripts for fast feedback

```json
{
  "test": "vitest run",
  "test:unit": "vitest run src/core src/adapters",
  "test:lib": "vitest run src/lib mcp",
  "test:node": "vitest run src/core src/adapters src/lib mcp 'tests/**/*.test.ts'",
  "test:ui": "vitest run src/app src/hooks src/components src/frameworks 'tests/**/*.test.tsx'"
}
```

### 8.4 Verify that fast tests actually run fast

Target: `test:node` completes significantly faster than the legacy 150+ seconds monolithic test. This gives developers a tight feedback loop during backend data-layer development.

### Acceptance Criteria

- [x] `npm run test:node` runs all pure Node integration and unit tests without booting JSDOM
- [x] `npm run test:ui` runs all JSDOM-dependent component tests seamlessly
- [x] `npm run test` runs workspaces sequentially or natively parallelized
- [x] Full suite: 0 failures

---

## Phase 9: Strategic Test Deletion

**Goal:** Remove tests that provide false confidence or test implementation details rather than behavior.

**Why last:** This requires the most judgment and should only happen after the suite is clean, DRY, and well-organized. Deleting tests from a messy suite is risky. Deleting tests from a clean suite is strategic.

### 9.1 Identify pure-mock tests

Find tests where:
- Every dependency is mocked
- The only assertions check that mocks were called with expected args
- No real business logic executes

These tests prove that the code calls the right functions in the right order — which is useful during initial development but becomes fragile maintenance overhead. If the production code is refactored, these tests break even if the behavior is identical.

### 9.2 Identify trivial getter/setter tests

Tests that assert:
- A constructor sets a property
- A getter returns what was set
- A factory returns the right type

These tests add lines without adding confidence.

### 9.3 Identify duplicate-coverage tests

Tests that cover the same behavior tested elsewhere:
- A use-case test that checks the same thing as an API route test
- A hook test that checks the same thing as a component test
- Multiple test files that test the same function from different angles

### 9.4 Delete or consolidate

For each candidate:
- If the behavior is covered by a higher-value test elsewhere, delete
- If the test is the only coverage for a real behavior, keep it but simplify
- If two tests overlap, keep the one closer to the user-facing surface

### Acceptance Criteria

- [x] Audit document produced listing every deleted test and why (see `phase_9_implementation_plan.md`)
- [x] No real behavior lost (verify via coverage report)
- [x] Net line reduction: ~2,000–4,000 lines (Actual: 4,986 lines deleted)
- [x] Final suite size target: Base size reduced by net ~5,000 lines (Original baseline of 64k grew to ~104k organically before Phase 9; final suite size is ~99,100)
- [ ] Full suite: 0 failures (Note: Pre-existing stability regressions discovered; to be addressed in a dedicated stabilization pass)

---

## Summary

| Phase | Focus | Estimated Line Impact | Risk |
|---|---|---|---|
| 1 | Shared test infrastructure | +200 (new files) | Low |
| 2 | Fix 17 broken tests | ~100 changed | Low |
| 3 | Deduplicate auth/nav mocks | -800 to -1,200 | Low |
| 4 | API route test harness | -2,000 to -3,000 | Medium |
| 5 | Tame the 3,334-line monster | -2,800 | Medium |
| 6 | Repository factory migration | -1,000 to -1,500 | Low |
| 7 | Reduce heavy-mock files | -500 to -1,000 | Medium-High |
| 8 | Test grouping | ~50 changed | Low |
| 9 | Strategic deletion | -2,000 to -4,000 | High |

**Total estimated reduction: ~9,000–14,000 lines** while maintaining or improving actual behavioral coverage.

Each phase lands independently. Research the code at the start of each phase based on the landed state from the previous phase. Do not plan the implementation details of Phase N+1 until Phase N is green.
