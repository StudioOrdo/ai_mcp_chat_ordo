# Phase 07 - Staff/Admin Operations And User Management

## Objective
Separate staff support, admin operations, user management, role changes,
affiliate enablement, logs, and system config into governed surfaces.

## Product Rules
- Staff can support users and review business operations.
- Staff should not get logs or system config by default.
- Admin can manage users, roles, affiliate QR enablement, prompts, config, and
  diagnostics.
- Conversational role/config changes must require authorization and confirmation.

## Current Code Grounding
- Auth/roles/user admin pages exist.
- Profile and preferences exist.
- Admin routes for users, affiliates, jobs, prompts, leads, conversations exist.
- `inspect_runtime_logs` and operations MCP are admin-grade diagnostics.

## Implementation Steps
1. Audit staff/admin role boundaries.
2. Define user-management control-plane services and UI first.
3. Ensure affiliate QR enablement is a governed admin/profile operation.
4. Keep conversational config as a later governed layer.
5. Add audit/inbox events for role/config changes.

## Tests
- Staff cannot inspect runtime logs.
- Admin can inspect logs.
- Staff/admin affiliate operations are separated from user-owned affiliate data.
- Role/config changes require admin policy.
- Config changes produce attention/audit events.

## Done Criteria
- Staff and admin are not treated as the same role.
- User management and affiliate enablement have clear governance.

