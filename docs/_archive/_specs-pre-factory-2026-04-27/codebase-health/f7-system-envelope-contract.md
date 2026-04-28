# F7 — System envelope contract (prerequisite for Phase 2)

Status: documenting the rule Phase 1 already implements; Phase 2 coach envelopes follow it.

## The rule

A system envelope is a `CapabilityResultEnvelope<TPayload>` that:

1. has `family: "system"`
2. has a registered `cardKind` (Phase 1 ships `"lifecycle"`; Phase 2 reuses it)
3. is **not** registered in `CAPABILITY_CATALOG` / `CLIENT_CAPABILITY_CATALOG` because system envelopes are not LLM-tool-invocable — they are system-authored and rendered via presenter passthrough
4. rides on a `role: "system"` chat message via a dedicated key on `ChatMessageMetadata`
5. is forwarded by `ChatPresenter.present()` via a matching dedicated key on `PresentedMessage`
6. is rendered by `MessageList` when its presenter key is truthy, wrapped in `ErrorBoundary`
7. must have a render path that null-guards `envelope.payload` (typed `TPayload | null` per the envelope contract)

## Why dedicated keys (not a generic metadata passthrough)

The presenter and `PresentedMessage` deliberately use named fields (`failedSend`, `responseState`, `lifecycle`, now `coach`) instead of a generic `metadata: Record<string, unknown>`. This keeps rendering decisions typed end-to-end, prevents drift between stored metadata and presented metadata, and lets MessageList route by a single truthy check per kind.

Adding a new system envelope kind is a bounded change:

- Add `KindPayload` + `KindEnvelope` to an entity module under `src/core/entities/`
- Add `ChatMessageMetadata.kind?: KindEnvelope`
- Add `PresentedMessage.kind?: KindEnvelope` and the one-line forward in `ChatPresenter.present()`
- Add a descriptor + render component under `src/frameworks/ui/chat/plugins/system/`
- Add the branch in `MessageList` after the existing `lifecycle` check

## Relation to Phase 2

Phase 2's `coach` envelope is a second system envelope kind. It reuses `cardKind: "lifecycle"` (the resolver already routes it) but travels on a dedicated `metadata.coach` field so coach cards and lifecycle cards can coexist on the same conversation without collision and so each renderer sees a single typed payload shape.
