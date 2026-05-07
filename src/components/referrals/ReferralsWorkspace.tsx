"use client";

import { useState } from "react";

import { downloadFileFromUrl } from "@/lib/download-browser";
import { formatStableDateTimeOrValue } from "@/lib/format/stable-date";
import type { ReferralsWorkspaceData } from "@/lib/referrals/load-referrals-workspace";

type NoticeState =
  | { kind: "idle" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

function getNoticeClassName(kind: NoticeState["kind"]): string {
  return kind === "error"
    ? "alert-error"
    : "profile-success-notice px-(--space-inset-default) py-(--space-inset-compact) text-sm";
}

function formatMetricValue(value: number | string): string {
  return typeof value === "number" ? String(value) : value;
}

function formatRelativeDate(value: string): string {
  return formatStableDateTimeOrValue(value);
}

function buildCtaCopy(referralUrl: string): string {
  return `I use Studio Ordo for real AI work. Start with my link or QR code: ${referralUrl}`;
}

export function ReferralsWorkspace({ workspace }: { workspace: ReferralsWorkspaceData }) {
  const { profile, overview, pipeline, recentActivity, timeseries } = workspace;
  const [notice, setNotice] = useState<NoticeState>({ kind: "idle" });

  if (!profile.affiliateEnabled || !profile.referralCode || !profile.referralUrl || !profile.qrCodeUrl) {
    return (
      <main className="referrals-page-shell mx-auto flex w-full max-w-5xl flex-col gap-(--space-6) px-(--space-frame-default) py-(--space-section-loose) sm:py-(--space-frame-wide)" data-referrals-workspace="true" data-referrals-workspace-state="disabled">
        <header className="referrals-route-header flex flex-col gap-(--space-3)" data-referrals-header="true">
          <p className="theme-label tier-micro uppercase text-foreground/42">Referrals</p>
          <h1 className="theme-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Affiliate dashboard
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-foreground/62 sm:text-base">
            Referral links, QR assets, milestone visibility, and reporting live here once affiliate access is enabled for your account.
          </p>
        </header>

        <section className="profile-panel-surface p-(--space-inset-default) sm:p-(--space-inset-panel)" data-referrals-primary-surface="availability">
          <p className="theme-label tier-micro uppercase text-foreground/42">Affiliate access</p>
          <h2 className="mt-(--space-2) theme-display text-2xl font-semibold tracking-tight text-foreground">
            Referral and QR access are not enabled yet
          </h2>
          <p className="mt-(--space-3) max-w-2xl text-sm leading-6 text-foreground/58">
            An administrator still needs to enable affiliate capability before this workspace can show your canonical link, QR asset, charts, and milestone feed.
          </p>
        </section>
      </main>
    );
  }

  const metricCards = [
    { label: "Introductions", value: overview?.introductions ?? 0 },
    { label: "Started chats", value: overview?.startedChats ?? 0 },
    { label: "Registered", value: overview?.registered ?? 0 },
    { label: "Qualified opportunities", value: overview?.qualifiedOpportunities ?? 0 },
    { label: "Credit status", value: overview?.creditStatusLabel ?? "No credited referrals yet" },
  ];
  const referralCode = profile.referralCode;
  const referralUrl = profile.referralUrl;
  const qrCodeUrl = profile.qrCodeUrl;
  const ctaCopy = buildCtaCopy(referralUrl);
  const highestTimeseriesValue = Math.max(1, ...timeseries.flatMap((point) => [
    point.introductions,
    point.startedChats,
    point.registered,
    point.qualifiedOpportunities,
  ]));
  const highestPipelineValue = Math.max(1, ...(pipeline?.stages.map((stage) => stage.count) ?? [0]));
  const highestOutcomeValue = Math.max(1, ...(pipeline?.outcomes.map((outcome) => outcome.count) ?? [0]));

  async function handleCopy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setNotice({ kind: "success", message: `${label} copied.` });
    } catch (error) {
      void error;
      setNotice({ kind: "error", message: `Unable to copy ${label.toLowerCase()}.` });
    }
  }

  function handleDownloadQr() {
    downloadFileFromUrl(qrCodeUrl, `referral-${referralCode}.png`);
    setNotice({ kind: "success", message: "Referral QR download started." });
  }

  return (
    <main className="referrals-page-shell mx-auto flex w-full max-w-6xl flex-col gap-(--space-6) px-(--space-frame-default) py-(--space-section-loose) sm:py-(--space-frame-wide)" data-referrals-workspace="true" data-referrals-workspace-state="enabled">
      <header className="referrals-route-header flex flex-col gap-(--space-3)" data-referrals-header="true">
        <p className="theme-label tier-micro uppercase text-foreground/42">Referrals</p>
        <h1 className="theme-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Affiliate dashboard
        </h1>
        <p className="max-w-3xl text-sm leading-6 text-foreground/62 sm:text-base">
          Share your public link or QR, review recent referral milestones, and track how introductions move from first visit through registration, qualified opportunity, and credit review.
        </p>
      </header>

      {notice.kind !== "idle" ? (
        <div className={getNoticeClassName(notice.kind)} data-referrals-notice={notice.kind}>
          {notice.message}
        </div>
      ) : null}

      <section className="referrals-summary-strip grid gap-(--space-3) md:grid-cols-5" data-referrals-summary-strip="true">
        {metricCards.map((card) => (
          <article key={card.label} className="profile-panel-surface referrals-summary-card min-h-28 p-(--space-inset-default) sm:min-h-32 sm:p-(--space-inset-panel)" data-referrals-summary-card="true">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-foreground/38">{card.label}</p>
            <p className="mt-(--space-3) text-2xl font-semibold tracking-tight text-foreground">
              {formatMetricValue(card.value)}
            </p>
          </article>
        ))}
      </section>

      <section className="referrals-primary-grid grid gap-(--space-6) xl:grid-cols-[1.2fr_0.8fr]" data-referrals-primary-grid="true">
        <article className="profile-panel-surface referrals-share-surface p-(--space-inset-default) sm:p-(--space-inset-panel)" data-referrals-primary-surface="share-tools">
          <div className="flex flex-col gap-(--space-2)">
            <p className="theme-label tier-micro uppercase text-foreground/42">Share assets</p>
            <h2 className="theme-display text-2xl font-semibold tracking-tight text-foreground">
              Share the link. Drop the QR.
            </h2>
            <p className="text-sm leading-6 text-foreground/58">
              Copy the canonical link, grab the QR, or use ready-to-send intro text without leaving this workspace.
            </p>
          </div>

          <div className="referrals-share-grid mt-(--space-5) grid gap-(--space-4) lg:mt-(--space-6) lg:grid-cols-[0.85fr_1.15fr]">
            <div className="profile-qr-frame overflow-hidden p-(--space-inset-default)" data-referrals-surface="qr-frame">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrCodeUrl}
                alt={`Referral QR code for ${profile.name}`}
                className="mx-auto h-auto w-full max-w-60"
              />
            </div>

            <div className="grid gap-(--space-4)">
              <div>
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-foreground/38">Referral code</p>
                <div className="mt-(--space-1) flex items-center gap-(--space-2)">
                  <code className="rounded-md bg-background/80 px-(--space-inset-compact) py-(--space-inset-tight) text-sm text-foreground/78">
                    {referralCode}
                  </code>
                  <button
                    type="button"
                    className="profile-inline-action focus-ring rounded-full px-(--space-3) py-(--space-inset-tight) text-xs font-semibold transition-colors"
                    onClick={() => handleCopy(referralCode, "Referral code")}
                  >
                    Copy
                  </button>
                </div>
              </div>

              <div>
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-foreground/38">Referral link</p>
                <div className="mt-(--space-1) flex flex-col gap-(--space-2) sm:flex-row">
                  <input readOnly value={referralUrl} className="input-field referrals-link-field flex-1" />
                  <button
                    type="button"
                    className="profile-inline-action focus-ring rounded-full px-(--space-inset-default) py-(--space-inset-tight) text-xs font-semibold transition-colors"
                    onClick={() => handleCopy(referralUrl, "Referral link")}
                  >
                    Copy link
                  </button>
                </div>
              </div>

              <div>
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-foreground/38">Short CTA copy</p>
                <textarea readOnly value={ctaCopy} className="input-field referrals-cta-field mt-(--space-1) min-h-24 w-full resize-none sm:min-h-28" />
                <button
                  type="button"
                  className="profile-inline-action focus-ring mt-(--space-2) rounded-full px-(--space-inset-default) py-(--space-inset-tight) text-xs font-semibold transition-colors"
                  onClick={() => handleCopy(ctaCopy, "CTA copy")}
                >
                  Copy CTA
                </button>
              </div>

              <div className="referrals-action-row flex flex-wrap gap-(--space-2)">
                <button type="button" className="btn-primary" onClick={handleDownloadQr}>
                  Download QR
                </button>
                <a
                  href={profile.qrCodeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="profile-inline-action focus-ring inline-flex min-h-11 items-center justify-center rounded-full px-(--space-inset-default) py-(--space-inset-tight) text-sm font-semibold transition-colors"
                >
                  Open QR
                </a>
                <a
                  href={profile.referralUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="profile-inline-action focus-ring inline-flex min-h-11 items-center justify-center rounded-full px-(--space-inset-default) py-(--space-inset-tight) text-sm font-semibold transition-colors"
                >
                  Open link
                </a>
              </div>
            </div>
          </div>
        </article>

        <article className="profile-panel-surface referrals-summary-surface p-(--space-inset-default) sm:p-(--space-inset-panel)" data-referrals-primary-surface="summary">
          <p className="theme-label tier-micro uppercase text-foreground/42">Summary</p>
          <h2 className="mt-(--space-2) theme-display text-2xl font-semibold tracking-tight text-foreground">
            What is moving now
          </h2>
          <p className="mt-(--space-3) text-sm leading-6 text-foreground/58">
            {overview?.narrative ?? "No referral activity has been attributed yet."}
          </p>
          <div className="mt-(--space-6) grid gap-(--space-3)">
            <div className="rounded-3xl border border-foreground/10 bg-background/70 p-(--space-inset-default)">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-foreground/38">Credit status</p>
              <p className="mt-(--space-2) text-sm leading-6 text-foreground/64">{overview?.creditStatusLabel ?? "No credit state changes yet."}</p>
            </div>
            <div className="rounded-3xl border border-foreground/10 bg-background/70 p-(--space-inset-default)">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-foreground/38">Recent activity</p>
              <p className="mt-(--space-2) text-sm leading-6 text-foreground/64">
                {recentActivity.length > 0
                  ? `${recentActivity.length} recent milestone${recentActivity.length === 1 ? "" : "s"} are visible below.`
                  : "No referral milestones have been recorded yet. Your link and QR assets are still ready to share."}
              </p>
            </div>
          </div>
        </article>
      </section>

      <section className="referrals-analytics-grid grid gap-(--space-6) xl:grid-cols-3" data-referrals-analytics-grid="true">
        <article className="profile-panel-surface p-(--space-inset-default) sm:p-(--space-inset-panel)">
          <p className="theme-label tier-micro uppercase text-foreground/42">Introductions over time</p>
          <div className="mt-(--space-5) grid gap-(--space-3)">
            {timeseries.length === 0 ? (
              <div className="profile-empty-state p-(--space-inset-default) text-sm leading-6 text-foreground/52">
                No introduction activity is visible yet.
              </div>
            ) : (
              timeseries.map((point) => (
                <div key={point.date} className="grid gap-(--space-1)">
                  <div className="flex items-center justify-between gap-(--space-3) text-xs text-foreground/52">
                    <span>{point.date}</span>
                    <span>{point.introductions} intro{point.introductions === 1 ? "" : "s"}</span>
                  </div>
                  <div className="h-2 rounded-full bg-foreground/8">
                    <div
                      className="h-full rounded-full bg-foreground"
                      style={{ width: `${Math.max(8, Math.round((point.introductions / highestTimeseriesValue) * 100))}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="profile-panel-surface p-(--space-inset-default) sm:p-(--space-inset-panel)">
          <p className="theme-label tier-micro uppercase text-foreground/42">Referred funnel conversion</p>
          <div className="mt-(--space-5) grid gap-(--space-4)">
            {(pipeline?.stages ?? []).map((stage) => (
              <div key={stage.stage} className="grid gap-(--space-1)">
                <div className="flex items-center justify-between gap-(--space-3)">
                  <span className="text-sm text-foreground/72">{stage.label}</span>
                  <span className="text-xs text-foreground/52">{stage.count} • {stage.conversionRate}%</span>
                </div>
                <div className="h-2 rounded-full bg-foreground/8">
                  <div
                    className="h-full rounded-full bg-foreground"
                    style={{ width: `${Math.max(8, Math.round((stage.count / highestPipelineValue) * 100))}%` }}
                  />
                </div>
              </div>
            ))}
            {!pipeline ? (
              <div className="profile-empty-state p-(--space-inset-default) text-sm leading-6 text-foreground/52">
                Funnel stages will appear here once referral activity starts.
              </div>
            ) : null}
          </div>
        </article>

        <article className="profile-panel-surface p-(--space-inset-default) sm:p-(--space-inset-panel)">
          <p className="theme-label tier-micro uppercase text-foreground/42">Recent milestone outcomes</p>
          <div className="mt-(--space-5) grid gap-(--space-4)">
            {(pipeline?.outcomes ?? []).map((outcome) => (
              <div key={outcome.outcome} className="grid gap-(--space-1)">
                <div className="flex items-center justify-between gap-(--space-3)">
                  <span className="text-sm text-foreground/72">{outcome.label}</span>
                  <span className="text-xs text-foreground/52">{outcome.count}</span>
                </div>
                <div className="h-2 rounded-full bg-foreground/8">
                  <div
                    className="h-full rounded-full bg-foreground"
                    style={{ width: `${Math.max(8, Math.round((outcome.count / highestOutcomeValue) * 100))}%` }}
                  />
                </div>
              </div>
            ))}
            {!pipeline ? (
              <div className="profile-empty-state p-(--space-inset-default) text-sm leading-6 text-foreground/52">
                Outcome counts appear after the first referred milestones are recorded.
              </div>
            ) : null}
          </div>
        </article>
      </section>

      <section className="profile-panel-surface referrals-activity-surface p-(--space-inset-default) sm:p-(--space-inset-panel)" data-referrals-primary-surface="activity">
        <div className="flex flex-col gap-(--space-2)">
          <p className="theme-label tier-micro uppercase text-foreground/42">Recent activity</p>
          <h2 className="theme-display text-2xl font-semibold tracking-tight text-foreground">
            Latest referral milestones
          </h2>
        </div>
        <div className="mt-(--space-5) sm:mt-(--space-6)">
          {recentActivity.length === 0 ? (
            <div className="profile-empty-state p-(--space-inset-default) text-sm leading-6 text-foreground/52">
              No attributed referral milestones yet. Share your link or QR code and this feed will fill in automatically.
            </div>
          ) : (
            <ul className="referrals-activity-list grid gap-(--space-3)">
              {recentActivity.map((item) => (
                <li key={item.id} className="rounded-3xl border border-foreground/10 bg-background/70 p-(--space-inset-default)">
                  <div className="flex flex-wrap items-center justify-between gap-(--space-3)">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{item.title}</p>
                      <p className="mt-(--space-1) text-sm leading-6 text-foreground/58">{item.description}</p>
                    </div>
                    <div className="text-right text-xs text-foreground/45">
                      <p>{formatRelativeDate(item.occurredAt)}</p>
                      <p>{item.referralCode}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}
