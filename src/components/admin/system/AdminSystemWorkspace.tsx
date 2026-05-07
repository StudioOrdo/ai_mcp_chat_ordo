import Link from "next/link";
import type { ReactNode } from "react";

import {
  GovernanceSectionFrame,
  SectionBriefPanel,
  type GovernanceSectionModel,
  type GovernanceSelectorItem,
} from "@/components/governance/GovernanceSectionFrame";
import { BackupSelfServiceManager } from "@/app/admin/system/backups/BackupSelfServiceManager";
import type {
  AdminSystemSection,
  AdminSystemSummary,
  AdminSystemWorkspaceData,
} from "@/lib/admin/system/load-admin-system-workspace";

interface AdminSystemWorkspaceProps {
  workspace: AdminSystemWorkspaceData;
}

function Metric({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  tone?: "neutral" | "good" | "review";
}) {
  const toneClass = tone === "good"
    ? "text-emerald-700"
    : tone === "review"
      ? "text-rose-700"
      : "text-foreground";

  return (
    <div className="rounded-lg border border-foreground/10 bg-background/72 p-(--space-3)">
      <dt className="theme-label tier-micro uppercase text-foreground/42">{label}</dt>
      <dd className={`mt-(--space-1) text-2xl font-semibold tracking-tight ${toneClass}`}>
        {value}
      </dd>
    </div>
  );
}

function SystemSelectorOverview({ summary }: { summary: AdminSystemSummary }) {
  return (
    <div className="rounded-lg border border-foreground/10 bg-background/72 p-(--space-3)" data-admin-system-selector-overview="true">
      <p className="text-sm font-semibold text-foreground">System Brief</p>
      <p className="mt-(--space-1) text-xs leading-5 text-foreground/52">
        {summary.warningCount > 0
          ? `${summary.warningCount} admin signals need review.`
          : "Admin signals are stable."}
      </p>
      <p className="mt-(--space-2) text-xs text-foreground/46">
        Backups {summary.backupCount} · Restore plans {summary.restorePlanCount} · Failed jobs {summary.failedJobs}
      </p>
    </div>
  );
}

function SystemOverview({ workspace }: { workspace: AdminSystemWorkspaceData }) {
  const { summary, loadErrors } = workspace;

  return (
    <div className="grid gap-(--space-5)" data-admin-system-brief="true">
      <SectionBriefPanel brief={workspace.brief} />
      <section className="grid gap-(--space-3) rounded-lg border border-foreground/10 bg-background/82 p-(--space-inset-panel)">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">Admin readiness</h2>
        <dl className="grid gap-(--space-3) sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Health" value={summary.healthStatus} tone={summary.healthStatus === "ok" ? "good" : "review"} />
          <Metric label="Tools" value={summary.toolCount} tone={summary.toolWarningCount > 0 ? "review" : "good"} />
          <Metric label="Backups" value={summary.backupCount} />
          <Metric label="Restore Plans" value={summary.restorePlanCount} />
          <Metric label="Failed Jobs" value={summary.failedJobs} tone={summary.failedJobs > 0 ? "review" : "good"} />
        </dl>
        {loadErrors.length > 0 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-(--space-3) text-sm text-amber-900">
            <p className="font-semibold">Some System sources did not load.</p>
            <ul className="mt-(--space-2) grid gap-(--space-1)">
              {loadErrors.map((error) => (
                <li key={error.source}>{error.source}: {error.message}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
      <section className="grid gap-(--space-2) rounded-lg border border-foreground/10 bg-background/82 p-(--space-inset-panel)">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">Background reliability model</h2>
        <p className="text-sm leading-6 text-foreground/60">
          Backup and restore are the System model for background brief work: create a durable request,
          execute it outside the UI, persist the result and evidence manifest, then reconcile the
          successful result into read models. Failures keep prior evidence intact.
        </p>
      </section>
    </div>
  );
}

function DataList({
  rows,
}: {
  rows: Array<{ label: string; value: string | number | null | undefined }>;
}) {
  return (
    <dl className="grid gap-(--space-2) text-sm text-foreground/62">
      {rows.map((row) => (
        <div key={row.label} className="grid gap-(--space-1) rounded-lg border border-foreground/10 bg-background/72 p-(--space-3) sm:grid-cols-[12rem_minmax(0,1fr)]">
          <dt className="theme-label tier-micro uppercase text-foreground/42">{row.label}</dt>
          <dd className="min-w-0 break-words text-foreground/72">{row.value ?? "-"}</dd>
        </div>
      ))}
    </dl>
  );
}

function SectionHeader({
  section,
}: {
  section: AdminSystemSection;
}) {
  return (
    <header className="grid gap-(--space-2)">
      <p className="theme-label tier-micro uppercase text-foreground/42">Admin System</p>
      <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{section.title}</h1>
      <p className="max-w-3xl text-sm leading-6 text-foreground/60">{section.summary}</p>
      {section.targetHref && section.targetLabel ? (
        <Link href={section.targetHref} className="btn-secondary w-fit">
          {section.targetLabel}
        </Link>
      ) : null}
    </header>
  );
}

function HealthDetail({ workspace, section }: { workspace: AdminSystemWorkspaceData; section: AdminSystemSection }) {
  const health = workspace.diagnostics.health;

  return (
    <div className="grid gap-(--space-5)" data-admin-system-section-detail="health">
      <SectionHeader section={section} />
      {health ? (
        <DataList
          rows={[
            { label: "Overall", value: health.data.summary.overallStatus },
            { label: "Readiness", value: health.data.summary.readinessStatus },
            { label: "Liveness", value: health.data.summary.livenessStatus },
            { label: "Environment", value: health.data.summary.environmentStatus },
            { label: "Generated", value: health.data.generatedAt },
            { label: "Public origin", value: health.data.referral.publicOrigin },
          ]}
        />
      ) : (
        <p className="text-sm text-foreground/56">System health could not load.</p>
      )}
    </div>
  );
}

function ProvidersDetail({ workspace, section }: { workspace: AdminSystemWorkspaceData; section: AdminSystemSection }) {
  const providers = workspace.diagnostics.providers;

  return (
    <div className="grid gap-(--space-5)" data-admin-system-section-detail="providers">
      <SectionHeader section={section} />
      {providers ? (
        <DataList
          rows={[
            { label: "Provider", value: providers.intelligence.provider },
            { label: "Provider source", value: providers.intelligence.providerSource },
            { label: "Model", value: providers.intelligence.model },
            { label: "Model source", value: providers.intelligence.modelSource },
            { label: "API key", value: providers.intelligence.apiKeyConfigured ? "configured" : "missing" },
            { label: "Warnings", value: providers.intelligence.warningCodes.join(", ") || "none" },
          ]}
        />
      ) : (
        <p className="text-sm text-foreground/56">Provider diagnostics could not load.</p>
      )}
    </div>
  );
}

function CapabilitiesDetail({ workspace, section }: { workspace: AdminSystemWorkspaceData; section: AdminSystemSection }) {
  const providers = workspace.diagnostics.providers;

  return (
    <div className="grid gap-(--space-5)" data-admin-system-section-detail="capabilities">
      <SectionHeader section={section} />
      {providers ? (
        <div className="grid gap-(--space-3)">
          {providers.capabilities.map((capability) => (
            <article key={capability.slot} className="rounded-lg border border-foreground/10 bg-background/82 p-(--space-inset-default)">
              <div className="flex flex-wrap items-center gap-(--space-2)">
                <h2 className="text-lg font-semibold text-foreground">{capability.slot}</h2>
                <span className="rounded-full border border-foreground/10 px-(--space-2) py-[0.14rem] text-xs font-semibold text-foreground/56">
                  {capability.state.replaceAll("_", " ")}
                </span>
              </div>
              <p className="mt-(--space-2) text-sm text-foreground/58">
                Provider {capability.provider}; model {capability.model ?? "not configured"}.
              </p>
              <p className="mt-(--space-1) text-xs text-foreground/46">
                Impacted tools: {capability.impactedTools.length > 0 ? capability.impactedTools.join(", ") : "none"}.
              </p>
            </article>
          ))}
        </div>
      ) : (
        <p className="text-sm text-foreground/56">Capability diagnostics could not load.</p>
      )}
    </div>
  );
}

function ToolsDetail({ workspace, section }: { workspace: AdminSystemWorkspaceData; section: AdminSystemSection }) {
  const providers = workspace.diagnostics.providers;

  return (
    <div className="grid gap-(--space-5)" data-admin-system-section-detail="tools">
      <SectionHeader section={section} />
      {providers ? (
        <>
          <dl className="grid gap-(--space-3) sm:grid-cols-3">
            <Metric label="Catalog Tools" value={providers.toolSummary.total} />
            <Metric label="Protected" value={providers.toolSummary.protectedCount} />
            <Metric label="Warnings" value={providers.toolSummary.warnings} tone={providers.toolSummary.warnings > 0 ? "review" : "good"} />
          </dl>
          <section className="rounded-lg border border-foreground/10 bg-background/82 p-(--space-inset-default)">
            <p className="text-sm leading-6 text-foreground/60">
              Tool availability, operator locks, provider gates, and protected recovery controls stay
              in the linked System Tools page.
            </p>
          </section>
        </>
      ) : (
        <p className="text-sm text-foreground/56">Tool diagnostics could not load.</p>
      )}
    </div>
  );
}

function BackupsDetail({ workspace, section }: { workspace: AdminSystemWorkspaceData; section: AdminSystemSection }) {
  const dashboard = workspace.diagnostics.backups;

  return (
    <div className="grid gap-(--space-5)" data-admin-system-section-detail="backups">
      <SectionHeader section={section} />
      {dashboard ? (
        <BackupSelfServiceManager dashboard={dashboard} initialView="backups" />
      ) : (
        <p className="text-sm text-foreground/56">Backup dashboard could not load.</p>
      )}
    </div>
  );
}

function RestorePlansDetail({ workspace, section }: { workspace: AdminSystemWorkspaceData; section: AdminSystemSection }) {
  const dashboard = workspace.diagnostics.backups;

  return (
    <div className="grid gap-(--space-5)" data-admin-system-section-detail="restore-plans">
      <SectionHeader section={section} />
      <section className="rounded-lg border border-rose-200 bg-rose-50 p-(--space-inset-default) text-sm text-rose-900">
        <p className="font-semibold">Restore is destructive.</p>
        <p className="mt-(--space-1)">
          Restore plans require the confirmation phrase, a safety backup, and admin execution before data is replaced.
        </p>
      </section>
      {dashboard ? (
        <BackupSelfServiceManager dashboard={dashboard} initialView="restore-plans" />
      ) : (
        <p className="text-sm text-foreground/56">Restore plans could not load.</p>
      )}
    </div>
  );
}

function JobsDetail({ workspace, section }: { workspace: AdminSystemWorkspaceData; section: AdminSystemSection }) {
  const jobs = workspace.diagnostics.jobs;

  return (
    <div className="grid gap-(--space-5)" data-admin-system-section-detail="jobs">
      <SectionHeader section={section} />
      {jobs ? (
        <>
          <dl className="grid gap-(--space-3) sm:grid-cols-4">
            <Metric label="Queued" value={jobs.statusCounts.queued ?? 0} />
            <Metric label="Running" value={jobs.statusCounts.running ?? 0} />
            <Metric label="Failed" value={jobs.statusCounts.failed ?? 0} tone={(jobs.statusCounts.failed ?? 0) > 0 ? "review" : "good"} />
            <Metric label="Retryable" value={jobs.jobs.filter((job) => job.canRetry || job.canRequeue).length} />
          </dl>
          <div className="grid gap-(--space-3)">
            {jobs.jobs.slice(0, 8).map((job) => (
              <Link
                key={job.id}
                href={job.detailHref}
                className="focus-ring rounded-lg border border-foreground/10 bg-background/82 p-(--space-inset-default)"
              >
                <div className="flex flex-wrap items-center gap-(--space-2)">
                  <span className="font-semibold text-foreground">{job.toolLabel}</span>
                  <span className="rounded-full border border-foreground/10 px-(--space-2) py-[0.14rem] text-xs font-semibold text-foreground/56">
                    {job.status}
                  </span>
                  {job.canRetry ? <span className="text-xs font-semibold text-rose-700">retryable</span> : null}
                </div>
                <p className="mt-(--space-1) text-xs text-foreground/46">
                  {job.id} · attempts {job.attemptCount} · updated {job.completedAt ?? job.startedAt ?? job.createdAt}
                </p>
              </Link>
            ))}
          </div>
        </>
      ) : (
        <p className="text-sm text-foreground/56">Job diagnostics could not load.</p>
      )}
    </div>
  );
}

function LinkedSectionDetail({
  section,
  children,
}: {
  section: AdminSystemSection;
  children?: ReactNode;
}) {
  return (
    <div className="grid gap-(--space-5)" data-admin-system-section-detail={section.id}>
      <SectionHeader section={section} />
      <section className="rounded-lg border border-foreground/10 bg-background/82 p-(--space-inset-panel)">
        {children ?? (
          <p className="text-sm leading-6 text-foreground/60">
            This System section keeps the linked admin surface one click away while the second column remains the diagnostic index.
          </p>
        )}
      </section>
    </div>
  );
}

function renderSystemDetail(workspace: AdminSystemWorkspaceData, section: AdminSystemSection) {
  switch (section.id) {
    case "overview":
      return <SystemOverview workspace={workspace} />;
    case "health":
      return <HealthDetail workspace={workspace} section={section} />;
    case "providers":
      return <ProvidersDetail workspace={workspace} section={section} />;
    case "tools":
      return <ToolsDetail workspace={workspace} section={section} />;
    case "capabilities":
      return <CapabilitiesDetail workspace={workspace} section={section} />;
    case "backups":
      return <BackupsDetail workspace={workspace} section={section} />;
    case "restore-plans":
      return <RestorePlansDetail workspace={workspace} section={section} />;
    case "jobs":
      return <JobsDetail workspace={workspace} section={section} />;
    case "visibility":
      return <LinkedSectionDetail section={section}>Content visibility and publishing rules stay in the linked admin page.</LinkedSectionDetail>;
    case "prompts":
      return <LinkedSectionDetail section={section}>Prompt governance stays in the linked admin page.</LinkedSectionDetail>;
    case "operations":
      return <LinkedSectionDetail section={section}>Durable operation evidence and actions stay in the linked operations page.</LinkedSectionDetail>;
    case "logs":
      return <LinkedSectionDetail section={section}>Raw logs remain admin-only and must not appear in owner governance surfaces.</LinkedSectionDetail>;
    case "keys":
      return <LinkedSectionDetail section={section}>Provider keys and model settings stay in the linked keys page.</LinkedSectionDetail>;
  }
}

function selectorItems(workspace: AdminSystemWorkspaceData): GovernanceSelectorItem[] {
  return workspace.sections.map((section) => ({
    id: section.id,
    href: section.href,
    title: section.title,
    summary: section.summary,
    iconLabel: section.iconLabel,
    statusLabel: section.statusLabel ?? undefined,
    countLabel: section.countLabel ?? undefined,
    selected: workspace.query.sectionId === section.id,
    diagnosticLabel: section.targetLabel ?? undefined,
    dataAttributes: {
      "data-admin-system-section": section.id,
    },
  }));
}

export function AdminSystemWorkspace({ workspace }: AdminSystemWorkspaceProps) {
  const sectionModel: GovernanceSectionModel<AdminSystemSection, AdminSystemSummary> = {
    sectionId: "admin-system",
    sectionTitle: "System",
    brief: workspace.brief,
    summary: workspace.summary,
    objects: workspace.sections,
    selectedObject: workspace.selectedSection,
    permissions: {
      canView: true,
      canSelect: true,
      canFilter: true,
      canMutate: true,
      canViewDiagnostics: true,
    },
  };

  const detailRequested = Boolean(workspace.query.sectionId);

  return (
    <GovernanceSectionFrame
      model={sectionModel}
      detailRequested={detailRequested}
      listHref="/admin/system"
      mobileBackLabel="Back to System"
      rootDataAttributes={{
        "data-admin-system-workspace": "true",
      }}
      selector={{
        ariaLabel: "System sections",
        title: "System",
        guidance: "Select an admin governance section. Owner surfaces receive translated status, not raw diagnostics.",
        overview: <SystemSelectorOverview summary={workspace.summary} />,
        search: {
          action: "/admin/system",
          label: "Search System sections",
          placeholder: "Search System...",
          defaultValue: workspace.query.q,
        },
        items: selectorItems(workspace),
        emptyTitle: "No System section matches this search.",
        emptySummary: "Clear the search to return to all System sections.",
        footer: (
          <p>
            Showing {workspace.sections.length} System sections.
          </p>
        ),
        dataAttributes: {
          "data-admin-system-selector-column": "true",
        },
      }}
      main={{
        ariaLabel: "System governance",
        renderBrief: () => <SystemOverview workspace={workspace} />,
        renderDetail: (section) => renderSystemDetail(workspace, section),
        missingDetail: {
          title: "System section was not found.",
          summary: "Return to the System Brief or select another admin section.",
        },
        dataAttributes: {
          "data-admin-system-main-column": "true",
        },
      }}
    />
  );
}
