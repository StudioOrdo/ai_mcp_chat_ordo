export const ORDO_OBJECT_KINDS = [
  "media_asset",
  "content_item",
  "workflow_run",
  "operation",
  "person",
  "offer",
  "tracked_link",
  "campaign",
  "conversation",
  "backup",
  "restore_plan",
  "system",
] as const;

export type OrdoObjectKind = typeof ORDO_OBJECT_KINDS[number];

export const ORDO_DETAIL_LENSES = [
  "overview",
  "provenance",
  "funnel",
  "performance",
  "actions",
  "history",
  "related",
  "activity",
  "visibility",
] as const;

export type OrdoDetailLens = typeof ORDO_DETAIL_LENSES[number];

export const OBJECT_CENTERED_SURFACES = [
  "public",
  "dashboard",
  "studio",
  "business",
  "offers",
  "knowledge_base",
  "profile_settings",
  "admin",
  "diagnostic",
] as const;

export type ObjectCenteredSurface = typeof OBJECT_CENTERED_SURFACES[number];

export interface OrdoObjectKindContract {
  kind: OrdoObjectKind;
  label: string;
  targetSurface: ObjectCenteredSurface;
  defaultLens: OrdoDetailLens;
  donorSources: readonly string[];
  knownGap?: string;
}

export const ORDO_OBJECT_KIND_CONTRACTS: Record<OrdoObjectKind, OrdoObjectKindContract> = {
  media_asset: {
    kind: "media_asset",
    label: "Media asset",
    targetSurface: "studio",
    defaultLens: "provenance",
    donorSources: [
      "src/core/platform/asset-catalog/AssetCatalogReader.ts",
      "user_files",
      "blog_assets",
      "materialization_records",
      "media_workflows",
    ],
    knownGap: "Needs a Studio card projector and object detail route.",
  },
  content_item: {
    kind: "content_item",
    label: "Content item",
    targetSurface: "studio",
    defaultLens: "provenance",
    donorSources: [
      "blog_posts",
      "blog_post_artifacts",
      "blog_assets",
      "public feed donor routes",
    ],
    knownGap: "Content now has Feed, Studio cards, tracked-link metrics, and object detail routes; private audience-specific publishing remains future work.",
  },
  workflow_run: {
    kind: "workflow_run",
    label: "Workflow run",
    targetSurface: "studio",
    defaultLens: "provenance",
    donorSources: ["media_workflows", "operations", "job_requests", "factory work donors"],
    knownGap: "Needs a user-facing workflow card distinct from raw job cards.",
  },
  operation: {
    kind: "operation",
    label: "Operation",
    targetSurface: "diagnostic",
    defaultLens: "actions",
    donorSources: ["operations", "operation_steps", "operation_actions", "operation_artifacts"],
  },
  person: {
    kind: "person",
    label: "Person",
    targetSurface: "business",
    defaultLens: "funnel",
    donorSources: [
      "src/core/platform/business-workflow/BusinessWorkflowContextReader.ts",
      "leads",
      "deals",
      "consultations",
      "referrals",
    ],
    knownGap: "Business now has a derived person index; governed merge/split operations are still future work.",
  },
  offer: {
    kind: "offer",
    label: "Offer",
    targetSurface: "offers",
    defaultLens: "performance",
    donorSources: ["config/services.json", "src/app/offers/page.tsx", "admin attribution donors"],
    knownGap: "Offer events now support tracked-link attribution; full commerce remains simulated until real checkout exists.",
  },
  tracked_link: {
    kind: "tracked_link",
    label: "Tracked link",
    targetSurface: "business",
    defaultLens: "performance",
    donorSources: [
      "src/app/r/[code]/page.tsx",
      "src/app/t/[code]/route.ts",
      "src/app/api/referral/[code]/route.ts",
      "tracked_links",
      "tracked_link_events",
      "referral_events",
    ],
    knownGap: "generic tracked links now exist for public offers and published content; media/campaign share links still need dedicated target validators.",
  },
  campaign: {
    kind: "campaign",
    label: "Campaign",
    targetSurface: "business",
    defaultLens: "performance",
    donorSources: ["src/lib/referrals/campaign-presets.ts", "admin attribution donors", "trust-distribution refs"],
    knownGap: "Content campaign performance is currently a read model over content, offers, and tracked links; durable campaign and pillar tables are planned later.",
  },
  conversation: {
    kind: "conversation",
    label: "Conversation",
    targetSurface: "business",
    defaultLens: "history",
    donorSources: [
      "conversations",
      "src/core/platform/business-workflow/BusinessWorkflowContextReader.ts",
      "chat search/restore donors",
    ],
    knownGap: "Needs object relationship projection rather than a new chat route.",
  },
  backup: {
    kind: "backup",
    label: "Backup",
    targetSurface: "admin",
    defaultLens: "history",
    donorSources: [
      "system_commands",
      "src/lib/appliance/backup/**",
      "src/app/api/admin/system/backups/**",
      "crates/ordo-backup/src/**",
    ],
    knownGap: "Backup details are admin-only and still rendered through the System backup manager until a full object detail route exists.",
  },
  restore_plan: {
    kind: "restore_plan",
    label: "Restore plan",
    targetSurface: "admin",
    defaultLens: "actions",
    donorSources: [
      "system_commands",
      "src/lib/appliance/backup/**",
      "src/app/api/admin/system/restore-plans/**",
      "crates/ordo-backup/src/**",
    ],
    knownGap: "Restore plans are admin-only and require destructive confirmation inside the System backup manager.",
  },
  system: {
    kind: "system",
    label: "System section",
    targetSurface: "admin",
    defaultLens: "actions",
    donorSources: [
      "src/lib/admin/system/load-admin-system-workspace.ts",
      "src/components/admin/system/AdminSystemWorkspace.tsx",
      "src/lib/admin/jobs/admin-jobs.ts",
      "src/lib/appliance/backup/**",
    ],
    knownGap: "System sections use admin diagnostics and must not appear in regular owner governance details.",
  },
};

export const OBJECT_CENTERED_PRIMARY_SURFACES: readonly ObjectCenteredSurface[] = [
  "dashboard",
  "studio",
  "business",
  "offers",
  "knowledge_base",
  "profile_settings",
  "admin",
];
