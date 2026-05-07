# Phase 06 - Systems Help And Closeout Index

Status: Planned - split into 06x systems-help series

## Goal

Turn the appliance lifecycle work into a role-gated systems help experience.

This phase is no longer only "admin docs and closeout." It is the product
trial-by-fire for Ordo as a governed operating system:

- `_corpus` becomes the runtime help source.
- corpus access control is proven across routes, search, section reads, and
  chat citations.
- custom message cards and action buttons become the guided operations layer.
- onboarding and first-use guidance become role-aware and friendly.
- the anonymous user experience becomes the public face of the CEO's chief of
  staff, not a salesperson persona.
- admin and staff users get safe appliance controls without needing shell
  commands.
- lower roles get appropriate help without leaking protected operational
  material.

## Product Shape

Use multiple books by job-to-be-done, not one book per role.

Recommended corpus organization:

- `getting-started`
  - public/member owner onboarding and normal product use.
- `systems-help`
  - mixed-audience help for features, workflows, and self-service support.
- `appliance-operations`
  - admin-first lifecycle, backup, restore, health, install, update, and
    recovery runbooks.
- `staff-operations`
  - staff/operator support procedures for hosted instances, diagnostics,
    escalation, and safe interpretation of health reports.
- existing public/business books remain public product narrative.

Do not create a separate book per role as the primary organizing rule. Roles
are an access-control dimension, not the information architecture. The current
corpus model already supports:

- book-level `audience`
- chapter frontmatter `audience`
- role-filtered summaries
- role-filtered search
- role-filtered `get_section`

That lets one book contain a public overview, member-level usage chapters,
staff diagnostics chapters, and admin-only runbooks while keeping hidden
chapters out of lower-role search and table-of-contents output.

## 06x Series

- `06a-corpus-help-information-architecture.md`
  - define the runtime help IA, role tiers, book/chapter conventions, and
    authoring contract.
- `06b-corpus-access-control-proof.md`
  - prove corpus ACL across library routes, `search_corpus`, `get_section`,
    summaries, direct slugs, citations, and vector metadata.
- `06c-systems-help-content-foundation.md`
  - create the first practical help corpus content from the implemented
    appliance lifecycle features.
- `06d-custom-message-help-and-operation-cards.md`
  - use rich custom messages and buttons for guided feature help, health,
    backup, restore, and runbook navigation.
- `06e-admin-and-staff-help-surfaces.md`
  - expose role-appropriate systems help in admin/staff pages and chat while
    preserving route/tool gates.
- `06f-closeout-evidence-and-regression-suite.md`
  - close the appliance lifecycle package with evidence, docs, evals, and
    regression tests.
- `06g-role-onboarding-and-chief-of-staff-persona.md`
  - make first-use, role bootstraps, lifecycle coaching, and anonymous public
    posture coherent across all roles.

## Current Code Grounding

Ground the 06x series in:

- `src/core/entities/rich-content.ts`
  - supports `action-link` inline nodes with `tool`, `route`, and `corpus`
    action types.
- `src/frameworks/ui/chat/primitives/CapabilityActionRail.tsx`
  - renders action links as buttons with primary/secondary/danger intent.
- `src/frameworks/ui/chat/plugins/custom/ApplianceBackupCard.tsx`
  - proves custom operational cards already exist.
- `src/core/use-cases/tools/appliance-backup.tool.ts`
  - proves admin-only operation tools can attach action buttons to structured
    results.
- `src/lib/access/content-access.ts`
  - defines `public`, `member`, `account`, `premium`, `apprentice`, `staff`,
    and `admin` audiences.
- `src/lib/corpus-library.ts`
  - provides role-aware corpus facade functions.
- `src/core/use-cases/LibrarySearchInteractor.ts`
  - filters visible sections by audience for role-aware search.
- `src/core/use-cases/CorpusIndexInteractor.ts`
  - filters role-aware corpus indexes.
- `src/core/use-cases/CorpusSummaryInteractor.ts`
  - hides books with no visible sections for the current role.
- `src/core/platform/knowledge-access/KnowledgeAccessService.ts`
  - enforces role-aware search, section fetch, and related-section filtering.
- `src/app/library/*`
  - already resolves viewer role and handles denied content.
- `src/hooks/chat/chatState.ts`
  - creates first chat messages from instance prompts and role bootstraps.
- `config/prompts.json`
  - owns current hero copy, anonymous greeting, suggestions, and role bootstrap
    defaults.
- `src/core/entities/role-directive-assembler.ts`
  - owns role-level assistant framing.
- `src/lib/lifecycle/coach-templates.ts`
  - owns lifecycle-driven onboarding cards.
- `src/app/api/install/setup/route.ts`
  - creates the first admin and queues the installed lifecycle event.
- `docs/_corpus`
  - is the runtime documentation bundle retained by Phase 05C.

## Architecture Rule

Docs explain. Tools decide.

The corpus may explain how backup, restore, health, install, and recovery work.
The durable tool/service layer must still decide whether a user may execute an
operation and whether the system state is safe.

Do not let documentation text become the source of authorization, restore
state, confirmation state, secret state, or health truth.

## Exit Criteria

- Phase 06 is implemented through the 06x series, not this index file.
- Systems help content exists in `_corpus` with explicit audience strategy.
- Lower roles cannot discover, retrieve, cite, or open admin/staff-only docs.
- Admin/staff users can use guided cards/buttons for core appliance operations.
- Admin/staff pages and chat use the same corpus and action contracts.
- Anonymous, authenticated, apprentice, staff, and admin first-use experiences
  clearly match their access level.
- Closeout evidence ties every prior appliance phase to runtime help,
  role-gated docs, and regression tests.
