# Target Architecture

## Core Pattern
1. User intent enters through chat or UI.
2. Ordo classifies role, context, and business unit.
3. Prompt/tool exposure is projected from the catalog and context policy.
4. A business-unit service executes through existing runtime bindings.
5. Durable state is projected through read models.
6. Events are written to jobs, timelines, inbox/attention, and notifications.
7. UI presents state through product surfaces, not raw tool internals.

## Control Plane
`CAPABILITY_CATALOG` remains the technical control plane.

Add product-level projection policy on top:
- executable by role;
- visible in default prompt;
- visible only after detected intent;
- operator/staff/admin only;
- internal/UI-only;
- notification/event behavior;
- business-unit ownership.

Do not fork new registries. Project from catalog/runtime metadata.

## Prompt Exposure Policy
Execution permission and prompt visibility are different.

Example:
- `set_theme` is executable and should be easy to expose for all users because
  it is accessibility/personalization.
- `inspect_runtime_logs` is executable only for admin and should never appear
  in normal user context.
- `list_my_referral_activity` is executable for authenticated users, but should
  be default-visible only in affiliate/referral context.

Suggested visibility classes:
- `default`: visible in normal conversations for eligible role.
- `intent_gated`: visible when classifier/context says the user is asking for
  that office/service.
- `operator_only`: visible in staff/admin operations mode.
- `admin_only`: visible only to admin.
- `internal_only`: executable by UI/system but not prompt-visible.

## Business-Unit Service Boundary
Business units own product services. They may call shared services, but they do
not own shared infrastructure.

Example:
- Referral Office can use Identity & Access for affiliate enablement and
  Notification/Inbox to inform the user.
- Media Studio can use Asset Catalog and Job Operations.
- Product Factory can use Job Operations, Execution Timeline, and Revision.
- Founder Coach can read Workspace, Jobs, Knowledge, and Inbox, but should not
  mutate everything directly.

## Attention Ledger / Inbox
Notifications need durable attention state.

The inbox answers:
- What happened?
- Was the user told?
- Does it need action?
- Was it acknowledged, dismissed, or resolved?
- What entity/job/work-order/referral/deal does it relate to?

Initial sources:
- job completed/failed;
- work order paused/needs decision;
- affiliate/referral milestone;
- lead/deal/training next action;
- storage/quota warning;
- bug/support response;
- config or role change;
- coach/daily review item.

## Config Surface
Configuration should exist in two forms:
- precise UI pages for admin/user settings;
- conversational configuration later, governed by policy, confirmation, and
  audit events.

Config domains:
- profile/preferences/theme/accessibility;
- roles and tool assignment;
- affiliate QR enablement;
- notifications/inbox preferences;
- business-unit enablement;
- prompt behavior and governance;
- media/storage quotas.

## SOLID / Clean / DRY / GoF
- Single Responsibility: business units expose product services; shared
  infrastructure handles identity, jobs, assets, memory, and notifications.
- Open/Closed: new product services are added through catalog policy and
  business-unit services, not hardcoded prompt branches.
- Interface Segregation: UI, chat, and admin pages consume read models suited
  to their surfaces.
- Dependency Inversion: business-unit services depend on ports/readers/facades,
  not data mappers.
- DRY: catalog metadata projects tool schemas, prompt exposure, presentation,
  jobs, and MCP exports.
- Facade: Ordo/chief-of-staff surface orchestrates business units without
  leaking internal steps.
- Strategy: intent/context policy selects prompt/tool exposure.
- Adapter: existing persistence/routes/MCP sidecars adapt into product services.
- CQRS: use summary read models for list surfaces and full aggregates only for
  details/mutations.

## Non-Goals For This Package
- Do not add many new agent tools immediately.
- Do not build autonomous business-unit agents talking to each other freely.
- Do not preserve legacy tool names if a hard cutover is safer.
- Do not make notifications equivalent to push delivery only.
- Do not hide theme/accessibility; this is a product differentiator.

