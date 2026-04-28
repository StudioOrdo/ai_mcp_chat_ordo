# Phase 4: API Route Test Harness

## Objective

Extract common boilerplate from 42 API route tests into a reusable harness, creating a `expectStatus` + `expectJson` assertion layer and a generalized `createRouteParams` helper. The goal is consistent, DRY route tests that focus on _what_ each route does, not _how_ to call it.

## Current State (Post Phase 3)

```
Full suite: 579/579 files, 4540/4540 tests, 0 failures
API route test files: 42 (in src/app/api/)
Already importing @/__test-utils__: 36
Not yet importing @/__test-utils__: 6
Total response.json() calls: 98
Total response.status assertions: 160
Inline Promise.resolve params: 34 occurrences across 10 files
createRouteRequest usage: 23 files
createRouteParams usage: 4 files (only supports { id: ... })
```

## Research Findings

### Auth Strategy Split
- **29 files** use `getSessionUser` (standard auth guard)
- **3 files** use `validateSession` (cookie-based, conversation routes)
- **1 file** uses real SQLite integration test (`auth-routes.test.ts`)

### Top 10 Mock Targets
| Module | Files |
|---|---|
| `@/lib/auth` | 31 |
| `@/lib/chat/conversation-root` | 22 |
| `@/adapters/RepositoryFactory` | 12 |
| `@/lib/chat/resolve-user` | 10 |
| `@/lib/db` | 7 |

### Response Assertion Frequency
| Status Code | Occurrences |
|---|---|
| 200 | 77 |
| 400 | 25 |
| 403 | 22 |
| 404 | 17 |
| 401 | 11 |
| 201 | 8 |

### Size Buckets
| Bucket | Count | Files |
|---|---|---|
| Small (<100 lines) | 16 | profile, jobs/route, referral/visit, campaign/context, lifecycle/context, etc. |
| Medium (100-200 lines) | 17 | deals/route, web-search, consultation-requests, etc. |
| Large (200+ lines) | 9 | auth-routes (646), chat/stream (559), chat/uploads (460), chat/jobs (388), etc. |

### Non-Standard Param Keys
The existing `createRouteParams(id)` only supports `{ id: ... }`. These files use other param names:

| Param Key | Files |
|---|---|
| `jobId` | 4 (chat/jobs/[jobId], admin/jobs/[jobId], jobs/[jobId], jobs/[jobId]/events) |
| `leadId` | 1 (admin/leads/[leadId]/triage) |
| `postId` | 2 (admin/blog/posts/[postId]/artifacts, hero-images) |
| `streamId` | 1 (chat/streams/[streamId]/stop) |
| `code` | 1 (referral/[code]) |

---

## Sub-Phase 4A: Extend `@/__test-utils__` Helpers

### 4A.1 Generalize `createRouteParams`

Replace the current `id`-only signature with a generic one:

```typescript
// Current:
export function createRouteParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

// New (additive — keep old signature as overload):
export function createRouteParams(params: Record<string, string>): { params: Promise<Record<string, string>> };
export function createRouteParams(id: string): { params: Promise<{ id: string }> };
export function createRouteParams(input: string | Record<string, string>) {
  const params = typeof input === "string" ? { id: input } : input;
  return { params: Promise.resolve(params) };
}
```

This supports:
```typescript
createRouteParams("deal_1")                    // { params: Promise<{ id: "deal_1" }> }
createRouteParams({ jobId: "job_1" })          // { params: Promise<{ jobId: "job_1" }> }
createRouteParams({ leadId: "lead_1" })        // { params: Promise<{ leadId: "lead_1" }> }
```

### 4A.2 Add `expectJsonResponse` and `expectStatus` Assertion Helpers

```typescript
/**
 * Assert response status and optionally parse + return the JSON body.
 * Replaces the 2-line idiom: expect(response.status).toBe(X); const body = await response.json();
 */
export async function expectJsonResponse(response: Response, status: number) {
  expect(response.status).toBe(status);
  return response.json();
}

/** Assert response status without parsing body (for error responses). */
export function expectStatus(response: Response, status: number) {
  expect(response.status).toBe(status);
}
```

These turn:
```typescript
const response = await GET(req);
expect(response.status).toBe(200);
const body = await response.json();
expect(body.deal.id).toBe("deal_1");
```
Into:
```typescript
const response = await GET(req);
const body = await expectJsonResponse(response, 200);
expect(body.deal.id).toBe("deal_1");
```

### 4A.3 Export from barrel

Add new exports to `src/__test-utils__/index.ts`.

---

## Sub-Phase 4B: Migrate 6 Files to `@/__test-utils__`

These 6 API route test files don't import from `@/__test-utils__` yet:

| # | File | Lines | What Needs Migration |
|---|---|---|---|
| 1 | `auth/auth-routes.test.ts` | 646 | Integration test — only add `@/__test-utils__` for user builders |
| 2 | `user-files/[id]/route.test.ts` | 201 | Replace inline user objects + inline `Promise.resolve` params |
| 3 | `tts/route.test.ts` | 159 | Replace inline user objects |
| 4 | `chat/events/route.test.ts` | 119 | Replace inline `new NextRequest` with `createRouteRequest` |
| 5 | `runtime/generate-audio/route.test.ts` | 106 | Replace inline user objects |
| 6 | `referral/visit/route.test.ts` | 69 | Replace inline `new NextRequest` with `createRouteRequest` |

### Per-file procedure:
1. Add `import { ... } from "@/__test-utils__"`
2. Replace inline user constructions with `createXxxUser()`
3. Replace `new NextRequest(...)` with `createRouteRequest(...)`
4. Replace `{ params: Promise.resolve({ ... }) }` with `createRouteParams(...)`
5. Run `npx vitest run <file>` — must pass

---

## Sub-Phase 4C: Replace Inline `Promise.resolve` Params (10 files)

These files already import from `@/__test-utils__` but still construct route params inline:

| # | File | Inline Param Count | Param Key |
|---|---|---|---|
| 1 | `admin/leads/[leadId]/triage/route.test.ts` | 7 | `leadId` |
| 2 | `admin/blog/posts/[postId]/artifacts/route.test.ts` | 1 | `postId` |
| 3 | `admin/blog/posts/[postId]/hero-images/route.test.ts` | 1 | `postId` |
| 4 | `admin/jobs/[jobId]/export/route.test.ts` | 3 | `jobId` |
| 5 | `chat/jobs/[jobId]/route.test.ts` | 3 | `jobId` |
| 6 | `chat/streams/[streamId]/stop/route.test.ts` | 3 | `streamId` |
| 7 | `jobs/[jobId]/route.test.ts` | 6 | `jobId` |
| 8 | `jobs/[jobId]/events/route.test.ts` | 1 | `jobId` |
| 9 | `referral/[code]/route.test.ts` | 2 | `code` |
| 10 | `user-files/[id]/route.test.ts` | 5 | `id` |

**Total: 32 inline param constructions → `createRouteParams({ key: val })`**

---

## Sub-Phase 4D: Add `expectJsonResponse` Assertions (Optional — Low Priority)

Apply the `expectJsonResponse` helper to reduce the 2-line response+parse idiom across 35 files. This is a refactoring convenience, not a correctness issue.

**Estimated scope:**
- 98 `response.json()` calls across 35 files
- Each replacement saves 1 line (merges status check + json parse)
- Net savings: ~98 lines

**Risk assessment:** This is the most invasive change with the lowest ROI. The existing pattern is already readable and well-established. We recommend making this helper _available_ in 4A.2 but NOT migrating existing files unless they need to be touched for another reason.

---

## Files NOT included in Phase 4

### `auth/auth-routes.test.ts` (646 lines)
This is a **full integration test** using an in-memory SQLite database. It doesn't follow the standard route unit test pattern — it actually imports and runs the real database, creates users, manages cookies, etc. It should NOT be migrated to the route harness. It can receive user builder helpers in 4B but should otherwise be left alone.

### Chat route tests (chat/stream, chat/uploads, chat/jobs)
These are complex tests with domain-specific mock patterns (streaming, file uploads, job lifecycle). They already use `@/__test-utils__` well. Their size comes from complex test scenarios, not boilerplate. They don't benefit from a generic harness.

---

## Implementation Procedure

### Step 1: Extend `createRouteParams` (4A.1)
1. Modify `src/__test-utils__/request-helpers.ts` to accept `Record<string, string>` overload
2. Run self-test to verify backwards compatibility

### Step 2: Add assertion helpers (4A.2)
1. Create `src/__test-utils__/response-helpers.ts` with `expectJsonResponse` and `expectStatus`
2. Add export to `src/__test-utils__/index.ts`

### Step 3: Migrate 6 non-`@/__test-utils__` files (4B)
1. Per-file: add import, replace inline patterns, verify
2. Run full suite after batch

### Step 4: Replace inline params (4C)
1. Per-file: add `createRouteParams` import, replace `{ params: Promise.resolve({...}) }` patterns
2. Run full suite after batch

---

## Acceptance Criteria

| # | Criterion | How to Verify |
|---|---|---|
| 1 | `createRouteParams` supports generic params | Self-test: `createRouteParams({ jobId: "job_1" })` resolves correctly |
| 2 | `expectJsonResponse` available in `@/__test-utils__` | Import and use in self-test |
| 3 | All 42 API route test files import from `@/__test-utils__` | `find src/app/api -name "*.test.ts" \| xargs grep -L "@/__test-utils__"` → 0 |
| 4 | Zero inline `Promise.resolve` param constructions | `find src/app/api -name "*.test.ts" \| xargs grep 'Promise.resolve({' \| wc -l` → 0 |
| 5 | Zero inline `new NextRequest` constructions | `find src/app/api -name "*.test.ts" \| xargs grep 'new NextRequest' \| wc -l` → 0 |
| 6 | Full suite: 0 failures | `npx vitest run` → 579/579, 4540/4540 |
| 7 | No production code changed | Only test files + `@/__test-utils__/` modified |

## Estimated Scope

- **New/modified infra files**: 3 (`request-helpers.ts` extend, new `response-helpers.ts`, `index.ts` barrel)
- **Modified test files**: 16 (6 not-yet-migrated + 10 inline params)
- **Inline replacements**: ~37 (32 params + 3 NextRequest + 2 misc)
- **Net line reduction**: ~40 (shorter helper calls vs multi-line constructions)
- **Risk**: Low — all changes are constructional simplifications, no logic changes
