# Phase 01: Root README And State Of Project

Status: Complete

## Goal

Rewrite the root README and create a concise state-of-project document that make
Ordo understandable, credible, and compelling to a public reader.

The README should be the front door. The state-of-project document should be the
truth ledger behind it.

## Governing Docs

- `docs/_documentation_project/README.md`
- `docs/_documentation_project/editorial-standard.md`
- `docs/_documentation_project/evidence/00-inventory-and-editorial-map.md`
- `docs/_business/01_founding_thesis.md`
- `docs/_business/02_the_bottega_model.md`
- `docs/_business/07_governance_and_process.md`
- `docs/_business/ordo_process.md`
- `docs/_business/ux/02-message-and-tone.md`

## Scope

- Rewrite `README.md` for public comprehension and engagement.
- Create `docs/state-of-the-project.md` or an equivalent public truth ledger.
- Include July 31, 2026 alpha direction and QA volunteer invitation.
- Include fast velocity and software manufacturing process.
- Include implemented system categories without turning README into a code map.
- Include GitHub and YouTube follow paths when verified.

## Non-Goals

- Do not rewrite `docs/README.md` yet.
- Do not add issue templates yet.
- Do not archive docs yet.
- Do not claim automatic GitHub issue creation until implemented.

## Required Reader Outcomes

After reading the README, a visitor should know:

- Ordo is an AGPL AI business appliance / operator system.
- Chat is the operating interface; governed workflows are the engine.
- The project is in active development toward a July 31, 2026 alpha.
- The repo already contains real jobs, factory, QA, WASM/media, RAG/search, and
  backup/restore foundations.
- The docs distinguish built reality from direction.
- QA volunteers and serious builders have a way to help.

## QA Pass 1

- Rewrite for structure and truth first.
- Check every capability claim against Phase 00 evidence.
- Remove density that belongs in deeper docs.
- Add state-of-project details where technical readers need proof.

## QA Pass 2

- Read the README aloud for drag, repetition, hype, and cognitive overload.
- Confirm first-time readers get the product in the first screen.
- Confirm serious builders get links to evidence.
- Confirm alpha/QA volunteer language is welcoming but bounded.
- Confirm the Phase 02 prompt is written and archived.

## Required Commands

```bash
npm run lint -- README.md docs/state-of-the-project.md
rg -n "revolutionary|seamless|cutting-edge|world-class|fully automated|automatically files|automatically resolves|production ready" README.md docs/state-of-the-project.md
rg -n "July 31, 2026|AGPL|QA volunteer|software manufacturing|jobs|WASM|RAG|vector|backup|Rust|TypeScript" README.md docs/state-of-the-project.md
```

If markdown lint is not configured for markdown files through `npm run lint`,
record that and rely on link/prose/static scans.

## Acceptance Criteria

- Root README is public-facing, succinct, grounded, and alive.
- State-of-project doc separates implemented, active refactor, alpha track, and
  vision.
- No unsupported claims remain.
- Phase 02 prompt is ready.
