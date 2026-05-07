# Current Realtime Map

Issue: https://github.com/StudioOrdo/ai_mcp_chat_ordo/issues/1

Status: initial archaeology evidence

## Summary

Realtime is currently narrow and job-centered.

The repo has enough pieces to prove the desired direction, but not the final
system:

- chat/job events use `EventSource`/SSE;
- SSE responses poll SQLite;
- job events use sequence cursors;
- browser hooks reconcile missed job events;
- no WebSocket broker exists for product-wide UI updates;
- no global event sequence exists.

## Current SSE Path

Code anchors:

- `src/app/api/chat/events/route.ts`
- `src/app/api/jobs/events/route.ts`
- `src/app/api/jobs/[jobId]/events/route.ts`
- `src/lib/jobs/job-event-stream.ts`
- `src/hooks/chat/useChatJobEvents.test.tsx`
- `src/hooks/useGlobalChat.test.tsx`

What is real:

- Chat and jobs can open an event stream.
- The stream accepts an `afterSequence` cursor or `Last-Event-ID`.
- The stream uses `ReadableStream`.
- The stream encodes SSE messages with `id: sequence`.
- The stream advances the cursor even when a job is missing.
- Tests cover replay after a requested sequence and reconnect behavior.

Limitations:

- The stream polls by repeatedly querying SQLite.
- The stream has a max window and then closes.
- The sequence is job/conversation scoped, not global.
- It only knows about job events, not all product changes.

## In-Process Event Bus

Code anchor:

- `src/lib/jobs/job-event-bus.ts`

What is real:

- Uses Node `EventEmitter`.
- Currently supports job cancellation fanout.

Limitations:

- Process-local only.
- Not durable.
- Not usable as the source for read state or missed events.

## Browser State

Code anchors:

- `src/hooks/chat/useChatJobEvents.test.tsx`
- `src/hooks/chat/useJobStateStore.test.tsx`
- `src/frameworks/ui/useChatSurfaceState.tsx`

What is real:

- Browser-side job state tracks sequence and terminal states.
- Tests cover keeping the latest terminal job entry by sequence.
- Hooks reopen streams with reconciled sequence cursors.

Limitations:

- This is still job-specific.
- There is no section-level invalidation protocol for Today, Studio, People,
  Offers, Knowledge, or System.

## Rust Realtime Planning

Planning anchors:

- `docs/_refactor/rust_projects/02_realtime_broker.md`
- `docs/_refactor/rust_projects/00_architecture_manifesto.md`
- `crates/ordo-daemon/src/runway_fixtures.rs`
- `crates/ordo-daemon/src/runway_schema_snapshots.rs`

What is real:

- Rust planning names WebSocket fanout as the target.
- `ordo-daemon` contains job event fixture parsing and schema snapshots.

Limitations:

- No production Rust broker is wired yet.
- No Unix socket bridge is wired yet.
- No browser WebSocket subscription path exists yet.

## Missing Realtime Pieces

Needed:

- global durable event log;
- per-user read cursors;
- `GET /api/changes?after=sequence`;
- browser change subscription layer;
- Rust WebSocket broker after the change API is proven;
- reconnect from last global sequence.

## Realtime Conclusion

Do not jump straight to WebSockets.

First add the durable event log and a small changes API. Then the Rust broker can
push invalidations without owning product meaning.
