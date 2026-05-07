# Phase Index

This directory breaks the chat job event delivery refactor into small,
reviewable phases. Each phase should be completed and validated before the next
phase depends on it.

Post-09 hard-cutover note: Phases 09a-09d supersede any earlier phase guidance
that retained message-shaped job lifecycle state as a product presentation,
restore, reconciliation, or persistence mechanism. Earlier phases remain useful
as historical implementation evidence, but the current package contract is
canonical job snapshots plus transcript messages as separate sources.

## Sequence

0. [Phase 00 - Baseline Evidence](00-baseline-evidence.md)
1. [Phase 01 - Contract And Surface Inventory](01-contract-and-surface-inventory.md)
2. [Phase 02 - Cursor Semantics And Route Hardening](02-cursor-semantics-and-route-hardening.md)
3. [Phase 03 - Active Chat Event Hook](03-active-chat-event-hook.md)
4. [Phase 04 - Job State Merge Authority](04-job-state-merge-authority.md)
5. [Phase 05 - Presenter Dedupe And Raw History](05-presenter-dedupe-and-raw-history.md)
6. [Phase 06 - Status Tool Guardrails](06-status-tool-guardrails.md)
7. [Phase 07 - Eval And Fixture Rewrite](07-eval-and-fixture-rewrite.md)
8. [Phase 08 - Legacy Fragmentation Cleanup](08-legacy-fragmentation-cleanup.md)
9. [Phase 09a - Job State Contract And Guardrails](09a-job-state-contract-and-guardrails.md)
10. [Phase 09b - Canonical Job Read Model](09b-canonical-job-read-model.md)
11. [Phase 09c - Chat Presentation Split](09c-chat-presentation-split.md)
12. [Phase 09d - Stop Dual Writes And Prune](09d-stop-dual-writes-and-prune.md)
13. [Phase 09 - Push Notification Boundary](09-push-notification-boundary.md)
14. [Phase 10 - Browser And Runtime Proof](10-browser-and-runtime-proof.md)
15. [Phase 10a - Audio Job Contract And Routing](10a-audio-job-contract-and-routing.md)
16. [Phase 10b - Audio Worker Materialization And Compose Integration](10b-audio-worker-materialization-and-compose-integration.md)
17. [Phase 10c - Audio Presentation Restore And Legacy Prune](10c-audio-presentation-restore-and-legacy-prune.md)
18. [Phase 11 - Release Evidence](11-release-evidence.md)
19. [Phase 12 - Closeout And Handoff](12-closeout-and-handoff.md)

## Phase Rules

- Do not skip baseline evidence.
- Do not implement browser Push before active chat correctness is proven.
- Do not treat status tools as a normal wait loop.
- Do not hide duplicate cards only in React components.
- Preserve raw transcript and diagnostic history while deduping default product
  presentation.
- Keep messages and jobs as separate domain concepts: messages are speech, jobs
  are durable state.
- Treat high-usage audio generation as a canonical media job. Do not keep a
  direct/synthetic audio compatibility lane in product chat.
- Keep code changes scoped to the phase unless a discovered dependency is
  documented in the phase closeout.
