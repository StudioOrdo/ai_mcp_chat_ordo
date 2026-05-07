# Phase 06A - Corpus Help Information Architecture

Status: Planned

## Goal

Define the runtime documentation architecture for Ordo systems help.

The help system should be understandable to normal users, useful to owners,
safe for staff, and operationally complete for admins without splitting the
product into unrelated documentation silos.

## Design Decision

Use books by product journey and responsibility, not one book per role.

Roles should control visibility. They should not be the primary navigation
model.

Recommended books:

- `getting-started`
  - first login, profile, conversations, files, library, jobs, normal usage.
  - mostly `public`, `member`, or `account`.
- `systems-help`
  - feature help, troubleshooting, capability explanations, and guided
    workflows.
  - mixed audience by chapter.
- `appliance-operations`
  - install, first boot, `.data`, health, backup, restore, update, release,
    Docker, resource limits, and recovery.
  - mostly `admin`.
- `staff-operations`
  - hosted-instance support, triage, platform handoff, diagnostics, and
    escalation.
  - mostly `staff`.

This keeps the user's mental model aligned with jobs-to-be-done while using
chapter frontmatter to protect sensitive operations.

## Current Code Grounding

- `docs/_corpus/*/book.json`
  - already defines corpus books.
  - supports book-level `audience`.
- `src/adapters/FileSystemCorpusRepository.ts`
  - reads book manifests from `docs/_corpus`.
  - parses chapter frontmatter.
  - lets chapter `audience` override book `audience`.
  - rejects invalid audience values.
- `src/lib/access/content-access.ts`
  - defines the audience vocabulary and role mapping.
- `src/core/use-cases/CorpusSummaryInteractor.ts`
  - hides books that have no visible chapters for a role.

## Authoring Contract

Every runtime help chapter should have frontmatter:

```md
---
audience: admin
class: runbook
rolePersona: owner
---
```

Allowed `audience` values:

- `public`
- `member`
- `account`
- `premium`
- `apprentice`
- `staff`
- `admin`

Recommended `class` values for help:

- `guide`
- `reference`
- `runbook`
- `troubleshooting`
- `safety`
- `release`

Recommended `rolePersona` values:

- `visitor`
- `owner`
- `operator`
- `staff`
- `admin`
- `developer`

## Positive Use Cases

- Anonymous users can read public help without seeing admin runbooks.
- Authenticated owners can read feature usage docs without operational
  internals.
- Admin users can search appliance lifecycle help from chat.
- Staff can see support docs without receiving admin-only destructive actions.

## Negative Use Cases

- A public chapter must not contain secrets, restore commands, install tokens,
  private deployment topology, or staff escalation procedures.
- A staff chapter must not imply permission to execute admin-only restore tools.
- A mixed-audience book must not leak hidden chapter titles to lower roles.

## Edge Use Cases

- A book has only admin chapters and is requested by an anonymous user.
- A public book has one admin appendix.
- A chapter omits frontmatter and inherits book audience.
- A chapter has invalid audience metadata.

## Exit Criteria

- Documentation IA is reflected in `_corpus` book/chapter conventions.
- Tests or evidence prove role-filtered summaries hide inaccessible chapters.
- Phase 06B can verify the access-control behavior against these conventions.
