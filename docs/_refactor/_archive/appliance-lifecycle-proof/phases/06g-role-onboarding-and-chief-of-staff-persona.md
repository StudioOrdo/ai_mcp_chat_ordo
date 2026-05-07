# Phase 06G - Role Onboarding And Chief Of Staff Persona

Status: Planned

## Goal

Make Ordo's first-use experience understandable, friendly, and role-aware.

The anonymous experience should not be a sales assistant. It should feel like
the public face of the CEO's chief of staff: calm, useful, clear about what is
available publicly, and careful with access boundaries.

Each role should feel like a different level of access to the CEO's operating
system.

## Product Thesis

Ordo is the world's agentic system for a small business appliance. It must
handle many kinds of people without making them learn internal architecture
first.

The first interaction should answer:

- who am I speaking with?
- what can this role do?
- what is safe for me to ask?
- what is hidden because I do not have that access?
- what is the next useful move?

## Role Experience Model

### Anonymous - Public Front Office

The anonymous user is speaking with the public desk of the CEO's chief of
staff.

Behavior:

- helpful and calm
- not salesy
- explains Ordo plainly
- routes people to public docs, examples, or registration when relevant
- never implies privileged access
- never exposes staff/admin runbooks
- never pressures the visitor to sign up

Primary jobs:

- understand what Ordo is
- ask whether Ordo fits their situation
- browse public docs
- start a useful public conversation
- register only when they want a private workspace

### Authenticated - Customer Operator

The authenticated user is in their workspace.

Behavior:

- assumes real work is happening
- avoids marketing posture
- helps clarify, build, organize, publish, and decide
- teaches the user what tools are available without overwhelming them

Primary jobs:

- continue a conversation
- search their accessible library
- create or refine work
- understand what changed since last time
- learn how to use Ordo for their own workflow

### Apprentice - Guided Learner

The apprentice user is a learner or contributor who needs structure.

Behavior:

- supportive
- assignment-aware
- referral-aware where relevant
- patient and concrete
- explains why a next step matters

Primary jobs:

- complete assignments
- learn workflows
- understand referral/activity expectations
- ask for structured coaching

### Staff - Internal Operator

The staff user is part of the operating layer.

Behavior:

- concise
- service-aware
- support-oriented
- focused on risk, quality, handoff, diagnostics, and escalation
- does not grant admin-only destructive controls

Primary jobs:

- triage support
- inspect system health at staff-safe depth
- open staff runbooks
- prepare escalation notes
- understand customer-facing impact

### Admin - CEO / Founder Console

The admin user has the inner office.

Behavior:

- concise operator brief
- decision-oriented
- system-aware
- safe with destructive operations
- surfaces backup, health, restore, configuration, and revenue priorities

Primary jobs:

- understand appliance health
- configure the system
- run backup/restore workflows
- review operational risk
- make founder-level decisions

## Current Code Grounding

- `config/prompts.json`
  - currently defines anonymous first message, referral message,
    suggestions, and role bootstraps.
- `src/lib/config/defaults.ts`
  - mirrors the default prompt contract in code.
- `src/hooks/chat/chatState.ts`
  - creates initial chat messages by role.
  - anonymous has a separate first-message path.
  - non-anonymous roles use `roleBootstraps`.
- `src/core/entities/role-directive-assembler.ts`
  - defines role-level framing.
  - anonymous is currently framed as demo mode and sign-up encouragement.
  - this is the main source of salesy anonymous drift.
- `src/lib/lifecycle/coach-templates.ts`
  - defines installed, onboarded, role-changed, and tier-upgraded coach cards.
- `src/app/api/install/setup/route.ts`
  - creates or upgrades the first admin and queues the `installed` lifecycle
    event.
- `src/lib/lifecycle/onboarded.ts`
  - emits one-shot onboarding events for authenticated users.
- `src/hooks/chat/useLifecycleContext.ts`
  - appends lifecycle and coach cards for authenticated users.

## Required Changes

### 1. Rewrite Role Framing

Update `ROLE_FRAMING` in `role-directive-assembler.ts` so each role maps to the
experience model above.

Anonymous must stop being framed as "demo mode" and "encourage sign up" as the
default behavior.

Registration can still be mentioned when useful, but the default posture is:

> public chief-of-staff front office

### 2. Rewrite Default Prompt Copy

Update `config/prompts.json` and `DEFAULT_PROMPTS` so first-use copy matches
the role model.

Anonymous suggestions should be public-service oriented, for example:

- `What is Ordo?`
- `Show me what I can read`
- `Help me see if this fits`
- `Start with a real problem`

Admin suggestions should be appliance/operator oriented, for example:

- `Show operator brief`
- `Check appliance health`
- `Review backup status`
- `Open systems help`

### 3. Add Role-Aware First-Use Cards

Use the lifecycle/coach system and custom action messages to guide first users
of each role.

Admin after install should see:

- system installed
- health check action
- backup status action
- systems help action
- configure public face action

Authenticated user after registration should see:

- what they can do now
- private workspace continuity
- library/help entry
- first useful workflow prompt

Staff role-changed card should point to:

- staff systems help
- support triage
- health diagnostics
- escalation runbook

### 4. Connect Onboarding To `_corpus`

Use role-gated `_corpus` docs as the source for onboarding help.

Examples:

- anonymous: public "What is Ordo?" section
- authenticated: owner getting-started guide
- apprentice: learning path guide
- staff: staff operations guide
- admin: appliance operations guide

Cards should use `corpus` action links where possible.

### 5. Preserve Access Boundaries

Do not show buttons for tools or docs unavailable to the role.

Lower roles must not receive:

- admin restore buttons
- staff runbook links
- admin health internals
- install token language
- provider secret language

## SOLID/Clean/GOF Notes

- Single Responsibility: role framing stays in role directive assembly;
  first-message copy stays in prompt config; lifecycle cards stay in coach
  templates.
- Strategy: role onboarding should be modeled as strategy data per role, not
  scattered conditionals in UI components.
- Facade: chat surfaces should consume onboarding/card DTOs rather than
  reconstructing role logic.
- Policy: access decisions remain in role/tool/corpus policy, not copy.

## Positive Use Cases

- Anonymous visitor gets a clear, helpful public-facing answer without a sales
  pitch.
- New admin finishes install and immediately understands health, backup, and
  systems help.
- Registered user sees a friendly first-use path for real work.
- Staff gets operational guidance without admin-only destructive controls.
- Apprentice gets learning-oriented support.

## Negative Use Cases

- Anonymous user is not told they have full workspace access.
- Anonymous user is not pushed to sign up when the answer can be given
  publicly.
- Staff user does not get restore execution controls.
- Admin onboarding does not expose raw secrets.
- Copy does not imply unsupported platform/multi-tenant behavior.

## Edge Use Cases

- User changes role mid-session.
- Admin is the first user after install.
- Existing user is promoted to staff or admin.
- Anonymous conversation migrates to registered user.
- Instance has provider/image/audio capabilities disabled.
- Install is complete but appliance health is degraded.

## Tests And Evidence

Required tests:

- first-message tests for all roles
- role-directive tests proving anonymous is no longer sales/demo framed
- lifecycle coach tests for installed/onboarded/role-changed paths
- corpus ACL tests proving onboarding cards do not link hidden docs
- action-button tests proving role-specific onboarding does not show forbidden
  tools

Required evidence:

- before/after first-use copy snapshot
- role matrix for first messages, suggestions, allowed docs, and allowed
  actions
- screenshots or rendered test output for anonymous, authenticated, staff, and
  admin first-use states

## Exit Criteria

- Anonymous feels like the public front office of the CEO's chief of staff.
- Every role has a coherent first-use path.
- Role copy, role directives, lifecycle cards, and systems-help docs agree.
- Access boundaries are tested across docs, tools, cards, and routes.
- The onboarding experience helps users understand Ordo without requiring
  architectural knowledge.
