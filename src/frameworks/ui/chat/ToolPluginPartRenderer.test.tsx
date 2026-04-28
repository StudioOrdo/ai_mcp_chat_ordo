// @vitest-environment jsdom

import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ToolPluginPartRenderer } from "./ToolPluginPartRenderer";
import { ToolPluginRegistryProvider } from "./registry/ToolPluginContext";
import { createDefaultToolRegistry } from "./registry/default-tool-registry";

const registry = createDefaultToolRegistry();

describe("ToolPluginPartRenderer", () => {
  it("renders a custom card from completed job-status payloads", () => {
    render(
      <ToolPluginRegistryProvider registry={registry}>
        <ToolPluginPartRenderer
          part={{
            type: "job_status",
            jobId: "job_ready_1",
            toolName: "prepare_journal_post_for_publish",
            label: "Prepare Journal Post For Publish",
            status: "succeeded",
            summary: "The journal draft is ready.",
            resultPayload: {
              action: "prepare_journal_post_for_publish",
              ready: true,
              summary: "The journal draft is ready.",
              blockers: [],
              revision_count: 2,
              post: {
                id: "post_1",
                title: "Launch Plan",
                detail_route: "/admin/journal/post_1",
                preview_route: "/admin/journal/preview/launch-plan",
              },
            },
          }}
          isStreaming={false}
        />
      </ToolPluginRegistryProvider>,
    );

    expect(screen.getByText("Ready to publish")).toBeInTheDocument();
    expect(screen.getByText("Launch Plan")).toBeInTheDocument();
  });

  it("renders a custom card from completed job-status envelopes when the legacy payload is absent", () => {
    render(
      <ToolPluginRegistryProvider registry={registry}>
        <ToolPluginPartRenderer
          part={{
            type: "job_status",
            jobId: "job_ready_2",
            toolName: "prepare_journal_post_for_publish",
            label: "Prepare Journal Post For Publish",
            status: "succeeded",
            resultEnvelope: {
              schemaVersion: 1,
              toolName: "prepare_journal_post_for_publish",
              family: "journal",
              cardKind: "journal_workflow",
              executionMode: "deferred",
              inputSnapshot: { post_id: "post_1" },
              summary: {
                title: "Journal publish readiness for post_1",
                message: "The journal draft is ready.",
              },
              replaySnapshot: { title: "Launch Plan" },
              payload: {
                action: "prepare_journal_post_for_publish",
                ready: true,
                summary: "The journal draft is ready.",
                blockers: [],
                revision_count: 2,
                post: {
                  id: "post_1",
                  title: "Launch Plan",
                  detail_route: "/admin/journal/post_1",
                  preview_route: "/admin/journal/preview/launch-plan",
                },
              },
            },
          }}
          isStreaming={false}
        />
      </ToolPluginRegistryProvider>,
    );

    expect(screen.getByText("Ready to publish")).toBeInTheDocument();
    expect(screen.getByText("Launch Plan")).toBeInTheDocument();
  });

  it("renders compose_media job statuses through the dedicated media card", () => {
    render(
      <ToolPluginRegistryProvider registry={registry}>
        <ToolPluginPartRenderer
          part={{
            type: "job_status",
            jobId: "job_media_1",
            toolName: "compose_media",
            label: "Compose Media",
            status: "running",
            progressPercent: 40,
            progressLabel: "Staging assets",
            resultEnvelope: {
              schemaVersion: 1,
              toolName: "compose_media",
              family: "artifact",
              cardKind: "artifact_viewer",
              executionMode: "hybrid",
              inputSnapshot: { planId: "plan_media_1" },
              summary: {
                title: "Media Composition",
                statusLine: "running",
              },
              payload: {
                route: "browser_wasm",
                planId: "plan_media_1",
                outputFormat: "mp4",
              },
              progress: {
                percent: 40,
                label: "Staging assets",
              },
            },
          }}
          isStreaming={false}
        />
      </ToolPluginRegistryProvider>,
    );

    expect(screen.getByLabelText("Media render result")).toBeInTheDocument();
    expect(screen.getByText("Staging assets")).toBeInTheDocument();
  });

  it("renders newly mapped inline profile preferences through the profile card", () => {
    render(
      <ToolPluginRegistryProvider registry={registry}>
        <ToolPluginPartRenderer
          toolCall={{
            name: "set_preference",
            args: { key: "preferred_name", value: "Keith" },
            result: JSON.stringify({
              action: "set_preference",
              key: "preferred_name",
              value: "Keith",
              message: 'Preference "preferred_name" set to "Keith".',
            }),
          }}
          isStreaming={false}
        />
      </ToolPluginRegistryProvider>,
    );

    expect(screen.getByText("Preference updated")).toBeInTheDocument();
    expect(screen.getByText('Preference "preferred_name" set to "Keith".')).toBeInTheDocument();
  });

  it("renders newly mapped corpus search payloads through the search card", () => {
    render(
      <ToolPluginRegistryProvider registry={registry}>
        <ToolPluginPartRenderer
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
        />
      </ToolPluginRegistryProvider>,
    );

    expect(screen.getByText("Strong grounding")).toBeInTheDocument();
    expect(screen.getByText("Top matches")).toBeInTheDocument();
  });

  it("falls back to the status card when a mapped job is still in progress", () => {
    render(
      <ToolPluginRegistryProvider registry={registry}>
        <ToolPluginPartRenderer
          part={{
            type: "job_status",
            jobId: "job_running_1",
            toolName: "prepare_journal_post_for_publish",
            label: "Prepare Journal Post For Publish",
            status: "running",
            progressPercent: 45,
            progressLabel: "Checking blockers",
          }}
          isStreaming={false}
        />
      </ToolPluginRegistryProvider>,
    );

    expect(screen.getByText("Prepare Journal Post For Publish")).toBeInTheDocument();
    expect(screen.getByText("Running")).toBeInTheDocument();
    expect(screen.getByText(/Checking blockers/i)).toBeInTheDocument();
  });

  it("routes failed job statuses through the shared error card", () => {
    render(
      <ToolPluginRegistryProvider registry={registry}>
        <ToolPluginPartRenderer
          part={{
            type: "job_status",
            jobId: "job_failed_1",
            toolName: "generate_graph",
            label: "Generate Graph",
            status: "failed",
            error: "Graph generation timed out.",
          }}
          isStreaming={false}
        />
      </ToolPluginRegistryProvider>,
    );

    expect(screen.getByRole("alert", { name: "Generate Graph failed" })).toBeInTheDocument();
    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(screen.getByText("Graph generation timed out.")).toBeInTheDocument();
  });

  it("renders failed compose_media job statuses through the dedicated media card when an envelope is available", () => {
    render(
      <ToolPluginRegistryProvider registry={registry}>
        <ToolPluginPartRenderer
          part={{
            type: "job_status",
            jobId: "job_failed_media_1",
            toolName: "compose_media",
            label: "Compose Media",
            status: "failed",
            error: "Remote FFmpeg failed.",
            lifecyclePhase: "compose_failed_terminal",
            failureStage: "deferred_execution",
            resultEnvelope: {
              schemaVersion: 1,
              toolName: "compose_media",
              family: "artifact",
              cardKind: "media_render",
              executionMode: "deferred",
              inputSnapshot: { planId: "plan_media_2" },
              summary: {
                title: "Media Composition",
              },
              payload: {
                planId: "plan_media_2",
                outputFormat: "mp4",
              },
            },
          }}
          isStreaming={false}
        />
      </ToolPluginRegistryProvider>,
    );

    expect(screen.getByRole("alert", { name: "Media composition failed" })).toBeInTheDocument();
    expect(screen.getByText("Remote FFmpeg failed.")).toBeInTheDocument();
    expect(screen.queryByRole("alert", { name: "Compose Media failed" })).not.toBeInTheDocument();
  });

  it("renders canceled audio job statuses through the dedicated audio card", () => {
    render(
      <ToolPluginRegistryProvider registry={registry}>
        <ToolPluginPartRenderer
          part={{
            type: "job_status",
            jobId: "job_canceled_1",
            toolName: "generate_audio",
            label: "Generate Audio",
            status: "canceled",
            summary: "Audio generation was canceled by the user.",
            lifecyclePhase: "generation_failed_terminal",
            failureStage: "asset_generation",
          }}
          isStreaming={false}
        />
      </ToolPluginRegistryProvider>,
    );

    expect(screen.getByRole("alert", { name: "Generate Audio result" })).toBeInTheDocument();
    expect(screen.getByText("Canceled")).toBeInTheDocument();
    expect(screen.getByText("Audio generation was canceled by the user.")).toBeInTheDocument();
  });

  it("treats unresolved inline fallback tool calls as running instead of completed", () => {
    render(
      <ToolPluginRegistryProvider registry={registry}>
        <ToolPluginPartRenderer
          toolCall={{
            name: "calculator",
            args: { expression: "8*8" },
          }}
          isStreaming={true}
        />
      </ToolPluginRegistryProvider>,
    );

    expect(screen.getByRole("region", { name: "Calculator status" })).toBeInTheDocument();
    expect(screen.getByText("Running")).toBeInTheDocument();
    expect(screen.queryByText("Completed")).not.toBeInTheDocument();
  });

  it("routes inline fallback error payloads through the shared error card", () => {
    render(
      <ToolPluginRegistryProvider registry={registry}>
        <ToolPluginPartRenderer
          toolCall={{
            name: "calculator",
            args: { expression: "1/0" },
            result: { error: "Division by zero." },
          }}
          isStreaming={false}
        />
      </ToolPluginRegistryProvider>,
    );

    expect(screen.getByRole("alert", { name: "Calculator failed" })).toBeInTheDocument();
    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(screen.getByText("Division by zero.")).toBeInTheDocument();
  });
});