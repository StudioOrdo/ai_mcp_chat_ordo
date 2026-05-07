# Phase 01e: Public Motion, Scrollytelling, And Responsive Polish

Status: Planned

Parent phase:

- `01-public-site-shell-and-navigation.md`

Depends on:

- `01a-public-shell-chat-and-ui-audit.md`
- `01b-route-access-and-public-surface-contract.md`
- `01c-public-navigation-footer-and-mobile-system.md`
- `01c6-navigation-regression-cleanup-and-closeout.md`
- `01d-conversational-homepage-composition.md`

## Goal

Adapt the best ideas from `../testing` to make the public Ordo experience feel
striking without making the site heavy, fragile, or confusing.

The target is not a slide deck. The target is an agentic public surface with
controlled sections, visible route orientation, and motion that helps the user
understand where they are.

## Product Rule

Motion should orient, not decorate.

The regular management/audit UI must stay stable and low-motion. This phase is
public shell/homepage polish only.

## Blast Radius

Public homepage sections, public footer behavior, public bottom navigation,
responsive CSS, reduced motion behavior, and browser/mobile tests.

Do not add scrollytelling to admin, operations, workflows, jobs, or asset
management pages.

## Current Code To Research

Current Ordo:

- `src/app/page.tsx`
- `src/components/SiteNav.tsx`
- `src/components/AppShell.tsx`
- `src/frameworks/ui/ChatSurface.tsx`
- `src/app/styles/**`
- browser/mobile public tests

Reference patterns:

- `../testing/components/layouts/PresentationLayout.tsx`
- `../testing/components/motion/PresentationSlide.tsx`
- `../testing/components/motion/PresentationFooterGate.tsx`
- `../testing/components/motion/PresentationProgress.tsx`
- `../testing/components/motion/PresentationShortcuts.tsx`
- `../testing/components/motion/presentation-nav.ts`
- `../testing/components/motion/Reveal.tsx`
- `../testing/components/motion/SceneCard.tsx`
- `../testing/components/site-footer.tsx`
- `../testing/app/globals.css`
- `../testing/tests/browser/presentation.spec.ts`

## Adopt / Adapt / Reject Guidance

Adopt:

- sticky section concept where the first scene can feel locked and intentional,
- footer gate/compaction idea for public route orientation,
- responsive safe padding and short-viewport handling,
- browser tests that verify structural motion behavior.

Adapt:

- progress rail only if the homepage has enough sections to need orientation,
- keyboard shortcuts only if they do not interfere with chat composer input,
- reveal animations as CSS or existing stack unless a new dependency is
  justified.

Reject for Phase 01:

- full slide-deck engine,
- motion blur/parallax that makes text harder to read,
- hidden footer during normal public browsing if it hides route discovery,
- adding `framer-motion` only for decorative effects.

## Required Work

- Define homepage section behavior for desktop and mobile.
- Add reduced-motion behavior.
- Keep chat composer clear of bottom/footer chrome.
- Keep footer/bottom navigation visible or quickly recoverable.
- Preserve the Phase 01c role-aware navigation split; do not reintroduce the
  old drawer-first public discovery pattern for motion convenience.
- Add browser/mobile tests for non-overlap and route visibility.

## Positive Tests

- Homepage sections render without overlap on desktop and mobile.
- Public footer/bottom navigation remains usable.
- Reduced-motion users get static, readable sections.
- Chat composer remains usable.

## Negative Tests

- Motion does not hide required public routes.
- Motion does not apply to admin/workspace/operations pages.
- Keyboard shortcuts do not hijack typing in chat input.

## Edge Tests

- Very short viewport.
- Mobile Safari-sized viewport.
- Empty feed/offers.
- Slow image/media loading.
- Reduced motion enabled.

## Cleanup

- Remove visual ideas that are impressive but do not improve comprehension.
- Keep CSS tokens and component boundaries local to the public shell until they
  prove reusable.

## Exit Criteria

- Public Ordo feels distinct and intentional.
- Motion improves orientation without hiding routes or blocking conversation.
- Desktop and mobile screenshots/tests prove layout stability.
