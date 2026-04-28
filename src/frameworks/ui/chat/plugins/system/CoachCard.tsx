"use client";

import React from "react";
import Link from "next/link";

import type { CoachEnvelope, CoachPayload } from "@/core/entities/coach";

import { CapabilityCardShell } from "../../primitives/CapabilityCardShell";
import {
  CapabilityTimeline,
  type CapabilityTimelineItem,
} from "../../primitives/CapabilityTimeline";

import { COACH_DESCRIPTOR } from "./coach-descriptor";

export interface CoachCardProps {
  envelope: CoachEnvelope;
  className?: string;
}

function buildTimelineItems(payload: CoachPayload): CapabilityTimelineItem[] {
  return payload.steps.map((step, index) => ({
    key: step.key,
    label: step.label,
    status: step.status === "succeeded"
      ? "succeeded"
      : index === payload.currentStep
        ? "active"
        : "pending",
    meta: step.detail ?? null,
  }));
}

export const CoachCard: React.FC<CoachCardProps> = ({ envelope, className }) => {
  const payload = envelope.payload;
  if (!payload) return null;
  const title = envelope.summary?.title ?? payload.title;
  const subtitle = envelope.summary?.subtitle ?? payload.subtitle;

  return (
    <CapabilityCardShell
      descriptor={COACH_DESCRIPTOR}
      state="running"
      cardKind="lifecycle"
      ariaLabel={`Coach: ${title}`}
      className={className}
    >
      <header className="ui-capability-card-header">
        <p
          className="ui-capability-card-eyebrow"
          data-coach-variant={payload.variant}
        >
          Next steps
        </p>
        <h3 className="ui-capability-card-title" data-coach-title="true">
          {title}
        </h3>
        {subtitle ? (
          <p className="ui-capability-card-subtitle">{subtitle}</p>
        ) : null}
      </header>
      <CapabilityTimeline title="Steps" items={buildTimelineItems(payload)} />
      {payload.actions.length > 0 ? (
        <nav
          className="ui-capability-card-actions"
          data-coach-actions="true"
          aria-label="Coach actions"
        >
          {payload.actions.map((action) => {
            if (action.kind === "navigate" && action.href) {
              return (
                <Link
                  key={action.key}
                  href={action.href}
                  className="ui-action-link"
                  data-coach-action-kind="navigate"
                  data-coach-action-key={action.key}
                >
                  {action.label}
                </Link>
              );
            }
            return (
              <button
                key={action.key}
                type="button"
                className="ui-action-link"
                data-coach-action-kind={action.kind}
                data-coach-action-key={action.key}
                data-coach-action-tool={action.toolName ?? undefined}
              >
                {action.label}
              </button>
            );
          })}
        </nav>
      ) : null}
    </CapabilityCardShell>
  );
};
