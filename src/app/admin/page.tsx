import type { Metadata } from "next";
import Link from "next/link";

import { AdminCard } from "@/components/admin/AdminCard";
import {
  loadRoutingReviewBlock,
  loadSystemHealthBlock,
} from "@/lib/operator/loaders/admin-loaders";
import { loadOverdueFollowUpsBlock } from "@/lib/admin/pipeline/admin-pipeline-attention";
import {
  loadAnonymousOpportunitiesBlock,
  loadRecurringPainThemesBlock,
} from "@/lib/operator/loaders/analytics-loaders";
import {
  loadConsultationRequestQueueBlock,
  loadLeadQueueBlock,
  loadTrainingPathQueueBlock,
} from "@/lib/admin/leads/admin-leads-attention";
import {
  loadAdminJournalList,
  requireAdminPageAccess,
} from "@/lib/journal/admin-journal";
import {
  getAdminJournalAttributionPath,
  getAdminJournalListPath,
} from "@/lib/journal/admin-journal-routes";
import { loadAdminJobList } from "@/lib/admin/jobs/admin-jobs";
import { getAdminJobsListPath } from "@/lib/admin/jobs/admin-jobs-routes";
import { getAdminLeadsListPath } from "@/lib/admin/leads/admin-leads-routes";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin Dashboard",
  robots: { index: false, follow: false },
};

type AdminDashboardSectionId =
  | "overview"
  | "system-health"
  | "pipeline"
  | "conversations"
  | "content"
  | "jobs";

interface AdminDashboardSection {
  id: AdminDashboardSectionId;
  label: string;
  shortLabel: string;
  description: string;
  href: string;
  targetHref: string;
  targetLabel: string;
}

const ADMIN_DASHBOARD_SECTIONS: AdminDashboardSection[] = [
  {
    id: "overview",
    label: "Overview",
    shortLabel: "Overview",
    description: "Cross-workspace health, attention, and operator pressure.",
    href: "/admin",
    targetHref: "/admin",
    targetLabel: "Stay on overview",
  },
  {
    id: "system-health",
    label: "System health",
    shortLabel: "Health",
    description: "Runtime readiness, environment, provider, and referral checks.",
    href: "/admin?section=system-health",
    targetHref: "/admin/system",
    targetLabel: "Open full system page",
  },
  {
    id: "pipeline",
    label: "Pipeline attention",
    shortLabel: "Pipeline",
    description: "Leads, consultations, training paths, and overdue follow-ups.",
    href: "/admin?section=pipeline",
    targetHref: getAdminLeadsListPath(),
    targetLabel: "Open pipeline page",
  },
  {
    id: "conversations",
    label: "Conversation attention",
    shortLabel: "Conversations",
    description: "Routing review, anonymous opportunities, and recurring themes.",
    href: "/admin?section=conversations",
    targetHref: "/admin/conversations",
    targetLabel: "Open conversations page",
  },
  {
    id: "content",
    label: "Content operations",
    shortLabel: "Content",
    description: "Journal inventory, review state, publishing, and attribution.",
    href: "/admin?section=content",
    targetHref: getAdminJournalListPath(),
    targetLabel: "Open content page",
  },
  {
    id: "jobs",
    label: "Jobs health",
    shortLabel: "Jobs",
    description: "Deferred-job queue pressure and failed work review.",
    href: "/admin?section=jobs",
    targetHref: getAdminJobsListPath(),
    targetLabel: "Open jobs page",
  },
];

type SearchParams = Record<string, string | string[] | undefined>;

function firstSearchValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function resolveAdminSectionId(searchParams: SearchParams): AdminDashboardSectionId {
  const rawSection = firstSearchValue(searchParams.section);
  const section = ADMIN_DASHBOARD_SECTIONS.find((item) => item.id === rawSection);
  return section?.id ?? "overview";
}

function unavailableCard(title: string) {
  return (
    <AdminCard title={title} status="neutral">
      <p className="text-sm text-foreground/40">Data unavailable</p>
    </AdminCard>
  );
}

function unavailablePanel(title: string) {
  return (
    <section className="admin-panel-surface grid gap-(--space-3) p-(--space-inset-panel)" data-admin-system-section-panel="unavailable">
      <p className="text-[0.68rem] font-semibold uppercase text-foreground/42">Unavailable</p>
      <h2 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h2>
      <p className="max-w-2xl text-sm leading-6 text-foreground/56">
        The selected system section could not load its source data. Open the linked page for deeper diagnostics.
      </p>
    </section>
  );
}

function metricTone(status: "ok" | "warning" | "neutral"): string {
  if (status === "ok") return "text-emerald-700";
  if (status === "warning") return "text-rose-700";
  return "text-foreground";
}

function SectionMetric({
  label,
  value,
  status = "neutral",
}: {
  label: string;
  value: string | number;
  status?: "ok" | "warning" | "neutral";
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-background/70 p-(--space-3)">
      <dt className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-foreground/42">
        {label}
      </dt>
      <dd className={`mt-(--space-1) text-2xl font-semibold tracking-tight ${metricTone(status)}`}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </dd>
    </div>
  );
}

function SectionLink({ href, children }: { href: string; children: string }) {
  return (
    <Link
      href={href}
      className="focus-ring inline-flex min-h-10 w-fit items-center justify-center rounded-full border border-border/80 px-(--space-4) text-sm font-semibold text-foreground/76 transition hover:bg-foreground/[0.035] hover:text-foreground"
    >
      {children}
    </Link>
  );
}

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
} = {}) {
  const user = await requireAdminPageAccess();
  const rawSearchParams = searchParams ? await searchParams : {};
  const activeSectionId = resolveAdminSectionId(rawSearchParams);
  const activeSection = ADMIN_DASHBOARD_SECTIONS.find((section) => section.id === activeSectionId)
    ?? ADMIN_DASHBOARD_SECTIONS[0];

  const results = await Promise.allSettled([
    loadSystemHealthBlock(user),
    loadLeadQueueBlock(user),
    loadConsultationRequestQueueBlock(user),
    loadTrainingPathQueueBlock(user),
    loadOverdueFollowUpsBlock(user),
    loadRoutingReviewBlock(user),
    loadAnonymousOpportunitiesBlock(user),
    loadRecurringPainThemesBlock(user),
    loadAdminJournalList({}),
    loadAdminJobList({}, user.roles, { limit: 10, offset: 0 }),
  ]);

  const [
    systemHealthResult,
    leadQueueResult,
    consultationResult,
    trainingResult,
    overdueResult,
    routingResult,
    anonymousResult,
    themesResult,
    journalResult,
    jobsResult,
  ] = results;

  const systemHealth = systemHealthResult.status === "fulfilled" ? systemHealthResult.value : null;
  const leadQueue = leadQueueResult.status === "fulfilled" ? leadQueueResult.value : null;
  const consultationQueue = consultationResult.status === "fulfilled" ? consultationResult.value : null;
  const trainingPaths = trainingResult.status === "fulfilled" ? trainingResult.value : null;
  const overdueFollowUps = overdueResult.status === "fulfilled" ? overdueResult.value : null;
  const routingReview = routingResult.status === "fulfilled" ? routingResult.value : null;
  const anonymousOpps = anonymousResult.status === "fulfilled" ? anonymousResult.value : null;
  const painThemes = themesResult.status === "fulfilled" ? themesResult.value : null;
  const journalWorkspace = journalResult.status === "fulfilled" ? journalResult.value : null;
  const jobQueue = jobsResult.status === "fulfilled" ? jobsResult.value : null;

  const pipelineAttentionCount = (leadQueue?.data.summary.newLeadCount ?? 0)
    + (consultationQueue?.data.summary.pendingCount ?? 0)
    + (trainingPaths?.data.summary.followUpNowCount ?? 0)
    + (overdueFollowUps?.data.summary.totalOverdueCount ?? 0);
  const conversationAttentionCount = (routingReview?.data.summary.uncertainCount ?? 0)
    + (anonymousOpps?.data.opportunities.length ?? 0)
    + (painThemes?.data.themes.length ?? 0);
  const contentInProgressCount = journalWorkspace
    ? (journalWorkspace.counts.draft ?? 0) + (journalWorkspace.counts.review ?? 0)
    : 0;
  const activeJobCount = jobQueue
    ? (jobQueue.statusCounts.queued ?? 0) + (jobQueue.statusCounts.running ?? 0)
    : 0;
  const failedJobCount = jobQueue?.statusCounts.failed ?? 0;
  const totalAttentionCount = pipelineAttentionCount
    + conversationAttentionCount
    + contentInProgressCount
    + activeJobCount
    + failedJobCount
    + (systemHealth && systemHealth.data.summary.overallStatus !== "ok" ? 1 : 0);

  const sectionCounts: Partial<Record<AdminDashboardSectionId, number | string>> = {
    overview: totalAttentionCount,
    "system-health": systemHealth?.data.summary.overallStatus === "ok" ? "Stable" : "Review",
    pipeline: pipelineAttentionCount,
    conversations: conversationAttentionCount,
    content: journalWorkspace?.counts.all ?? 0,
    jobs: jobQueue?.total ?? 0,
  };

  return (
    <section
      className="shell-governance-grid grid w-full max-w-none gap-0 px-0 py-0"
      data-admin-dashboard="true"
      data-admin-system-workspace="true"
      aria-label="System"
    >
      <aside
        className="grid content-start gap-(--space-4) border-b border-border/60 bg-background/35 px-(--space-frame-default) py-(--space-4) lg:border-b-0 lg:border-r lg:py-(--space-section-loose)"
        aria-label="System sections"
        data-admin-system-selection-column="true"
      >
        <header className="grid gap-(--space-2)">
          <p className="theme-label tier-micro uppercase text-foreground/42">System</p>
          <p className="max-w-[18rem] text-xs leading-5 text-foreground/52">
            Select a governance section. The main pane shows the linked page content and keeps the full route one click away.
          </p>
        </header>

        <nav className="grid gap-(--space-2)" aria-label="System section list">
          {ADMIN_DASHBOARD_SECTIONS.map((section) => {
            const active = section.id === activeSectionId;
            const count = sectionCounts[section.id];

            return (
              <Link
                key={section.id}
                href={section.href}
                aria-current={active ? "page" : undefined}
                className={`focus-ring relative grid min-h-16 gap-[0.15rem] rounded-lg border p-(--space-3) transition ${
                  active
                    ? "border-[color-mix(in_oklab,var(--accent)_42%,transparent)] bg-[color-mix(in_oklab,var(--accent)_8%,var(--background))]"
                    : "border-transparent hover:border-border/70 hover:bg-foreground/[0.035]"
                }`}
                data-admin-system-section={section.id}
              >
                {active ? (
                  <span className="absolute left-0 top-(--space-3) h-[calc(100%-1.5rem)] w-[2px] rounded-full bg-accent" aria-hidden="true" />
                ) : null}
                <span className="flex items-center justify-between gap-(--space-3) pl-(--space-2)">
                  <span className="text-sm font-semibold text-foreground/82">{section.shortLabel}</span>
                  {count !== undefined ? (
                    <span className="text-xs text-foreground/46" aria-hidden="true">{count}</span>
                  ) : null}
                </span>
                <span className="line-clamp-2 pl-(--space-2) text-xs leading-5 text-foreground/48">
                  {section.description}
                </span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <div
        className="grid min-w-0 content-start gap-(--space-5) px-(--space-frame-default) py-(--space-section-loose) sm:py-(--space-frame-wide)"
        data-admin-system-main-column="true"
      >
        <header className="grid gap-(--space-3)">
          <p className="text-[0.68rem] font-semibold uppercase text-foreground/46">Admin platform</p>
          <h1 className="text-[1.75rem] font-semibold leading-tight text-foreground sm:text-[2.25rem]">
            {activeSection.label}
          </h1>
          <p className="max-w-3xl text-sm leading-6 text-foreground/66">
            {activeSection.description}
          </p>
          {activeSection.targetHref !== "/admin" ? (
            <SectionLink href={activeSection.targetHref}>{activeSection.targetLabel}</SectionLink>
          ) : null}
        </header>

        {activeSectionId === "overview" ? (
          <>
            <dl className="grid gap-(--space-2) sm:grid-cols-3">
              <SectionMetric label="Needs review" value={totalAttentionCount} status={totalAttentionCount > 0 ? "warning" : "ok"} />
              <SectionMetric label="Active jobs" value={activeJobCount} status={activeJobCount > 0 ? "warning" : "ok"} />
              <SectionMetric label="Content items" value={journalWorkspace?.counts.all ?? 0} />
            </dl>
            <div className="admin-route-stack px-0 lg:grid-cols-2" data-admin-system-overview-grid="true">
              {systemHealth ? (
                <AdminCard
                  title="System health"
                  description={systemHealth.data.warnings.length === 0 ? "All clear." : systemHealth.data.warnings[0]}
                  status={systemHealth.data.summary.overallStatus === "ok" ? "ok" : "warning"}
                >
                  <p className="text-3xl font-semibold tracking-tight text-foreground">
                    {systemHealth.data.summary.overallStatus === "ok" ? "Healthy" : "Needs review"}
                  </p>
                  <SectionLink href="/admin?section=system-health">Review section</SectionLink>
                </AdminCard>
              ) : unavailableCard("System health")}

              {leadQueue && consultationQueue && trainingPaths && overdueFollowUps ? (
                <AdminCard
                  title="Pipeline attention"
                  description={pipelineAttentionCount === 0
                    ? "No active pipeline follow-ups."
                    : `${pipelineAttentionCount} items need review across leads, consultations, training, and overdue follow-ups.`}
                  status={pipelineAttentionCount > 0 ? "warning" : "ok"}
                >
                  <p className="text-3xl font-semibold tracking-tight text-foreground">{pipelineAttentionCount}</p>
                  <SectionLink href="/admin?section=pipeline">Review section</SectionLink>
                </AdminCard>
              ) : unavailableCard("Pipeline attention")}

              {routingReview && anonymousOpps && painThemes ? (
                <AdminCard
                  title="Conversation attention"
                  description={conversationAttentionCount === 0
                    ? "No conversations need review."
                    : `${conversationAttentionCount} conversation signals need a closer look across routing, anonymous opportunities, and recurring pain themes.`}
                  status={conversationAttentionCount > 0 ? "warning" : "ok"}
                >
                  <p className="text-3xl font-semibold tracking-tight text-foreground">{conversationAttentionCount}</p>
                  <SectionLink href="/admin?section=conversations">Review section</SectionLink>
                </AdminCard>
              ) : unavailableCard("Conversation attention")}

              {journalWorkspace ? (
                <AdminCard
                  title="Content operations"
                  description={journalWorkspace.counts.all === 0
                    ? "No journal posts yet."
                    : contentInProgressCount > 0
                      ? `${contentInProgressCount} journal posts are still in draft or review.`
                      : "All journal posts are either approved or published."}
                  status={journalWorkspace.counts.review > 0 ? "warning" : journalWorkspace.counts.all > 0 ? "ok" : "neutral"}
                >
                  <p className="text-3xl font-semibold tracking-tight text-foreground">{journalWorkspace.counts.all}</p>
                  <SectionLink href="/admin?section=content">Review section</SectionLink>
                </AdminCard>
              ) : unavailableCard("Content operations")}

              {jobQueue ? (
                <AdminCard
                  title="Jobs health"
                  description={jobQueue.total === 0
                    ? "No global deferred jobs are queued right now."
                    : failedJobCount > 0
                      ? `${failedJobCount} jobs failed and need operator review.`
                      : `${activeJobCount} jobs are currently queued or running.`}
                  status={failedJobCount > 0 ? "warning" : jobQueue.total > 0 ? "ok" : "neutral"}
                >
                  <p className="text-3xl font-semibold tracking-tight text-foreground">{jobQueue.total}</p>
                  <SectionLink href="/admin?section=jobs">Review section</SectionLink>
                </AdminCard>
              ) : unavailableCard("Jobs health")}
            </div>
          </>
        ) : null}

        {activeSectionId === "system-health" && systemHealth ? (
          <section className="admin-panel-surface grid gap-(--space-4) p-(--space-inset-panel)" data-admin-system-section-panel="system-health">
            <dl className="grid gap-(--space-2) sm:grid-cols-3">
              <SectionMetric label="Overall" value={systemHealth.data.summary.overallStatus === "ok" ? "Healthy" : "Needs review"} status={systemHealth.data.summary.overallStatus === "ok" ? "ok" : "warning"} />
              <SectionMetric label="Readiness" value={systemHealth.data.summary.readinessStatus} />
              <SectionMetric label="Liveness" value={systemHealth.data.summary.livenessStatus} />
            </dl>
            <div className="grid gap-(--space-3)">
              <h2 className="text-xl font-semibold tracking-tight text-foreground">Health signals</h2>
              <dl className="admin-system-list text-sm text-foreground/62">
                <div className="admin-system-row"><dt>Environment</dt><dd>{systemHealth.data.summary.environmentStatus}</dd></div>
                <div className="admin-system-row"><dt>Public origin</dt><dd className="admin-mono-value text-xs">{systemHealth.data.referral.publicOrigin}</dd></div>
                <div className="admin-system-row"><dt>Referral prompt check</dt><dd>{systemHealth.data.referral.knownReferrerPromptVerified ? "verified" : "needs review"}</dd></div>
              </dl>
              {systemHealth.data.warnings.length > 0 ? (
                <ul className="grid gap-(--space-2) text-sm text-foreground/58">
                  {systemHealth.data.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-foreground/56">No active system warnings.</p>
              )}
              <SectionLink href="/admin/system">Open full system page</SectionLink>
            </div>
          </section>
        ) : activeSectionId === "system-health" ? unavailablePanel("System health") : null}

        {activeSectionId === "pipeline" && leadQueue && consultationQueue && trainingPaths && overdueFollowUps ? (
          <section className="admin-panel-surface grid gap-(--space-4) p-(--space-inset-panel)" data-admin-system-section-panel="pipeline">
            <dl className="grid gap-(--space-2) sm:grid-cols-4">
              <SectionMetric label="New leads" value={leadQueue.data.summary.newLeadCount} status={leadQueue.data.summary.newLeadCount > 0 ? "warning" : "ok"} />
              <SectionMetric label="Consultations" value={consultationQueue.data.summary.pendingCount} status={consultationQueue.data.summary.pendingCount > 0 ? "warning" : "ok"} />
              <SectionMetric label="Training" value={trainingPaths.data.summary.followUpNowCount} status={trainingPaths.data.summary.followUpNowCount > 0 ? "warning" : "ok"} />
              <SectionMetric label="Overdue" value={overdueFollowUps.data.summary.totalOverdueCount} status={overdueFollowUps.data.summary.totalOverdueCount > 0 ? "warning" : "ok"} />
            </dl>
            <p className="max-w-2xl text-sm leading-6 text-foreground/62">
              Pipeline content is summarized here from the same lead, consultation, training, and follow-up loaders used by the linked page.
            </p>
            <SectionLink href={getAdminLeadsListPath()}>Open pipeline page</SectionLink>
          </section>
        ) : activeSectionId === "pipeline" ? unavailablePanel("Pipeline attention") : null}

        {activeSectionId === "conversations" && routingReview && anonymousOpps && painThemes ? (
          <section className="admin-panel-surface grid gap-(--space-4) p-(--space-inset-panel)" data-admin-system-section-panel="conversations">
            <dl className="grid gap-(--space-2) sm:grid-cols-3">
              <SectionMetric label="Routing review" value={routingReview.data.summary.uncertainCount} status={routingReview.data.summary.uncertainCount > 0 ? "warning" : "ok"} />
              <SectionMetric label="Opportunities" value={anonymousOpps.data.opportunities.length} status={anonymousOpps.data.opportunities.length > 0 ? "warning" : "ok"} />
              <SectionMetric label="Pain themes" value={painThemes.data.themes.length} status={painThemes.data.themes.length > 0 ? "warning" : "ok"} />
            </dl>
            <p className="max-w-2xl text-sm leading-6 text-foreground/62">
              Conversation diagnostics stay inside System/Admin. Owner-facing relationship work is projected into People and Today.
            </p>
            <SectionLink href="/admin/conversations">Open conversations page</SectionLink>
          </section>
        ) : activeSectionId === "conversations" ? unavailablePanel("Conversation attention") : null}

        {activeSectionId === "content" && journalWorkspace ? (
          <section className="admin-panel-surface grid gap-(--space-4) p-(--space-inset-panel)" data-admin-system-section-panel="content">
            <dl className="grid gap-(--space-2) sm:grid-cols-4">
              <SectionMetric label="All" value={journalWorkspace.counts.all} />
              <SectionMetric label="Draft" value={journalWorkspace.counts.draft} />
              <SectionMetric label="In review" value={journalWorkspace.counts.review} status={journalWorkspace.counts.review > 0 ? "warning" : "ok"} />
              <SectionMetric label="Published" value={journalWorkspace.counts.published} />
            </dl>
            <p className="max-w-2xl text-sm leading-6 text-foreground/62">
              Content operations exposes editorial inventory and attribution without turning the owner Studio into a raw journal admin page.
            </p>
            <div className="flex flex-wrap gap-(--space-2)">
              <SectionLink href={getAdminJournalListPath()}>Open content page</SectionLink>
              <SectionLink href={getAdminJournalAttributionPath()}>Open attribution page</SectionLink>
            </div>
          </section>
        ) : activeSectionId === "content" ? unavailablePanel("Content operations") : null}

        {activeSectionId === "jobs" && jobQueue ? (
          <section className="admin-panel-surface grid gap-(--space-4) p-(--space-inset-panel)" data-admin-system-section-panel="jobs">
            <dl className="grid gap-(--space-2) sm:grid-cols-4">
              <SectionMetric label="Total" value={jobQueue.total} />
              <SectionMetric label="Queued" value={jobQueue.statusCounts.queued ?? 0} status={(jobQueue.statusCounts.queued ?? 0) > 0 ? "warning" : "ok"} />
              <SectionMetric label="Running" value={jobQueue.statusCounts.running ?? 0} status={(jobQueue.statusCounts.running ?? 0) > 0 ? "warning" : "ok"} />
              <SectionMetric label="Failed" value={failedJobCount} status={failedJobCount > 0 ? "warning" : "ok"} />
            </dl>
            <p className="max-w-2xl text-sm leading-6 text-foreground/62">
              Jobs remain an admin diagnostic surface. Regular owner pages see governed work, decisions, and outputs instead of raw queue management.
            </p>
            <div className="flex flex-wrap gap-(--space-2)">
              <SectionLink href={getAdminJobsListPath()}>Open jobs page</SectionLink>
              <SectionLink href={`${getAdminJobsListPath()}?status=failed`}>Review failed jobs</SectionLink>
            </div>
          </section>
        ) : activeSectionId === "jobs" ? unavailablePanel("Jobs health") : null}
      </div>
    </section>
  );
}
