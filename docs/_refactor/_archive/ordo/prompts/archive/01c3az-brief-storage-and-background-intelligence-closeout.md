Implement /Users/kwilliams/Projects/ordoSite/docs/_refactor/ordo/phases/01c3az-brief-storage-and-background-intelligence-closeout.md

Heads down.

This phase closes the durable brief/background intelligence loop. Do not drift
into scheduler implementation, new LLM provider integration, prompt tuning UI,
new owner surface redesign, or broad backup engine redesign.

Follow the phase spec exactly. Treat these as governing contracts:
- docs/_refactor/ordo/letters/refactor1.md
- docs/_business/ux/08-product-kernel-contract.md
- docs/_business/ux/09-canonical-ux-architecture.md
- docs/_business/ux/00-ux-north-star.md
- docs/_business/ordo_process.md
- docs/_refactor/ordo/phases/02-ui-surface-realignment/04-owner-intelligence-brief-surfaces.md
- docs/_refactor/ordo/phases/02-ui-surface-realignment/08-studio-jobs-and-background-briefs.md
- docs/_refactor/ordo/phases/02-ui-surface-realignment/07-placeholder-read-model-policy.md
- docs/_refactor/ordo/phases/01c3aq-route-registry-and-shell-contract-lock.md
- docs/_refactor/ordo/phases/01c3ar-shared-frame-compliance-sweep.md
- docs/_refactor/ordo/phases/01c3ay-system-sections-and-backup-restore-brief-parity.md

Core invariant:
Chat is the operating interface. UI surfaces are the governance layer.

Phase scope:
- Inventory which canonical owner/admin section briefs already use durable
  stored/current briefs versus deterministic local brief models.
- Ensure durable brief request/result/reconcile semantics are used where the
  phase requires background brief behavior.
- Prefer current stored brief read models where available and fall back to
  deterministic limited briefs when not available.
- Preserve evidence manifests and visibility policies.
- Ensure failed brief updates do not overwrite current briefs.
- Do not add recurring scheduler behavior, new provider integrations, prompt
  editing UI, fake live intelligence, or broad UI redesign.

Before editing:
1. Read the phase spec.
2. Read every governing doc above.
3. Research every current-code anchor named in the phase:
   - src/core/entities/brief.ts
   - src/core/entities/brief-execution.ts
   - src/lib/briefs/brief-update-executor.ts
   - src/lib/briefs/brief-update-reconciler.ts
   - src/adapters/BriefReadModelDataMapper*
   - src/adapters/BriefUpdateRequestDataMapper*
   - src/lib/appliance/backup/backup-command-service.ts
   - section loaders under src/lib/**/load-*.ts
4. Verify which phase claims are implemented, missing, stale, or wrong.
5. Identify affected section loaders, brief read models, evidence manifests,
   visibility rules, mapper/service boundaries, and tests.
6. Preserve unrelated worktree changes.
7. Do not invent new architecture if existing brief, backup/restore, loader,
   mapper, or governance frame code can be reused or reframed.

Architecture rules:
- Briefs are durable staff reports, not decorative summaries.
- Durable background brief work follows the backup/restore shape: durable
  request, executor result, evidence manifest, reconcile step.
- Components render SectionBrief/read models; they do not derive business
  meaning from raw tables, jobs, logs, provider payloads, or command internals.
- Base section routes render section briefs.
- Query-selected/detail routes render one selected object detail.
- Evidence manifests attach claims to source refs.
- Visibility policies exclude private/admin evidence from lower-role briefs.
- Failed brief updates must not overwrite current stored briefs.
- Deterministic fallbacks must be explicit, limited, and replaceable.
- Do not fake metrics, claims, retrieval quality, result counts, or live
  intelligence.
- Raw jobs, providers, payloads, logs, keys, and diagnostics remain admin-only.

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

docs/_refactor/ordo/prompts/archive/01c3ba-canonical-ui-surface-realignment-closeout.md

The next prompt must target:

/Users/kwilliams/Projects/ordoSite/docs/_refactor/ordo/phases/01c3ba-canonical-ui-surface-realignment-closeout.md

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
- the same prompt handoff requirement for the following phase if one exists.

QA pass 1:
- run the exact required commands from the phase,
- run focused related tests for touched brief, mapper, loader, governance, and
  backup/restore code,
- run typecheck/lint/CSS lint where relevant,
- inspect brief behavior for UX/product drift against every governing doc,
- inspect visibility policy behavior,
- fix every issue found.

QA pass 2:
- rerun phase tests and focused related tests after fixes,
- rerun typecheck/lint if code changed during QA pass 1,
- run the static scans named in the phase,
- verify no fake metrics, unsupported claims, private leaks, raw jobs/logs/
  provider/payload details, or ungrounded brief claims appear in regular
  owner/public UI,
- verify failed brief results do not overwrite current briefs,
- verify docs/evidence match the final implementation,
- verify docs/_refactor/ordo/prompts/next.md contains the next prompt for
  01c3ba,
- fix every issue found.

Required commands:
- npx vitest run src/core/entities/brief.test.ts src/core/entities/brief-execution.test.ts src/lib/briefs/brief-update-executor.test.ts src/lib/briefs/brief-update-reconciler.test.ts src/lib/appliance/backup/backup-command-service.test.ts src/components/governance/GovernanceSectionFrame.test.tsx
- npm run typecheck
- npm run lint:css
- npm run lint -- src/core/entities/brief.ts src/core/entities/brief-execution.ts src/lib/briefs/brief-update-executor.ts src/lib/briefs/brief-update-reconciler.ts src/lib/appliance/backup/backup-command-service.ts

Static scans:
- rg -n "fake|sample|coming soon|provider|payload|raw log|job id|visibilityPolicy|manifest|priorBrief" src/core src/lib src/components
- rg -n "Date\\.now\\(|Math\\.random\\(|toLocaleString\\(|toLocaleDateString\\(" src/core/entities src/lib/briefs src/components/governance

Visual QA:
- If the dev server and session state are usable, inspect representative base
  briefs and selected detail surfaces touched by the phase on desktop and
  mobile.
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
