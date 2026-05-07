# Ordo Docs

This directory has two jobs: help public readers understand Ordo, and help maintainers find current operating material without mistaking archive history for product truth.

Start with the public front door. Go deeper when you need proof or process.

## Start Here

1. [Project README](../README.md): public front door.
2. [State Of The Project](state-of-the-project.md): current truth ledger for implemented, active refactor, alpha-track, and vision claims.
3. [Business Canon](./_business/README.md): product thesis, operating doctrine, and north star.
4. [Contributing](../CONTRIBUTING.md): current issue-first contribution path.

## Current Map

| Area | Use it for | Truth status |
| --- | --- | --- |
| [state-of-the-project.md](state-of-the-project.md) | Public implementation truth, claim labels, and current alpha direction | Current public ledger |
| [_business](./_business/README.md) | Founding thesis, bottega model, governance, product doctrine, and architecture north star | Active doctrine; not every idea is shipped |
| [_documentation_project](./_documentation_project/README.md) | The closing documentation manufacturing process that created the current public docs and GitHub templates | Closing public-doc governance |
| [_refactor/ordo](./_refactor/ordo/prompts/next.md) | Active phase handoff prompt for this documentation project | Active operator handoff |
| [_corpus](./_corpus) | Structured corpus manifests for architecture reference, field guide, operators handbook, thesis, and system docs | Source material; not the first public route |
| [_archive](./_archive) | Historical audits, specs, refactors, QA notes, and prior business material | Archive/history only |
| [_debug](./_debug) and [debug_info](debug_info) | Debug traces and local investigation material | Maintainer/debug context |

## Business Canon

The business canon is active because it explains the product thesis and operating doctrine:

- [01 Founding Thesis](./_business/01_founding_thesis.md)
- [02 The Bottega Model](./_business/02_the_bottega_model.md)
- [06 The Production Engine](./_business/06_the_production_engine.md)
- [07 Governance And Process](./_business/07_governance_and_process.md)
- [08 Software Manufacturing Loop](./_business/08_software_manufacturing_loop.md)
- [Ordo Process](./_business/ordo_process.md)
- [Message And Tone](./_business/ux/02-message-and-tone.md)

Read it as north star and doctrine. For current implementation claims, use [State Of The Project](state-of-the-project.md) and current source code.

## Active Process Docs

- [Documentation Project](./_documentation_project/README.md): closes the old markdown-first documentation phase loop and records its evidence.
- [Editorial Standard](./_documentation_project/editorial-standard.md): prose and claim discipline.
- [Phase Plan](./_documentation_project/phase-plan.md): bounded phase sequence.
- [Active Handoff Prompt](./_refactor/ordo/prompts/next.md): the prompt the operator can ask an agent to execute next at `docs/_refactor/ordo/prompts/next.md`.
- [Software Manufacturing Loop](./_business/08_software_manufacturing_loop.md): the new GitHub-backed work-ledger direction for public issues and pull requests.

## Archive Boundary

Archive material is useful history. It is not the current roadmap unless a current phase explicitly reactivates it.

The archive currently includes historical audits, older specs, pre-factory refactors, QA notes, unification work, and legacy business material. Keep it discoverable, but do not send first-time readers there for current product truth.

No files were moved during this index cleanup. Phase 00 identified stale paths and archive risk, but this phase did not prove enough ownership to relocate standalone root notes without churn.

## Standalone Notes Needing Future Classification

These files remain in `docs/` and should be classified in a later archive or reference pass:

- [issue-resolution-tracker.md](issue-resolution-tracker.md)
- [me.txt](me.txt)
- [ordo_system_architecture_and_extensibility.md](ordo_system_architecture_and_extensibility.md)
- [scrollcast-integration-letter.md](scrollcast-integration-letter.md)
- [theme-brand-audit.md](theme-brand-audit.md)

They are listed here so they are visible, not because they are all current public contracts.

## Source Of Truth

When docs disagree, use this order:

1. Current source code, tests, and release evidence.
2. [State Of The Project](state-of-the-project.md).
3. [Project README](../README.md).
4. Active business canon and current phase specs.
5. Archive material as historical context only.

Phase evidence for the public documentation project lives under [./_documentation_project/evidence](./_documentation_project/evidence).
