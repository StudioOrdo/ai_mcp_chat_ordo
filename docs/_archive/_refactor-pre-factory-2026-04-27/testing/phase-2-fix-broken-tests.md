# Phase 2: Fix Broken Tests

## Objective

Resolve all 7 test failures to reach 0 failures across the full suite. Every fix targets stale hardcoded strings or incorrect test expectations — no production code changes required.

## Current State (Post Phase 1)

```
Test Files  5 failed | 574 passed (579)
     Tests  7 failed | 4533 passed | 2 skipped (4542)
```

## Root Cause Analysis

All 7 failures fall into two categories:

### Category A: Stale Identity/Prompt Strings (6 failures)

Our corpus/identity update in the prior session changed:
- Tagline: `"All-in-One AI Operator System"` → `"Bespoke Intelligence for the Trust Economy"`
- First message: `"Bring me the messy workflow..."` → `"Tell me what you do and who you serve..."`
- Default suggestions: `["Plan this workflow", "Search my library", ...]` → `["How does Ordo work?", "What can I build with this?", ...]`

Six tests hardcode the **old** strings:

| # | File | Test | Hardcoded Old Value |
|---|---|---|---|
| 1 | `tests/config-loader.test.ts` | P5 | `"All-in-One AI Operator System"` |
| 2 | `tests/first-message-flow.test.tsx` | N2 | `"Bring me the messy workflow, half-finished idea, or customer task."` |
| 3 | `tests/first-message-flow.test.tsx` | N3 | `"Bring me the messy workflow, half-finished idea, or customer task."` |
| 4 | `tests/first-message-flow.test.tsx` | E6 | `"Plan this workflow"` |
| 5 | `tests/browser-fab-chat-flow.test.tsx` | FAB flow | `"Plan this workflow"` (as chip text + message content) |
| 6 | `tests/browser-fab-chat-flow.test.tsx` | FAB flow | `"Plan this workflow"` in fetchStream assertion |

### Category B: Incorrect Test Expectation (1 failure)

| # | File | Test | Issue |
|---|---|---|---|
| 7 | `tests/chat/chat-job-actions-route.test.ts` | cancels queued jobs | Test expects `activePhaseKey: null, progressLabel: null` but production code intentionally **carries forward** existing progress values from the latest renderable event |

---

## Implementation Checklist

### Step 2.1: Fix `tests/config-loader.test.ts` P5

**File:** [tests/config-loader.test.ts](file:///Users/kwilliams/Projects/ordoSite/tests/config-loader.test.ts)
**Line:** 130
**Test:** `P5: falls back to hardcoded identity when no config file exists`

**Current (failing):**
```typescript
expect(id.tagline).toBe("All-in-One AI Operator System");
```

**Fix:** Update to match `DEFAULT_IDENTITY.tagline`:
```typescript
expect(id.tagline).toBe("Bespoke Intelligence for the Trust Economy");
```

**Better fix (resilient to future copy changes):** The test already imports `DEFAULT_IDENTITY`. Use it:
```typescript
expect(id.tagline).toBe(DEFAULT_IDENTITY.tagline);
```

This makes P5 immune to future marketing copy changes — the test is verifying *fallback behavior*, not specific prose.

**Evidence gate:** `npx vitest run tests/config-loader.test.ts` — 0 failures

---

### Step 2.2: Fix `tests/first-message-flow.test.tsx` N2

**File:** [tests/first-message-flow.test.tsx](file:///Users/kwilliams/Projects/ordoSite/tests/first-message-flow.test.tsx)
**Line:** 172–174
**Test:** `N2: createInitialChatMessages falls back to hardcoded when prompts is undefined`

**Current (failing):**
```typescript
const [msg] = createInitialChatMessages("ANONYMOUS");
expect(msg.content).toContain(
  "Bring me the messy workflow, half-finished idea, or customer task.",
);
```

**Fix:** Use `DEFAULT_PROMPTS.firstMessage.default` instead of hardcoded string:
```typescript
const [msg] = createInitialChatMessages("ANONYMOUS");
expect(msg.content).toContain(DEFAULT_PROMPTS.firstMessage.default);
```

The test already imports `DEFAULT_PROMPTS` (line 15–16). This tests the behavior (fallback happens) without coupling to specific marketing copy.

**Evidence gate:** Test N2 passes

---

### Step 2.3: Fix `tests/first-message-flow.test.tsx` N3

**File:** [tests/first-message-flow.test.tsx](file:///Users/kwilliams/Projects/ordoSite/tests/first-message-flow.test.tsx)
**Line:** 179–181
**Test:** `N3: createInitialChatMessages falls back when firstMessage.default is undefined`

**Current (failing):**
```typescript
const [msg] = createInitialChatMessages("ANONYMOUS", {});
expect(msg.content).toContain(
  "Bring me the messy workflow, half-finished idea, or customer task.",
);
```

**Fix:** Same pattern as N2:
```typescript
expect(msg.content).toContain(DEFAULT_PROMPTS.firstMessage.default);
```

**Evidence gate:** Test N3 passes

---

### Step 2.4: Fix `tests/first-message-flow.test.tsx` E6

**File:** [tests/first-message-flow.test.tsx](file:///Users/kwilliams/Projects/ordoSite/tests/first-message-flow.test.tsx)
**Line:** 282
**Test:** `E6: createInitialChatMessages with partial prompts uses defaults for missing fields`

**Current (failing):**
```typescript
expect(msg.content).toContain("Plan this workflow");
```

The test provides partial prompts with a custom `firstMessage.default` but no `defaultSuggestions`. It asserts that the fallback suggestions include `"Plan this workflow"` — the old default. The new default is `"How does Ordo work?"`.

**Fix:** Use `DEFAULT_PROMPTS.defaultSuggestions![0]` or the actual new chip text:
```typescript
expect(msg.content).toContain(DEFAULT_PROMPTS.defaultSuggestions![0]);
```

**Evidence gate:** Test E6 passes

---

### Step 2.5: Fix `tests/browser-fab-chat-flow.test.tsx` FAB flow

**File:** [tests/browser-fab-chat-flow.test.tsx](file:///Users/kwilliams/Projects/ordoSite/tests/browser-fab-chat-flow.test.tsx)
**Line:** 89, 90, 126–128, 185, 195–196
**Test:** `keeps the FAB flow stable from open to initial chip send to follow-up chip send`

This test renders a full `ChatProvider + ChatSurface` and simulates clicking a suggestion chip. The chip text `"Plan this workflow"` is hardcoded in:
1. The mock conversation messages (lines 89–90) — user message content
2. The mock conversation messages (line 126–128) — duplicated in second fetch response
3. The `screen.findByText("Plan this workflow")` assertion (line 185)
4. The `fetchStreamMock` call assertion (lines 195–196)

All of these use the old default suggestion `"Plan this workflow"`. The new first default suggestion is `"How does Ordo work?"`.

**Fix:** Replace all 6 occurrences of `"Plan this workflow"` with `"How does Ordo work?"` throughout the mock data and assertions. The mock messages and assertions must all use the **same** string since they represent the same user interaction.

This test hardcodes mock server responses — using `DEFAULT_PROMPTS` constants here would make the mock data fragile in a different way. The mock data represents a specific scenario, so using a literal string is appropriate. Just update it to match the current default chip.

**Evidence gate:** `npx vitest run tests/browser-fab-chat-flow.test.tsx` — 0 failures

---

### Step 2.6: Fix `tests/chat/chat-job-actions-route.test.ts` cancel expectation

**File:** [tests/chat/chat-job-actions-route.test.ts](file:///Users/kwilliams/Projects/ordoSite/tests/chat/chat-job-actions-route.test.ts)
**Lines:** 139–145
**Test:** `cancels queued jobs and projects a canceled event`

**Root cause analysis:**

The test provides a `findLatestRenderableEventForJob` mock with payload:
```typescript
{
  progressLabel: "Reviewing article",
  activePhaseKey: "qa_blog_article",
  phases: [...],
  progressPercent: 42,
}
```

Then asserts:
```typescript
expect(appendEventMock).toHaveBeenCalledWith(expect.objectContaining({
  eventType: "canceled",
  payload: expect.objectContaining({
    activePhaseKey: null,     // ← WRONG
    progressLabel: null,      // ← WRONG
  }),
}));
```

But `buildCanceledEventPayload()` in [job-action-executor.ts](file:///Users/kwilliams/Projects/ordoSite/src/lib/jobs/job-action-executor.ts) (lines 49–82) intentionally **carries forward** existing values from the latest renderable event:

```typescript
// Lines 57-59: carries forward progressLabel
...(typeof latestRenderablePayload?.progressLabel === "string"
  || latestRenderablePayload?.progressLabel === null
  ? { progressLabel: latestRenderablePayload.progressLabel }
  : {}),

// Lines 64-66: carries forward activePhaseKey  
...(typeof latestRenderablePayload?.activePhaseKey === "string"
  || latestRenderablePayload?.activePhaseKey === null
  ? { activePhaseKey: latestRenderablePayload.activePhaseKey }
  : {}),
```

So the actual payload will have `activePhaseKey: "qa_blog_article"` and `progressLabel: "Reviewing article"` — the values from the mock event, not `null`.

**Fix:** Update the assertion to match what the production code actually produces:
```typescript
expect(appendEventMock).toHaveBeenCalledWith(expect.objectContaining({
  eventType: "canceled",
  payload: expect.objectContaining({
    activePhaseKey: "qa_blog_article",
    progressLabel: "Reviewing article",
    canceledBy: "usr_test",
  }),
}));
```

**Evidence gate:** `npx vitest run tests/chat/chat-job-actions-route.test.ts` — 0 failures

---

## Acceptance Criteria

| # | Criterion | How to Verify |
|---|---|---|
| 1 | `tests/config-loader.test.ts` P5 passes | `npx vitest run tests/config-loader.test.ts` |
| 2 | `tests/first-message-flow.test.tsx` N2, N3, E6 pass | `npx vitest run tests/first-message-flow.test.tsx` |
| 3 | `tests/browser-fab-chat-flow.test.tsx` all tests pass | `npx vitest run tests/browser-fab-chat-flow.test.tsx` |
| 4 | `tests/chat/chat-job-actions-route.test.ts` all tests pass | `npx vitest run tests/chat/chat-job-actions-route.test.ts` |
| 5 | Full suite: 0 failures | `npx vitest run` — 0 failed |
| 6 | Tests use `DEFAULT_PROMPTS` / `DEFAULT_IDENTITY` refs where appropriate | Visual inspection — no stale hardcoded marketing copy in fallback tests |
| 7 | No production code changed | Only test files modified |

## Estimated Scope

- **Modified files:** 4 test files
- **New files:** 0
- **Production code changes:** 0
- **Lines changed:** ~20
- **Risk:** Low — all changes are test assertion updates
