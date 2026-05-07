# Phase 01c3as Evidence: Conversations Selector Stabilization

Date: 2026-05-06

Status: Implemented

## Governing Product Contract

- Chat remains the operating interface.
- UI surfaces remain the governance layer.
- Anonymous `/` remains public Home/chat.
- Signed-in `/` is the Conversations owner operating surface.
- The main pane remains chat-first.
- The second column may prepare future person transfer without claiming live
  human chats, real customers, unread messages, or active operator handoff.
- Owner Conversations must not expose admin conversation controls, retention,
  purge, logs, providers, or raw diagnostics.

## Code Files Changed

- `src/frameworks/ui/ChatSurface.tsx`
- `src/frameworks/ui/ChatSurface.test.tsx`
- `src/lib/shell/shell-navigation.ts`
- `src/components/SiteNav.test.tsx`
- `src/app/styles/shell.css`

## Documentation Files Changed

- `docs/_refactor/ordo/phases/01c3as-conversations-selector-stabilization.md`
- `docs/_refactor/ordo/evidence/phase-01c3as-conversations-selector-stabilization.md`

## Implementation Evidence

`src/app/page.tsx` still passes `showConversationSelector=false` for anonymous
users and `true` for signed-in users. This preserves public/owner separation at
the route boundary.

`ChatSurface` now renders:

1. Ordo as the only active agent conversation row.
2. `Person transfer slot`
3. `Follow-up thread slot`
4. `Customer thread slot`

The three non-Ordo rows are deterministic disabled placeholders. They are
labelled `Not live` and include explicit `Placeholder - no ...` metadata. They
do not use fake names, avatars, unread counts, live states, or customer data.

The shell route registry still uses `ordo-chat` with label `Conversations`; its
description now says future person transfer slots instead of handoff language.

The mobile main menu remains integrated in the brand/logo region, but CSS now
hides it by default and shows it only under the mobile breakpoint.

## QA Pass 1

Commands run:

```bash
npx vitest run src/app/page.test.tsx src/frameworks/ui/ChatSurface.test.tsx src/frameworks/ui/useChatSurfaceState.test.tsx src/app/api/conversations/route.test.ts src/app/api/conversations/active/route.test.ts src/lib/shell/shell-navigation.test.ts src/components/SiteNav.test.tsx
npm run typecheck
npm run lint:css
npm run lint -- src/app/page.tsx src/frameworks/ui/ChatSurface.tsx src/frameworks/ui/useChatSurfaceState.tsx src/frameworks/ui/ChatSurfaceHeader.tsx src/lib/shell/shell-navigation.ts
rg -n "fake|sample|soon|handoff|My conversations|admin conversation|retention|purge" src/app src/components src/frameworks src/lib
rg -n "fake|sample|soon|handoff|My conversations|admin conversation|retention|purge" src/app/page.tsx src/frameworks/ui/ChatSurface.tsx src/frameworks/ui/useChatSurfaceState.tsx src/frameworks/ui/ChatSurfaceHeader.tsx src/lib/shell/shell-navigation.ts src/components/SiteNav.tsx src/components/shell/ShellMobileMainMenu.tsx src/components/AccountMenu.tsx
```

Results:

- Required phase tests passed: 7 files, 82 tests.
- Typecheck passed.
- CSS lint passed.
- Focused lint passed.
- Broad static scan still reports existing admin/media/backup/eval diagnostic
  and fixture terms outside this phase.
- Focused static scan over touched Conversations/shell/account files returned no
  matches.

Issues found and fixed:

- Future person rows used named fake people and a `Soon` state. Replaced them
  with deterministic non-live placeholder slots.
- The mobile main menu was shown by default and hidden above desktop. Reversed
  the CSS contract so desktop is hidden by default and mobile explicitly opts in.

## Visual QA

The dev server is reachable, but `curl -I http://localhost:3000/` currently
returns `307 Temporary Redirect` to `/install`. Because authenticated browser
state is not usable in this shell context, screenshot capture was deferred and
DOM/CSS/unit-test evidence was used.

## QA Pass 2

Commands run:

```bash
npx vitest run src/app/page.test.tsx src/frameworks/ui/ChatSurface.test.tsx src/frameworks/ui/useChatSurfaceState.test.tsx src/app/api/conversations/route.test.ts src/app/api/conversations/active/route.test.ts src/lib/shell/shell-navigation.test.ts src/components/SiteNav.test.tsx
npm run typecheck
npm run lint:css
npm run lint -- src/app/page.tsx src/frameworks/ui/ChatSurface.tsx src/frameworks/ui/useChatSurfaceState.tsx src/frameworks/ui/ChatSurfaceHeader.tsx src/lib/shell/shell-navigation.ts
rg -n "fake|sample|soon|handoff|My conversations|admin conversation|retention|purge" src/app/page.tsx src/frameworks/ui/ChatSurface.tsx src/frameworks/ui/useChatSurfaceState.tsx src/frameworks/ui/ChatSurfaceHeader.tsx src/lib/shell/shell-navigation.ts src/components/SiteNav.tsx src/components/shell/ShellMobileMainMenu.tsx src/components/AccountMenu.tsx
rg -n "fake|sample|soon|handoff|My conversations|admin conversation|retention|purge" src/app src/components src/frameworks src/lib
```

Results:

- Required phase tests passed again: 7 files, 82 tests.
- Typecheck passed again.
- CSS lint passed again.
- Focused lint passed again.
- Focused static scan over touched Conversations/shell/account files returned no
  matches again.
- Broad static scan still reports pre-existing admin/media/backup/eval
  diagnostic and fixture terms outside this phase.

Issues found and fixed:

- None.
