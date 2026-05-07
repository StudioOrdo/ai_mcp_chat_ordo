# Spec 09: Today Brief And Decision Surface

Status: Draft spec

Evidence date: 2026-05-05

## Problem

Today is the most important owner governance surface, but the current screen
still behaves like a dashboard stream.

The second-column mechanics are mostly in place. The main-pane product model is
wrong.

Current symptoms:

- the first-screen headline is a greeting instead of a brief,
- the main pane repeats the same buckets listed in the second column,
- decisions, running work, outputs, weak signals, results, business loop, Ask
  Ordo, and system health all compete at once,
- completed work can appear as a `Decision`,
- generic `OrdoCard` detail does not explain why the item matters today,
- system work can appear beside owner work without enough translation,
- `Ask Ordo` is repeated as a generic action instead of one contextual command.

## Current Code Anchors

- `src/app/workspace/page.tsx`
- `src/components/dashboard/UserDashboard.tsx`
- `src/lib/dashboard/load-user-dashboard.ts`
- `src/lib/dashboard/load-user-dashboard.test.ts`
- `src/components/dashboard/UserDashboard.test.tsx`

Important current functions:

- `buildTodaySelectionItems` in `UserDashboard.tsx`
- `DashboardSelectionColumn` in `UserDashboard.tsx`
- `DashboardOverview` in `UserDashboard.tsx`
- `SelectedTodayObject` in `UserDashboard.tsx`
- `buildNextActionCards` in `load-user-dashboard.ts`
- `buildWeakSignalCards` in `load-user-dashboard.ts`
- `buildResultCards` in `load-user-dashboard.ts`
- `buildSystemHealth` in `load-user-dashboard.ts`

## Product Principle

Today is the CEO daily brief.

The second column is the evidence index.

The main pane is the interpretation layer.

Chat remains the operating interface. Today tells the owner what to ask or
approve next, using evidence-backed objects.

## Target UX

### Second Column

Keep the current direction:

- search,
- filter icon/sheet,
- item rows,
- mobile list/detail behavior.

But rows should be driven by intent:

- Decide,
- Watch,
- Inspect,
- Learn,
- Fix.

Each row should show:

- intent icon,
- title,
- short reason,
- domain badge,
- status,
- as-of/updated date,
- optional source icon.

The second column should not show a dashboard. It is a selector.

### Main Pane Base Route

`/workspace` shows Today Brief.

It should answer:

1. What needs a decision now?
2. What is moving?
3. What output needs inspection?
4. What result or weak signal matters?
5. What should Ordo do next?

Recommended structure:

```text
Today Brief
As of May 6, 2026

Top priority
One decision with why, evidence, and action.

Watch
One running/queued item if it matters.

Inspect
One output ready for review.

Signal
One result or weak signal if evidence exists.

[Ask Ordo about today]
```

Do not render every category as a full dashboard block.

### Main Pane Selected Item

`/workspace?object=...` shows one selected Today item.

It should include:

- item intent and domain,
- title,
- why this is on Today,
- current state,
- recommended next action,
- evidence/source refs,
- related object links,
- type-specific action.

Examples:

- Person follow-up links to People detail and conversation.
- Media output links to Studio media detail.
- Offer review links to Offers detail.
- Backup failure links to System Backups.
- Restore confirmation links to System Restore Plans.

## Today Item Contract

Today items should be projected by the loader/read model, not assembled in JSX.

```ts
type TodayIntent = "decide" | "watch" | "inspect" | "learn" | "fix";

interface TodayItem {
  id: string;
  intent: TodayIntent;
  domain: "people" | "studio" | "offers" | "system" | "business";
  title: string;
  summary: string;
  why: string;
  status: string;
  updatedAt: string;
  sourceObject: {
    kind: string;
    id: string;
    href: string;
    label: string;
  };
  recommendedAction: {
    label: string;
    href: string;
    prompt?: string;
  } | null;
  evidenceRefs: Array<{
    kind: string;
    id: string;
    label: string;
    href?: string;
  }>;
}
```

## Classification Rules

Use these rules before anything appears on Today:

- `decide`: owner must approve, choose, send, publish, retry, classify, confirm,
  or answer.
- `watch`: work is queued/running and matters, but does not need action yet.
- `inspect`: output is ready and needs review.
- `learn`: result or performance signal is backed by evidence.
- `fix`: weak signal, blocked work, failed work, or risk needs attention.

Do not classify as `decide`:

- completed work with no pending owner action,
- succeeded jobs that only need provenance,
- metrics with no decision,
- system diagnostics that belong only in admin.

## System Work On Today

System work may appear on Today only if it needs action or creates material
risk.

Allowed owner-safe examples:

- `Backup failed`,
- `Restore needs confirmation`,
- `Safety backup still running`,
- `Provider setup needs review`,
- `Work queue stalled`.

Not allowed in regular Today copy:

- raw job id,
- raw command payload,
- provider key details,
- log excerpts,
- restore target paths,
- queue internals.

Those details belong behind System/Admin links.

## Brief Generation Link

Today Brief should eventually be generated like backup/restore work:

1. create durable brief update request,
2. gather evidence from Today read model sources,
3. validate every claim against evidence refs,
4. stage draft brief,
5. store brief artifact and manifest,
6. emit brief update event,
7. reconcile into `/workspace` read model,
8. keep prior brief on failure.

The first implementation can produce a deterministic brief from the read model,
but it must keep this future contract visible in code and tests.

## Acceptance Criteria

- `/workspace` main pane shows Today Brief, not stacked dashboard blocks.
- second column remains search/filter/list evidence index.
- selected Today item shows one detail with why, evidence, and recommended
  action.
- completed work is not labeled `Decision` unless an owner decision remains.
- system work is translated into owner-safe language.
- Today links to source surfaces instead of duplicating those surfaces.
- `Ask Ordo` appears as one contextual command per brief/item, not repeated as
  decorative card chrome.

## Tests

Positive:

- base route renders Today Brief.
- second column renders search, filter, and intent rows.
- selected item renders why/evidence/recommended action/source links.
- person follow-up links to People/conversation.
- media output links to Studio media detail.
- system backup/restore item links to System when authorized.

Negative:

- main pane does not render all dashboard buckets on the base route.
- completed work without owner action is not labeled `Decision`.
- owner Today copy does not expose raw job ids, provider keys, logs, command
  payloads, or restore target paths.
- non-admin user cannot open admin-only source links.

Edge:

- no evidence renders a first-action brief that routes to chat.
- partial loader failure keeps available brief sections and marks limitations.
- stale brief shows stale/refresh state without erasing prior brief.
- selected missing item returns to the brief with quiet unavailable copy.
