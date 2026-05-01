import type { Metadata } from "next";

import { AdminSection } from "@/components/admin/AdminSection";
import { AdminDetailShell } from "@/components/admin/AdminDetailShell";
import { AdminConversationRetentionActions } from "@/components/admin/AdminConversationRetentionActions";
import { AdminMetaBox } from "@/components/admin/AdminMetaBox";
import type { TranscriptEntry } from "@/lib/chat/transcript-store";
import { requireAdminPageAccess } from "@/lib/journal/admin-journal";
import { loadAdminConversationDetail } from "@/lib/admin/conversations/admin-conversations";
import type { PromptTurnAuditEntry } from "@/lib/prompts/prompt-provenance-service";
import {
  restoreConversationAction,
  takeOverConversationAction,
  handBackConversationAction,
} from "@/lib/admin/conversations/admin-conversations-actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Conversation Detail",
  robots: { index: false, follow: false },
};

// ── Helpers ────────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function LaneBadge({ lane, confidence }: { lane: string; confidence: number | null }) {
  return (
    <span className="flex items-center gap-1">
      <span className="inline-flex rounded-full border border-foreground/12 px-2 py-0.5 text-[0.68rem] font-semibold uppercase tracking-[0.12em]">
        {lane}
      </span>
      {confidence != null && (
        <span className="text-xs text-foreground/40">{Math.round(confidence * 100)}%</span>
      )}
    </span>
  );
}

function transcriptRoleLabel(role: TranscriptEntry["role"]): string {
  switch (role) {
    case "user":
      return "User";
    case "assistant":
      return "Assistant";
    case "tool_result":
      return "Tool result";
    case "system":
      return "System";
    case "compaction_marker":
      return "Compaction";
  }
}

function transcriptStateLabel(entry: TranscriptEntry): string {
  if (entry.role === "compaction_marker") {
    return entry.compactionKind === "meta_summary" ? "Meta-summary compaction" : "Summary compaction";
  }

  return entry.inContextWindow ? "Prompt window" : "Durable only";
}

function transcriptCoverageLabel(entry: TranscriptEntry): string | null {
  if (entry.role !== "compaction_marker") {
    return null;
  }

  if (entry.compactionKind === "meta_summary") {
    return `Covers summaries through ${entry.coversUpToSummaryId ?? "unknown"}`;
  }

  return `Covers messages through ${entry.coversUpToMessageId ?? "unknown"}`;
}

function TranscriptEntryCard({ entry }: { entry: TranscriptEntry }) {
  const coverageLabel = transcriptCoverageLabel(entry);

  return (
    <div className="rounded-xl border border-foreground/8 bg-surface px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex rounded-full border border-foreground/12 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-foreground/60">
            {transcriptRoleLabel(entry.role)}
          </span>
          <span className="inline-flex rounded-full border border-foreground/12 px-2 py-0.5 text-[0.65rem] text-foreground/50">
            Turn {entry.turnIndex + 1}
          </span>
          <span className="inline-flex rounded-full border border-foreground/12 px-2 py-0.5 text-[0.65rem] text-foreground/50">
            {transcriptStateLabel(entry)}
          </span>
        </div>
        <span className="text-[0.6rem] text-foreground/35 tabular-nums">
          {entry.tokenEstimate > 0 && `${entry.tokenEstimate} tok · `}
          {formatDate(entry.timestamp)}
        </span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-foreground whitespace-pre-wrap wrap-break-word">
        {entry.contentSummary}
      </p>
      {(entry.sourceMessageId || coverageLabel || typeof entry.compactedCount === "number") && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[0.65rem] text-foreground/45">
          {entry.sourceMessageId ? <span>Source message {entry.sourceMessageId}</span> : null}
          {coverageLabel ? <span>{coverageLabel}</span> : null}
          {typeof entry.compactedCount === "number" ? <span>{entry.compactedCount} compacted</span> : null}
        </div>
      )}
    </div>
  );
}

function PromptProvenanceCard({ entry }: { entry: PromptTurnAuditEntry }) {
  const driftWarnings = entry.replay.diff.driftWarnings;

  return (
    <div className="rounded-xl border border-foreground/8 bg-surface px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex rounded-full border border-foreground/12 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-foreground/60">
              {entry.record.surface}
            </span>
            <span className={`inline-flex rounded-full border px-2 py-0.5 text-[0.65rem] ${entry.replay.matches ? "border-emerald-500/30 text-emerald-700" : "border-amber-500/30 text-amber-700"}`}>
              {entry.replay.matches ? "Replay match" : "Drift detected"}
            </span>
          </div>
          <p className="mt-2 text-xs text-foreground/55">
            User turn {entry.record.userMessageId}
            {entry.record.assistantMessageId ? ` -> assistant ${entry.record.assistantMessageId}` : " -> assistant pending"}
          </p>
        </div>
        <span className="text-[0.65rem] text-foreground/40 tabular-nums">{formatDate(entry.record.recordedAt)}</span>
      </div>

      <dl className="mt-3 grid gap-2 text-xs text-foreground/55 sm:grid-cols-2">
        <div>
          <dt className="text-foreground/40">Stored hash</dt>
          <dd className="mt-0.5 font-mono text-[0.7rem] text-foreground">{entry.record.effectiveHash}</dd>
        </div>
        <div>
          <dt className="text-foreground/40">Rebuilt hash</dt>
          <dd className="mt-0.5 font-mono text-[0.7rem] text-foreground">{entry.replay.rebuilt.effectiveHash}</dd>
        </div>
        <div>
          <dt className="text-foreground/40">Slot refs</dt>
          <dd className="mt-0.5 text-foreground">{entry.record.slotRefs.length}</dd>
        </div>
        <div>
          <dt className="text-foreground/40">Sections</dt>
          <dd className="mt-0.5 text-foreground">{entry.record.sections.length}</dd>
        </div>
      </dl>

      <div className="mt-3">
        <h3 className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-foreground/55">Replay Diagnostics</h3>
        {driftWarnings.length === 0 ? (
          <p className="mt-1 text-xs text-emerald-700">Stored provenance still matches a replay against the current prompt runtime.</p>
        ) : (
          <ul className="mt-2 grid gap-1 text-xs text-amber-700">
            {driftWarnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        )}
      </div>

      {entry.affectedTargets.length > 0 ? (
        <div className="mt-3">
          <h3 className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-foreground/55">Affected Targets</h3>
          <ul className="mt-2 grid gap-1 text-xs text-foreground/60">
            {entry.affectedTargets.map((target) => (
              <li key={target.id}>
                {target.surface}{" -> "}{target.targetKind} {target.targetId}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <details className="mt-3 rounded border border-foreground/8 p-2 text-xs">
        <summary className="cursor-pointer font-medium text-foreground/60">Stored structure and diff</summary>
        <pre className="mt-2 overflow-auto text-[0.65rem] text-foreground/50 whitespace-pre-wrap">
          {JSON.stringify({
            stored: {
              slotRefs: entry.record.slotRefs,
              sections: entry.record.sections,
              warnings: entry.record.warnings,
            },
            replayDiff: entry.replay.diff,
          }, null, 2)}
        </pre>
      </details>
    </div>
  );
}

// ── Message bubbles ────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: { id: string; role: string; content: string; parts: unknown[]; tokenEstimate: number; createdAt: string } }) {
  const isUser = msg.role === "user";
  const isSystem = msg.role === "system";

  // Check for tool invocations in parts
  const toolParts = (msg.parts as Array<{ type?: string; toolName?: string }>).filter(
    (p) => p.type === "tool-invocation" || p.type === "tool-result",
  );

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-xl px-4 py-3 ${
          isSystem
            ? "border border-foreground/8 bg-foreground/2 text-foreground/50 italic"
            : isUser
              ? "bg-foreground/8 text-foreground"
              : "border border-foreground/8 bg-surface text-foreground"
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="text-[0.6rem] font-semibold uppercase tracking-wider text-foreground/40">
            {msg.role}
          </span>
          <span className="text-[0.55rem] text-foreground/30 tabular-nums">
            {msg.tokenEstimate > 0 && `${msg.tokenEstimate} tok · `}
            {formatDate(msg.createdAt)}
          </span>
        </div>
        <div className="mt-1 text-sm whitespace-pre-wrap wrap-break-word">
          {msg.content}
        </div>
        {toolParts.length > 0 && (
          <details className="mt-2 rounded border border-foreground/8 p-2 text-xs">
            <summary className="cursor-pointer font-medium text-foreground/60">
              {toolParts.length} tool invocation{toolParts.length !== 1 ? "s" : ""}
            </summary>
            <pre className="mt-1 overflow-auto text-foreground/50 whitespace-pre-wrap">
              {JSON.stringify(toolParts, null, 2)}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────

export default async function AdminConversationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminPageAccess();
  const { id } = await params;
  const detail = await loadAdminConversationDetail(id);
  const {
    conversation: conv,
    messages,
    totalTokens,
    transcript,
    promptProvenance: promptProvenanceRaw,
  } = detail;
  const promptProvenance = promptProvenanceRaw ?? [];
  const compactionEntries = transcript.entries.filter((entry) => entry.role === "compaction_marker");

  const isHumanMode = conv.conversationMode === "human";
  const isDeleted = conv.deletedAt != null;

  return (
    <AdminSection
      title={conv.title}
      description={`${conv.userName} · ${conv.messageCount} messages · ${totalTokens.toLocaleString()} tokens`}
      breadcrumbs={[
        { label: "Admin", href: "/admin" },
        { label: "Conversations", href: "/admin/conversations" },
        { label: conv.id },
      ]}
    >
      <div className="px-(--space-inset-panel)">
        {/* Human mode banner */}
        {isHumanMode && (
          <div className="mb-(--space-4) rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-600">
            You are actively managing this conversation.
          </div>
        )}

        {isDeleted && (
          <div className="mb-(--space-4) rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-medium">This conversation is currently deleted from self-service history.</p>
                <p className="mt-1 text-xs text-amber-800/80">
                  Deleted {formatDate(conv.deletedAt)}{conv.purgeAfter ? ` · purge eligible ${formatDate(conv.purgeAfter)}` : ""}
                </p>
              </div>
              <form action={restoreConversationAction}>
                <input type="hidden" name="id" value={conv.id} />
                <button
                  type="submit"
                  className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-amber-700"
                >
                  Restore
                </button>
              </form>
            </div>
          </div>
        )}

        <AdminDetailShell
          backHref="/admin/conversations"
          backLabel="All Conversations"
          main={
            <div className="grid gap-(--space-section-default)">
              {/* Takeover / hand-back control */}
              <section className="rounded-xl border border-foreground/8 p-(--space-inset-panel)">
                {isHumanMode ? (
                  <form action={handBackConversationAction} className="flex items-center justify-between">
                    <input type="hidden" name="id" value={conv.id} />
                    <span className="text-sm text-foreground/60">Conversation is in human mode.</span>
                    <button
                      type="submit"
                      className="rounded-lg bg-foreground/8 px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-foreground/14"
                    >
                      Return to AI
                    </button>
                  </form>
                ) : (
                  <form action={takeOverConversationAction} className="flex items-center justify-between gap-3">
                    <input type="hidden" name="id" value={conv.id} />
                    <div>
                      <span className="text-sm text-foreground/60">Conversation is in AI mode.</span>
                      <p className="mt-0.5 text-xs text-foreground/40">Taking over will interrupt the active AI session. Please confirm before proceeding.</p>
                    </div>
                    <button
                      type="submit"
                      className="rounded-lg bg-foreground/8 px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-foreground/14"
                    >
                      Take Over
                    </button>
                  </form>
                )}
              </section>

              {/* Message thread */}
              <section className="rounded-xl border border-foreground/8 p-(--space-inset-panel)">
                <h2 className="text-sm font-semibold text-foreground/60">Messages</h2>
                <div className="mt-(--space-3) grid gap-(--space-3)">
                  {messages.length === 0 ? (
                    <p className="text-xs text-foreground/40">No messages yet.</p>
                  ) : (
                    messages.map((msg) => (
                      <MessageBubble key={msg.id} msg={msg} />
                    ))
                  )}
                </div>
              </section>

              <section className="rounded-xl border border-foreground/8 p-(--space-inset-panel)">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-sm font-semibold text-foreground/60">Prompt Provenance</h2>
                    <p className="mt-1 max-w-2xl text-xs leading-relaxed text-foreground/45">
                      Durable prompt assembly audit records linked to chat turns. Replay compares the stored structural provenance to a prompt rebuilt from persisted inputs.
                    </p>
                  </div>
                  <span className="inline-flex rounded-full border border-foreground/12 px-2 py-0.5 text-[0.65rem] text-foreground/50">
                    {promptProvenance.length} turn{promptProvenance.length === 1 ? "" : "s"}
                  </span>
                </div>

                <div className="mt-(--space-3) grid gap-(--space-3)">
                  {promptProvenance.length === 0 ? (
                    <p className="text-xs text-foreground/40">No prompt provenance has been recorded for this conversation yet.</p>
                  ) : (
                    promptProvenance.map((entry) => (
                      <PromptProvenanceCard key={entry.record.id} entry={entry} />
                    ))
                  )}
                </div>
              </section>

              <section className="rounded-xl border border-foreground/8 p-(--space-inset-panel)">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-sm font-semibold text-foreground/60">Durable Transcript</h2>
                    <p className="mt-1 max-w-2xl text-xs leading-relaxed text-foreground/45">
                      Export-safe replay view derived from persisted messages. Tool results and compaction markers stay visible here, and the same structure ships in JSON export.
                    </p>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
                    <div>
                      <dt className="text-foreground/45">Entries</dt>
                      <dd className="mt-0.5 font-semibold text-foreground">{transcript.entryCount}</dd>
                    </div>
                    <div>
                      <dt className="text-foreground/45">Prompt window</dt>
                      <dd className="mt-0.5 font-semibold text-foreground">{transcript.inContextCount}</dd>
                    </div>
                    <div>
                      <dt className="text-foreground/45">Tool results</dt>
                      <dd className="mt-0.5 font-semibold text-foreground">{transcript.toolResultCount}</dd>
                    </div>
                    <div>
                      <dt className="text-foreground/45">Compaction markers</dt>
                      <dd className="mt-0.5 font-semibold text-foreground">{transcript.compactionMarkerCount}</dd>
                    </div>
                  </dl>
                </div>

                <div className="mt-(--space-3) rounded-xl border border-foreground/8 bg-foreground/2 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground/55">Compaction Timeline</h3>
                      <p className="mt-1 max-w-2xl text-xs leading-relaxed text-foreground/45">
                        Filtered view of replayable compaction events so admins can inspect what was summarized without parsing the full transcript stream.
                      </p>
                    </div>
                    <span className="inline-flex rounded-full border border-foreground/12 px-2 py-0.5 text-[0.65rem] text-foreground/50">
                      {transcript.compactionMarkerCount} marker{transcript.compactionMarkerCount === 1 ? "" : "s"}
                    </span>
                  </div>

                  <div className="mt-(--space-3) grid gap-(--space-2)">
                    {compactionEntries.length === 0 ? (
                      <p className="text-xs text-foreground/40">No compaction markers recorded for this conversation.</p>
                    ) : (
                      compactionEntries.map((entry) => (
                        <TranscriptEntryCard key={`compaction-${entry.turnIndex}-${entry.timestamp}`} entry={entry} />
                      ))
                    )}
                  </div>
                </div>

                <div className="mt-(--space-3) flex items-center justify-between gap-3">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground/55">All Transcript Entries</h3>
                  <span className="text-[0.65rem] text-foreground/45">Ordered durable replay log</span>
                </div>

                <div className="mt-(--space-2) grid max-h-128 gap-(--space-2) overflow-y-auto pr-1">
                  {transcript.entries.length === 0 ? (
                    <p className="text-xs text-foreground/40">No transcript entries yet.</p>
                  ) : (
                    transcript.entries.map((entry) => (
                      <TranscriptEntryCard key={`${entry.role}-${entry.turnIndex}-${entry.timestamp}`} entry={entry} />
                    ))
                  )}
                </div>
              </section>

              <section className="rounded-xl border border-foreground/8 p-(--space-inset-panel)">
                <h2 className="text-sm font-semibold text-foreground/60">Retention</h2>
                <div className="mt-(--space-3)">
                  <AdminConversationRetentionActions
                    conversationId={conv.id}
                    purgeEligible={conv.purgeEligible}
                    purgeBlockedReason={conv.purgeBlockedReason}
                  />
                </div>
              </section>
            </div>
          }
          sidebar={
            <div className="grid gap-(--space-section-default)">
              <AdminMetaBox title="Routing Intelligence">
                <dl className="mt-(--space-2) grid gap-(--space-2) text-xs">
                  <div>
                    <dt className="text-foreground/50">Lane</dt>
                    <dd className="mt-0.5"><LaneBadge lane={conv.lane} confidence={conv.laneConfidence} /></dd>
                  </div>
                  <div>
                    <dt className="text-foreground/50">Detected need</dt>
                    <dd className="mt-0.5 text-foreground">{conv.detectedNeedSummary || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-foreground/50">Recommended next step</dt>
                    <dd className="mt-0.5 text-foreground">{conv.recommendedNextStep || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-foreground/50">Prompt version</dt>
                    <dd className="mt-0.5 text-foreground">{conv.promptVersion ?? "—"}</dd>
                  </div>
                </dl>
              </AdminMetaBox>

              <AdminMetaBox title="Session" collapsible>
                <dl className="mt-(--space-2) grid gap-(--space-1) text-xs">
                  <div className="flex justify-between text-foreground/60">
                    <dt>Source</dt>
                    <dd>{conv.sessionSource}</dd>
                  </div>
                  <div className="flex justify-between text-foreground/60">
                    <dt>Referral ID</dt>
                    <dd>{conv.referralId || "—"}</dd>
                  </div>
                  <div className="flex justify-between text-foreground/60">
                    <dt>Referral</dt>
                    <dd>{conv.referralSource || "—"}</dd>
                  </div>
                  <div className="flex justify-between text-foreground/60">
                    <dt>Trusted referrer</dt>
                    <dd>{conv.trustedReferrerName || "—"}</dd>
                  </div>
                  <div className="flex justify-between text-foreground/60">
                    <dt>Credential</dt>
                    <dd>{conv.trustedReferrerCredential || "—"}</dd>
                  </div>
                  <div className="flex justify-between text-foreground/60">
                    <dt>Converted from</dt>
                    <dd>{conv.convertedFrom || "—"}</dd>
                  </div>
                  <div className="flex justify-between text-foreground/60">
                    <dt>Status</dt>
                    <dd>{conv.status}</dd>
                  </div>
                  <div className="flex justify-between text-foreground/60">
                    <dt>Deleted at</dt>
                    <dd>{formatDate(conv.deletedAt)}</dd>
                  </div>
                  <div className="flex justify-between text-foreground/60">
                    <dt>Deleted by</dt>
                    <dd>{conv.deletedByUserId || "—"}</dd>
                  </div>
                  <div className="flex justify-between text-foreground/60">
                    <dt>Delete reason</dt>
                    <dd>{conv.deleteReason || "—"}</dd>
                  </div>
                  <div className="flex justify-between text-foreground/60">
                    <dt>Purge after</dt>
                    <dd>{formatDate(conv.purgeAfter)}</dd>
                  </div>
                  <div className="flex justify-between text-foreground/60">
                    <dt>Imported at</dt>
                    <dd>{formatDate(conv.importedAt)}</dd>
                  </div>
                  <div className="flex justify-between text-foreground/60">
                    <dt>Imported from</dt>
                    <dd>{conv.importSourceConversationId || "—"}</dd>
                  </div>
                </dl>
              </AdminMetaBox>

              <AdminMetaBox title="Identity Migration" collapsible>
                {detail.migration ? (
                  <dl className="mt-(--space-2) grid gap-(--space-1) text-xs">
                    <div className="flex justify-between gap-3 text-foreground/60">
                      <dt>Status</dt>
                      <dd>{detail.migration.status}</dd>
                    </div>
                    <div className="flex justify-between gap-3 text-foreground/60">
                      <dt>Stage</dt>
                      <dd>{detail.migration.currentStage ?? "—"}</dd>
                    </div>
                    <div className="flex justify-between gap-3 text-foreground/60">
                      <dt>Source</dt>
                      <dd className="font-mono text-[0.65rem]">{detail.migration.sourceUserId}</dd>
                    </div>
                    <div className="flex justify-between gap-3 text-foreground/60">
                      <dt>Target</dt>
                      <dd className="font-mono text-[0.65rem]">{detail.migration.targetUserId}</dd>
                    </div>
                    <div className="flex justify-between gap-3 text-foreground/60">
                      <dt>Conversations</dt>
                      <dd>{detail.migration.migratedConversationIds.length}</dd>
                    </div>
                    <div className="flex justify-between gap-3 text-foreground/60">
                      <dt>Jobs</dt>
                      <dd>{detail.migration.migratedJobIds.length}</dd>
                    </div>
                    <div className="flex justify-between gap-3 text-foreground/60">
                      <dt>Assets</dt>
                      <dd>{detail.migration.migratedAssetIds.length}</dd>
                    </div>
                    <div className="flex justify-between gap-3 text-foreground/60">
                      <dt>Search repairs</dt>
                      <dd>{detail.migration.repairedSearchSourceIds.length}</dd>
                    </div>
                    <div className="flex justify-between gap-3 text-foreground/60">
                      <dt>Memory repairs</dt>
                      <dd>{detail.migration.repairedMemoryRefs.length}</dd>
                    </div>
                    <div className="flex justify-between gap-3 text-foreground/60">
                      <dt>Completed</dt>
                      <dd>{formatDate(detail.migration.completedAt)}</dd>
                    </div>
                    {detail.migration.failureMessage ? (
                      <div className="text-amber-700">
                        <dt>Failure</dt>
                        <dd className="mt-0.5">{detail.migration.failureMessage}</dd>
                      </div>
                    ) : null}
                  </dl>
                ) : (
                  <p className="mt-(--space-2) text-xs text-foreground/40">
                    No identity migration event is linked to this conversation.
                  </p>
                )}
              </AdminMetaBox>

              <AdminMetaBox title="Stats" collapsible>
                <dl className="mt-(--space-2) grid gap-(--space-1) text-xs">
                  <div className="flex justify-between text-foreground/60">
                    <dt>Messages</dt>
                    <dd>{conv.messageCount}</dd>
                  </div>
                  <div className="flex justify-between text-foreground/60">
                    <dt>Total tokens</dt>
                    <dd>{totalTokens.toLocaleString()}</dd>
                  </div>
                  <div className="flex justify-between text-foreground/60">
                    <dt>Created</dt>
                    <dd>{formatDate(conv.createdAt)}</dd>
                  </div>
                  <div className="flex justify-between text-foreground/60">
                    <dt>Updated</dt>
                    <dd>{formatDate(conv.updatedAt)}</dd>
                  </div>
                </dl>
              </AdminMetaBox>

              <AdminMetaBox title="Event Telemetry" collapsible defaultOpen={false}>
                <div className="mt-(--space-2) grid max-h-96 gap-(--space-2) overflow-y-auto pr-1">
                  {detail.events.length === 0 ? (
                    <p className="text-xs text-foreground/40">No events recorded.</p>
                  ) : (
                    detail.events.map((event) => (
                      <div key={event.id} className="rounded border border-foreground/8 bg-surface p-2 text-xs">
                        <div className="flex justify-between items-center gap-2">
                          <span className={`font-semibold uppercase tracking-[0.05em] ${event.eventType === "session_resolution" ? "text-blue-500/90" : "text-foreground/70"}`}>
                            {event.eventType}
                          </span>
                          <span className="text-[0.6rem] text-foreground/40 shrink-0">{formatDate(event.createdAt)}</span>
                        </div>
                        <pre className="mt-1 overflow-x-auto text-[0.65rem] text-foreground/50 whitespace-pre-wrap">
                          {JSON.stringify(event.metadata, null, 2)}
                        </pre>
                      </div>
                    ))
                  )}
                </div>
              </AdminMetaBox>
            </div>
          }
        />
      </div>
    </AdminSection>
  );
}
