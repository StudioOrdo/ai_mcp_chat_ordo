Implement /Users/kwilliams/Projects/ordoSite/docs/_refactor/ordo/phases/01c3ay-system-sections-and-backup-restore-brief-parity.md

Heads down.

This phase makes System the single admin governance surface for diagnostics,
backup/restore, jobs, visibility, prompts, operations, logs, keys, and
provider/tool detail while preserving backup/restore as the model for durable
background brief work. Do not expose System to owner/public IA and do not
redesign the backup engine.

Follow the phase spec exactly. Treat these as governing contracts:
- docs/_refactor/ordo/letters/refactor1.md
- docs/_business/ux/08-product-kernel-contract.md
- docs/_business/ux/09-canonical-ux-architecture.md
- docs/_business/ux/00-ux-north-star.md
- docs/_business/ordo_process.md
- docs/_refactor/ordo/phases/02-ui-surface-realignment/08-studio-jobs-and-background-briefs.md
- docs/_refactor/ordo/phases/02-ui-surface-realignment/02-shared-surface-frame-contract.md
- docs/_refactor/ordo/phases/02-ui-surface-realignment/07-placeholder-read-model-policy.md
- docs/_refactor/ordo/phases/01c3aq-route-registry-and-shell-contract-lock.md
- docs/_refactor/ordo/phases/01c3ar-shared-frame-compliance-sweep.md
- docs/_refactor/ordo/phases/01c3ax-knowledge-base-surface.md

Core invariant:
Chat is the operating interface. UI surfaces are the governance layer.

Phase scope:
- Make `/admin/system` render System Brief at base route.
- Ensure System second column selects sections and selected sections expose
  linked/embedded admin-safe page content.
- Ensure backups and restore plans are usable from System.
- Ensure jobs diagnostics remain admin-only under System/Admin.
- Document backup/restore command semantics as the reliability model for
  background brief updates.
- Do not expose System in the account menu, public nav, owner rail, or owner
  surfaces.
- Do not add owner System affordances, new backup engine behavior, prompt
  editing redesign, or raw logs in owner UI.

Before editing:
1. Read the phase spec.
2. Read every governing doc above.
3. Research every current-code anchor named in the phase:
   - src/app/admin/system/page.tsx
   - src/components/admin/system/AdminSystemWorkspace.tsx
   - src/lib/admin/system/load-admin-system-workspace.ts
   - src/app/admin/system/backups/page.tsx
   - src/app/admin/system/keys/page.tsx
   - src/app/admin/system/operations/page.tsx
   - src/app/admin/system/tools/page.tsx
   - src/app/admin/jobs/page.tsx
   - src/app/admin/prompts/page.tsx
   - src/app/admin/content-visibility/page.tsx
   - src/lib/appliance/backup/*
   - crates/ordo-backup
4. Verify which phase claims are implemented, missing, stale, or wrong.
5. Identify System read models, section ids, linked donor pages, backup/restore
   service boundaries, role gates, tests, and current copy boundaries.
6. Preserve unrelated worktree changes.
7. Do not invent new architecture if existing System, backup, jobs, prompt,
   visibility, operations, keys, shell, or GovernanceSectionFrame code can be
   reused or reframed.

Architecture rules:
- System is admin-only.
- `/admin/system` is the canonical admin governance surface for diagnostics.
- System base route renders System Brief.
- The System second column selects admin sections, not owner objects.
- Selected System section renders one section at a time.
- Backup and restore controls must preserve existing confirmation and command
  semantics.
- Jobs, providers, payloads, logs, keys, operation ids, and diagnostics may
  appear only inside admin-gated System/Admin routes.
- Account menu must not show System.
- Public nav and owner rail must not show System.
- Owner surfaces must not link to raw jobs/logs/provider/payload pages except
  through role-gated admin-safe source links where already authorized.
- Brief/background intelligence work must follow durable request/result/
  reconcile semantics modeled on backup/restore; document the model, do not
  implement broad brief generation here unless the phase explicitly requires it.
- Do not fake health, backup, restore, job, provider, or key status.
- Placeholders must be deterministic, explicit, limited, and replaceable.

Implement end to end:
- update code,
- add or update positive, negative, and edge tests from the phase,
- preserve role/access/privacy boundaries,
- preserve provenance/evidence/source-link paths,
- preserve chat-first behavior,
- keep raw diagnostics out of regular owner/public UI,
- update phase docs and evidence docs with what actually changed.

Prompt handoff requirement:
At closeout, write the next phase execution prompt to:

docs/_refactor/ordo/prompts/next.md

Also copy the same prompt to:

docs/_refactor/ordo/prompts/archive/01c3az-brief-storage-and-background-intelligence-closeout.md

The next prompt must target:

/Users/kwilliams/Projects/ordoSite/docs/_refactor/ordo/phases/01c3az-brief-storage-and-background-intelligence-closeout.md

The prompt must include:
- exact phase file path,
- governing docs,
- phase-specific scope boundaries,
- current-code anchors from the phase,
- architecture rules,
- QA pass 1 and QA pass 2 instructions,
- required commands,
- static scans,
- visual QA expectations,
- final answer requirements,
- the same prompt handoff requirement for the following phase.

QA pass 1:
- run the exact required commands from the phase,
- run focused related tests for touched System, backup, restore, jobs, shell,
  and admin route code,
- run typecheck/lint/CSS lint where relevant,
- inspect System for UX/product drift against every governing doc,
- inspect admin role-gate behavior,
- fix every issue found.

QA pass 2:
- rerun phase tests and focused related tests after fixes,
- rerun typecheck/lint if code changed during QA pass 1,
- run the static scans named in the phase,
- verify no System, backups, restore, jobs, provider, keys, logs, operation,
  payload, or diagnostic controls leak into account/public/owner UI,
- verify backup/restore command semantics remain preserved,
- verify docs/evidence match the final implementation,
- verify docs/_refactor/ordo/prompts/next.md contains the next prompt for
  01c3az,
- fix every issue found.

Required commands:
- npx vitest run src/components/admin/system/AdminSystemWorkspace.test.tsx src/lib/admin/system/load-admin-system-workspace.test.ts src/app/admin/system/backups/page.test.tsx src/lib/appliance/backup/backup-command-service.test.ts src/app/api/admin/system/backups/route.test.ts src/app/api/admin/system/restore-plans/[planId]/execute/route.test.ts src/lib/shell/shell-navigation.test.ts
- npm run typecheck
- npm run lint:css
- npm run lint -- src/components/admin/system/AdminSystemWorkspace.tsx src/lib/admin/system/load-admin-system-workspace.ts src/app/admin/system/backups/BackupSelfServiceManager.tsx src/lib/appliance/backup/backup-command-service.ts src/lib/shell/shell-navigation.ts

Static scans:
- rg -n "System|Backups|Restore|Jobs|Provider|Keys|Logs|Operations|payload|command" src/app src/components src/lib
- rg -n "System|Backups|Restore|Jobs|Provider|Keys|Logs|Operations|payload|command" src/components src/app | grep -v "src/components/admin" | grep -v "src/app/admin" || true

Visual QA:
- If the dev server and session state are usable, inspect System overview,
  backups, restore plans, and jobs sections on desktop and mobile.
- If screenshots cannot be captured, document why and rely on DOM/CSS/test/static
  evidence.

Do not stop until:
- implementation is complete,
- all required tests pass,
- both QA passes are complete,
- static scans are reviewed,
- phase docs/evidence are updated,
- next prompt handoff files are written,
- final answer lists files changed, tests run, QA pass 1 fixes, QA pass 2
  fixes, visual QA status, next prompt files written, and remaining explicit
  risks.
