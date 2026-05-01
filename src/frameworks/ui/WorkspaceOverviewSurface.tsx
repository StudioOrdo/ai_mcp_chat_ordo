"use client";

import React from "react";

import { ProductExperienceSummary } from "./ProductExperienceSummary";
import { useChatSurfaceState } from "./useChatSurfaceState";
import { useViewTransitionReady } from "@/hooks/useViewTransitionReady";

export function WorkspaceOverviewSurface() {
  const surfaceState = useChatSurfaceState({
    isEmbedded: true,
    surfaceVariant: "workspace",
  });
  const canUseViewTransitions = useViewTransitionReady();
  const summary = surfaceState.contentProps.productExperienceSummary;

  const sectionStyle: React.CSSProperties = {};
  if (canUseViewTransitions) {
    sectionStyle.viewTransitionName = "workspace-overview";
  }

  return (
    <section
      className="relative flex h-full min-h-0 flex-1 flex-col bg-background"
      style={sectionStyle}
      data-workspace-overview="true"
    >
      <div className="relative flex-1 overflow-y-auto py-(--space-3)" data-workspace-overview-body="true">
        {summary ? (
          <ProductExperienceSummary
            summary={summary}
            isEmbedded={true}
            isFullScreen={false}
            onActionClick={surfaceState.handleActionClick}
          />
        ) : (
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-(--space-3) px-(--space-4) py-(--space-6)">
            <div className="rounded-[2rem] border border-foreground/10 bg-background/92 px-(--space-5) py-(--space-5) shadow-[0_32px_110px_-64px_rgba(15,23,42,0.5)]">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-foreground/44">Current work</p>
              <h1 className="mt-(--space-2) text-[1.4rem] font-semibold tracking-[-0.03em] text-foreground">No active workspace snapshot yet.</h1>
              <p className="mt-(--space-2) max-w-2xl text-sm leading-6 text-foreground/72">
                Return to chat to start a thread or reopen an existing conversation. The workspace screen will fill in once the system has conversation context to project.
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}