import Link from "next/link";

import {
  GovernanceSectionFrame,
  SectionBriefPanel,
  type GovernanceFilterControl,
  type GovernanceSelectorItem,
} from "@/components/governance/GovernanceSectionFrame";
import type {
  KnowledgeBaseObject,
  KnowledgeBaseWorkspace as KnowledgeBaseWorkspaceModel,
} from "@/lib/knowledge/load-knowledge-base-workspace";

export interface KnowledgeBaseWorkspaceProps {
  userName: string;
  workspace: KnowledgeBaseWorkspaceModel;
}

function audienceLabel(value: string): string {
  return value
    .split("_")
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function selectorItems(workspace: KnowledgeBaseWorkspaceModel): GovernanceSelectorItem[] {
  return workspace.objects.map((object) => ({
    id: object.id,
    href: object.href,
    title: object.title,
    summary: object.type === "document" ? object.summary : object.documentTitle,
    meta: object.type === "document" ? object.sourceLabel : `${object.documentId} · ${object.sourceLabel}`,
    iconLabel: object.type === "document" ? "D" : "S",
    statusLabel: audienceLabel(object.audience),
    selected: workspace.selectedObject?.id === object.id,
    countLabel: object.type === "document" ? `${object.detail.sectionCount}` : undefined,
    diagnosticLabel: workspace.permissions.canViewDiagnostics ? object.id : undefined,
    dataAttributes: {
      "data-knowledge-object-type": object.type,
      "data-knowledge-audience": object.audience,
    },
  }));
}

function audienceFilter(workspace: KnowledgeBaseWorkspaceModel): GovernanceFilterControl {
  return {
    id: "knowledge-audience-filter",
    label: "Visibility",
    name: "audience",
    value: workspace.query.audience,
    options: [
      { label: "All visible", value: null },
      ...workspace.summary.visibleAudiences.map((audience) => ({
        label: audienceLabel(audience),
        value: audience,
      })),
    ],
  };
}

function KnowledgeOverview({ workspace }: { workspace: KnowledgeBaseWorkspaceModel }) {
  return (
    <section className="grid gap-(--space-2) rounded-lg border border-foreground/10 bg-background/72 p-(--space-3)" data-knowledge-overview="true">
      <p className="text-sm font-semibold text-foreground">Overview</p>
      <div className="grid grid-cols-2 gap-(--space-2) text-xs text-foreground/56">
        <span>{workspace.summary.totalDocuments} documents</span>
        <span>{workspace.summary.totalSections} sections</span>
      </div>
      <p className="text-xs leading-5 text-foreground/46">
        Role-filtered before render. Chat remains the operating interface.
      </p>
    </section>
  );
}

function DetailMeta({ object }: { object: KnowledgeBaseObject }) {
  const fields = [
    { label: "Type", value: object.type === "document" ? "Document" : "Section" },
    { label: "Visibility", value: audienceLabel(object.audience) },
    { label: "Source", value: object.sourceLabel },
    { label: "Document", value: `${object.documentId} ${object.documentTitle}`.trim() },
  ];

  return (
    <dl className="grid gap-(--space-3) border-y border-foreground/10 py-(--space-4) sm:grid-cols-4">
      {fields.map((field) => (
        <div key={field.label} className="grid gap-(--space-1)">
          <dt className="theme-label tier-micro uppercase text-foreground/42">{field.label}</dt>
          <dd className="text-sm leading-6 text-foreground/72">{field.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function KnowledgeObjectDetail({ object }: { object: KnowledgeBaseObject }) {
  return (
    <article className="grid max-w-5xl gap-(--space-5)" data-knowledge-detail={object.id}>
      <header className="grid gap-(--space-2)">
        <p className="theme-label tier-micro uppercase text-foreground/42">
          {object.type === "document" ? "Knowledge document" : "Knowledge section"}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {object.title}
        </h1>
        <p className="max-w-3xl text-sm leading-6 text-foreground/60">
          {object.type === "document"
            ? "Inspect the sections available to this role, then ask Ordo to use the source when you need operating guidance."
            : "This section is inspectable source evidence for chat-grounded answers."}
        </p>
      </header>

      <DetailMeta object={object} />

      <section className="rounded-lg border border-foreground/10 bg-background/82 p-(--space-inset-panel)" data-knowledge-source-preview="true">
        <div className="flex items-start justify-between gap-(--space-4)">
          <div>
            <p className="theme-label tier-micro uppercase text-foreground/42">Source preview</p>
            <h2 className="mt-(--space-1) text-xl font-semibold text-foreground">
              {object.type === "document" ? "Accessible sections" : "Section excerpt"}
            </h2>
          </div>
          <Link href={`/?prompt=${encodeURIComponent(`Use ${object.title} as source context.`)}`} className="btn-secondary shrink-0">
            Ask Ordo
          </Link>
        </div>

        {object.detail.contentPreview ? (
          <p className="mt-(--space-4) whitespace-pre-line text-sm leading-7 text-foreground/68">
            {object.detail.contentPreview}
          </p>
        ) : (
          <p className="mt-(--space-4) text-sm leading-6 text-foreground/56">
            No readable section body is available for this document yet.
          </p>
        )}

        {object.detail.headings.length > 0 ? (
          <div className="mt-(--space-4) rounded-lg border border-foreground/10 bg-foreground/[0.025] p-(--space-3)">
            <p className="theme-label tier-micro uppercase text-foreground/42">Headings</p>
            <ul className="mt-(--space-2) grid gap-(--space-1) text-sm text-foreground/62">
              {object.detail.headings.slice(0, 8).map((heading) => (
                <li key={heading}>{heading}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {object.detail.relatedSections.length > 0 ? (
        <section className="rounded-lg border border-foreground/10 bg-background/82 p-(--space-inset-panel)" data-knowledge-related="true">
          <p className="theme-label tier-micro uppercase text-foreground/42">Related source links</p>
          <div className="mt-(--space-3) grid gap-(--space-2)">
            {object.detail.relatedSections.map((section) => (
              <Link key={section.href} href={section.href} className="focus-ring rounded-lg border border-foreground/10 px-(--space-3) py-(--space-2) text-sm font-semibold text-foreground/68 hover:border-foreground/18">
                {section.title}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {object.detail.adminLinks.length > 0 ? (
        <section className="rounded-lg border border-foreground/10 bg-background/82 p-(--space-inset-panel)" data-knowledge-admin-links="true">
          <p className="theme-label tier-micro uppercase text-foreground/42">Admin controls</p>
          <div className="mt-(--space-3) flex flex-wrap gap-(--space-2)">
            {object.detail.adminLinks.map((link) => (
              <Link key={link.href} href={link.href} className="btn-secondary">
                {link.label}
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </article>
  );
}

export function KnowledgeBaseWorkspace({ userName, workspace }: KnowledgeBaseWorkspaceProps) {
  const detailRequested = Boolean(workspace.query.document);

  return (
    <GovernanceSectionFrame
      model={workspace}
      detailRequested={detailRequested}
      listHref={workspace.listHref}
      mobileBackLabel="Back to Knowledge Base"
      selector={{
        ariaLabel: "Knowledge Base selector",
        title: "Knowledge Base",
        guidance: `${userName} can inspect governed source material here. Ask Ordo in chat when you need the work applied.`,
        overview: <KnowledgeOverview workspace={workspace} />,
        search: {
          action: "/knowledge",
          label: "Search Knowledge Base",
          placeholder: "Search knowledge...",
          defaultValue: workspace.query.q,
          hiddenFields: [{ name: "audience", value: workspace.query.audience }],
        },
        filters: {
          label: "Open Knowledge Base filters",
          action: "/knowledge",
          clearHref: "/knowledge",
          hiddenFields: [{ name: "q", value: workspace.query.q }],
          controls: [audienceFilter(workspace)],
        },
        items: selectorItems(workspace),
        emptyTitle: "No knowledge sources match",
        emptySummary: "Try a broader search or clear the visibility filter.",
        footer: (
          <p>
            Showing {workspace.objects.length} of {workspace.summary.filteredObjects} visible knowledge items.
          </p>
        ),
        dataAttributes: { "data-knowledge-selector": "true" },
      }}
      main={{
        ariaLabel: "Knowledge Base detail",
        renderBrief: (model) => <SectionBriefPanel brief={model.brief} />,
        renderDetail: (object) => <KnowledgeObjectDetail object={object} />,
        missingDetail: {
          title: "Knowledge source was not found.",
          summary: "It may be hidden by visibility rules, missing from the local source index, or filtered out by search.",
        },
        dataAttributes: { "data-knowledge-main": "true" },
      }}
      rootDataAttributes={{ "data-knowledge-base": "true" }}
    />
  );
}
