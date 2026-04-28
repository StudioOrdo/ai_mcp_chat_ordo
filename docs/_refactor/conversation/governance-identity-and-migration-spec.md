# Governance, Identity, And Migration Specification

## Objective

Define the high-level governance and migration requirements for the greenfield
conversation architecture.

## Why This Exists

The conversation system is not only chat state. It includes ownership,
governed prompts, durable assets, long-running jobs, privacy deletion, and
anonymous-to-authenticated conversion.

Those concerns must be modeled explicitly or they will become hidden data-loss
and continuity bugs.

## Prompt Governance

### Prompt Requirement

Important state changes should be explainable against the prompt runtime that
produced them.

Important state changes include:

- workspace snapshot updates
- relationship memory updates
- job request planning
- materialization decisions
- customer-facing assistant decisions that create or modify durable assets

### Prompt Binding

Prompt binding should capture:

- effective prompt hash
- slot refs and versions
- important overlays
- task-origin context when present
- routing context when present
- memory context refs when present

### Non-Goal

Prompt binding is not a requirement to store full prompt text for every turn.
It is a requirement to make governed continuity auditable and reproducible
enough for debugging.

## Identity Migration

### Migration Requirement

Anonymous-to-authenticated conversion must migrate every continuity model.

Migration scope includes:

- conversations
- messages
- jobs
- job events
- assets
- relationship memory
- workspace snapshots
- search indexes
- prompt bindings
- referral links

### Migration Shape

Migration should be a durable workflow.

It should have:

- migration event ID
- source identity
- target identity
- migrated object counts
- repair attempts
- failure state
- verification state

### Repair Rules

After migration, repair should verify:

- active workspace belongs to target user
- active jobs belong to target user or migrated conversation
- asset catalog entries are reachable by target user
- relationship memory uses target identity
- search source IDs no longer point only to anonymous ownership

## Privacy And Deletion

### Deletion Requirement

Deletion must operate across all canonical models, not just conversations and
messages.

Deletion scope includes:

- workspace snapshots
- relationship memory
- job refs and eligible payloads
- assets subject to retention policy
- transcript messages
- search indexes
- prompt bindings where required by policy

### Retention Distinction

The system must distinguish:

- user-visible deletion
- retention-window soft deletion
- audit-retained operational records
- privacy-request purge

## Authorization

Every canonical model must be user-scoped or explicitly role-scoped.

No restore projection may join data only through a conversation ID without
verifying user ownership.

## Definition Of Done

This spec is satisfied when:

- prompt changes cannot silently erase explainability for durable decisions
- anonymous migration has a durable status and repair path
- restore after login shows migrated jobs, assets, memory, and workspace state
- deletion policy covers all new canonical models
- access checks are expressed at model boundaries, not only route handlers
