# Phase 3: Deduplicate Auth & Navigation Mocks

## Objective

Migrate all 49 remaining test files from inline user construction and `tests/helpers/` imports to `@/__test-utils__`. This eliminates the ugly relative paths (`../../../../../../tests/helpers/...`) and consolidates all shared test infrastructure into one canonical location.

## Current State (Post Phase 2)

```
Full suite: 579/579 files, 4540/4540 tests, 0 failures
Files already migrated to @/__test-utils__: 3
Files using tests/helpers/ (need import swap): 22
Files with inline user construction (need full migration): 27
Total files with auth mock: 52
Total files with nav mock: 46
```

## Migration Strategy

Phase 3 is split into 3 sub-phases to keep each commit small and independently verifiable:

1. **3A**: Bucket B — swap `tests/helpers/` imports to `@/__test-utils__` (22 files, import-only changes)
2. **3B**: Bucket A — replace inline user constructions with `@/__test-utils__` helpers (27 files, inline → helper)
3. **3C**: Verify old helpers have zero consumers, mark fully deprecated

---

## Sub-Phase 3A: Swap `tests/helpers/` Imports (22 files)

### Function Name Mapping

| Old Name (tests/helpers/) | New Name (@/__test-utils__) |
|---|---|
| `createAdminSessionUser` | `createAdminUser` |
| `createAuthenticatedSessionUser` | `createAuthenticatedUser` |
| `createAnonymousSessionUser` | `createAnonymousUser` |
| `createStaffSessionUser` | `createStaffUser` |
| `createRouteRequest` | `createRouteRequest` (same) |
| `createRouteParams` | `createRouteParams` (same) |
| `createConsultationRequestRepositoryMock` | Already in `@/__test-utils__/mock-repositories` via factory |
| `createLeadRecordRepositoryMock` | Already in `@/__test-utils__/mock-repositories` via factory |
| `createDealRecordRepositoryMock` | Already in `@/__test-utils__/mock-repositories` via factory |
| `createTrainingPathRecordRepositoryMock` | Already in `@/__test-utils__/mock-repositories` via factory |
| `createConversationEventRecorderMock` | Already in `@/__test-utils__/mock-repositories` via factory |

### Pre-requisite: Add Missing Helpers to `@/__test-utils__`

Before swapping imports, we need to add helpers that exist in `tests/helpers/` but NOT yet in `@/__test-utils__`:

#### 1. `tests/helpers/conversation-route-fixture.ts` exports (used by 6 files)

These need to be absorbed into `@/__test-utils__/conversation-helpers.ts`:

```typescript
// Already provided by @/__test-utils__:
// - createConversationInteractorMock (similar to createConversationRouteServicesMock)

// Need to add:
export function createConversationRouteServicesMock(overrides?) { ... }
export function createActiveConversationResult(overrides?) { ... }
export function createConversationRouteRequest(path, method?, includeSession?, body?) { ... }
export function createConversationRouteParams(id) { ... }
export function createValidatedSessionUser(overrides?) { ... }
export const TEST_SESSION_TOKEN = "test-session-token";
```

#### 2. `tests/helpers/repository-fixture.ts` individual mocks (used by 5 files)

These files import `createDealRecordRepositoryMock`, `createConsultationRequestRepositoryMock`, etc. individually. Our `createMockRepositoryFactory` provides them as getters on a factory object, which is a different API shape.

**Decision**: Add these individual mock creators as re-exports from `@/__test-utils__/mock-repositories.ts`:

```typescript
export function createDealRecordRepositoryMock(overrides?) { ... }
export function createTrainingPathRecordRepositoryMock(overrides?) { ... }
export function createConsultationRequestRepositoryMock(overrides?) { ... }
export function createLeadRecordRepositoryMock(overrides?) { ... }
export function createConversationEventRecorderMock(overrides?) { ... }
```

### File List (22 files)

Each file needs:
1. Replace `from "../../tests/helpers/workflow-route-fixture"` → `from "@/__test-utils__"`
2. Replace `from "../../tests/helpers/repository-fixture"` → `from "@/__test-utils__"`
3. Replace `from "../../tests/helpers/conversation-route-fixture"` → `from "@/__test-utils__"`
4. Rename old function calls: `createAdminSessionUser` → `createAdminUser`, etc.

| # | File | Old Import Source | Functions Used |
|---|---|---|---|
| 1 | `src/app/api/chat/stream/route.test.ts` | workflow-route-fixture | createRouteRequest |
| 2 | `src/app/api/chat/jobs/route.test.ts` | workflow-route-fixture | createAuthenticatedSessionUser, createRouteRequest, createRouteParams |
| 3 | `src/app/api/consultation-requests/route.test.ts` | workflow-route-fixture | createAuthenticatedSessionUser, createRouteRequest |
| 4 | `src/app/api/consultation-requests/[id]/route.test.ts` | workflow-route-fixture, repository-fixture | createAuthenticatedSessionUser, createRouteRequest, createRouteParams, createConsultationRequestRepositoryMock |
| 5 | `src/app/api/admin/leads/[leadId]/triage/route.test.ts` | workflow-route-fixture | createAdminSessionUser, createRouteRequest |
| 6 | `src/app/api/admin/blog/posts/[postId]/artifacts/route.test.ts` | workflow-route-fixture | createAuthenticatedSessionUser |
| 7 | `src/app/api/admin/blog/posts/[postId]/hero-images/route.test.ts` | workflow-route-fixture | createAuthenticatedSessionUser |
| 8 | `src/app/api/admin/routing-review/route.test.ts` | workflow-route-fixture | createAdminSessionUser, createRouteRequest |
| 9 | `src/app/api/deals/route.test.ts` | workflow-route-fixture | createAuthenticatedSessionUser, createRouteRequest |
| 10 | `src/app/api/deals/[id]/response/route.test.ts` | workflow-route-fixture, repository-fixture | createAuthenticatedSessionUser, createDealRecordRepositoryMock |
| 11 | `src/app/api/deals/[id]/route.test.ts` | workflow-route-fixture, repository-fixture | createAuthenticatedSessionUser, createRouteParams, createDealRecordRepositoryMock |
| 12 | `src/app/api/conversations/route.test.ts` | conversation-route-fixture | createConversationRouteServicesMock, etc. |
| 13 | `src/app/api/conversations/[id]/route.test.ts` | conversation-route-fixture | createConversationRouteServicesMock, etc. |
| 14 | `src/app/api/conversations/[id]/restore/route.test.ts` | conversation-route-fixture | createConversationRouteServicesMock, etc. |
| 15 | `src/app/api/web-search/route.test.ts` | workflow-route-fixture | createAuthenticatedSessionUser, createStaffSessionUser, createRouteRequest |
| 16 | `src/app/api/training-paths/route.test.ts` | workflow-route-fixture | createAuthenticatedSessionUser, createRouteRequest |
| 17 | `src/app/api/training-paths/[id]/route.test.ts` | workflow-route-fixture, repository-fixture | createAuthenticatedSessionUser, createRouteParams, createTrainingPathRecordRepositoryMock |
| 18 | `src/app/api/jobs/route.test.ts` | workflow-route-fixture | createAuthenticatedSessionUser, createRouteRequest |
| 19 | `src/app/api/jobs/[jobId]/route.test.ts` | workflow-route-fixture | createAuthenticatedSessionUser, createRouteRequest, createRouteParams |
| 20 | `src/app/api/jobs/[jobId]/events/route.test.ts` | workflow-route-fixture | createAuthenticatedSessionUser, createRouteParams |
| 21 | `src/app/api/jobs/events/route.test.ts` | workflow-route-fixture | createAuthenticatedSessionUser, createRouteRequest |
| 22 | `src/app/api/notifications/push/route.test.ts` | workflow-route-fixture | createAuthenticatedSessionUser, createRouteRequest |

---

## Sub-Phase 3B: Replace Inline User Constructions (27 files)

Each file constructs user objects inline like:
```typescript
getSessionUserMock.mockResolvedValue({
  id: "usr_admin", email: "admin@example.com", name: "Admin", roles: ["ADMIN"]
});
```

Replace with:
```typescript
getSessionUserMock.mockResolvedValue(createAdminUser());
```

### File List with Inline Mock Call Counts

| # | File | Inline Calls | Notes |
|---|---|---|---|
| 1 | `src/app/referrals/page.test.tsx` | 5 | |
| 2 | `src/app/referrals/actions.test.ts` | 5 | |
| 3 | `src/app/admin/journal/page.test.tsx` | 15 | Heavy — also has RepositoryFactory mock |
| 4 | `src/app/admin/journal/preview/[slug]/page.test.tsx` | 11 | |
| 5 | `src/app/admin/journal/[id]/page.test.tsx` | 13 | |
| 6 | `src/app/profile/page.test.tsx` | 3 | |
| 7 | `src/app/my/media/page.test.tsx` | 3 | |
| 8 | `src/app/api/runtime/generate-audio/route.test.ts` | 2 | |
| 9 | `src/app/api/admin/jobs/[jobId]/export/route.test.ts` | 6 | |
| 10 | `src/app/api/lifecycle/context/route.test.ts` | 6 | |
| 11 | `src/app/api/user-files/[id]/route.test.ts` | 10 | |
| 12 | `src/app/api/tts/route.test.ts` | 7 | |
| 13 | `src/app/api/campaign/context/route.test.ts` | 6 | |
| 14 | `src/app/api/notifications/feed/route.test.ts` | 8 | |
| 15 | `src/app/jobs/page.test.tsx` | 3 | |
| 16 | `src/lib/journal/admin-journal.test.ts` | 7 | |
| 17 | `src/lib/operations/operations-access.test.ts` | 4 | |
| 18 | `tests/dev-role-switch-guard.test.ts` | 9 | |
| 19 | `tests/stream-pipeline.test.ts` | 4 | |
| 20 | `tests/chat/chat-route.test.ts` | 2 | |
| 21 | `tests/chat/chat-stream-route.test.ts` | 43 | **Heaviest file** — 43 mock calls |
| 22 | `tests/chat/chat-stream-route.prompt-runtime-seam.test.ts` | 4 | |
| 23 | `tests/homepage-shell-evals.test.tsx` | 1 | |
| 24 | `tests/tts-route-hardening.test.ts` | 3 | |
| 25 | `tests/global-search-actions.test.ts` | 2 | |
| 26 | `tests/blog-assets-route.test.ts` | 16 | Also uses tests/helpers/ |
| 27 | `tests/homepage-shell-layout.test.tsx` | 1 | |

**Total inline constructions to replace: ~198**

---

## Sub-Phase 3C: Verify and Finalize

1. Run stale import scan: `grep -r "tests/helpers/" src/ tests/ --include="*.test.ts" --include="*.test.tsx"` → should return 0 results (or only non-auth imports that belong to later phases)
2. Run full suite: 0 failures
3. Update `tests/helpers/README.md` with remaining consumer count

---

## Implementation Procedure (Per File)

For each file in the migration list:

1. **Add import**: `import { createAdminUser, createAuthenticatedUser, ... } from "@/__test-utils__";`
2. **Remove old import**: Delete the `from "../../tests/helpers/..."` line
3. **Find-replace function names**: `createAdminSessionUser` → `createAdminUser`, etc.
4. **Replace inline objects**: `{ id: "...", email: "...", name: "...", roles: ["ADMIN"] }` → `createAdminUser({ id: "..." })`
5. **Run the file's tests**: `npx vitest run <file>` — must pass
6. **Move to next file**

### Pattern Recognition Rules

When replacing inline user objects, match by the `roles` array:

| Inline `roles` value | Replacement |
|---|---|
| `["ADMIN"]` | `createAdminUser()` |
| `["AUTHENTICATED"]` | `createAuthenticatedUser()` |
| `["ANONYMOUS"]` | `createAnonymousUser()` |
| `["STAFF"]` | `createStaffUser()` |
| `["APPRENTICE"]` | `createApprenticeUser()` |

When the inline object has a custom `id`, use: `createAdminUser({ id: "custom_id" })`.

When the inline object uses `mockResolvedValue(null)` → leave as-is (not a user fixture).

---

## Sub-Phase 3D: Remove Redundant Navigation Mocks (10 files)

`tests/setup.ts` already globally mocks `next/navigation` with default implementations:
- `useRouter` → `{ push: vi.fn(), replace: vi.fn(), back: vi.fn(), forward: vi.fn() }`
- `usePathname` → `"/"`
- `useSearchParams` → `new URLSearchParams()`
- `useParams` → `{}`

46 test files locally re-mock `next/navigation`. After classification:

### Redundant (safe to remove) — 10 files

These re-declare the exact same defaults as `tests/setup.ts`. Remove the local `vi.mock("next/navigation", ...)` block entirely.

| # | File |
|---|---|
| 1 | `src/components/AccountMenu.test.tsx` |
| 2 | `src/components/AppShell.test.tsx` |
| 3 | `src/components/ShellWorkspaceMenu.test.tsx` |
| 4 | `src/components/SiteNav.test.tsx` |
| 5 | `src/components/media/UserMediaWorkspace.test.tsx` |
| 6 | `src/frameworks/ui/ChatSurface.test.tsx` |
| 7 | `src/lib/admin/jobs/admin-jobs.test.ts` |
| 8 | `tests/browser-motion.test.tsx` |
| 9 | `tests/chat/chat-surface.test.tsx` |
| 10 | `tests/ux-auth-forms-accessibility.test.tsx` |

**Procedure per file:**
1. Delete the `vi.mock("next/navigation", ...)` block
2. Run the individual test file to verify it passes
3. If it fails → the test actually needed the local mock. Restore it and add a `// NOTE: local override — needs X` comment.

### Custom (must keep) — 36 files

These override `usePathname`, add `redirect` mocks, or capture `push` calls for assertion. They MUST keep their local `vi.mock`. No action required.

---

## Acceptance Criteria

| # | Criterion | How to Verify |
|---|---|---|
| 1 | All 22 Bucket B files import from `@/__test-utils__` | `grep -r "tests/helpers/workflow-route-fixture\|tests/helpers/repository-fixture" src/ --include="*.test.ts" --include="*.test.tsx"` → 0 results |
| 2 | All 27 Bucket A files use helpers instead of inline objects | `grep -c 'mockResolvedValue({' <file>` → only non-user mocks remain |
| 3 | Zero `createAdminSessionUser` calls remain | `grep -r "createAdminSessionUser\|createAuthenticatedSessionUser\|createAnonymousSessionUser\|createStaffSessionUser" src/ tests/ --include="*.test.ts" --include="*.test.tsx"` → 0 |
| 4 | conversation-route-fixture helpers absorbed into @/__test-utils__ | `grep -r "conversation-route-fixture" src/ tests/ --include="*.test.ts" --include="*.test.tsx"` → 0 |
| 5 | Individual repo mock creators available in @/__test-utils__ | Self-test covers `createDealRecordRepositoryMock`, etc. |
| 6 | 10 redundant nav mocks removed | `grep -c 'vi.mock("next/navigation"' <file>` → 0 for each of the 10 files |
| 7 | Full suite: 0 failures | `npx vitest run` → 579/579, 4540/4540 |
| 8 | No production code changed | Only test files + `@/__test-utils__/` modified |

## Estimated Scope

- **New/modified infra files**: 2-3 (add helpers to `@/__test-utils__/`)
- **Modified test files**: 59 (22 import swaps + 27 inline replacements + 10 nav mock removals)
- **Lines replaced**: ~400 (198 inline objects × ~2 lines each)
- **Lines deleted**: ~100 (10 redundant nav mock blocks × ~10 lines each)
- **Net line reduction**: ~300
- **Risk**: Low — all changes are import path swaps, user object construction replacements, and redundant mock removal

