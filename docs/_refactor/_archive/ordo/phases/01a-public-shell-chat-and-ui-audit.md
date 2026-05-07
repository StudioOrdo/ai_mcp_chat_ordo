# Phase 01a: Public Shell, Chat, And UI Audit

Status: Complete

Parent phase:

- `01-public-site-shell-and-navigation.md`

## Goal

Collect the evidence needed to redesign the public shell without guessing.

This phase is diagnosis only. It must deeply inspect how Ordo currently renders
the homepage, chat messages, first assistant message, public shell, command
surface, footer, mobile layout, and public route leakage. It must also inspect
`../testing` for scrollytelling and footer ideas that can be adapted without
turning Ordo into a slide deck.

## Product Thesis To Validate

Ordo should not feel like a normal website with a chatbot. It should feel like
an agentic operating surface whose public face is conversational.

The public site should still be simple enough for a solopreneur:

- useful with zero feed posts,
- useful with one configured offer,
- clear on mobile,
- inspectable when work happens,
- visually distinct from a generic landing page.

## Blast Radius

Docs and evidence only.

Do not edit application code in this phase.

## Current Code To Research

Homepage and chat:

- `src/app/page.tsx`
- `src/frameworks/ui/ChatSurface.tsx`
- `src/frameworks/ui/useChatSurfaceState.tsx`
- `src/frameworks/ui/ChatMessageViewport.tsx`
- `src/frameworks/ui/ChatMessageViewport.test.tsx`
- `src/adapters/ChatPresenter.ts`
- `src/lib/config/defaults.ts`
- `tests/first-message-flow.test.tsx`
- `tests/homepage-shell-layout.test.tsx`
- `tests/homepage-shell-ownership.test.tsx`
- `tests/homepage-shell-evals.test.tsx`

Public shell and navigation:

- `src/components/SiteNav.tsx`
- `src/components/AppShell.tsx`
- `src/components/ShellWorkspaceMenu.tsx`
- `src/components/ShellNavDrawer.tsx`
- `src/components/AccountMenu.tsx`
- `src/lib/shell/shell-navigation.ts`
- `src/lib/shell/shell-commands.ts`
- `tests/shell-acceptance.test.tsx`
- `tests/site-shell-composition.test.tsx`
- `tests/shell-command-parity.test.ts`
- `tests/shell-navigation-model.test.ts`

Public leakage:

- `src/app/not-found.tsx`
- `src/app/sitemap.ts`
- `src/app/robots.ts`
- `src/frameworks/ui/RichContentRenderer.tsx`
- `tests/public-content-routes.test.ts`
- `tests/seo-infrastructure.test.ts`
- `tests/evals/eval-runner.test.ts`

Motion/reference system:

- `../testing/components/layouts/PresentationLayout.tsx`
- `../testing/components/motion/PresentationSlide.tsx`
- `../testing/components/motion/PresentationFooterGate.tsx`
- `../testing/components/motion/PresentationProgress.tsx`
- `../testing/components/motion/PresentationShortcuts.tsx`
- `../testing/components/motion/presentation-nav.ts`
- `../testing/components/site-footer.tsx`
- `../testing/app/globals.css`
- `../testing/tests/browser/presentation.spec.ts`

## Required Evidence

Create an evidence file:

- `../evidence/phase-01a-public-shell-chat-ui-audit.md`

It must record:

- current homepage render path,
- current first-message and suggestion path,
- current chat message composition path,
- current public nav/footer/drawer/command path,
- current mobile behavior and tests,
- current library/journal/blog public leakage,
- current public empty-state capabilities,
- useful `../testing` patterns and what not to copy,
- exact tests that Phase 01b-01f should update or replace.

## Positive Use Cases

- Future implementer knows which code owns the homepage and message behavior.
- Future implementer knows which tests currently encode old public shell truth.
- The team can decide how much scrollytelling to use without importing a visual
  system blindly.

## Negative Use Cases

- Evidence must not propose public library compatibility.
- Evidence must not treat feed content as required for the solopreneur launch
  experience.
- Evidence must not recommend hidden left-menu navigation as the primary public
  discovery pattern.

## Edge Use Cases

- Empty feed.
- No configured offers.
- Anonymous referral visitor.
- Mobile viewport with the chat composer visible.
- Reduced-motion user preference.

## Exit Criteria

- Evidence file exists.
- Evidence names exact code and test anchors for Phase 01b-01f.
- `../testing` patterns are classified as adopt, adapt, or reject.
- No application code changed.

## Completion Notes

Executed on 2026-05-04.

Evidence:

- `../evidence/phase-01a-public-shell-chat-ui-audit.md`

Outcome:

- Confirmed `/` already renders as an embedded chat-first surface.
- Confirmed public shell route truth still exposes Library and Journal through
  navigation, footer, drawer, commands, sitemap, robots, not-found recovery,
  chat action links, rich content links, about-page copy, and tests.
- Confirmed `/feed` and `/offers` do not exist yet.
- Confirmed `../testing` should influence sticky public sections, footer/bottom
  chrome, safe-area handling, and browser tests, but not be copied as a full
  slide-deck engine.
- Confirmed Phase 01b-01f should proceed in this order: route contract, visible
  navigation, chat-first homepage copy, motion/responsive polish, stale
  reference closeout.

Application code changed:

- No.
