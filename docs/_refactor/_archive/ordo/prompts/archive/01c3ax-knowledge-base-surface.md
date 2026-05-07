Implement /Users/kwilliams/Projects/ordoSite/docs/_refactor/ordo/phases/01c3ax-knowledge-base-surface.md

Heads down.

This phase introduces Knowledge Base as the owner/admin business brain surface by reusing existing corpus, content access, training, and retrieval infrastructure. Do not turn Library into a public product route. Do not add fake retrieval usage analytics, a new vector store, prompt tuning UI, or broad public content redesign.

Follow the phase spec exactly. Treat these as governing contracts:
- docs/_refactor/ordo/letters/refactor1.md
- docs/_business/ux/08-product-kernel-contract.md
- docs/_business/ux/09-canonical-ux-architecture.md
- docs/_business/ux/00-ux-north-star.md
- docs/_business/ordo_process.md
- docs/_refactor/ordo/phases/02-ui-surface-realignment/05-knowledge-base-surface.md
- docs/_refactor/ordo/phases/02-ui-surface-realignment/07-placeholder-read-model-policy.md
- docs/_refactor/ordo/phases/01c3aq-route-registry-and-shell-contract-lock.md
- docs/_refactor/ordo/phases/01c3ar-shared-frame-compliance-sweep.md
- docs/_refactor/ordo/phases/01c3aw-offers-and-accepted-offer-lifecycle.md

Core invariant:
Chat is the operating interface. UI surfaces are the governance layer.

Phase scope:
Create the canonical Knowledge Base route/read model/surface for owner/admin access to permitted knowledge. Reuse existing corpus/content-access/retrieval donors. Keep Library donor routes out of public IA unless explicitly redirected or hidden by the phase. Do not fake live intelligence, usage metrics, retrieval quality, or document coverage.

Before editing:
1. Read the phase spec.
2. Read every governing doc above.
3. Research every current-code anchor named in the phase:
   - src/app/library/page.tsx
   - src/app/library/[document]/page.tsx
   - src/app/library/[document]/[section]/page.tsx
   - src/app/library/section/[slug]/page.tsx
   - src/app/admin/training/page.tsx
   - src/app/admin/content-visibility/page.tsx
   - src/lib/access/content-access.ts
   - src/adapters/FileSystemCorpusRepository.ts
   - src/core/platform/knowledge-access/KnowledgeAccessService.ts
   - src/lib/chat/retrieval-envelope.ts
   - src/lib/shell/shell-navigation.ts
4. Verify which phase claims are implemented, missing, stale, or wrong.
5. Identify corpus/read-model boundaries, route visibility rules, donor routes, shell entries, selector/detail behavior, and tests.
6. Preserve unrelated worktree changes.
7. Do not invent new architecture if existing corpus, content access, retrieval, shell, or GovernanceSectionFrame code can be reused or reframed.

Architecture rules:
- Knowledge Base is an owner/admin governance surface, not a public Library launch.
- Base route renders a Knowledge Brief with honest limitations.
- The second column is a knowledge/document/section selector, not a dashboard.
- Selected detail renders one selected document or section.
- Visibility filtering must happen in the read model before render.
- Public nav must not show Library or Knowledge Base.
- Owner users must not see staff/admin-only knowledge.
- Admin visibility/training donors may be linked only for authorized users.
- Library/training/corpus donor routes must not leak private content.
- Placeholders must be deterministic, explicit, limited, and replaceable.
- Do not fake usage analytics, retrieval quality, live intelligence, or document coverage.

Implement end to end:
- update code,
- add or update positive, negative, and edge tests from the phase,
- preserve role/access/privacy boundaries,
- preserve provenance/evidence/source-link paths,
- preserve chat-first behavior,
- keep raw diagnostics/provider/log details out of owner UI,
- update phase docs and evidence docs with what actually changed.

Prompt handoff requirement:
At closeout, write the next phase execution prompt to:

docs/_refactor/ordo/prompts/next.md

Also copy the same prompt to:

docs/_refactor/ordo/prompts/archive/01c3ay-system-sections-and-backup-restore-brief-parity.md

The next prompt must target:

/Users/kwilliams/Projects/ordoSite/docs/_refactor/ordo/phases/01c3ay-system-sections-and-backup-restore-brief-parity.md

The prompt must include exact phase file path, governing docs, phase-specific scope boundaries, current-code anchors from the phase, architecture rules, QA pass 1 and QA pass 2 instructions, required commands, static scans, visual QA expectations, final answer requirements, and this same prompt handoff requirement for the following phase.

QA pass 1:
- run the exact required commands from the phase,
- run focused related tests for touched Knowledge Base, library, corpus, content access, retrieval, admin visibility, and shell code,
- run typecheck/lint/CSS lint where relevant,
- inspect Knowledge Base for UX/product drift against every governing doc,
- inspect public/private/admin visibility behavior,
- fix every issue found.

QA pass 2:
- rerun phase tests and focused related tests after fixes,
- rerun typecheck/lint if code changed during QA pass 1,
- run the static scans named in the phase,
- verify no public Library/Knowledge Base nav leak, private knowledge leak, fake usage analytics, fake retrieval quality, duplicate menu entries, or raw diagnostics appear,
- verify docs/evidence match the final implementation,
- verify docs/_refactor/ordo/prompts/next.md contains the next prompt for 01c3ay,
- fix every issue found.

Required commands:
- npx vitest run src/lib/access/content-access.test.ts src/core/platform/knowledge-access/KnowledgeAccessService.test.ts src/lib/chat/retrieval-envelope.test.ts src/app/admin/content-visibility/page.test.tsx src/lib/shell/shell-navigation.test.ts
- npm run typecheck
- npm run lint:css
- npm run lint -- src/lib/access/content-access.ts src/adapters/FileSystemCorpusRepository.ts src/core/platform/knowledge-access/KnowledgeAccessService.ts src/lib/chat/retrieval-envelope.ts src/lib/shell/shell-navigation.ts

Static scan:
- rg -n "library|Knowledge Base|corpus|training|content visibility|visibilityPolicy|public" src/app src/components src/lib src/core

Visual QA:
- If the dev server and session state are usable, inspect Knowledge Base base route, selected document/section detail, and mobile list/detail behavior.
- If screenshots cannot be captured, document why and rely on DOM/CSS/test/static evidence.

Do not stop until:
- implementation is complete,
- all required tests pass,
- both QA passes are complete,
- static scans are reviewed,
- phase docs/evidence are updated,
- next prompt handoff files are written,
- final answer lists files changed, tests run, QA pass 1 fixes, QA pass 2 fixes, visual QA status, next prompt files written, and remaining explicit risks.
