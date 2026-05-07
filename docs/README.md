# Ordo Docs

This folder has a lot of material. Some of it is current. Some of it is older
research. Use this page as the map.

## Start Here

1. [Project README](../README.md)
2. [State Of The Project](state-of-the-project.md)
3. [Business Docs](./_business/README.md)
4. [Contributing](../CONTRIBUTING.md)

## Current Docs

| Area | What it is for |
| --- | --- |
| [state-of-the-project.md](state-of-the-project.md) | The plain status page: what works, what is being refactored, and what is not ready to claim. |
| [_business](./_business/README.md) | The product thesis, business model, governance process, UX rules, and architecture notes. |
| [_corpus](./_corpus) | Source material used by the app and by research workflows. |
| [_documentation_project](./_documentation_project/README.md) | The finished docs cleanup project and its evidence. |
| [_archive](./_archive) | Old audits, specs, refactor notes, QA notes, and historical business docs. |
| [_refactor](./_refactor) | Refactor plans and archived implementation work. Treat these as work history unless a current issue points to one. |

## Business Docs

The best current product writing lives in [docs/_business](./_business/README.md).

Read these first:

- [01 Founding Thesis](./_business/01_founding_thesis.md)
- [02 The Bottega Model](./_business/02_the_bottega_model.md)
- [06 The Production Engine](./_business/06_the_production_engine.md)
- [07 Governance And Process](./_business/07_governance_and_process.md)
- [08 Software Manufacturing Loop](./_business/08_software_manufacturing_loop.md)
- [UX North Star](./_business/ux/00-ux-north-star.md)
- [Product Kernel Contract](./_business/ux/08-product-kernel-contract.md)
- [Canonical UX Architecture](./_business/ux/09-canonical-ux-architecture.md)

These docs explain the product. They do not mean every idea is shipped.

## Archived Standalone Notes

The loose notes that used to sit in this folder have been moved to
[_archive/standalone-notes](./_archive/standalone-notes).

They are still useful, but they are no longer part of the first reading path.

## How To Decide What To Trust

When two docs disagree, use this order:

1. Current source code and tests.
2. [State Of The Project](state-of-the-project.md).
3. [Project README](../README.md).
4. Current business and UX docs.
5. Archive material.

If a doc sounds polished but does not match the code, treat it as an idea, not a
claim.
