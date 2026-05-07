# Phase 05: Realtime Broker Feature Flag

Status: Planned

## Goal

Add the Rust realtime broker behind a feature flag so websocket fanout can be
proved without removing the current SSE path prematurely.

## Current Code To Refresh

- job event stream implementation.
- conversation/chat send and receive APIs.
- browser realtime hooks.
- admin/system event consumers.
- current tests for job updates and chat refresh behavior.

## Implementation Scope

- Add browser websocket subscription path when `ORDO_RUST_REALTIME_ENABLED` is
  set.
- Add Node-to-Rust event publishing over a local IPC mechanism.
- Add conversation channel subscription, reconnect, and authorization checks in
  TypeScript before subscription is opened.
- Add bot/human lane routing rules without moving LLM policy into Rust.
- Keep SSE fallback available and tested.

## Out Of Scope

- Removing SSE polling before parity.
- Letting Rust decide access control or prompt behavior.
- Exposing raw channel identifiers in regular UI.

## Required Tests

Positive:

- browser receives job update via websocket;
- browser receives chat/governance event via websocket;
- reconnect resubscribes to the expected conversation.

Negative:

- unauthorized subscription is rejected before websocket use;
- malformed event payload is ignored or classified;
- broker failure falls back to current behavior when configured.

Edge:

- multiple browser clients on one conversation;
- typing events do not persist as messages;
- human lane does not trigger LLM inference.

## Exit Criteria

- Websocket path is proven with browser tests.
- SSE fallback remains available.
- Realtime behavior is observable in admin diagnostics without leaking secrets.
