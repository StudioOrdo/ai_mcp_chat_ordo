# Spec 07: Clean Architecture And Shared Components

Status: Draft spec

Evidence date: 2026-05-05

## Problem

The refactor touches many surfaces. If every page fixes its own layout,
navigation, selectors, filters, cards, and mobile drill-in independently, the
codebase will become harder to maintain.

We need one shared architecture for the shell and governance surfaces.

## Architecture Principles

- One shell contract.
- One section layout contract.
- One second-column selector contract.
- One card/detail vocabulary.
- Read models translate implementation data into product objects.
- Components render product objects, not database table names.
- Admin diagnostics are isolated behind role-gated admin/system surfaces.
- Brief generation uses command/result/reconcile semantics rather than
  component-local derivation.
- Main panes render either a brief or one selected object, never both global
  dashboards and selected detail.

## Current Anchors To Reuse

Layout and shell:

- `src/components/AppShell.tsx`
- `src/components/SiteNav.tsx`
- `src/components/AuthenticatedWorkRail.tsx`
- `src/app/styles/shell.css`

Second-column examples:

- `src/components/business/BusinessWorkspace.tsx`
- `src/components/studio/StudioWorkspace.tsx`
- `src/components/profile/ProfileSettingsPanel.tsx`
- `src/app/admin/page.tsx`

Object cards:

- `src/components/ordo-cards/OrdoCard.tsx`
- `src/lib/ordo-cards/*`
- `src/core/entities/ordo-object.ts`

Media preview donor:

- `src/components/media/UserMediaWorkspace.tsx`

Backups donor:

- `src/app/admin/system/backups/BackupSelfServiceManager.tsx`

## Proposed Shared Components

### Shell

- `ShellLayoutFrame`
- `ShellTopBar`
- `ShellMainMenu`
- `ShellAccountMenu`
- `ShellLeftRail`
- `ShellMobileMenu`

### Governance Section

- `GovernanceSectionLayout`
- `SectionSecondColumn`
- `SectionBriefPanel`
- `SectionObjectList`
- `SectionFilterSheet`
- `MobileDetailBackButton`
- `SectionBriefSummary`
- `SectionBriefDecision`
- `SectionBriefEvidenceList`
- `SectionBriefActionBar`

### Object UI

- `ObjectSelectorRow`
- `ObjectDetailHeader`
- `ObjectStatusBadge`
- `ObjectFactsRow`
- `ObjectEvidenceTrail`
- `ObjectRelatedLinks`
- `ObjectActionBar`

### Today

- `TodayBriefPanel`
- `TodayIntentRow`
- `TodaySelectedItemDetail`
- `TodayEvidenceSummary`
- `TodayRecommendedAction`

### Media

- `MediaPreviewPane`
- `MediaMetadataGrid`
- `MediaRetentionActions`

### System

- `SystemSectionSelector`
- `SystemStatusCard`
- `BackupTable`
- `RestorePlanPanel`
- `SystemBriefPanel`

### Brief Infrastructure

- `BriefManifestViewer`
- `BriefSourceLinkList`
- `BriefHistoryTimeline`
- `BriefRefreshStatus`

## Read Model Pattern

Each section should expose a read model shaped for UX:

```ts
interface GovernanceSectionModel<TObject, TSummary> {
  sectionId: string;
  sectionTitle: string;
  brief: SectionBrief | null;
  summary: TSummary;
  query: GovernanceQuery;
  objects: TObject[];
  selectedObject: TObject | null;
  pageInfo: PageInfo;
  permissions: SectionPermissions;
}
```

The component should not know which database tables were joined.

Briefs should be read-model objects too:

```ts
interface SectionBrief {
  id: string;
  sectionId: string;
  objectRef?: {
    kind: string;
    id: string;
    label: string;
  };
  asOf: string;
  status: "fresh" | "stale" | "limited" | "failed";
  bullets: string[];
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
  limitations: string[];
}
```

Today items should be product intents, not raw cards:

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
  sourceObject: {
    kind: string;
    id: string;
    href: string;
  };
  recommendedAction: SectionBrief["recommendedAction"];
  evidenceRefs: SectionBrief["evidenceRefs"];
}
```

This avoids the current anti-pattern where React components assemble Today
state by combining unrelated dashboard card blocks.

## URL Pattern

Prefer stable query-based selection where route ownership is not yet settled:

- `/workspace?item=...`
- `/studio?kind=media_asset&object=...`
- `/business?person=...`
- `/offers?offer=...`
- `/admin/system?section=backups&backup=...`

When a route becomes public or shareable, add a clean detail route later.

## Styling Rules

- shared CSS variables for rail width, second-column width, top rail height,
  content max width, and mobile breakpoints.
- no page-specific fixed offsets unless unavoidable.
- no shadow at rail/top seams.
- selected state is subtle and consistent.
- icon-plus-label on desktop rails.
- icon-only buttons require accessible labels.

## Test Helpers

Create test helpers for:

- authenticated user,
- admin user,
- mobile viewport,
- shell nav assertions,
- second-column assertions,
- selected detail assertions,
- public/private route assertions.

## Acceptance Criteria

- New surfaces use shared layout and selector primitives.
- Existing People behavior is preserved while other sections converge.
- Media preview logic is reusable without duplicating the whole media page.
- Backup/restore logic is reusable inside System section.
- Tests assert product language, not implementation internals.
- Today, Studio, Offers, Account, and System all consume section read models
  instead of deriving page logic inside JSX.
- Brief update requests/results can be tested independently from the UI.
