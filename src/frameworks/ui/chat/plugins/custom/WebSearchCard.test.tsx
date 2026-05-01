// @vitest-environment jsdom

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WebSearchCard } from "./WebSearchCard";
import type { ToolPluginProps } from "../../registry/types";

function createPart(overrides: Partial<NonNullable<ToolPluginProps["part"]>> = {}) {
  return {
    type: "job_status" as const,
    jobId: "job_search_1",
    toolName: "search_corpus",
    label: "Search Corpus",
    status: "succeeded" as const,
    ...overrides,
  };
}

describe("WebSearchCard", () => {
  it("renders structured corpus search payloads behind the shared shell", () => {
    render(
      <WebSearchCard
        part={createPart()}
        toolCall={{
          name: "search_corpus",
          args: { query: "governance" },
          result: {
            query: "governance",
            groundingState: "prefetched_section",
            followUp: "cite_canonical_paths",
            retrievalQuality: "strong",
            results: [
              {
                document: "1. Ordo Overview",
                documentId: "1",
                section: "Governance",
                sectionSlug: "governance",
                documentSlug: "ordo-overview",
                matchContext: "Governance principles and review cycles.",
                relevance: "high",
                book: "Ordo Overview",
                bookNumber: "1",
                chapter: "Governance",
                chapterSlug: "governance",
                bookSlug: "ordo-overview",
                canonicalPath: "/library/ordo-overview/governance",
                resolverPath: "/library/ordo-overview/governance",
                fallbackSearchPath: "/library?query=governance",
                fallbackSearchQuery: "governance",
              },
            ],
            prefetchedSection: {
              found: true,
              requestedDocumentSlug: "ordo-overview",
              requestedSectionSlug: "governance",
              title: "Governance",
              document: "1. Ordo Overview",
              documentId: "1",
              documentSlug: "ordo-overview",
              sectionSlug: "governance",
              canonicalPath: "/library/ordo-overview/governance",
              resolverPath: "/library/ordo-overview/governance",
              fallbackSearchPath: "/library?query=governance",
              fallbackSearchQuery: "governance",
              content: "Governance principles and review cycles.",
              contentTruncated: false,
              resolvedFromAlias: false,
              navigation: { previous: null, next: null },
              relatedSections: [],
            },
          },
        }}
        isStreaming={false}
      />,
    );

    expect(screen.getByRole("region", { name: "Search Corpus result" })).toHaveAttribute(
      "data-capability-card",
      "true",
    );
    expect(screen.getByText("Strong grounding")).toBeInTheDocument();
    expect(screen.getByText("Top matches")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Prefetched section/i }));

    expect(screen.getByText("Governance principles and review cycles.")).toBeInTheDocument();
  });

  it("renders resolved section payloads with content disclosure", () => {
    render(
      <WebSearchCard
        part={createPart({ toolName: "get_section", label: "Get Section" })}
        toolCall={{
          name: "get_section",
          args: { documentSlug: "ordo-overview", sectionSlug: "governance" },
          result: {
            found: true,
            requestedDocumentSlug: "ordo-overview",
            requestedSectionSlug: "governance",
            title: "Governance",
            document: "1. Ordo Overview",
            documentId: "1",
            documentSlug: "ordo-overview",
            sectionSlug: "governance",
            canonicalPath: "/library/ordo-overview/governance",
            resolverPath: "/library/ordo-overview/governance",
            fallbackSearchPath: "/library?query=governance",
            fallbackSearchQuery: "governance",
            content: "Governance content goes here.",
            contentTruncated: false,
            resolvedFromAlias: false,
            navigation: {
              previous: null,
              next: {
                title: "Stewardship",
                document: "1. Ordo Overview",
                documentId: "1",
                documentSlug: "ordo-overview",
                sectionSlug: "stewardship",
                canonicalPath: "/library/ordo-overview/stewardship",
                resolverPath: "/library/ordo-overview/stewardship",
                fallbackSearchPath: "/library?query=stewardship",
                fallbackSearchQuery: "stewardship",
              },
            },
            relatedSections: [],
          },
        }}
        isStreaming={false}
      />,
    );

    expect(screen.getByText("Section ready")).toBeInTheDocument();
    expect(screen.getByText("Stewardship")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Section content/i }));

    expect(screen.getByText("Governance content goes here.")).toBeInTheDocument();
  });

  it("renders plain-text search results without falling back", () => {
    render(
      <WebSearchCard
        part={createPart({ toolName: "get_corpus_summary", label: "Get Corpus Summary" })}
        toolCall={{
          name: "get_corpus_summary",
          args: { query: "pricing" },
          result: "1. [high] (turn 4)\nWe discussed pricing assumptions.",
        }}
        isStreaming={false}
      />,
    );

    expect(screen.getByRole("heading", { name: "Get Corpus Summary" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Result details/i }));
    expect(screen.getByText(/We discussed pricing assumptions\./)).toBeInTheDocument();
  });
});