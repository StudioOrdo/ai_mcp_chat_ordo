# Phase 4: Platform Maturity

> **Milestone:** After this phase, the system manages itself. Tools are auto-registered from the catalog (no more 6-file ritual). Data doesn't grow unbounded (retention sweeps enforce lifecycle). The admin can toggle tools on/off from a GUI. This is the phase where Ordo becomes an operator-friendly platform, not just an engineer's project.

## Status: `[ ] Not Started`

---

## What Ships

### 4A — Catalog Auto-Registration

Consolidates: Spec 15 (capability DX)

Eliminate the manual tool registration ceremony:

- [ ] Create `src/core/capability-catalog/catalog-auto-register.ts`
  - Loop over `CAPABILITY_CATALOG`
  - Derive `ToolDescriptor` from `CapabilityDefinition`
  - Auto-register executor bindings
  - Auto-register job capabilities for tools with `job` facet
- [ ] Create `src/core/capability-catalog/catalog-validator.ts`
  - Duplicate name detection
  - Missing `job` facet on deferred tools
  - Unresolvable `executorId` references
  - Empty input schemas
  - Warn on `roles: []` (no one can execute)
- [ ] Replace `TOOL_BUNDLE_REGISTRATIONS` in `tool-composition-root-impl.ts` with `registerAllCapabilities(registry)`
- [ ] Auto-resolve UI renderer from `cardKind` in `ToolPluginContext.tsx`
- [ ] Add catalog validation test: `expect(validateCatalog(CAPABILITY_CATALOG)).toEqual([])`
- [ ] Delete individual `register*Tools()` bundle functions (after migration verified)

### 4B — Data Lifecycle Enforcement

Consolidates: Spec 14 (data lifecycle & retention)

Enforce the retention types that currently exist as dead code:

- [ ] Create `src/lib/jobs/job-retention-worker.ts`
  - Sweep `succeeded`/`canceled` jobs past TTL (default: 90 days)
  - Sweep `failed` jobs past TTL (default: 180 days)
  - Respect `retention_mode: "retain"` — never auto-prune
  - `prune_payload_keep_events` → null out payloads, keep event skeletons
- [ ] Create `src/lib/media/media-retention-worker.ts`
  - `ephemeral` assets → delete after 7 days
  - `conversation` assets → cascade on conversation purge
  - `durable` assets → never auto-deleted
- [ ] Extend `ConversationDataMapper.purge()` transaction to:
  - Delete `job_requests WHERE conversation_id = ?`
  - Delete `job_events WHERE conversation_id = ?`
  - Delete/mark user files where `conversation_id = ?`
- [ ] Add `deleteJobsByConversationId()` and `pruneJobPayload()` to `JobQueueDataMapper`
- [ ] Create `src/lib/retention/retention-sweep-coordinator.ts`
  - Orchestrate: conversation sweep → job sweep → media sweep
  - Expose as `POST /api/admin/retention/sweep` endpoint

### 4C — Plugin Management GUI

Consolidates: Spec 01 (capability management)

Give operators a toggle panel for tools:

- [ ] Add `defaultEnabled: boolean` to `CapabilityCoreFacet` in `capability-definition.ts`
- [ ] Add optional `configSchema: JSONSchema` to `CapabilityCoreFacet`
- [ ] Extend `SystemSettingsDataMapper` to store active capabilities + configuration blobs
- [ ] Create `src/app/admin/plugins/page.tsx`
  - Iterate `CAPABILITY_CATALOG`
  - Render card per tool: label, description, toggle switch
  - Auto-generate settings form from `configSchema` when present
  - Save toggles and config to system settings
- [ ] Modify runtime filtering: strip disabled tools from LLM context during prompt generation

---

## Verification Checkpoint

```bash
npm run typecheck
npm run test          # Catalog validator test passes
```

Manual checks:

- [ ] Add a new tool to `CAPABILITY_CATALOG` → it appears in chat without touching any other file
- [ ] Remove a tool from catalog → build-time validator catches the dangling reference
- [ ] Visit `/admin/plugins` → see all tools with toggle switches
- [ ] Disable a tool → send a chat message → LLM does not see the tool
- [ ] Run retention sweep → old completed jobs are pruned, `retain` jobs are preserved
- [ ] Purge a conversation → all associated jobs, events, and media files are deleted

---

## Files Touched

| Action | File |
| --- | --- |
| MODIFY | `src/core/capability-catalog/capability-definition.ts` |
| MODIFY | `src/lib/chat/tool-composition-root-impl.ts` |
| MODIFY | `src/frameworks/ui/chat/registry/ToolPluginContext.tsx` |
| MODIFY | `src/adapters/ConversationDataMapper.ts` |
| MODIFY | `src/adapters/JobQueueDataMapper.ts` |
| NEW | `src/core/capability-catalog/catalog-auto-register.ts` |
| NEW | `src/core/capability-catalog/catalog-validator.ts` |
| NEW | `src/lib/jobs/job-retention-worker.ts` |
| NEW | `src/lib/media/media-retention-worker.ts` |
| NEW | `src/lib/retention/retention-sweep-coordinator.ts` |
| NEW | `src/app/admin/plugins/page.tsx` |

---

## Depends On

**Phase 1** — entity types (particularly `dead_letter` status for retention logic)

## Unlocks

Phase 5 (Engine Power) — DAG orchestration benefits from auto-registration for new workflow tools
