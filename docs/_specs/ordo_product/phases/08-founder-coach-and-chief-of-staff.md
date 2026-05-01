# Phase 08 - Founder Coach And Chief Of Staff

## Objective
Make Ordo useful as a solopreneur coach and chief of staff without polluting
execution prompts or creating ungoverned agent swarms.

## Product Shape
Ordo modes:
- Assistant: execute clear requests.
- Operator: manage work, jobs, assets, and follow-through.
- Strategist: choose direction and tradeoffs.
- Coach: improve operating behavior, routines, and reflection.
- Analyst: search, summarize, inspect, compare.
- Producer: create artifacts and deliverables.

## Founder Coach Services
- Daily operating review.
- Priority arbitration.
- Energy/capacity planning.
- Decision journaling.
- Accountability loops.
- Reflection/debrief.
- Relationship/client conversation prep.
- Skill development and training recommendations.

## Current Code Grounding
- Lifecycle context.
- Coach templates and queue.
- Relationship memory.
- Workspace snapshots.
- Jobs and attention candidates.
- Knowledge/search and profile/preferences.

## Implementation Steps
1. Define coach mode as product context, not a pile of new tools.
2. Use existing memory, workspace, jobs, and knowledge surfaces.
3. Add prompt exposure policy for coach mode.
4. Keep mutations explicit and confirmable.
5. Feed coach follow-ups into Attention Ledger once available.

## Tests
- Coach context exposes planning/memory/search tools, not logs/admin config.
- Coach can summarize existing jobs/assets/context.
- Coach does not mutate profile/roles/config without explicit request.

## Done Criteria
- Coaching is a governed context over existing infrastructure.
- Ordo feels like a chief of staff, not a generic chatbot.

