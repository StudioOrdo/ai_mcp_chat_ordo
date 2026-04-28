# Build Phases — Ordo Job System & Platform

> 17 specs consolidated into 5 agent-optimized phases.
> Organized by blast radius (what files change together), not by feature.

---

## Phase Overview

| Phase | Milestone | User-Visible Change | Status |
| --- | --- | --- | --- |
| [Phase 1: Solid Ground](./phase-1-solid-ground.md) | Types correct, SSE resilient, state decoupled | None (infrastructure) | `[x] Complete` |
| [Phase 2: Transparent Operations](./phase-2-transparent-operations.md) | Users can see and control jobs | Cancel/retry buttons, retry/timing transparency, strip navigation/pinning, repair notes | `[x] Complete` |
| [Phase 3: Visual Polish](./phase-3-visual-polish.md) | UI looks premium | Shimmer loading, galleries, structured errors, a11y | `[ ] Not Started` |
| [Phase 4: Platform Maturity](./phase-4-platform-maturity.md) | System manages itself | Auto-registration, retention, plugin GUI | `[ ] Not Started` |
| [Phase 5: Engine Power](./phase-5-engine-power.md) | Orchestration capability | Scheduled jobs, DAG workflows | `[ ] Not Started` |

---

## Dependency Graph

```text
Phase 1 ──→ Phase 2 ──→ Phase 3
   │
   ├──────→ Phase 4
   │
   └──────→ Phase 5 (also benefits from Phase 4)
```

Phases 2 and 3 are sequential (2 builds the action framework, 3 layers visual polish on top).
Phase 4 can run after Phase 1.
Phase 5 should follow Phase 4 because its workflow tools depend on the auto-registration work landing first.

---

## Spec Consolidation Map

| Original Spec | Absorbed Into |
| --- | --- |
| 01 — Capability Management | Phase 4 (4C) |
| 02 — A2A Networking | Vision backlog |
| 03 — MCP Developer Portal | Vision backlog |
| 04 — Agentic Contributions | Vision backlog |
| 05 — Job Orchestration DAGs | Phase 5 (5B) |
| 06 — Scheduled Jobs | Phase 5 (5A) |
| 07 — Dead Letter Queue | Phase 1 (1A) |
| 08 — Event-Driven Cancellation | Phase 1 (1D) |
| 09 — Job Transparency UX | Phase 1 (1A) + Phase 2 (2A) |
| 10 — Multimedia Card Redesign | Phase 3 (3A–3D) |
| 11 — Job Command Rail | Phase 2 (2B–2D) |
| 12 — Deduplicate Job Routes | Phase 1 (1A) |
| 13 — SSE Reconnection | Phase 1 (1C) |
| 14 — Data Lifecycle Retention | Phase 4 (4B) |
| 15 — Capability Registration DX | Phase 4 (4A) |
| 16 — Accessibility Hardening | Phase 3 (3E) |
| 17 — Context Window Coherence | Phase 1 (1B) |

---

## Vision Backlog (Future)

These specs require multi-month infrastructure that doesn't exist yet:

| Spec | Prerequisite |
| --- | --- |
| 02 — A2A Networking | Network transport, trust protocol, registry |
| 03 — Developer Portal | Stable plugin API (Phase 4) + external developer interest |
| 04 — Agentic Contributions | A2A networking (02) + automated testing infra |

---

## Companion Notes

- [Phase 1 Readiness Review](./phase-1-readiness-review.md) — repo-grounded implementation notes and execution order for the foundation phase
- [Phase 2 Readiness Review](./phase-2-readiness-review.md) — repo-grounded status, current seams, and Phase 0 carryover notes for the user-visible operations phase
- [Phase 3 Readiness Review](./phase-3-readiness-review.md) — repo-grounded status, current card/plugin seams, and implementation order for the visual polish phase
