import Link from "next/link";

import {
  GovernanceSectionFrame,
  SectionBriefPanel,
  type GovernanceSectionModel,
  type GovernanceSelectorItem,
} from "@/components/governance/GovernanceSectionFrame";
import {
  buildAboutHref,
  type AboutStorySection,
  type AboutWorkspaceData,
  type PublicAboutPageData,
} from "@/lib/about/load-about-workspace";

function StatusBadge({ children }: { children: string }) {
  return (
    <span className="rounded-full border border-foreground/10 px-(--space-2) py-[0.14rem] text-[0.7rem] font-semibold text-foreground/58">
      {children}
    </span>
  );
}

export function PublicAboutSurface({ data }: { data: PublicAboutPageData }) {
  return (
    <main className="shell-page editorial-page-shell" data-public-about-surface="true">
      <div className="site-container px-(--container-padding) py-[clamp(3rem,8vw,6rem)]">
        <section className="mb-[clamp(3rem,8vw,5rem)] max-w-3xl">
          <p className="shell-section-heading mb-4 opacity-60">About {data.identityName}</p>
          <h1 className="journal-intro-title mb-6">
            Run your business like you have a team.
          </h1>
          <p className="journal-intro-dek mb-3">
            {data.identityName} is an AI operating system for solo operators who need help turning intent into governed work, offers, content, and follow-up.
          </p>
          <p className="journal-intro-dek">
            Chat is the operating interface. The public site explains the business, and the signed-in workspace keeps the work accountable.
          </p>
        </section>

        <hr className="mb-[clamp(3rem,8vw,5rem)] border-t border-color-theme" />

        <section className="mb-[clamp(3rem,8vw,5rem)]">
          <h2 className="shell-panel-heading mb-8">What this Ordo helps with</h2>
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {data.publicSections.slice(0, 3).map((section) => (
              <article key={section.id} className="about-feature-card">
                <p className="about-feature-title">{section.title}</p>
                <p className="about-feature-body">{section.summary}</p>
              </article>
            ))}
          </div>
        </section>

        <hr className="mb-[clamp(3rem,8vw,5rem)] border-t border-color-theme" />

        <section className="mb-[clamp(3rem,8vw,5rem)] max-w-2xl">
          <h2 className="shell-panel-heading mb-6">How it works</h2>
          <div className="space-y-6">
            <div className="about-step">
              <span className="about-step-number">01</span>
              <div>
                <p className="about-step-title">Start in conversation</p>
                <p className="about-step-body">Tell Ordo what you want to create, decide, sell, publish, or follow up on.</p>
              </div>
            </div>
            <div className="about-step">
              <span className="about-step-number">02</span>
              <div>
                <p className="about-step-title">Turn intent into governed work</p>
                <p className="about-step-body">Ordo keeps work inspectable so the owner can see what changed, what is public, and what needs review.</p>
              </div>
            </div>
            <div className="about-step">
              <span className="about-step-number">03</span>
              <div>
                <p className="about-step-title">Connect work to business motion</p>
                <p className="about-step-body">Offers, people, content, links, and results stay connected so the owner knows what to do next.</p>
              </div>
            </div>
          </div>
        </section>

        <hr className="mb-[clamp(3rem,8vw,5rem)] border-t border-color-theme" />

        <section className="mb-[clamp(3rem,8vw,5rem)] max-w-2xl">
          <h2 className="shell-panel-heading mb-4">Built for ownership</h2>
          <p className="journal-intro-dek mb-6">
            Studio Ordo is open source and designed to run on infrastructure the owner controls. The system should give a solo operator leverage without taking away agency.
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href="https://github.com/studioordo"
              target="_blank"
              rel="noopener noreferrer"
              className="shell-nav-guest-link shell-nav-guest-link-primary px-5"
            >
              View on GitHub
            </a>
            <a
              href="https://www.youtube.com/@studioordo"
              target="_blank"
              rel="noopener noreferrer"
              className="shell-nav-guest-link shell-nav-guest-link-secondary px-5"
            >
              Watch on YouTube
            </a>
          </div>
        </section>

        <hr className="mb-[clamp(3rem,8vw,5rem)] border-t border-color-theme" />

        <section className="max-w-xl">
          <h2 className="shell-panel-heading mb-3">Ready to work with Ordo?</h2>
          <p className="journal-intro-dek mb-6">
            Start with one concrete outcome. Ordo can explain the offers, answer questions, or help decide the next useful step.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/register"
              className="shell-nav-guest-link shell-nav-guest-link-primary px-5"
            >
              Get started
            </Link>
            <Link
              href="/offers"
              className="shell-nav-guest-link shell-nav-guest-link-secondary px-5"
            >
              View offers
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

function AboutSelectorOverview({ workspace }: { workspace: AboutWorkspaceData }) {
  return (
    <div className="rounded-lg border border-foreground/10 bg-background/74 p-(--space-3)" data-about-selector-overview="true">
      <p className="text-sm font-semibold text-foreground">Story Brief</p>
      <p className="mt-(--space-1) text-xs leading-5 text-foreground/52">
        {workspace.summary.published} published · {workspace.summary.needsEvidence} needs evidence · {workspace.summary.needsDraft} needs draft
      </p>
    </div>
  );
}

function aboutSelectorItems(workspace: AboutWorkspaceData): GovernanceSelectorItem[] {
  return workspace.filteredSections.map((section) => ({
    id: section.id,
    href: buildAboutHref(workspace.query, { sectionId: section.id }),
    title: section.title,
    summary: section.summary,
    meta: section.visibilityLabel,
    iconLabel: section.title.slice(0, 1),
    statusLabel: section.statusLabel,
    selected: workspace.selectedSection?.id === section.id,
    dataAttributes: {
      "data-about-section-status": section.statusLabel,
      "data-about-section-visibility": section.visibilityLabel,
    },
  }));
}

function AboutBrief({ workspace, userName }: { workspace: AboutWorkspaceData; userName: string }) {
  return (
    <div className="grid max-w-5xl gap-(--space-5)" data-about-brief="true">
      <SectionBriefPanel brief={workspace.brief} />
      <section className="rounded-lg border border-foreground/10 bg-background/82 p-(--space-inset-default)">
        <p className="theme-label tier-micro uppercase text-foreground/42">Story governance</p>
        <h2 className="mt-(--space-1) text-lg font-semibold text-foreground">Keep the public story honest</h2>
        <p className="mt-(--space-1) max-w-3xl text-sm leading-6 text-foreground/58">
          {userName} can ask Ordo to revise the public story in chat. This surface keeps each story section, source, visibility, and missing evidence inspectable before copy changes.
        </p>
        <div className="mt-(--space-3) flex flex-wrap gap-(--space-2)">
          <Link href={workspace.brief.recommendedAction?.href ?? "/"} className="btn-primary">
            Ask Ordo to review
          </Link>
          <Link
            href={workspace.publicHref}
            className="focus-ring rounded-full border border-foreground/12 px-(--space-3) py-(--space-2) text-sm font-semibold text-foreground/62"
          >
            Open public About
          </Link>
        </div>
      </section>
    </div>
  );
}

function AboutSectionDetail({ section }: { section: AboutStorySection }) {
  const isMissing = section.currentCopy.length === 0;

  return (
    <article className="grid max-w-5xl gap-(--space-5)" data-about-section-detail={section.id}>
      <header className="max-w-4xl">
        <p className="theme-label tier-micro uppercase text-foreground/42">Selected story section</p>
        <div className="mt-(--space-2) flex flex-wrap items-center gap-(--space-2)">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {section.title}
          </h1>
          <StatusBadge>{section.statusLabel}</StatusBadge>
          <StatusBadge>{section.visibilityLabel}</StatusBadge>
        </div>
        <p className="mt-(--space-2) max-w-3xl text-sm leading-6 text-foreground/62 sm:text-base">
          {section.summary}
        </p>
      </header>

      <section className="rounded-lg border border-foreground/10 bg-background/82 p-(--space-inset-default)" aria-labelledby={`about-copy-${section.id}`}>
        <p className="theme-label tier-micro uppercase text-foreground/42">Current copy</p>
        <h2 id={`about-copy-${section.id}`} className="mt-(--space-1) text-xl font-semibold tracking-tight text-foreground">
          Public story copy
        </h2>
        {isMissing ? (
          <p className="mt-(--space-3) text-sm leading-6 text-foreground/62">
            No public copy is published for this section yet. Keep this in owner review until Ordo can tie the claim to evidence.
          </p>
        ) : (
          <div className="mt-(--space-3) grid gap-(--space-3) text-sm leading-6 text-foreground/66">
            {section.currentCopy.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-(--space-5) xl:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)] xl:items-start">
        <section className="rounded-lg border border-foreground/10 bg-background/82 p-(--space-inset-default)" aria-labelledby={`about-sources-${section.id}`}>
          <p className="theme-label tier-micro uppercase text-foreground/42">Sources</p>
          <h2 id={`about-sources-${section.id}`} className="mt-(--space-1) text-lg font-semibold text-foreground">
            Story sources
          </h2>
          {section.sourceRefs.length > 0 ? (
            <ul className="mt-(--space-3) grid gap-(--space-2)">
              {section.sourceRefs.map((sourceRef) => (
                <li key={`${sourceRef.kind}:${sourceRef.id}`} className="text-sm text-foreground/66">
                  {sourceRef.href ? (
                    <Link href={sourceRef.href} className="underline decoration-foreground/20 underline-offset-4 hover:text-foreground">
                      {sourceRef.label}
                    </Link>
                  ) : (
                    sourceRef.label
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-(--space-3) text-sm leading-6 text-foreground/58">
              No source has been selected yet.
            </p>
          )}
        </section>

        <aside className="rounded-lg border border-foreground/10 bg-background/82 p-(--space-inset-default)" aria-labelledby={`about-actions-${section.id}`}>
          <p className="theme-label tier-micro uppercase text-foreground/42">Actions</p>
          <h2 id={`about-actions-${section.id}`} className="mt-(--space-1) text-lg font-semibold text-foreground">
            Next safe action
          </h2>
          <p className="mt-(--space-2) text-sm leading-6 text-foreground/58">
            Changes should start in chat so Ordo can preserve the intent, source, and visibility decision.
          </p>
          <Link href={section.nextActionHref} className="btn-primary mt-(--space-3) w-full justify-center">
            {section.nextActionLabel}
          </Link>
        </aside>
      </div>
    </article>
  );
}

export function OwnerAboutWorkspace({
  userName,
  workspace,
}: {
  userName: string;
  workspace: AboutWorkspaceData;
}) {
  const model: GovernanceSectionModel<AboutStorySection, AboutWorkspaceData["summary"]> = {
    sectionId: "about",
    sectionTitle: "About",
    brief: workspace.brief,
    summary: workspace.summary,
    objects: workspace.filteredSections,
    selectedObject: workspace.selectedSection,
    permissions: {
      canView: true,
      canSelect: true,
      canFilter: true,
      canMutate: false,
      canViewDiagnostics: false,
    },
  };
  const detailRequested = Boolean(workspace.query.sectionId);

  return (
    <GovernanceSectionFrame
      model={model}
      detailRequested={detailRequested}
      listHref={buildAboutHref(workspace.query, { sectionId: null })}
      mobileBackLabel="Back to About"
      rootDataAttributes={{
        "data-about-workspace": true,
      }}
      selector={{
        ariaLabel: "About story selection",
        title: "About",
        guidance: "Select public story sections. Chat revises the story; this column keeps the current copy inspectable.",
        overview: <AboutSelectorOverview workspace={workspace} />,
        search: {
          action: "/about",
          label: "Search About story",
          placeholder: "Search About...",
          defaultValue: workspace.query.q,
        },
        items: aboutSelectorItems(workspace),
        emptyTitle: "No story sections match this view.",
        emptySummary: "Clear the search or ask Ordo which public story section should exist.",
        footer: (
          <p data-about-footer-count="true">
            Showing {workspace.filteredSections.length} of {workspace.summary.total} story sections.
          </p>
        ),
        dataAttributes: {
          "data-about-selector": true,
        },
      }}
      main={{
        ariaLabel: detailRequested ? "Selected About story section" : "About business story brief",
        renderBrief: () => <AboutBrief workspace={workspace} userName={userName} />,
        renderDetail: (section) => <AboutSectionDetail section={section} />,
        missingDetail: {
          title: "Story section was not found.",
          summary: "Return to the About brief or ask Ordo whether this section belongs in the public story.",
        },
        dataAttributes: {
          "data-about-main-column": true,
        },
      }}
    />
  );
}
