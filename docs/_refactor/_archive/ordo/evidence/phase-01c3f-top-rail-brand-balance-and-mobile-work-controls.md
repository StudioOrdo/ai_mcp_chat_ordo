# Phase 01c3f Evidence: Top Rail Brand Balance And Mobile Work Controls

Date: 2026-05-04

## Scope

Implemented the phase 01c3f shell/navigation refactor:

- top rail brand is a single symbol mark plus text wordmark;
- workspace drawer trigger moved out of the brand cluster;
- drawer trigger is a neutral menu glyph;
- brand mark has first-class `identity.markPath` support;
- authenticated mobile gets an explicit `Work` sheet;
- `/activity` is now a canonical authenticated work route.

## Code Changes

- `src/lib/config/defaults.ts`
  - Added optional `InstanceIdentity.markPath`.
  - Set default mark to `/ordo-mark.png`.
- `src/lib/config/instance.schema.ts`
  - Added validation for optional `identity.markPath`.
- `src/components/shell/ShellBrand.tsx`
  - Uses `identity.markPath ?? identity.logoPath` for the visible shell mark.
  - Removes `theme-display` from the wordmark.
  - Adds `data-shell-brand-mark-source` for verification.
- `src/components/SiteNav.tsx`
  - Brand region now contains only `ShellBrand`.
  - `ShellWorkspaceMenu` moved to `account-access`.
- `src/components/ShellWorkspaceMenu.tsx`
  - Trigger uses a neutral SVG menu glyph instead of an Ordo image.
  - Drawer header uses `/ordo-mark.png`.
- `src/components/AuthenticatedWorkRail.tsx`
  - Adds mobile `Work` trigger and `Workspace controls` sheet.
  - Desktop rail remains route links plus jobs and attention utilities.
- `src/lib/shell/shell-navigation.ts`
  - Adds authenticated `/activity` route.
  - Adds `activity` to the authenticated work/account route set.
- `src/app/globals.css`
  - Adds `--font-brand`.
- `src/app/styles/foundation.css`
  - Adds `--font-brand` to design token defaults.
- `src/app/styles/shell.css`
  - Adds brand font rules, neutral menu glyph sizing, and mobile work sheet
    styles.

## Tests Updated

- `src/components/SiteNav.test.tsx`
- `src/components/AuthenticatedWorkRail.test.tsx`
- `src/components/ShellWorkspaceMenu.test.tsx`
- `tests/shell-brand.test.tsx`
- `tests/config-loader.test.ts`
- `src/lib/shell/shell-navigation.test.ts`
- `tests/shell-navigation-model.test.ts`
- `tests/job-visibility-solid.test.ts`
- `tests/site-shell-composition.test.tsx`
- `tests/homepage-shell-ownership.test.tsx`
- `tests/shell-acceptance.test.tsx`
- `tests/shell-visual-system.test.tsx`
- `tests/browser-ui/home-shell-header.spec.ts`

## Validation

Passed:

```bash
npm test -- --run src/components/SiteNav.test.tsx src/components/AuthenticatedWorkRail.test.tsx src/components/ShellWorkspaceMenu.test.tsx tests/shell-brand.test.tsx tests/config-loader.test.ts src/lib/shell/shell-navigation.test.ts tests/shell-navigation-model.test.ts tests/job-visibility-solid.test.ts tests/site-shell-composition.test.tsx tests/homepage-shell-ownership.test.tsx tests/shell-acceptance.test.tsx tests/shell-visual-system.test.tsx
```

Result:

- 12 test files passed.
- 111 tests passed.

Passed:

```bash
npx eslint src/components/SiteNav.tsx src/components/AuthenticatedWorkRail.tsx src/components/ShellWorkspaceMenu.tsx src/components/shell/ShellBrand.tsx src/lib/config/defaults.ts src/lib/config/instance.schema.ts src/lib/shell/shell-navigation.ts src/components/SiteNav.test.tsx src/components/AuthenticatedWorkRail.test.tsx src/components/ShellWorkspaceMenu.test.tsx tests/shell-brand.test.tsx tests/config-loader.test.ts src/lib/shell/shell-navigation.test.ts tests/shell-navigation-model.test.ts tests/job-visibility-solid.test.ts tests/site-shell-composition.test.tsx tests/homepage-shell-ownership.test.tsx tests/shell-acceptance.test.tsx tests/shell-visual-system.test.tsx
```

Passed:

```bash
npm run typecheck
```

Passed:

```bash
npx playwright test tests/browser-ui/home-shell-header.spec.ts
```

Result:

- 4 browser tests passed.
- Production build emitted existing Turbopack broad-trace warnings for
  `src/lib/user-files.ts`, `src/lib/appliance/native/native-binary-registry.ts`,
  and `next.config.ts`.

## QA Notes

- Initial implementation missed the Activity route in the authenticated work
  sheet. The route is now canonical in `shell-navigation.ts`.
- A stale job visibility assertion still expected `/api/chat/jobs` to use
  `getJobStatusQuery`; the current route delegates through platform interaction
  read facades. The test now asserts the current read facade contract.
- The mobile sheet links now use explicit `aria-label` values so descriptions do
  not pollute link accessible names.
