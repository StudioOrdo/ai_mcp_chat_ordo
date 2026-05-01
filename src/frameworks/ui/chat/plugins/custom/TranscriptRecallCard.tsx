"use client";

import React from "react";

import type { ToolPluginProps } from "../../registry/types";
import { CapabilityActionRail } from "../../primitives/CapabilityActionRail";
import { CapabilityCardHeader } from "../../primitives/CapabilityCardHeader";
import { CapabilityCardShell } from "../../primitives/CapabilityCardShell";
import { CapabilityContextPanel } from "../../primitives/CapabilityContextPanel";
import { CapabilityDisclosure } from "../../primitives/CapabilityDisclosure";
import { CapabilityMetricStrip } from "../../primitives/CapabilityMetricStrip";
import { JobStatusFallbackCard } from "../system/JobStatusFallbackCard";

function detailValue(value: string | null | undefined): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function createContextItems(items: Array<{ label: string; value: React.ReactNode }>) {
  return items.filter((item) => item.value != null && item.value !== false && item.value !== "");
}

export const TranscriptRecallCard: React.FC<ToolPluginProps> = (props) => {
  const { toolCall, resultEnvelope, part, computedActions = [], onActionClick, descriptor } = props;
  const result = resultEnvelope?.payload ?? toolCall?.result;

  if (!toolCall || typeof result !== "string") {
    return <JobStatusFallbackCard {...props} />;
  }

  const lines = result.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const matchCount = lines.filter((line) => /^\d+\./.test(line)).length || lines.length;

  return (
    <CapabilityCardShell
      descriptor={descriptor}
      state={part?.status ?? "succeeded"}
      ariaLabel="Transcript recall result"
    >
      <CapabilityCardHeader
        eyebrow="Transcript Recall"
        title={resultEnvelope?.summary.title ?? "Past conversation turns"}
        statusLabel="Transcript matches"
      />
      <p className="ui-capability-card-summary">
        {resultEnvelope?.summary.message ?? lines[0] ?? result}
      </p>
      <CapabilityMetricStrip
        items={[
          { label: "Matches", value: String(matchCount) },
          { label: "Surface", value: "Transcript" },
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
      <CapabilityDisclosure label="Transcript excerpts">
        <p className="ui-capability-card-summary whitespace-pre-wrap">{result}</p>
      </CapabilityDisclosure>
      <CapabilityActionRail actions={computedActions} onActionClick={onActionClick} />
    </CapabilityCardShell>
  );
};