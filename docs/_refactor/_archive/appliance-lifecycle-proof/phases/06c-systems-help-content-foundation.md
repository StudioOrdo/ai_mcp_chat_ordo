# Phase 06C - Systems Help Content Foundation

Status: Planned

## Goal

Create the first runtime systems help corpus from the appliance lifecycle work.

This phase turns the implemented 00-05F capabilities into practical help that
users, owners, staff, and admins can actually use.

## Content Sources

Use these phase docs as source material, but rewrite them into runtime help:

- 02 runtime shape and lifecycle contract
- 03 appliance health facade
- 04A-04F backup, restore, Rust executor, self-service, scheduled policy
- 05 and 05A-05F Docker, image hardening, hosted proxy, bundle, secrets,
  release provenance, resources, and failure posture

Do not publish raw phase docs directly into runtime help. Phase docs are
implementation evidence. `_corpus` help should be operator-facing.

## Proposed Books And Chapters

### `systems-help`

Mixed-audience feature help:

- What Ordo can do for you
- Conversations, files, jobs, and library
- Using guided action buttons
- Understanding tool results
- What to do when something fails

### `appliance-operations`

Admin-only by default:

- The `.data` boundary
- First boot and install
- Health states: healthy, degraded, blocked
- Backup policy
- Manual backups
- Restore safety pipeline
- Docker launch modes
- Hosted reverse-proxy mode
- Secrets and provider keys
- Release provenance
- Resource limits and disk pressure

### `staff-operations`

Staff-only by default:

- Hosted instance support
- Triage checklist
- Reading health diagnostics
- Backup/restore support boundaries
- Escalation rules
- Evidence collection

## Current Code Grounding

- Phase 05C keeps `docs/_corpus` in the runtime image.
- `FileSystemCorpusRepository` loads corpus books dynamically from
  `docs/_corpus`.
- `MarkdownChunker` and corpus indexing preserve audience/class/persona
  metadata for retrieval.
- Existing library pages render corpus markdown through `MarkdownProse`.

## Positive Use Cases

- Admin asks "how do I restore safely?" and gets the admin restore runbook.
- Owner asks "what does degraded mean?" and gets a safe owner explanation.
- Staff asks "how do I triage an unhealthy hosted instance?" and gets staff
  docs.

## Negative Use Cases

- Public docs do not instruct non-admin users to run destructive actions.
- Runtime help does not reference development-only phase internals unless the
  chapter is staff/admin.
- Docs do not promise multi-node, external database, or sidecar behavior that
  the appliance intentionally does not support.

## Edge Use Cases

- Feature is disabled because a provider key is missing.
- Backup executor is absent or unhealthy.
- Hosted origin is misconfigured.
- Disk pressure blocks backup/restore.

## Exit Criteria

- Initial `_corpus` systems help books exist.
- Chapters have explicit audience/class/persona metadata.
- Content cites implemented features, not planned work.
- Tests or evidence prove the new books are discoverable only to intended
  roles.
