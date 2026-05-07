# Admin, Observability, Appliance, And Governance

## UX Intent

Admin is a different mode from the solo operator's daily work. It should expose
system governance, diagnostics, security, prompts, users, backups, and runtime
health without polluting the public or regular authenticated experience.

The UX target is a left-side vertical admin rail, clear diagnostic tables, and
actionable system cards.

## Existing Code Evidence

Admin routes:

- `src/app/admin/page.tsx`
- `src/app/admin/layout.tsx`
- `src/app/admin/users/**`
- `src/app/admin/conversations/**`
- `src/app/admin/leads/**`
- `src/app/admin/deals/**`
- `src/app/admin/jobs/**`
- `src/app/admin/journal/**`
- `src/app/admin/prompts/**`
- `src/app/admin/training/**`
- `src/app/admin/content-visibility/page.tsx`
- `src/app/admin/system/**`

Admin components:

- `src/components/admin/**`
- `src/lib/admin/admin-navigation.ts`
- `src/lib/admin/admin-routes.ts`
- `src/lib/admin/shared/**`

Observability and notifications:

- `src/lib/activity/**`
- `src/components/AttentionInbox.tsx`
- `src/lib/admin/notifications/**`
- `src/lib/observability/**`
- `src/lib/diagnostics/**`
- `src/app/api/notifications/**`
- `push_subscriptions`
- `activity_receipts`

Appliance/system:

- `src/lib/appliance/**`
- `crates/**`
- `src/app/admin/system/backups/**`
- `src/app/admin/system/tools/**`
- `src/app/admin/system/keys/**`
- `src/app/admin/system/operations/**`
- `src/app/api/health/live/route.ts`
- `src/app/api/health/ready/route.ts`

Tests:

- `src/app/admin/**.test.tsx`
- `src/lib/admin/**.test.ts`
- `src/lib/appliance/**.test.ts`
- `src/app/api/admin/**.test.ts`
- `src/app/api/notifications/**.test.ts`
- `src/lib/activity/**.test.ts`
- `src/lib/health/probes.test.ts`

## Current Functionality

Admin already supports:

- users and roles
- conversations and retention actions
- leads/deals
- jobs and job detail/export
- journal/editorial management
- prompt governance
- content visibility audit
- training manuals with audience access
- system health
- tool availability
- key/config validation
- backup/restore policy, snapshots, plans, operations, and native Rust executor
- admin search
- admin notification/signal evaluation

Appliance work supports:

- install/setup validation
- health facade/probes
- backup archive service and validation
- backup command service
- backup scheduler
- restore safety pipeline
- native binary registry/contract/reconciler
- runtime profile and resource pressure probes
- release/image provenance tooling

## UX Mapping

| Existing system | UX meaning | Surface |
| --- | --- | --- |
| Admin pages | System governance | Admin rail |
| Jobs admin | Queue diagnostics | Admin/diagnostic |
| Prompts admin | Behavior governance | Admin |
| Content visibility admin | Access-control audit | Admin |
| System tools/keys | Runtime configuration | Admin |
| Backup/restore | Appliance trust and recovery | Admin |
| Activity taxonomy | Attention/read-state donor | Today/Admin |
| Notifications | Delivery channel, not primary nav | Today/Admin |

## Product Requirements

1. Admin must be visually separate from normal operator work.
2. Admin navigation should use a vertical rail.
3. Diagnostic labels are acceptable in admin, but regular UI should translate
   them.
4. Jobs, notifications, route metrics, provider logs, and MCP/native process
   logs stay admin/diagnostic unless explicitly projected.
5. Backup/restore actions require clear confirmation and evidence.
6. Prompt changes should preserve versions and activation evidence.
7. Content visibility drift should stay easy to audit.

## Gaps

- Admin surfaces are numerous and need navigation consolidation.
- Today now absorbs owner-safe activity, results, weak signals, and next
  actions. Remaining admin signals must stay diagnostic/admin-only.
- Appliance health should have a tiny regular-user status, with detail in admin.
- System event language needs separation from user-facing work.

## Tests To Preserve Or Add

Existing:

- admin page tests
- admin jobs/actions tests
- prompt control plane tests
- content visibility tests through access functions
- appliance backup/restore tests
- health/probe tests
- notification API tests

Add:

- admin rail contains governance routes and regular operator nav does not
- backup/restore confirmation cards are impossible to mistake for suggestions
- content visibility audit catches public/private drift
- notifications are projected into Today/Studio/People instead of standalone
  top-right clutter
