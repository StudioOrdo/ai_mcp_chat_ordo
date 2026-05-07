# Ordo Phase Execution Prompt

Implement /Users/kwilliams/Projects/ordoSite/docs/_refactor/ordo/phases/01c3ba-canonical-ui-surface-realignment-closeout.md

Heads down.

This is the canonical UI Surface Realignment closeout phase. Do not start a
new product redesign, do not add new feature surfaces, and do not drift outside
the closeout verification scope. If the phase file is missing, stop after
creating the missing phase spec from the governing package and do not implement
code until that spec exists.

Follow the phase spec exactly. Treat these as governing contracts:
- docs/_refactor/ordo/letters/refactor1.md
- docs/_business/ux/08-product-kernel-contract.md
- docs/_business/ux/09-canonical-ux-architecture.md
- docs/_business/ux/00-ux-north-star.md
- docs/_business/ordo_process.md
- docs/_refactor/ordo/phases/02-ui-surface-realignment/00-route-and-surface-inventory.md
- docs/_refactor/ordo/phases/02-ui-surface-realignment/01-shell-and-menu-ia-alignment.md
- docs/_refactor/ordo/phases/02-ui-surface-realignment/02-shared-surface-frame-contract.md
- docs/_refactor/ordo/phases/02-ui-surface-realignment/03-public-surfaces-homepage-modes.md
- docs/_refactor/ordo/phases/02-ui-surface-realignment/04-owner-intelligence-brief-surfaces.md
- docs/_refactor/ordo/phases/02-ui-surface-realignment/05-knowledge-base-surface.md
- docs/_refactor/ordo/phases/02-ui-surface-realignment/06-accepted-offers-lifecycle-surface.md
- docs/_refactor/ordo/phases/02-ui-surface-realignment/07-placeholder-read-model-policy.md
- docs/_refactor/ordo/phases/02-ui-surface-realignment/08-studio-jobs-and-background-briefs.md
- docs/_refactor/ordo/phases/02-ui-surface-realignment/09-implementation-phase-plan.md
- docs/_refactor/ordo/phases/01c3aq-route-registry-and-shell-contract-lock.md
- docs/_refactor/ordo/phases/01c3ar-shared-frame-compliance-sweep.md
- docs/_refactor/ordo/phases/01c3as-conversations-selector-stabilization.md
- docs/_refactor/ordo/phases/01c3at-today-brief-quality-and-evidence-index.md
- docs/_refactor/ordo/phases/01c3au-studio-consolidation-and-my-media-retirement.md
- docs/_refactor/ordo/phases/01c3av-people-referrals-and-affiliate-evidence-alignment.md
- docs/_refactor/ordo/phases/01c3aw-offers-and-accepted-offer-lifecycle.md
- docs/_refactor/ordo/phases/01c3ax-knowledge-base-surface.md
- docs/_refactor/ordo/phases/01c3ay-system-sections-and-backup-restore-brief-parity.md
- docs/_refactor/ordo/phases/01c3az-brief-storage-and-background-intelligence-closeout.md

Core invariant:
Chat is the operating interface. UI surfaces are the governance layer.

Phase scope:
- Verify the UI Surface Realignment series is internally consistent.
- Verify route registry, shell IA, account menu, public nav, owner rail, admin
  rail, shared frame behavior, base brief behavior, selected-detail behavior,
  placeholder policy, and durable brief closeout.
- Fix only small closeout defects required to satisfy the phase.
- Update closeout docs and evidence.
- Do not add new owner/admin/public surfaces.
- Do not fake live intelligence.
- Do not expose raw jobs/logs/providers/payloads in regular owner/public UI.

Before editing:
1. Read the phase spec.
2. Read every governing doc above.
3. Research every current-code anchor named in the phase.
4. Verify which phase claims are implemented, missing, stale, or wrong.
5. Check git status and preserve unrelated worktree changes.
6. Identify affected route registry entries, shell components, governance frame
   components, section loaders, brief read models, placeholder states, donor
   routes, visibility rules, and tests.
7. Do not invent new architecture if existing shell, loader, frame, read model,
   or component code can be reused or reframed.

Architecture rules:
- `src/lib/shell/shell-navigation.ts` is the source of truth for shell IA.
- `GovernanceSectionFrame` is the default owner/admin section frame.
- Public nav is Home, Offers, About, Feed only when public content exists.
- Owner rail is Conversations, Today, Studio, People, Offers, About.
- Admin rail is Admin, Jobs, System.
- Account menu is identity/session only: My Account, Affiliate Dashboard,
  theme toggle, Sign out.
- Base routes render section briefs or honest limited placeholders.
- Query-selected/detail routes render one selected object detail.
- The second column is an evidence/object selector, not a dashboard.
- Selected object details must not start with global section totals.
- Studio owns produced work, media, workflows, content, campaigns, and
  jobs-as-work.
- People owns relationship evidence; referral/QR evidence appears there only as
  source/trail evidence.
- Offers owns commercial state and accepted-offer lifecycle evidence.
- Knowledge Base is inspectable source evidence, not a public nav item or fake
  retrieval analytics.
- System/Admin may expose diagnostics only behind role gates.
- Brief/background intelligence follows durable request/result/reconcile
  semantics and preserves prior briefs on failure.

Implement end to end:
- update code only where the closeout phase requires it,
- add or update positive, negative, and edge tests from the phase,
- preserve role/access/privacy boundaries,
- preserve provenance/evidence/source-link paths,
- preserve chat-first behavior,
- update phase docs and evidence docs with what actually changed.

QA pass 1:
- run the exact required commands from the phase,
- run focused related tests for any touched route, shell, frame, loader, brief,
  or section component,
- run typecheck/lint/CSS lint where relevant,
- inspect UX/product drift against every governing doc,
- inspect public/owner/admin visibility behavior,
- inspect mobile list/detail behavior where shell or governance surfaces are
  touched,
- fix every issue found.

QA pass 2:
- rerun phase tests and focused related tests after fixes,
- rerun typecheck/lint if code changed during QA pass 1,
- run static scans named in the phase,
- verify no donor nav leaks, duplicate account items, fake intelligence,
  ungrounded claims, private leaks, raw job/log/provider/payload details,
  diagnostic nouns in regular owner/public UI, or stale route labels remain,
- verify docs/evidence match the final implementation,
- fix every issue found.

Required commands:
- Use the commands listed in the phase file.
- At minimum, include the route/shell/frame/section suites touched throughout
  this package:
  - `npx vitest run src/lib/shell/shell-navigation.test.ts src/components/SiteNav.test.tsx src/components/AuthenticatedWorkRail.test.tsx src/components/AccountMenu.test.tsx src/components/governance/GovernanceSectionFrame.test.tsx`
  - `npm run typecheck`
  - `npm run lint:css`

Static scans:
- Use the scans listed in the phase file.
- Include scans for donor and diagnostic leakage across `src/app`,
  `src/components`, and `src/lib`.

Visual QA:
- If the dev server and authenticated session state are usable, inspect
  Conversations, Today, Studio, People, Offers, Knowledge Base, Account, and
  System on desktop and mobile.
- If screenshots cannot be captured, document why and rely on DOM/CSS/test/static evidence.

Prompt handoff requirement:
At closeout, if another phase exists, write the next phase execution prompt to:

- `docs/_refactor/ordo/prompts/next.md`

Also copy the same prompt to:

- `docs/_refactor/ordo/prompts/archive/[NEXT_PHASE_FILENAME].md`

If no next phase exists, replace `docs/_refactor/ordo/prompts/next.md` with a
stop prompt that says the UI Surface Realignment series is complete and lists
the final closeout evidence file.

Do not stop until:
- implementation is complete,
- all required tests pass,
- both QA passes are complete,
- static scans are reviewed,
- phase docs/evidence are updated,
- next prompt or stop prompt handoff is written,
- final answer lists files changed, tests run, QA pass 1 fixes, QA pass 2 fixes,
  visual QA status, next prompt files written, and remaining explicit risks.
