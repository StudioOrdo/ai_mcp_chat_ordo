# Issue Resolution Tracker

This document tracks investigation, implementation, validation, and remaining risks for the current shell/chat UX issues.

## Scope

1. Move conversation data export into the main menu so it is not always visible in chat chrome.
2. Audit and resolve the broken page flash during page load.
3. Identify any related lifecycle or hydration bugs contributing to unstable initial render behavior.

## Current Status

### 1. Conversation Export Placement

- Status: Investigated
- Current behavior:
  - Conversation export is rendered from `src/frameworks/ui/ChatConversationDataMenu.tsx`
  - It is surfaced by `src/frameworks/ui/ChatSurfaceHeader.tsx`
  - The always-visible trigger is the chat-level `Data` menu, not the site-wide main menu
- Intended change:
  - Move export access into the main workspace/menu surface
  - Remove the persistent chat-header trigger
- Likely target surface:
  - `src/components/ShellWorkspaceMenu.tsx`
- Open questions:
  - Should export remain conversation-scoped and only appear when an active conversation exists?
  - Should the menu item open a sub-menu or just trigger direct JSON export?

### 2. Broken Page Flash On Load

- Status: Investigated, not fixed
- Observed behavior:
  - Page can briefly render a broken or unstable state during load
  - The flash is sometimes very short, sometimes noticeably longer
- Current leading hypotheses:
  1. Chat restore bootstraps into a loading state and swaps transcript/UI after active conversation fetch resolves
  2. Theme hydration re-applies state after mount and may cause a second full-page repaint
  3. Async effects may be updating state after unmount or before mount completes, creating unstable render timing
  4. Local dev server instability may amplify the flash, but is not the root cause of all production-facing behavior

## Evidence Collected

### Conversation Export

- `src/frameworks/ui/ChatConversationDataMenu.tsx`
- `src/frameworks/ui/ChatSurfaceHeader.tsx`
- Candidate destination: `src/components/ShellWorkspaceMenu.tsx`

### Page Flash / Loading

- `src/hooks/chat/useChatConversationSession.ts`
- `src/hooks/chat/useChatRestore.ts`
- `src/frameworks/ui/ChatMessageViewport.tsx`
- `src/components/ThemeProvider.tsx`
- `src/app/layout.tsx`
- Additional async-hook suspects:
  - `src/hooks/chat/useReferralContext.ts`
  - `src/hooks/chat/useCampaignContext.ts`
  - `src/hooks/chat/useLifecycleContext.ts`

## Work Plan

### Export Move

- [ ] Confirm final destination surface for export action
- [ ] Move export action from chat header to main menu/workspace menu
- [ ] Remove redundant always-visible chat header affordance
- [ ] Validate export still targets the active conversation correctly
- [ ] Add or update tests covering the new menu location

### Page Flash Investigation

- [ ] Audit chat restore path for unnecessary initial loading state swaps
- [ ] Audit theme bootstrap vs client rehydration for duplicate visual state transitions
- [ ] Audit async effects for missing cancellation / stale state updates
- [ ] Reproduce the flash in a controlled path and isolate whether it is chat, theme, or both
- [ ] Implement the smallest safe fix at the controlling layer
- [ ] Validate in browser reload scenarios, not just unit tests

## Recommended Fix Order

1. Export move
   - Smaller, self-contained, low-risk UI adjustment
2. Chat restore flash
   - Most likely direct contributor to broken initial content state
3. Theme hydration flash
   - Likely secondary repaint source
4. Async lifecycle cleanup
   - Hardening pass if warning paths are confirmed

## Validation Checklist

### Export Move Validation

- [ ] Export action is no longer persistently visible in the chat header
- [ ] Export action appears in the main/workspace menu
- [ ] Export works with an active conversation
- [ ] Export is hidden or disabled when no conversation is active

### Page Load

- [ ] No broken-page flash on hard reload
- [ ] No unnecessary loading placeholder swap for already-restorable conversation state
- [ ] No theme flicker between initial HTML and hydrated client state
- [ ] No React warning about updating state on an unmounted or not-yet-mounted component

## Notes

- A previous media playback issue was fixed by limiting playback verification to first-time verification states only; persisted assets now play normally after reload.
- Local development instability can create extra noise during investigation, so production-like validation should be part of the final check.

## Change Log

### 2026-04-25

- Created tracker document
- Recorded current findings for export placement and load-flash investigation
- Captured likely implementation surfaces and validation plan

### 2026-04-25 Validation Update

- Full Vitest suite passed: 575 files, 4499 passed, 2 skipped.
- Remaining repository validation blocker moved from tests to lint.
- Current closeout work: fix residual markdown/stylelint issues so `npm run verify` can proceed through lint, typecheck, and Vitest in one pass.

### 2026-04-26 Final Validation Update

- Authoritative terminal validation passed end to end.
- `npm run lint` passes with warnings only.
- `npx tsc --noEmit` passes.
- `npm run verify` passes.
- Final verify summary: 575 test files passed, 4499 tests passed, 2 skipped, exit code `0`.
