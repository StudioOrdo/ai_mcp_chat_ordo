# Documentation Manufacturing Phase Plan

Status: Complete

This plan turns the public documentation and GitHub customization work into a
bounded sequence of editorial phases.

The sequence is complete. Future public work now moves through the GitHub
manufacturing loop documented in `docs/_business/08_software_manufacturing_loop.md`.

## North Star

Make the repo legible to people who meet Ordo before they know the code:

- AI builders
- QA volunteers
- product engineers
- consultants
- potential alpha users
- open-source collaborators
- people meeting Keith at AI events

The docs should feel like Ordo itself: capable, serious, alive, and governed.

## Phase List

1. `phases/00-inventory-and-editorial-map.md`
2. `phases/01-root-readme-and-state-of-project.md`
3. `phases/02-docs-index-and-archive-cleanup.md`
4. `phases/03-github-community-surface.md`
5. `phases/04-public-prose-polish-and-cognitive-load-pass.md`
6. `phases/05-closeout-and-stop.md`

## Deterministic Handoff Rule

At the end of each phase, update `docs/_refactor/ordo/prompts/next.md` to point
to the next phase in this plan and archive that prompt under:

`docs/_documentation_project/prompts/archive/`

At the end of Phase 05, replace `docs/_refactor/ordo/prompts/next.md` with the
closeout stop message from `phases/05-closeout-and-stop.md`.

## Global QA Gates

Every phase must complete these checks:

- evidence scan: claims are tied to code/docs or labeled as direction
- prose scan: no generic marketing, no needless density, no unsupported hype
- audience scan: first-time reader, serious builder, QA volunteer, and maintainer
  each get a clear next step somewhere in the surface set
- link scan: changed markdown links point to existing files or intentional future
  placeholders marked as such
- drift scan: public docs do not contradict `docs/_business` or active code

## Global Stop Condition

Stop only when:

- all six phases are marked `Complete`
- root `README.md`, `docs/README.md`, `CONTRIBUTING.md`, and GitHub issue
  templates have been revised or explicitly deferred with evidence
- stale docs have been archived or intentionally retained with a manifest
- public claims distinguish implemented, active refactor, alpha track, and vision
- `docs/_refactor/ordo/prompts/next.md` contains the Phase 05 stop message
