# Phase 08: Appliance Networking TLS Prototype

Status: Planned

## Goal

Prototype local appliance networking as an opt-in mode: mDNS discovery, local
TLS termination, websocket routing, and reverse proxying to the internal Next.js
server.

## Current Code To Refresh

- Docker port configuration.
- Next.js server start command.
- service worker and push worker requirements.
- websocket/realtime route expectations.
- existing local development HTTPS notes, if any.

## Implementation Scope

- Prototype `.local` mDNS announcement.
- Generate local CA and leaf certificates on first boot in an appliance data
  directory.
- Add TLS listener in Rust for opt-in appliance mode.
- Route websocket paths to the Rust broker.
- Reverse proxy normal HTTP traffic to the internal Next.js server.
- Document trust-store UX and security limitations.

## Out Of Scope

- Making local TLS the default development mode.
- Requiring users to trust a certificate before basic localhost use works.
- Replacing hosted deployment TLS.

## Required Tests

Positive:

- TLS listener serves a health page or proxied Next.js route;
- websocket route upgrades through Rust;
- generated certificate includes expected local hostnames.

Negative:

- certificate private key is not exposed through UI or logs;
- disabled flag leaves current networking unchanged;
- proxy rejects unsupported upgrade paths safely.

Edge:

- first boot certificate generation;
- restart with existing certificate;
- port already in use.

## Exit Criteria

- Appliance networking remains opt-in and documented.
- Local secure browser feature enablement is proven without breaking localhost.
