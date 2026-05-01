"use client";

import React from "react";
import dynamic from "next/dynamic";
import type { GetSectionPayload, SearchCorpusPayload } from "@/core/use-cases/tools/CorpusTools";
import { isAdminWebSearchPayload } from "@/lib/web-search/admin-web-search-payload";
import type { ToolPluginProps } from "../../registry/types";
import {
  getCapabilityPresentationDescriptor,
  resolveCapabilityDisplayLabel,
} from "../../registry/capability-presentation-registry";
import { CapabilityActionRail } from "../../primitives/CapabilityActionRail";
import { CapabilityArtifactRail } from "../../primitives/CapabilityArtifactRail";
import { CapabilityCardHeader } from "../../primitives/CapabilityCardHeader";
import { CapabilityCardShell } from "../../primitives/CapabilityCardShell";
import { CapabilityContextPanel } from "../../primitives/CapabilityContextPanel";
import { CapabilityDisclosure } from "../../primitives/CapabilityDisclosure";
import { CapabilityMetricStrip } from "../../primitives/CapabilityMetricStrip";
import { JobStatusFallbackCard } from "../system/JobStatusFallbackCard";

const WebSearchResultCard = dynamic(
  () =>
    import("@/components/WebSearchResultCard").then(
      (mod) => mod.WebSearchResultCard,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-18 w-full max-w-2xl flex items-center justify-center text-xs opacity-50 animate-pulse bg-surface-muted rounded-theme border-theme my-(--space-2)">
        Loading Web Search...
      </div>
    ),
  },
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function detailValue(value: string | null | undefined): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function createContextItems(items: Array<{ label: string; value: React.ReactNode }>) {
  return items.filter((item) => item.value != null && item.value !== false && item.value !== "");
}

function formatLabel(value: string): string {
  return value
    .split("_")
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function isSearchCorpusPayload(value: unknown): value is SearchCorpusPayload {
  return (
    isRecord(value)
    && typeof value.query === "string"
    && typeof value.groundingState === "string"
    && typeof value.followUp === "string"
    && typeof value.retrievalQuality === "string"
    && Array.isArray(value.results)
    && (value.prefetchedSection === null || isRecord(value.prefetchedSection))
  );
}

function isGetSectionPayload(value: unknown): value is GetSectionPayload {
  return (
    isRecord(value)
    && typeof value.found === "boolean"
    && typeof value.requestedDocumentSlug === "string"
    && typeof value.requestedSectionSlug === "string"
    && isRecord(value.navigation)
    && Array.isArray(value.relatedSections)
  );
}

function searchStatusLabel(result: SearchCorpusPayload): string {
  switch (result.retrievalQuality) {
    case "strong":
      return "Strong grounding";
    case "partial":
      return "Partial grounding";
    case "none":
    default:
      return "No grounding";
  }
}

function isGenericSearchTextTool(toolName: string): boolean {
  return ["get_corpus_summary", "list_practitioners"].includes(toolName);
}

function summarizeSearchCorpus(result: SearchCorpusPayload): string {
  if (result.prefetchedSection?.found && result.prefetchedSection.title) {
    return `Prefetched ${result.prefetchedSection.title} with ${result.results.length} supporting match${result.results.length === 1 ? "" : "es"}.`;
  }

  if (result.results.length > 0) {
    return `Found ${result.results.length} corpus match${result.results.length === 1 ? "" : "es"} for \"${result.query}\".`;
  }

  return `No corpus matches were found for \"${result.query}\".`;
}

function summarizeSectionResult(result: GetSectionPayload): string {
  if (!result.found) {
    return `Could not resolve ${result.requestedDocumentSlug}/${result.requestedSectionSlug}.`;
  }

  return result.document
    ? `Loaded ${result.document}${result.title ? ` · ${result.title}` : ""}.`
    : "Loaded section content.";
}

export const WebSearchCard: React.FC<ToolPluginProps> = (props) => {
  const { toolCall, resultEnvelope, part, computedActions = [], onActionClick } = props;
  const result = resultEnvelope?.payload ?? toolCall?.result;
  const descriptor = props.descriptor ?? (toolCall ? getCapabilityPresentationDescriptor(toolCall.name) : undefined);
  const label = resolveCapabilityDisplayLabel({
    toolName: toolCall?.name,
    explicitLabel: part?.label,
    descriptorLabel: descriptor?.label,
    fallbackLabel: "Search",
  });
  const sharedShellProps = {
    descriptor,
    state: part?.status ?? "succeeded",
    ariaLabel: `${label} result`,
  } as const;

  if (!toolCall) {
    return <JobStatusFallbackCard {...props} />;
  }

  if (isAdminWebSearchPayload(result)) {
    return (
      <CapabilityCardShell {...sharedShellProps}>
        <CapabilityCardHeader
          eyebrow={label}
          title={result.query}
          statusLabel={"error" in result ? "Search failed" : "Search ready"}
          statusMeta={detailValue(result.model)}
        />
        <p className="ui-capability-card-summary">
          {resultEnvelope?.summary.message
            ?? ("error" in result
              ? result.error
              : `Returned ${result.citations.length} citation${result.citations.length === 1 ? "" : "s"} across ${result.sources.length} source${result.sources.length === 1 ? "" : "s"}.`)}
        </p>
        <CapabilityMetricStrip
          items={[
            { label: "Citations", value: "error" in result ? null : String(result.citations.length) },
            { label: "Sources", value: "error" in result ? null : String(result.sources.length) },
            { label: "Model", value: result.model },
          ]}
        />
        <CapabilityContextPanel
          items={createContextItems([
            { label: "Allowed domains", value: detailValue(result.allowed_domains?.join(", ")) },
          ])}
        />
        <WebSearchResultCard
          query={result.query}
          allowed_domains={result.allowed_domains}
          model={result.model}
          initialResult={"error" in result ? null : {
            answer: result.answer,
            citations: result.citations,
            sources: result.sources,
            model: result.model,
          }}
          initialError={"error" in result ? result.error : null}
        />
        <CapabilityActionRail actions={computedActions} onActionClick={onActionClick} />
      </CapabilityCardShell>
    );
  }

  if (toolCall.name === "search_corpus" && isSearchCorpusPayload(result)) {
    const prefetchedSection = result.prefetchedSection?.found ? result.prefetchedSection : null;

    return (
      <CapabilityCardShell {...sharedShellProps}>
        <CapabilityCardHeader
          eyebrow={label}
          title={result.query}
          statusLabel={searchStatusLabel(result)}
        />
        <p className="ui-capability-card-summary">
          {resultEnvelope?.summary.message ?? summarizeSearchCorpus(result)}
        </p>
        <CapabilityMetricStrip
          items={[
            { label: "Matches", value: String(result.results.length) },
            { label: "Grounding", value: formatLabel(result.groundingState) },
            { label: "Follow-up", value: formatLabel(result.followUp) },
          ]}
        />
        <CapabilityArtifactRail
          title="Top matches"
          items={result.results.slice(0, 5).map((entry) => ({
            id: `${entry.documentSlug}-${entry.sectionSlug}`,
            label: entry.section,
            href: entry.canonicalPath ?? entry.resolverPath ?? entry.fallbackSearchPath ?? undefined,
            meta: `${entry.document} · ${formatLabel(entry.relevance)}`,
          }))}
        />
        {prefetchedSection?.content ? (
          <CapabilityDisclosure label="Prefetched section">
            <div className="flex flex-col gap-(--space-2)">
              <p className="text-sm font-medium text-foreground">{prefetchedSection.title}</p>
              <p className="ui-capability-card-summary whitespace-pre-wrap">{prefetchedSection.content}</p>
            </div>
          </CapabilityDisclosure>
        ) : null}
        {result.results.some((entry) => detailValue(entry.matchPassage ?? entry.matchContext ?? entry.matchHighlight)) ? (
          <CapabilityDisclosure label="Top match excerpts">
            <ul className="flex flex-col gap-(--space-2)">
              {result.results.slice(0, 5).map((entry) => {
                const excerpt = detailValue(entry.matchHighlight ?? entry.matchPassage ?? entry.matchContext);
                if (!excerpt) {
                  return null;
                }

                return (
                  <li key={`${entry.documentSlug}-${entry.sectionSlug}-excerpt`} className="ui-capability-context-item">
                    <p className="text-sm font-medium text-foreground">{entry.section}</p>
                    <p className="mt-(--space-2) text-sm text-foreground/72 whitespace-pre-wrap">{excerpt}</p>
                  </li>
                );
              })}
            </ul>
          </CapabilityDisclosure>
        ) : null}
        <CapabilityActionRail actions={computedActions} onActionClick={onActionClick} />
      </CapabilityCardShell>
    );
  }

  if (toolCall.name === "get_section" && isGetSectionPayload(result)) {
    const relatedItems = [
      result.navigation.previous
        ? {
          id: `previous-${result.navigation.previous.documentSlug}-${result.navigation.previous.sectionSlug}`,
          label: result.navigation.previous.title,
          href:
            result.navigation.previous.canonicalPath
            ?? result.navigation.previous.resolverPath
            ?? result.navigation.previous.fallbackSearchPath
            ?? undefined,
          meta: `Previous · ${result.navigation.previous.document}`,
        }
        : null,
      result.navigation.next
        ? {
          id: `next-${result.navigation.next.documentSlug}-${result.navigation.next.sectionSlug}`,
          label: result.navigation.next.title,
          href:
            result.navigation.next.canonicalPath
            ?? result.navigation.next.resolverPath
            ?? result.navigation.next.fallbackSearchPath
            ?? undefined,
          meta: `Next · ${result.navigation.next.document}`,
        }
        : null,
      ...result.relatedSections.map((entry) => ({
        id: `related-${entry.documentSlug}-${entry.sectionSlug}`,
        label: entry.title,
        href: entry.canonicalPath ?? entry.resolverPath ?? entry.fallbackSearchPath ?? undefined,
        meta: `Related · ${entry.document}`,
      })),
    ].filter((item): item is NonNullable<typeof item> => item !== null);

    return (
      <CapabilityCardShell {...sharedShellProps}>
        <CapabilityCardHeader
          eyebrow={label}
          title={result.title ?? `${result.requestedDocumentSlug}/${result.requestedSectionSlug}`}
          statusLabel={result.found ? (result.resolvedFromAlias ? "Alias resolved" : "Section ready") : "Not found"}
        />
        <p className="ui-capability-card-summary">
          {resultEnvelope?.summary.message ?? summarizeSectionResult(result)}
        </p>
        <CapabilityContextPanel
          items={createContextItems([
            { label: "Requested document", value: result.requestedDocumentSlug },
            { label: "Requested section", value: result.requestedSectionSlug },
            { label: "Resolved document", value: detailValue(result.document ?? undefined) },
            { label: "Canonical path", value: detailValue(result.canonicalPath ?? undefined) },
            { label: "Resolver path", value: detailValue(result.resolverPath ?? undefined) },
          ])}
        />
        <CapabilityArtifactRail title="Navigation" items={relatedItems} />
        {result.content ? (
          <CapabilityDisclosure label="Section content">
            <p className="ui-capability-card-summary whitespace-pre-wrap">{result.content}</p>
          </CapabilityDisclosure>
        ) : null}
        <CapabilityActionRail actions={computedActions} onActionClick={onActionClick} />
      </CapabilityCardShell>
    );
  }

  if (
    typeof result === "string"
    && descriptor?.cardKind === "search_result"
    && isGenericSearchTextTool(toolCall.name)
  ) {
    const lines = result.split(/\n+/).map((line) => line.trim()).filter(Boolean);

    return (
      <CapabilityCardShell {...sharedShellProps}>
        <CapabilityCardHeader
          eyebrow={label}
          title={resultEnvelope?.summary.title ?? label}
          statusLabel="Completed"
        />
        <p className="ui-capability-card-summary">
          {resultEnvelope?.summary.message ?? lines[0] ?? result}
        </p>
        <CapabilityMetricStrip
          items={[
            { label: "Lines", value: String(lines.length) },
          ]}
        />
        <CapabilityContextPanel
          items={createContextItems([
            {
              label: "Query",
              value: typeof toolCall.args.query === "string" ? toolCall.args.query : null,
            },
            {
              label: "Limit",
              value: typeof toolCall.args.max_results === "number" ? String(toolCall.args.max_results) : null,
            },
          ])}
        />
        <CapabilityDisclosure label="Result details">
          <p className="ui-capability-card-summary whitespace-pre-wrap">{result}</p>
        </CapabilityDisclosure>
        <CapabilityActionRail actions={computedActions} onActionClick={onActionClick} />
      </CapabilityCardShell>
    );
  }

  return <JobStatusFallbackCard {...props} />;
};
