# Feature Spec: Media Capacity And Quotas

**Status:** Draft Spec — Realigned to live Phase 0 to Phase 3 architecture
**Priority:** Phase 4 (after `/my/media` and `/operations/media` exist)
**Execution Surface:** quota policy service + `/my/media` usage summaries + `/operations/media` capacity visibility
**Dependencies:** storage accounting layer, governed `.data` volume, live shared operations workspace

---

## Purpose

Tell users how much media space they can use without exposing confusing or unstable host-level storage details, while still giving operators visibility into the real free space of the backing `.data` volume.

This is two related but different problems:

1. user-facing storage budget,
2. operator-facing host capacity.

They should not be collapsed into one metric.

---

## Product Recommendation

### User-facing

Show a fixed quota or plan budget:

- used bytes,
- allowed bytes,
- percentage consumed.

Example:

`2.4 GB of 10 GB used`

### Operator-facing

Show real volume capacity for `.data`:

- total bytes,
- free bytes,
- used bytes,
- percentage consumed,
- last checked timestamp.

Example:

`Host media volume: 84 GB free of 128 GB`

This split avoids promising users a host metric that can change for reasons unrelated to their own usage.

---

## Current State

The deployment already makes real capacity reporting feasible:

- the app and media worker share `./.data:/app/.data`,
- governed media files live under `.data/user-files`,
- the runtime is otherwise read-only, so this is the relevant writable volume.

What does not exist yet:

- a quota policy model,
- user-facing usage meters,
- host free-space inspection,
- operator alerts for low available capacity.

What now does exist and should be treated as the implementation baseline:

- `/my/media` already loads user storage summaries through `getUserMediaStorageAccount()`,
- `/operations/media` already loads fleet storage summaries through `getFleetMediaStorageAccount()`,
- `/api/chat/uploads` still persists governed files without any quota-policy check,
- `AdminSystemPage` exists as an admin-only diagnostics surface, but it is not the only operator-facing option anymore.

---

## Implementation

### 1. Add quota policy service

Start with a fixed application-level limit rather than per-plan complexity.

Recommended v1 config:

```ts
interface MediaQuotaPolicy {
  defaultUserQuotaBytes: number;
  hardBlockUploadsAtQuota: boolean;
  warnAtPercent: number;
}
```

Initial policy recommendation:

- `defaultUserQuotaBytes`: 10 GB
- `hardBlockUploadsAtQuota`: false in v1, true later if desired
- `warnAtPercent`: 80

V1 should remain display-only in this phase. Enforcement should move to Phase 5.

### 2. Add user-facing quota summary

The My Media route should display:

- total bytes used,
- quota bytes,
- percent used,
- warning state.

If upload blocking is not yet enabled, messaging should be explicit:

`Approaching your storage budget. Cleanup tools and automatic enforcement are still rolling out.`

### 3. Add host capacity probe

Add a server-only utility that inspects the filesystem backing `.data`.

Recommended implementation surface:

`src/lib/storage/volume-capacity.ts`

Preferred mechanism:

- use Node filesystem capacity APIs such as `fs.statfs` on `.data`,
- derive total, free, and used bytes for the mounted volume.

If the platform cannot provide reliable capacity data, return an explicit "unavailable" state rather than fake precision.

### 4. Expose host metrics only to operators

Do not show host free space on the user-facing My Media route.

Show it first in:

- the media operations workspace at `/operations/media`,
- and only secondarily in an existing admin diagnostics surface such as system health if a separate release-readiness panel is useful.

### 5. Prepare for enforcement

When the team is ready, integrate quota checks into `/api/chat/uploads` so uploads can:

- warn before limit,
- reject above hard cap,
- emit structured error messages for the UI.

This should be a separate rollout switch, not bundled into initial display work.

---

## UX Rules

| Surface | Metric | Audience |
| --- | --- | --- |
| `/my/media` | used bytes vs quota | end user |
| `/operations/media` or admin diagnostics | host free space and fleet totals | staff or admin |
| upload UI | quota warning or rejection | end user |

---

## Non-Goals

- Exposing raw host free-space numbers to end users.
- Billing, invoicing, or plan upgrades.
- Multi-volume storage awareness.
- Automatic rebalancing across disks or object stores.

---

## Acceptance Criteria

1. The My Media route can display used bytes versus configured quota for the current user.
2. The application can compute and display host volume free space for the `.data` mount in an operator-only surface.
3. If host capacity cannot be determined, the operator surface reports that state explicitly instead of inventing a value.
4. User-facing quota messaging remains stable even if host free space changes for unrelated reasons.
5. The quota policy is configurable without editing route code.

---

## Validation

- Add unit tests for quota percentage and warning-state calculation.
- Add server tests for the capacity probe with both available and unavailable filesystem responses.
- Add an integration test proving that the user-facing route never exposes host free-space metrics.

---

## Rollout Notes

Quota-first is the correct product default. Real host free space is useful, but it is an operational diagnostic, not a stable promise to users.

---

*Spec drafted by GitHub Copilot. Grounded in the current Docker-mounted `.data` volume and the existing governed media storage architecture.*
