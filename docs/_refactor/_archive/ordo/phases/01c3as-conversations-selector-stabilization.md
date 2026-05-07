# Phase 01c3as: Conversations Selector Stabilization

Status: Implemented

Parent package:

- `02-ui-surface-realignment/09-implementation-phase-plan.md`

## Goal

Make signed-in Conversations use the same second-column selector pattern as the
rest of the owner workspace while preserving anonymous Home as the public chat
entry.

## Governing Docs

- `docs/_refactor/ordo/letters/refactor1.md`
- `docs/_business/ux/08-product-kernel-contract.md`
- `docs/_business/ux/09-canonical-ux-architecture.md`
- `docs/_business/ux/00-ux-north-star.md`
- `docs/_business/ordo_process.md`
- `docs/_refactor/ordo/phases/02-ui-surface-realignment/01-shell-and-menu-ia-alignment.md`
- `docs/_refactor/ordo/phases/02-ui-surface-realignment/02-shared-surface-frame-contract.md`

## Current Code Grounding

Code anchors:

- `src/app/page.tsx`
- `src/frameworks/ui/ChatSurface.tsx`
- `src/frameworks/ui/useChatSurfaceState.tsx`
- `src/frameworks/ui/ChatSurfaceHeader.tsx`
- `src/app/api/conversations/route.ts`
- `src/app/api/conversations/active/route.ts`
- `src/core/use-cases/ConversationInteractor.ts`
- `src/components/AppShell.tsx`
- `src/lib/shell/shell-navigation.ts`

## Verified Current State

- `/` renders `ChatSurface` for anonymous and signed-in users.
- Signed-in `/` passes `showConversationSelector=true`.
- Conversation APIs already support active conversation and conversation CRUD.
- The rail route id `ordo-chat` is labeled Conversations.
- Future human handoff/operator transfer should use the same selector concept,
  but only Ordo is the active agent conversation today.
- The selector already existed in `ChatSurface`, but its future person rows used
  named fake people and a `Soon` status, which could read as real relationship
  data. Those rows needed replacement with deterministic, explicitly non-live
  placeholder slots.
- The mobile main menu already lived in the brand/logo region, but its CSS was
  shown by default and hidden at the desktop breakpoint. The phase strengthened
  this to hidden by default and shown only below the mobile breakpoint.

## Target Behavior

- Anonymous `/` remains the public chat/home entry.
- Signed-in `/` is Conversations.
- Second column lists Ordo as the active agent conversation and deterministic
  person handoff placeholder rows when needed.
- Placeholder person rows are clearly non-live, deterministic, and replaceable.
- Main pane remains chat-first.
- Mobile uses shell menu plus list/detail pattern without desktop hamburger
  leakage.

## Implementation Steps

1. Research existing ChatSurface selector code before adding new UI.
2. Define a Conversations read model if existing active conversation data needs
   shaping for the selector.
3. Render second-column selector only for signed-in Conversations.
4. Keep anonymous chat unaffected.
5. Add deterministic person handoff placeholders only if they are labeled as
   future/soon and do not imply live customer chats.
6. Add tests for signed-in/anonymous route behavior.
7. Update evidence docs.

## Positive Tests

- Anonymous `/` renders public chat without owner selector.
- Signed-in `/` renders Conversations selector and active Ordo row.
- Selecting Ordo keeps chat active.
- Placeholder person rows are deterministic and labeled non-live.
- Mobile signed-in Conversations exposes list/detail/back behavior if detail
  state exists.

## Negative Tests

- Placeholder rows do not claim real people, real unread messages, or live
  handoff state.
- Public anonymous view does not show owner conversation data.
- Account menu does not include My Conversations.
- Raw admin conversation controls do not appear in owner Conversations.

## Edge Tests

- No active conversation creates an Ordo starter row.
- Archived active conversation creates a safe empty state.
- Failed conversation fetch does not break public home.
- Admin user still sees owner Conversations plus admin rail separately.

## Acceptance Criteria

- Conversations becomes the first owner operating surface without compromising
  public Home.
- The second column is ready for future human handoff chats.
- All placeholder rows obey the placeholder read-model policy.

## Non-Goals

- No human handoff implementation.
- No real person chat transfer.
- No admin conversation retention changes.
- No new avatar generation.

## Required Commands

```bash
npx vitest run src/app/page.test.tsx src/frameworks/ui/ChatSurface.test.tsx src/frameworks/ui/useChatSurfaceState.test.tsx src/app/api/conversations/route.test.ts src/app/api/conversations/active/route.test.ts src/lib/shell/shell-navigation.test.ts src/components/SiteNav.test.tsx
npm run typecheck
npm run lint:css
npm run lint -- src/app/page.tsx src/frameworks/ui/ChatSurface.tsx src/frameworks/ui/useChatSurfaceState.tsx src/frameworks/ui/ChatSurfaceHeader.tsx src/lib/shell/shell-navigation.ts
```

## Static Scans

```bash
rg -n "fake|sample|soon|handoff|My conversations|admin conversation|retention|purge" src/app src/components src/frameworks src/lib
```

## Closeout Evidence Required

- Anonymous and signed-in Home/Conversations screenshots.
- Mobile signed-in Conversations screenshot.
- Test output for ChatSurface and conversation route behavior.
- Notes proving placeholders are deterministic and non-live.

## Implementation Closeout

Date: 2026-05-06

Code changes:

- `src/frameworks/ui/ChatSurface.tsx` now renders the signed-in Conversations
  second column with Ordo as the only active agent conversation and three
  deterministic non-live placeholder slots: `Person transfer slot`,
  `Follow-up thread slot`, and `Customer thread slot`.
- Placeholder rows are disabled, marked `aria-disabled`, use stable ids, and
  say `Not live` plus `Placeholder - no ...` metadata. They do not name real
  people, claim unread messages, or imply active operator transfer.
- Anonymous `/` still receives `showConversationSelector=false`; signed-in `/`
  still receives `showConversationSelector=true`.
- `src/lib/shell/shell-navigation.ts` keeps `ordo-chat` labeled
  `Conversations` and updates its description to future transfer slots instead
  of handoff language.
- `src/app/styles/shell.css` now hides the mobile main menu by default and only
  displays it in the mobile breakpoint, reducing desktop hamburger leakage risk.

Test changes:

- `src/frameworks/ui/ChatSurface.test.tsx` now asserts that embedded anonymous
  chat has no Conversations selector, signed-in Conversations has the active
  Ordo row plus deterministic non-live placeholder rows, and the no-active
  conversation edge case renders a safe Ordo starter row.
- `src/components/SiteNav.test.tsx` now asserts the updated Conversations route
  description and the mobile-menu CSS contract.

QA pass 1:

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
- Focused lint for touched source files passed.
- Broad static scan still reports existing admin/media/backup/eval diagnostic
  and fixture terms outside this phase. The focused scan over touched
  Conversations/shell/account files returned no matches.

QA pass 1 issues found and fixed:

- The selector placeholder rows used named fake people and `Soon`; replaced
  them with stable non-live placeholder slots.
- The desktop hamburger CSS was mobile-visible by default; changed it to hidden
  by default and visible only under the mobile breakpoint.

Visual QA:

- A dev server is reachable at `http://localhost:3000/`, but this environment
  currently redirects `/` to `/install`, so anonymous/signed-in screenshots were
  not captured during pass 1. DOM, CSS, and route unit tests were used for pass
  1 evidence.

QA pass 2:

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

QA pass 2 issues found and fixed:

- None.
