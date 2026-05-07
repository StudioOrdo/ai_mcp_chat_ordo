# Phase 06E - Admin And Staff Help Surfaces

Status: Planned

## Goal

Expose systems help where operators already work: chat, admin pages, and staff
support pages.

The help system should be available at the moment of need, not only as a
separate library page.

## Current Code Grounding

- `src/app/admin/*`
  - existing admin surfaces already gate operational pages.
- `src/app/admin/content-visibility/page.tsx`
  - already reads corpus visibility metadata.
- `src/app/admin/training/*`
  - demonstrates admin-facing corpus navigation using audience metadata.
- `src/lib/appliance/health-facade.ts`
  - provides shared appliance status.
- `src/lib/appliance/backup/backup-self-service.ts`
  - provides shared backup/restore operations.
- `src/core/use-cases/tools/appliance-backup.tool.ts`
  - exposes admin-only conversation tools.

## Design

Add role-appropriate entry points:

- Admin systems help panel
  - appliance status
  - runbook links
  - backup/restore actions
  - health explanation
- Staff systems help panel
  - support diagnostics
  - escalation runbooks
  - hosted-instance troubleshooting
- Chat systems help behavior
  - answers grounded in `_corpus`
  - cards/buttons when an action is available
  - no hidden content leakage

## SOLID/Clean/GOF Notes

- Admin/staff pages consume shared read models and services.
- Chat tools and pages use the same backing services.
- UI components render state; they do not decide operational truth.
- Role checks stay in route/tool/service policy, with UI hiding only as a
  convenience.

## Positive Use Cases

- Admin opens one page and sees health, backup policy, and relevant runbooks.
- Staff can quickly find support docs without admin destructive controls.
- Conversation help can deep-link to exact runbook sections.

## Negative Use Cases

- Lower roles cannot navigate to staff/admin help surfaces.
- Staff cannot execute admin-only restore actions.
- Admin page does not expose raw secrets.

## Edge Use Cases

- Install incomplete.
- Provider configured by file secret.
- Hosted origin invalid.
- Disk pressure blocks backup/restore.
- Rust executor missing.

## Exit Criteria

- Admin and staff systems help surfaces exist or current pages are extended.
- They use `_corpus` as source for runbook links.
- They use shared health/backup read models.
- Route and tool access are tested for role boundaries.
