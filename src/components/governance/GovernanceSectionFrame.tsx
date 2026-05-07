import Link from "next/link";
import type { ReactNode } from "react";
import type { SectionBrief } from "@/core/entities/brief";

export type { SectionBrief } from "@/core/entities/brief";

export interface SectionPermissions {
  canView: boolean;
  canSelect?: boolean;
  canFilter?: boolean;
  canMutate?: boolean;
  canViewDiagnostics?: boolean;
}

export interface GovernanceSectionModel<TObject, TSummary> {
  sectionId: string;
  sectionTitle: string;
  brief: SectionBrief | null;
  summary: TSummary;
  objects: TObject[];
  selectedObject: TObject | null;
  permissions: SectionPermissions;
}

export interface GovernanceHiddenField {
  name: string;
  value: string | number | boolean | null | undefined;
}

export interface GovernanceFilterControl {
  id: string;
  label: string;
  name: string;
  value: string | null | undefined;
  options: Array<{
    label: string;
    value: string | null;
  }>;
}

export interface GovernanceSelectorItem {
  id: string;
  href: string;
  title: string;
  summary?: string;
  meta?: string;
  iconLabel?: string;
  statusLabel?: string;
  selected?: boolean;
  countLabel?: string;
  diagnosticLabel?: string;
  onSelect?: () => void;
  dataAttributes?: Record<`data-${string}`, string | boolean | undefined>;
}

export interface GovernanceSectionFrameProps<TObject, TSummary> {
  model: GovernanceSectionModel<TObject, TSummary>;
  detailRequested: boolean;
  listHref: string;
  mobileBackLabel: string;
  onMobileBack?: () => void;
  selector: {
    ariaLabel: string;
    title?: string;
    guidance?: string;
    overview?: ReactNode;
    search?: {
      action: string;
      label: string;
      placeholder: string;
      defaultValue?: string | null;
      hiddenFields?: GovernanceHiddenField[];
    };
    filters?: {
      label: string;
      action: string;
      clearHref: string;
      hiddenFields?: GovernanceHiddenField[];
      controls: GovernanceFilterControl[];
    };
    items: GovernanceSelectorItem[];
    emptyTitle: string;
    emptySummary: string;
    footer: ReactNode;
    pagination?: ReactNode;
    dataAttributes?: Record<`data-${string}`, string | boolean | undefined>;
  };
  main: {
    ariaLabel: string;
    renderBrief?: (model: GovernanceSectionModel<TObject, TSummary>) => ReactNode;
    renderDetail: (object: TObject) => ReactNode;
    missingDetail?: {
      title: string;
      summary: string;
    };
    dataAttributes?: Record<`data-${string}`, string | boolean | undefined>;
  };
  rootDataAttributes?: Record<`data-${string}`, string | boolean | undefined>;
}

function dataAttributes(attributes?: Record<`data-${string}`, string | boolean | undefined>) {
  return attributes ?? {};
}

function hiddenFields(fields: GovernanceHiddenField[] = []) {
  return fields
    .filter((field) => field.value !== null && field.value !== undefined && field.value !== "")
    .map((field) => (
      <input key={field.name} type="hidden" name={field.name} value={String(field.value)} />
    ));
}

function SectionSearch({
  action,
  label,
  placeholder,
  defaultValue,
  hiddenFields: fields,
}: NonNullable<GovernanceSectionFrameProps<unknown, unknown>["selector"]["search"]>) {
  return (
    <form action={action} className="flex min-w-0 flex-1 items-center" data-governance-search="true">
      {hiddenFields(fields)}
      <label className="sr-only" htmlFor={`governance-search-${label.replace(/\s+/g, "-").toLowerCase()}`}>
        {label}
      </label>
      <input
        id={`governance-search-${label.replace(/\s+/g, "-").toLowerCase()}`}
        name="q"
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        className="input-field min-h-11 flex-1 rounded-lg"
      />
      <button type="submit" className="sr-only">{label}</button>
    </form>
  );
}

function SectionFilterSheet({
  label,
  action,
  clearHref,
  hiddenFields: fields,
  controls,
}: NonNullable<GovernanceSectionFrameProps<unknown, unknown>["selector"]["filters"]>) {
  return (
    <details className="relative" data-governance-filter-sheet="true">
      <summary
        aria-label={label}
        className="focus-ring flex min-h-11 w-11 cursor-pointer list-none items-center justify-center rounded-lg border border-foreground/12 bg-background text-foreground/64 transition hover:border-foreground/24 hover:text-foreground"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true" focusable="false">
          <path d="M4 7h11" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
          <path d="M4 17h11" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
          <path d="M18 7h2" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
          <path d="M18 17h2" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
          <path d="M16 5v4" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
          <path d="M16 15v4" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
        </svg>
      </summary>
      <div className="absolute right-0 z-20 mt-(--space-2) w-[min(22rem,calc(100vw-2rem))] rounded-lg border border-foreground/10 bg-background p-(--space-inset-default) shadow-[0_24px_72px_-44px_rgba(15,23,42,0.55)]">
        <form action={action} className="grid gap-(--space-3)">
          {hiddenFields(fields)}
          {controls.map((control) => (
            <label key={control.id} htmlFor={control.id} className="grid gap-(--space-1) text-xs font-semibold text-foreground/58">
              {control.label}
              <select
                id={control.id}
                name={control.name}
                aria-label={control.label}
                defaultValue={control.value ?? ""}
                className="focus-ring min-h-10 rounded-lg border border-foreground/12 bg-background px-(--space-2) text-sm text-foreground"
              >
                {control.options.map((option) => (
                  <option key={`${control.id}-${option.value ?? "all"}`} value={option.value ?? ""}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <div className="flex items-center gap-(--space-2)">
            <button type="submit" className="btn-primary min-h-10 flex-1">
              Apply filters
            </button>
            <Link
              href={clearHref}
              className="focus-ring rounded-full border border-foreground/12 px-(--space-3) py-(--space-2) text-sm font-semibold text-foreground/58"
            >
              Clear
            </Link>
          </div>
        </form>
      </div>
    </details>
  );
}

export function ObjectSelectorRow({
  item,
  canViewDiagnostics,
}: {
  item: GovernanceSelectorItem;
  canViewDiagnostics: boolean;
}) {
  return (
    <Link
      href={item.href}
      onClick={item.onSelect}
      aria-current={item.selected ? "page" : undefined}
      className={`focus-ring group relative grid min-h-28 grid-cols-[2.5rem_minmax(0,1fr)] gap-(--space-3) rounded-lg border p-(--space-3) text-left transition ${
        item.selected
          ? "border-[color:color-mix(in_oklab,var(--accent-interactive)_42%,transparent)] bg-[color:color-mix(in_oklab,var(--accent-interactive)_7%,var(--background))] shadow-[0_18px_48px_-42px_rgba(15,23,42,0.5)]"
          : "border-transparent bg-background hover:border-foreground/10 hover:bg-foreground/[0.025]"
      }`}
      data-governance-selector-row={item.id}
      data-selected={item.selected ? "true" : "false"}
      {...dataAttributes(item.dataAttributes)}
    >
      {item.selected ? (
        <span className="absolute left-0 top-(--space-3) h-[calc(100%-1.5rem)] w-[2px] rounded-full bg-[color:color-mix(in_oklab,var(--accent-interactive)_74%,var(--foreground))]" />
      ) : null}
      <span
        aria-hidden="true"
        className="flex size-10 items-center justify-center rounded-full border border-foreground/10 bg-foreground/[0.035] text-xs font-semibold text-foreground/68"
      >
        {item.iconLabel ?? item.title.slice(0, 1)}
      </span>
      <span className="min-w-0">
        <span className="flex items-start justify-between gap-(--space-2)">
          <span className="truncate text-sm font-semibold text-foreground">{item.title}</span>
          {item.statusLabel ? (
            <span className="rounded-full border border-foreground/10 px-(--space-2) py-[0.14rem] text-[0.68rem] font-semibold text-foreground/54">
              {item.statusLabel}
            </span>
          ) : null}
        </span>
        {item.summary ? (
          <span className="mt-[0.2rem] block truncate text-sm text-foreground/56">
            {item.summary}
          </span>
        ) : null}
        <span className="mt-(--space-2) flex items-center justify-between gap-(--space-2) text-xs text-foreground/46">
          {item.meta ? <span className="truncate">{item.meta}</span> : <span />}
          {item.countLabel ? <span>{item.countLabel}</span> : null}
        </span>
        {canViewDiagnostics && item.diagnosticLabel ? (
          <span className="mt-(--space-2) block text-xs font-semibold text-foreground/42">
            {item.diagnosticLabel}
          </span>
        ) : null}
      </span>
    </Link>
  );
}

export function SectionBriefPanel({ brief }: { brief: SectionBrief | null }) {
  if (!brief) {
    return (
      <section className="rounded-lg border border-dashed border-foreground/14 bg-background/72 p-(--space-inset-panel)" data-governance-brief-panel="empty">
        <p className="text-sm font-semibold text-foreground">No brief is available yet.</p>
        <p className="mt-(--space-1) text-sm leading-6 text-foreground/58">
          Ordo will show an evidence-backed section brief here once there is enough activity to summarize.
        </p>
      </section>
    );
  }

  return (
    <section className="grid gap-(--space-4) rounded-lg border border-foreground/10 bg-background/82 p-(--space-inset-panel)" data-governance-brief-panel={brief.status}>
      <header>
        <p className="theme-label tier-micro uppercase text-foreground/42">{brief.status}</p>
        <h1 className="mt-(--space-2) text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {brief.title}
        </h1>
        <p className="mt-(--space-2) max-w-3xl text-sm leading-6 text-foreground/60">
          {brief.summary}
        </p>
        {brief.asOf ? (
          <p className="mt-(--space-1) text-xs text-foreground/42">
            As of {brief.asOf}
          </p>
        ) : null}
      </header>
      {brief.bullets.length > 0 ? (
        <ul className="grid gap-(--space-2) text-sm leading-6 text-foreground/68">
          {brief.bullets.map((bullet) => (
            <li key={bullet} className="flex gap-(--space-2)">
              <span aria-hidden="true">•</span>
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {brief.recommendedAction ? (
        <Link href={brief.recommendedAction.href} className="btn-primary w-fit">
          {brief.recommendedAction.label}
        </Link>
      ) : null}
      {brief.evidenceRefs.length > 0 ? (
        <section className="rounded-lg border border-foreground/10 bg-foreground/[0.025] p-(--space-3)" data-governance-brief-evidence="true">
          <p className="theme-label tier-micro uppercase text-foreground/42">Evidence behind the brief</p>
          <ul className="mt-(--space-2) grid gap-(--space-1) text-sm leading-6 text-foreground/62">
            {brief.evidenceRefs.map((ref) => (
              <li key={`${ref.kind}:${ref.id}`} className="flex min-w-0 items-center justify-between gap-(--space-3)">
                {ref.href ? (
                  <Link href={ref.href} className="focus-ring truncate underline decoration-foreground/20 underline-offset-4 hover:decoration-foreground/44">
                    {ref.label}
                  </Link>
                ) : (
                  <span className="truncate">{ref.label}</span>
                )}
                <span className="shrink-0 text-xs text-foreground/38">{ref.kind.replace(/_/g, " ")}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {brief.limitations.length > 0 ? (
        <section className="rounded-lg border border-foreground/10 bg-background/72 p-(--space-3)" data-governance-brief-limitations="true">
          <p className="theme-label tier-micro uppercase text-foreground/42">Limitations</p>
          <ul className="mt-(--space-2) grid gap-(--space-1) text-sm leading-6 text-foreground/62">
            {brief.limitations.map((limitation) => (
              <li key={limitation} className="flex gap-(--space-2)">
                <span aria-hidden="true">•</span>
                <span>{limitation}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </section>
  );
}

function MissingDetail({
  title,
  summary,
}: {
  title: string;
  summary: string;
}) {
  return (
    <section className="rounded-lg border border-dashed border-foreground/14 bg-background/72 p-(--space-inset-panel)" data-governance-missing-detail="true">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-(--space-1) text-sm leading-6 text-foreground/58">{summary}</p>
    </section>
  );
}

export function GovernanceSectionFrame<TObject, TSummary>({
  model,
  detailRequested,
  listHref,
  mobileBackLabel,
  onMobileBack,
  selector,
  main,
  rootDataAttributes,
}: GovernanceSectionFrameProps<TObject, TSummary>) {
  const showDetail = detailRequested;

  return (
    <main
      className="shell-governance-grid grid w-full max-w-none gap-0 px-0 py-0"
      aria-label={model.sectionTitle}
      data-governance-section={model.sectionId}
      data-governance-mobile-state={showDetail ? "detail" : "list"}
      {...dataAttributes(rootDataAttributes)}
    >
      <aside
        className={`grid content-start gap-(--space-4) border-foreground/10 bg-background/88 p-(--space-inset-default) lg:min-h-[calc(100vh-9rem)] lg:border-r ${
          showDetail ? "hidden lg:grid" : "grid"
        }`}
        aria-label={selector.ariaLabel}
        data-governance-selector-column="true"
        {...dataAttributes(selector.dataAttributes)}
      >
        {selector.title || selector.guidance || selector.overview ? (
          <div className="grid gap-(--space-2)" data-governance-selector-overview="true">
            {selector.title ? <p className="theme-label tier-micro uppercase text-foreground/42">{selector.title}</p> : null}
            {selector.guidance ? <p className="text-sm leading-6 text-foreground/58">{selector.guidance}</p> : null}
            {selector.overview}
          </div>
        ) : null}

        {selector.search || selector.filters ? (
          <div className="flex items-center gap-(--space-2)">
            {selector.search ? <SectionSearch {...selector.search} /> : null}
            {selector.filters ? <SectionFilterSheet {...selector.filters} /> : null}
          </div>
        ) : null}

        <nav aria-label={`${model.sectionTitle} objects`} className="grid gap-(--space-2)" data-governance-selector-list="true">
          {selector.items.length > 0 ? (
            selector.items.map((item) => (
              <ObjectSelectorRow
                key={item.id}
                item={item}
                canViewDiagnostics={model.permissions.canViewDiagnostics === true}
              />
            ))
          ) : (
            <div className="rounded-lg border border-dashed border-foreground/14 bg-background/72 p-(--space-inset-default)" data-governance-empty-list="true">
              <p className="text-sm font-semibold text-foreground">{selector.emptyTitle}</p>
              <p className="mt-(--space-1) text-sm leading-6 text-foreground/58">
                {selector.emptySummary}
              </p>
            </div>
          )}
        </nav>

        <footer className="border-t border-border/55 pt-(--space-3) text-xs leading-5 text-foreground/46" data-governance-selector-footer="true">
          {selector.footer}
          {selector.pagination}
        </footer>
      </aside>

      <section
        className={`min-w-0 px-(--space-frame-default) py-(--space-section-loose) sm:py-(--space-frame-wide) ${
          showDetail ? "grid" : "hidden lg:grid"
        } gap-(--space-5)`}
        aria-label={main.ariaLabel}
        data-governance-main-column="true"
        {...dataAttributes(main.dataAttributes)}
      >
        {showDetail ? (
          <Link
            href={listHref}
            onClick={onMobileBack}
            className="focus-ring inline-flex min-h-10 w-fit items-center rounded-full border border-foreground/12 px-(--space-3) text-sm font-semibold text-foreground/62 lg:hidden"
            data-governance-mobile-back="true"
          >
            {mobileBackLabel}
          </Link>
        ) : null}

        {showDetail ? (
          model.selectedObject ? (
            main.renderDetail(model.selectedObject)
          ) : (
            <MissingDetail
              title={main.missingDetail?.title ?? `${model.sectionTitle} item was not found.`}
              summary={main.missingDetail?.summary ?? "Return to the section brief or select another item from the evidence index."}
            />
          )
        ) : (
          main.renderBrief?.(model) ?? <SectionBriefPanel brief={model.brief} />
        )}
      </section>
    </main>
  );
}
