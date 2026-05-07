# 01c3aa Menu Aesthetic Hit List

Status: Active

Evidence date: 2026-05-05

## Goal

Bring the Studio Ordo shell menus closer to the first-screen UX target:

- public nav feels like quiet site navigation;
- left rail feels like the owner/business workspace;
- account menu feels like a precise account surface;
- mobile controls stay usable and uncluttered;
- focus states are visible without noisy decoration.

The governing product rule remains:

- chat is the operating interface;
- UI surfaces are the governance layer.

## Current Code Anchors

- `src/components/SiteNav.tsx`
- `src/components/public/PublicRouteLinks.tsx`
- `src/components/AuthenticatedWorkRail.tsx`
- `src/components/AccountMenu.tsx`
- `src/components/business/BusinessWorkspace.tsx`
- `src/app/styles/shell.css`
- `src/app/styles/utilities.css`
- `src/components/SiteNav.test.tsx`
- `src/components/AuthenticatedWorkRail.test.tsx`
- `src/components/AccountMenu.test.tsx`
- `tests/shell-visual-system.test.tsx`
- `tests/site-shell-composition.test.tsx`
- `tests/browser-ui/business-workspace.spec.ts`

## Hit List

### 1. Public Top Nav Reads Too Much Like A Control Pill

Current state:

- `PublicRouteLinks` renders the correct public route set.
- `.ui-shell-nav-links` gives the center nav a visible pill background.
- This makes About/Offers/Feed feel like an app switcher instead of calm public
  site navigation.

Fix:

- Keep public nav as About, Offers, conditional Feed.
- Remove the heavy pill treatment.
- Keep route links compact, centered, readable, and keyboard-focusable.
- Use subtle active/hover treatment instead of a heavy selected capsule.

### 2. Authenticated Left Rail Is Too Narrow And Stacked

Current state:

- `AuthenticatedWorkRail` uses the correct owner routes.
- Desktop CSS stacks icon over label in a narrow rail.
- The UX target expects a calmer icon + label rail that reads as business
  workspace navigation.

Fix:

- Desktop rail should be wider and use icon + label in one row.
- Active state should use a thin left indicator plus a quiet warm surface.
- Keep mobile bottom dock compact and scroll-safe.
- Keep System/admin role-gated.

### 3. Account Menu Rows Need Icons And Normal Reading Rhythm

Current state:

- `AccountMenu` route grouping is correct.
- Rows are uppercase, high-letter-spaced, and text-only.
- The UX target expects icon + label rows that feel like normal account
  navigation.
- The account menu currently risks duplicating workspace domains that belong in
  the left rail or main governance surfaces.

Fix:

- Add small route icons to account menu items.
- Keep labels plain case.
- Keep only personal account-owned items: My profile, My media, My Referrals,
  Preferences, and Sign out.
- Remove My conversations, My offers, and My content from the account menu
  because People, Offers, and Studio govern those domains.
- Keep System in the left rail for authorized users, not in the account menu.
- Move Light/Dark theme control into the menu header as a compact slide toggle.
- Keep mobile sheet usable.

### 4. Account Trigger And Dropdown Need Less Bounce

Current state:

- Account dropdown uses `rounded-3xl`, `duration-500`, and `spring-bounce`.
- This feels more decorative than the product target.

Fix:

- Reduce radius and motion.
- Keep a stable shadow and border.
- Ensure Escape, outside click, and mobile sheet behavior remain tested.

### 5. Focus And Touch Targets Need Governance Consistency

Current state:

- `focus-ring` exists.
- Some shell rows depend on hover styling for clarity.

Fix:

- Keep visible focus rings on account trigger, account links, nav links, rail
  links, filter icon, and mobile dock links.
- Preserve minimum touch target size.
- Do not add hidden drawers or raw job/operation/log controls.

### 6. Shell Columns Need One Global Geometry

Current state:

- `SiteNav` uses `site-container` centering for the brand/top navigation.
- `AuthenticatedWorkRail` owns its width separately.
- `BusinessWorkspace` previously centered itself with `max-w-7xl` and a local
  `22rem` People column.
- This makes the logo, owner rail, and second governance column drift instead
  of reading as one product shell.

Fix:

- Add shared shell tokens for the owner rail width and reusable second-column
  width.
- Align authenticated top navigation to those tokens.
- Introduce a reusable shell governance grid primitive for pages that use a
  second column.
- Move People onto that primitive as the first consumer.
- Treat this as a global shell contract for Studio, Offers, System, and future
  governance pages, not a People-only layout tweak.

### 7. Authenticated Top Rail And Left Rail Need A Clean Joint

Current state:

- The top rail can read as a floating glass strip above the authenticated owner
  rail.
- If the brand starts after the rail, the logo is visually detached from the
  shell corner.
- Shadow/blur treatment at the rail seam makes the structure feel decorative
  instead of precise.

Fix:

- In authenticated mode, remove top-rail shadow/blur treatment.
- Join top rail and left rail with simple shared background and hairline
  borders.
- Put the logo/brand at the top-left shell corner.
- Let the company/site name span at most the owner rail plus reusable second
  column width.
- Keep public/anonymous top nav behavior separate.

## Non-Goals

- Do not change route ownership.
- Do not add new pages.
- Do not reintroduce Profile to the owner rail.
- Do not add Jobs, Operations, Logs, Activity, Library, or Referrals to public
  nav or owner rail.
- Do not redesign the entire People page.
- Do not delete donor routes.

## Acceptance Checks

- Public nav remains About, Offers, conditional Feed.
- Owner rail remains Today, Studio, People, Offers, About, and authorized
  System.
- Account menu contains My profile, My media, My Referrals, Preferences, and
  Sign out.
- Account menu does not contain My conversations, My offers, My content, or
  System.
- Light/Dark theme is a header slide toggle, not a menu row.
- Account menu route rows have icons.
- Desktop owner rail route rows use icon + label alignment.
- Mobile owner rail still exposes Today, Studio, People, Offers, About.
- Static scans show no raw owner UX terms in the shell.
- Browser smoke proves `/business` still loads and mobile account menu opens.
- Authenticated shell CSS exposes global owner rail and second-column tokens.
- People uses the global governance grid instead of a local centered max-width
  layout.
- Authenticated shell brand starts in the shell corner and spans the owner rail
  plus second-column area without shadow or blur at the rail joint.
