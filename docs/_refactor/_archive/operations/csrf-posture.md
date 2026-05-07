# CSRF Protection Posture

## Current stance
- **Primary defense:** SameSite cookie attribute (Lax or Strict).
- **Secondary defense:** Origin header validation on all state-mutating requests (POST/PUT/PATCH/DELETE).
- **Not implemented:** Explicit CSRF tokens (Double Submit Cookie or Synchronizer Token Pattern).

## Why no CSRF tokens
This is a primarily API-driven application where:
- The client is a first-party SPA served from the same origin.
- Session cookies use SameSite=Lax (minimum).
- Non-browser API consumers supply Bearer tokens, not cookies.

Full CSRF token infrastructure adds complexity without proportional security gain
for this architecture. The Origin check catches the most common CSRF vector
(cross-origin form POST).

## Accepted risks
- Requests without an Origin header are allowed (e.g., server-to-server, non-browser clients).
  This is by design for API compatibility.
- Clients that strip the Origin header (unusual proxies) bypass this check.

## If upgrading to full CSRF tokens
Use the Double Submit Cookie pattern:
1. Set a `csrf_token` cookie (HttpOnly=false, SameSite=Strict).
2. Require `X-CSRF-Token` header on state-mutating requests.
3. Compare cookie value to header value.
