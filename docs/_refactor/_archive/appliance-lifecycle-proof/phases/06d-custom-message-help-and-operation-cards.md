# Phase 06D - Custom Message Help And Operation Cards

Status: Planned

## Goal

Use custom chat messages and buttons as the guided interface for systems help
and appliance operations.

The user should not need to remember commands, exact backup IDs, restore
phrases, or library routes. The conversation should project safe next actions
as explicit buttons.

## Current Code Grounding

- `src/core/entities/rich-content.ts`
  - `action-link` supports `route`, `tool`, `corpus`, `send`, and other action
    types.
- `src/frameworks/ui/chat/primitives/CapabilityActionRail.tsx`
  - renders action links as buttons.
  - infers primary/danger/secondary intent from action labels and values.
- `src/frameworks/ui/chat/plugins/custom/ApplianceBackupCard.tsx`
  - renders backup/restore cards.
- `src/core/use-cases/tools/appliance-backup.tool.ts`
  - attaches tool action links to backup, restore, command, and policy results.
- `src/frameworks/ui/useChatSurfaceState.tsx`
  - handles `corpus` actions by routing to library sections.

## Design

Add a systems-help card family that can present:

- a short answer
- a relevant documentation section
- visible audience label where useful for admin/staff contexts
- action buttons:
  - open corpus section
  - run a safe diagnostic
  - list backups
  - create backup
  - validate backup
  - prepare restore
  - inspect health
  - open admin page

Buttons must be generated from role-aware tool/corpus results. The UI should
not invent privileged actions for lower roles.

## Interaction Principles

- Prefer buttons for exact operations.
- Prefer `corpus` actions for docs navigation.
- Prefer `tool` actions for governed operations.
- Prefer `route` actions for admin/staff pages.
- Keep destructive actions behind the existing confirmation/safety pipeline.

## Positive Use Cases

- Admin asks "is my appliance safe?" and receives health plus action buttons.
- Admin asks "backup now" and receives an explicit create-backup button.
- Admin lists backups and each restorable snapshot offers validate/prepare
  buttons.
- Staff asks "why is this blocked?" and receives staff docs plus diagnostics.

## Negative Use Cases

- Authenticated non-admin does not receive restore execution buttons.
- Staff-only docs do not produce admin-only tool actions unless the viewer is
  admin.
- A failed tool result does not render success-looking buttons.

## Edge Use Cases

- Backup command is queued and status changes later.
- Restore plan expires or is canceled.
- Health is blocked because install is incomplete.
- Corpus section is no longer visible to the viewer role.

## Exit Criteria

- Systems-help card renderer exists or an existing capability card is extended
  cleanly.
- Buttons are visually obvious as buttons, not muted inline links.
- Action generation is role-aware and tested.
- Help cards can route to corpus docs and trigger safe governed tools.
