# Spec 05: Account, Profile, Referrals, And Preferences

Status: Draft spec

Evidence date: 2026-05-05

## Problem

The account menu should be personal identity and account settings only.

The current app already has a good account page structure, but the menu still
exposes user-owned work objects that should live in business governance
surfaces.

## Current Code Anchors

- `src/components/AccountMenu.tsx`
- `src/app/profile/page.tsx`
- `src/components/profile/ProfileSettingsPanel.tsx`
- `src/lib/profile/profile-service.ts`
- `src/lib/shell/shell-navigation.ts`

## Current Useful Functionality

Keep:

- profile user info form,
- credential field,
- referral code and QR display,
- preferences section,
- push notification controls,
- second-column account selector,
- mobile detail open state.

## Target Account Menu

Account menu:

- User info
- My Referrals
- Preferences
- Sign out

Header:

- display name,
- role label,
- initials/avatar,
- theme toggle.

Remove from account menu:

- My media,
- My conversations,
- My offers,
- My content,
- System.

Reasoning:

- Media belongs in Studio.
- Offers belong in Offers.
- Conversations and people belong in People.
- Content belongs in Studio/Feed.
- System belongs in admin rail.

## Target Account Page

Account route:

- `/profile`
- `/profile?section=referrals`
- `/profile?section=preferences`

Second column:

- User info
- My Referrals
- Preferences

Main pane:

- selected section detail.

Mobile:

- account second-column item selection opens detail,
- detail includes a back button to account list,
- direct URL to a section opens detail on mobile.

## My Referrals

The account referral section is a quick entry point, not the whole business
referral analytics surface.

It should show:

- referral code,
- QR code,
- public referral link,
- open full referrals workspace button when that workspace exists.

Performance and relationship motion belong in:

- People,
- Offers,
- Results,
- the full referrals workspace,
- section briefs.

## Preferences

Preferences can be minimal in this pass.

Allowed:

- theme toggle,
- push notification controls,
- in-development placeholder for future personal settings.

Do not overbuild preferences until a real user workflow needs it.

## Acceptance Criteria

- Account menu is short and account-owned.
- `My media` is gone from account menu.
- `System` is gone from account menu.
- Profile and Preferences route to the same account surface.
- My Referrals replaces `My QR / referral link` copy.
- Mobile account sections drill into detail and expose back-to-list.

## Tests

Positive:

- account menu renders User info, My Referrals, Preferences, Sign out.
- account route renders second column sections.
- `section=referrals` shows QR/referral section.
- mobile selected section shows a back control.

Negative:

- account menu does not render My media, My conversations, My offers, My
  content, or System.
- anonymous user cannot access account profile.

Edge:

- user without referral code gets a quiet unavailable or enablement state.
- preferences placeholder does not claim unavailable features are working.

