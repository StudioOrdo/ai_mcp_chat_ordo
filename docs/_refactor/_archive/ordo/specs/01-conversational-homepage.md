# Spec 01: Conversational Homepage

## Goal

Make the homepage the product: a public conversational entry point where the
default assistant message functions as the hero section and the primary calls to
action are chat engagements.

## Current Code To Use

- `src/app/page.tsx` already renders `ChatSurface`.
- `src/lib/config/defaults.ts` has `prompts.heroHeading`,
  `heroSubheading`, `firstMessage`, and suggestions.
- `src/frameworks/ui/ChatSurface` and `src/frameworks/ui/useChatSurfaceState.tsx`
  own chat state.
- `src/components/SiteNav.tsx` owns public nav.
- `tests/homepage-shell-layout.test.tsx`, `tests/homepage-shell-ownership.test.tsx`,
  and `tests/first-message-flow.test.tsx` cover homepage/chat behavior.

## Required Work

- Keep `/` chat-first.
- Ensure the first public assistant message is configurable and mission-aligned.
- Add clear public CTA suggestion buttons that map to safe public intents:
  explain Ordo, explore feed, view offers, ask a business question, register.
- Avoid static marketing hero duplication.
- Ensure anonymous chat tone is the public face of the CEO's chief of staff,
  not a sales persona.

## Cleanup After Replacement

- Remove homepage copy paths that compete with the first chat message.
- Remove public suggestions that route to library/corpus by default. The public
  homepage should point to feed, offers, about, account creation, or safe
  conversation.

## Positive Tests

- Anonymous `/` renders chat and default public assistant message.
- Configured first message and suggestions appear.
- CTA suggestions do not require authentication unless explicitly labeled.

## Negative Tests

- Anonymous homepage must not expose admin/staff tools.
- Homepage must not imply content exists in an empty feed.
- Homepage must not route public users to library/corpus, journal, or blog.

## Edge Tests

- Missing identity config uses defaults.
- Referral visitor receives referral-aware first message without exposing
  referrer private data.
- Installed but unconfigured optional tools do not appear in suggestions.
