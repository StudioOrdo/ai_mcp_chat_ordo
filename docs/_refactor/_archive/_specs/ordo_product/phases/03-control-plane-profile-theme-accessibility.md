# Phase 03 - Control Plane, Profile, Theme, And Accessibility

## Objective
Make profile, preference, theme, and accessibility behavior reliable,
per-user-aware, and product-visible without treating it as optional UI clutter.

## Product Rules
- All users can change theme/accessibility.
- Anonymous theme/accessibility persists locally/cookie.
- Authenticated theme/accessibility persists to user preferences.
- Profile changes require authenticated identity.
- Conversational config should be governed and confirm risky changes later.

## Current Code Grounding
- `set_theme`, `adjust_ui`, `inspect_theme`, `set_preference` exist.
- `get_my_profile`, `update_my_profile` exist.
- `src/lib/theme/theme-state.ts` and `theme-manifest.ts` define theme state.
- `src/app/api/preferences/route.ts` persists preferences.
- Profile service and profile route already exist.

## Implementation Steps
1. Audit theme persistence for anonymous and authenticated paths.
2. Ensure theme/accessibility tools are role/context visible as product
   differentiators.
3. Clarify descriptions around accessibility/readability.
4. Verify per-user preference writes do not leak across users.
5. Define future control-plane config domains without implementing all of them.

## Tests
- Anonymous can request theme/accessibility change without auth-only failure.
- Authenticated preference changes persist per user.
- Another user's preferences are never read/written.
- Accessibility context exposes theme/UI tools.

## Done Criteria
- Theme/accessibility is treated as core product UX.
- Profile/preferences are reliable per user.

