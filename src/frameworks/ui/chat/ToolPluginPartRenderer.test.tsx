// @vitest-environment jsdom

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ToolPluginPartRenderer } from "./ToolPluginPartRenderer";
import { ToolPluginRegistryProvider } from "./registry/ToolPluginContext";
import { createDefaultToolRegistry } from "./registry/default-tool-registry";

const registry = createDefaultToolRegistry();

describe("ToolPluginPartRenderer", () => {
  it("renders appliance restore operation actions from structured results", () => {
    const onActionClick = vi.fn();

    render(
      <ToolPluginRegistryProvider registry={registry}>
        <ToolPluginPartRenderer
          toolCall={{
            name: "prepare_appliance_restore",
            args: { snapshot_id: "backup_eb0d5a66" },
            result: {
              status: "confirmation_required",
              summary: "Restore plan is ready for confirmation.",
              restorePlan: {
                id: "restore_4bb1532c-edfe-4884-a85e-c59a1f8ef314",
                status: "confirmation_required",
                confirmationPhrase: "RESTORE restore_4bb1532c",
                archiveSizeBytes: 2547353,
              },
              actions: [
                {
                  type: "action-link",
                  label: "Confirm Restore",
                  actionType: "operation",
                  value: "op_restore_1",
                  params: {
                    operationId: "op_restore_1",
                    actionId: "act_confirm",
                    idempotencyKey: "idem_confirm",
                    operationRevision: "3",
                    riskLevel: "destructive",
                  },
                },
              ],
            },
          }}
          isStreaming={false}
          onActionClick={onActionClick}
        />
      </ToolPluginRegistryProvider>,
    );

    expect(screen.getByText("Prepare Appliance Restore")).toBeInTheDocument();
    expect(screen.getAllByText(/restore_4bb1532c/).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Confirm Restore (operation)" }));
    expect(onActionClick).toHaveBeenCalledWith(
      "operation",
      "op_restore_1",
      {
        operationId: "op_restore_1",
        actionId: "act_confirm",
        idempotencyKey: "idem_confirm",
        operationRevision: "3",
        riskLevel: "destructive",
      },
    );
  });

  it("omits legacy per-backup mutation actions from list appliance backup results", () => {
    const onActionClick = vi.fn();

    render(
      <ToolPluginRegistryProvider registry={registry}>
        <ToolPluginPartRenderer
          toolCall={{
            name: "list_appliance_backups",
            args: {},
            result: {
              summary: "Backup dashboard is healthy.",
              recentBackups: [
                {
                  id: "backup_eb0d5a66-6f1e-479f-bd3c-f18c1fb6ba75",
                  status: "succeeded",
                  archiveSizeBytes: 2547353,
                  actions: [],
                },
              ],
              actions: [],
            },
          }}
          isStreaming={false}
          onActionClick={onActionClick}
        />
      </ToolPluginRegistryProvider>,
    );

    expect(screen.getByText("List Appliance Backups")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Prepare Restore/ })).not.toBeInTheDocument();
    expect(onActionClick).not.toHaveBeenCalled();
  });

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
