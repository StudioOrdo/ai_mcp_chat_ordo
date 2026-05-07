# Shell Left Menu Contract Spec

## Objective

Refactor the primary shell menu so it behaves like an industry-standard mobile
navigation drawer: a branded menu trigger on the left, a left-anchored drawer,
and right-side controls reserved for work/status/account utilities.

The menu trigger should use the Studio Ordo mark at
[public/ordo_icon.png](../../../public/ordo_icon.png). The existing drawer
behavior should be preserved where it is already solid: portal rendering, focus
trap, Escape handling, outside-click dismissal, route-click dismissal, scroll
lock, and role-aware navigation.

This is a shell navigation placement and interaction refactor, not a new
navigation model.

## Current Codebase Grounding

### Shell Composition

- [src/components/AppShell.tsx](../../../src/components/AppShell.tsx) wraps every
  route with [src/components/SiteNav.tsx](../../../src/components/SiteNav.tsx),
  the route main, and the footer.
- [src/components/SiteNav.tsx](../../../src/components/SiteNav.tsx) currently
  renders the brand region on the left and the actions region on the right.
- The actions region now contains Jobs, notification/login controls, and
  [src/components/ShellWorkspaceMenu.tsx](../../../src/components/ShellWorkspaceMenu.tsx).
- Jobs now correctly belongs in the real shell top rail, so this refactor must
  keep Jobs on the right utility side.

### Workspace Menu

- [src/components/ShellWorkspaceMenu.tsx](../../../src/components/ShellWorkspaceMenu.tsx)
  already implements the main menu as a portal-backed modal drawer.
- The trigger currently uses a generic hamburger SVG and sits on the right.
- The drawer currently anchors to the right using `right-0` and `border-l`.
- The drawer already supports:
  - Escape close
  - outside click close
  - body/document scroll lock
  - focus trapping
  - first-interactive focus after opening
  - route click close
  - route-change close
  - role-aware sections
  - admin sections for admin users
  - accessibility controls
  - simulation controls in development/admin contexts

### Brand And Logo

- [src/components/shell/ShellBrand.tsx](../../../src/components/shell/ShellBrand.tsx)
  renders the brand/home link using `identity.logoPath` from instance config.
- [config/identity.json](../../../config/identity.json) currently sets
  `logoPath` to `/logo_with_words.png`.
- [src/lib/config/defaults.ts](../../../src/lib/config/defaults.ts) also defaults
  `logoPath` to `/logo_with_words.png`.
- [public/ordo_icon.png](../../../public/ordo_icon.png) exists and is the desired
  mark for the main menu trigger.
- The spec should not require changing the global `identity.logoPath`. The mark
  can be used directly for the menu trigger while the existing brand/logo
  contract remains intact.

### Shell Styling

- [src/app/styles/shell.css](../../../src/app/styles/shell.css) defines the shell
  grid, action row, brand mark sizing, icon button sizing, and drawer/dropdown
  surface classes.
- The current shell grid uses `grid-template-areas: "brand actions"`.
- `shell-nav-brand-region` is left-aligned and `shell-nav-actions` is
  right-aligned.
- Site nav tests already assert the shell grid, account action anchoring, and
  absence of legacy search/nav drawer regions in
  [src/components/SiteNav.test.tsx](../../../src/components/SiteNav.test.tsx).

## Product Decision

The main workspace menu should move from the right utility cluster to the left
brand/navigation cluster.

The shell top rail should read as:

```text
[Ordo menu mark] [Studio Ordo brand/home]                       [Jobs] [notifications/login] [account]
```

On narrow mobile widths, the brand text may collapse or hide, but the menu mark
must remain the leftmost stable control.

## Interaction Contract

### Trigger

- The trigger lives in the left shell region before the wordmark/home link.
- The trigger uses [public/ordo_icon.png](../../../public/ordo_icon.png).
- The trigger remains a `button`, not a link.
- Accessible label remains `Open workspace menu` unless product copy chooses a
  better equivalent such as `Open main menu`.
- `aria-expanded` reflects drawer state.
- `aria-haspopup="dialog"` remains.
- The trigger should be a familiar square/circular icon button with stable
  dimensions matching existing shell icon buttons.
- The trigger must not double as a home link. Home remains a drawer item and the
  wordmark/home link remains available where visible.

### Drawer

- The drawer opens from the left side.
- Replace right anchoring with left anchoring:
  - use `left-0`
  - use `border-r`
  - remove `right-0` and `border-l` from the drawer panel
- Preserve modal semantics:
  - `role="dialog"`
  - `aria-modal="true"`
  - `aria-label="Workspace menu"` or a renamed `Main menu` label if the product
    copy changes consistently
- Preserve overlay dismissal and Escape behavior.
- Preserve focus trap and focus restoration to the trigger.
- Preserve body/document scroll locking while the drawer is open.
- Preserve route-change and route-click close behavior.

### Drawer Content

The current information architecture can remain, but the header should feel like
primary app navigation rather than an account drawer.

Recommended header:

- Ordo mark from [public/ordo_icon.png](../../../public/ordo_icon.png)
- `Studio Ordo` label
- user/email/role status below or beside the brand block
- close button on the right side of the drawer header
- dark-mode control may remain in the header cluster if spacing still works;
  otherwise it can move into the System section

Recommended section order:

1. Primary navigation: Home, Library, Journal, Current Work, Jobs, My Media,
   Referrals
2. Access links for anonymous users
3. Admin navigation for admin/staff roles
4. Contextual admin workspace links when applicable
5. System legibility controls
6. Simulation mode where allowed
7. Sign out or app copyright/footer

## Layout Contract

### Desktop

- The left region contains the menu trigger and brand link.
- The right region contains Jobs, notifications/login, and account/workspace
  utility controls.
- Jobs must not shift into the left navigation cluster.
- The shell top rail should remain one row and should not overflow at common
  desktop widths.

### Mobile

- The menu trigger is the leftmost visible control.
- The brand wordmark may hide through the existing `compactOnMobile` behavior.
- Jobs remains visible as the marquee work-status control when space allows.
- If the rail becomes cramped, login/register text buttons are the first
  candidates for compression, not the main menu trigger or Jobs.
- Text must not overlap or escape button bounds.

## Source Authority

| Concern | Current owner | Rule |
| --- | --- | --- |
| Menu trigger placement | [src/components/SiteNav.tsx](../../../src/components/SiteNav.tsx) | Move `ShellWorkspaceMenu` into the brand/left region before `ShellBrand`. |
| Drawer behavior | [src/components/ShellWorkspaceMenu.tsx](../../../src/components/ShellWorkspaceMenu.tsx) | Preserve behavior, change anchor and trigger presentation. |
| Brand/home link | [src/components/shell/ShellBrand.tsx](../../../src/components/shell/ShellBrand.tsx) | Keep as home link; do not overload menu trigger as home. |
| Menu trigger mark | [public/ordo_icon.png](../../../public/ordo_icon.png) | Use directly for trigger and optionally drawer header mark. |
| Shell grid and spacing | [src/app/styles/shell.css](../../../src/app/styles/shell.css) | Add/adjust classes for left menu region without breaking tokenized layout. |
| Route groups | [src/lib/shell/shell-navigation.ts](../../../src/lib/shell/shell-navigation.ts) | Reuse existing route visibility and grouping. |

## Implementation Plan

1. Update [src/components/SiteNav.tsx](../../../src/components/SiteNav.tsx):
   - render `ShellWorkspaceMenu` inside `shell-nav-brand-region`
   - place it before `ShellBrand`
   - remove it from `shell-nav-actions`
   - keep Jobs, notifications/login, and account utilities in the right actions
     region

2. Update [src/components/ShellWorkspaceMenu.tsx](../../../src/components/ShellWorkspaceMenu.tsx):
   - import `Image` from `next/image`
   - replace the generic hamburger SVG trigger with the Ordo icon image
   - change drawer panel anchoring from right to left
   - optionally add the Ordo icon to the drawer header
   - preserve all existing accessibility and dismissal behavior

3. Update [src/app/styles/shell.css](../../../src/app/styles/shell.css):
   - add a left menu trigger/mark class if needed
   - ensure brand region spacing works with menu button plus brand link
   - keep stable icon-button dimensions
   - ensure mobile constraints prevent overlap with Jobs and account controls

4. Update tests:
   - [src/components/SiteNav.test.tsx](../../../src/components/SiteNav.test.tsx)
     should assert the workspace menu is in the brand/left region, not the
     account-actions region
   - [src/components/ShellWorkspaceMenu.test.tsx](../../../src/components/ShellWorkspaceMenu.test.tsx)
     should continue proving open behavior, guest links, and signed-in links
   - add or update assertions for left drawer anchoring if the test environment
     can inspect class names safely

5. Browser verification:
   - desktop: top rail has menu + brand on left, Jobs + account controls on right
   - mobile: menu trigger remains leftmost, drawer opens from left, no overlap
   - drawer: Escape/outside click/route click still close the menu

## Positive Cases

- A mobile user sees the Ordo mark as the first control and taps it to open the
  main menu.
- The drawer slides in from the left and presents app navigation first.
- A signed-in user still sees Current Work, My Jobs, My Media, Referrals, and
  Profile routes.
- An admin still sees admin routes and contextual admin workspace links.
- Anonymous users still see Login and Register paths.
- Jobs remains visible in the top rail as the work-status utility.
- The wordmark remains a home link on widths where it is visible.

## Negative Cases

- Do not keep the primary menu trigger on the right after this refactor.
- Do not make the Ordo icon both a menu button and a home link.
- Do not remove focus trap, Escape close, outside click close, scroll lock, or
  route-click close.
- Do not move Jobs into the drawer as its only visible surface.
- Do not parse route data manually inside the menu; keep using
  [src/lib/shell/shell-navigation.ts](../../../src/lib/shell/shell-navigation.ts).
- Do not globally change `identity.logoPath` unless a separate branding decision
  is made. This refactor only requires the menu mark to use
  [public/ordo_icon.png](../../../public/ordo_icon.png).

## Edge Cases

- Anonymous mobile view with Login/Register plus Jobs must not overflow.
- Admin mobile view with Jobs, notifications, and menu must not overlap.
- Journal quiet nav tone must still apply to both trigger and drawer tone.
- Opening the menu, navigating to a route, and returning focus should remain
  predictable.
- Route changes while the drawer is open should still close the drawer.
- If `ordo_icon.png` fails to load, the button must still have an accessible
  label and stable dimensions.

## Validation Commands

Focused test slice after implementation:

```bash
npm exec vitest run src/components/SiteNav.test.tsx src/components/ShellWorkspaceMenu.test.tsx
```

Recommended broader shell slice:

```bash
npm exec vitest run src/components/SiteNav.test.tsx src/components/ShellWorkspaceMenu.test.tsx src/frameworks/ui/jobs-rail/JobsRail.test.tsx src/frameworks/ui/jobs-rail/resolve-jobs-rail.test.ts
```

Browser checks should verify:

- `[data-shell-nav-region="brand"] [data-shell-workspace-menu="true"]` count is
  `1`
- `[data-shell-nav-region="account-access"] [data-shell-workspace-menu="true"]`
  count is `0`
- opening the menu produces one `[data-shell-workspace-menu-surface="true"]`
- drawer panel is left anchored
- Jobs remains in the primary nav

## Definition Of Done

The refactor is complete when:

- the primary menu trigger lives on the left and uses
  [public/ordo_icon.png](../../../public/ordo_icon.png)
- the drawer opens from the left
- the right rail contains Jobs and account/notification utilities only
- existing role-aware drawer navigation still works
- existing drawer accessibility behavior still works
- focused tests pass
- browser verification passes on desktop and mobile widths
