"use client";

import React from "react";

import type { LifecycleEnvelope, LifecyclePayload } from "@/core/entities/lifecycle";

import { CapabilityCardShell } from "../../primitives/CapabilityCardShell";
import {
  CapabilityTimeline,
  type CapabilityTimelineItem,
} from "../../primitives/CapabilityTimeline";

import {
  LIFECYCLE_EVENT_DESCRIPTOR,
  getLifecycleVariantLabel,
  getLifecycleVariantSubtitle,
} from "./lifecycle-descriptor";

export interface LifecycleCardProps {
  envelope: LifecycleEnvelope;
  className?: string;
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  try {
    return date.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return date.toISOString();
  }
}

function buildTimelineItems(payload: LifecyclePayload): CapabilityTimelineItem[] {
  const items: CapabilityTimelineItem[] = [
    {
      key: "occurred",
      label: getLifecycleVariantLabel(payload.variant),
      status: "succeeded",
      meta: formatTimestamp(payload.occurredAt),
    },
  ];
  if (payload.detail) {
    items.push({
      key: "detail",
      label: payload.detail,
      status: "succeeded",
    });
  }
  return items;
}

export const LifecycleCard: React.FC<LifecycleCardProps> = ({ envelope, className }) => {
  const payload = envelope.payload;
  if (!payload) return null;
  const title = envelope.summary?.title ?? getLifecycleVariantLabel(payload.variant);
  const subtitle = envelope.summary?.subtitle ?? getLifecycleVariantSubtitle(payload.variant);
  const caption = payload.actor ? `${payload.actor} — ${formatTimestamp(payload.occurredAt)}` : formatTimestamp(payload.occurredAt);

  return (
    <CapabilityCardShell
      descriptor={LIFECYCLE_EVENT_DESCRIPTOR}
      state="succeeded"
      cardKind="lifecycle"
      ariaLabel={`Lifecycle event: ${title}`}
      className={className}
    >
      <header className="ui-capability-card-header">
        <p
          className="ui-capability-card-eyebrow"
          data-lifecycle-variant={payload.variant}
        >
          Lifecycle
        </p>
        <h3 className="ui-capability-card-title" data-lifecycle-title="true">
          {title}
        </h3>
        <p className="ui-capability-card-subtitle">{subtitle}</p>
        <p
          className="ui-capability-card-caption"
          data-lifecycle-caption="true"
          data-lifecycle-occurred-at={payload.occurredAt}
        >
          {caption}
        </p>
      </header>
      <CapabilityTimeline title="Event" items={buildTimelineItems(payload)} />
    </CapabilityCardShell>
  );
};
