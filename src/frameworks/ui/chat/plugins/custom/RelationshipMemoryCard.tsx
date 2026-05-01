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

function createContextItems(items: Array<{ label: string; value: React.ReactNode }>) {
  return items.filter((item) => item.value != null && item.value !== false && item.value !== "");
}

function countMemoryEntries(lines: readonly string[]): number {
  return lines.filter((line) => /^\d+\./.test(line)).length || lines.length;
}

export const RelationshipMemoryCard: React.FC<ToolPluginProps> = (props) => {
  const { toolCall, resultEnvelope, part, computedActions = [], onActionClick, descriptor } = props;
  const result = resultEnvelope?.payload ?? toolCall?.result;

  if (!toolCall || typeof result !== "string") {
    return <JobStatusFallbackCard {...props} />;
  }

  const lines = result.split(/\n+/).map((line) => line.trim()).filter(Boolean);

  return (
    <CapabilityCardShell
      descriptor={descriptor}
      state={part?.status ?? "succeeded"}
      ariaLabel="Relationship memory result"
    >
      <CapabilityCardHeader
        eyebrow="Relationship Memory"
        title={resultEnvelope?.summary.title ?? "Continuity memory"}
        statusLabel="Memory matches"
      />
      <p className="ui-capability-card-summary">
        {resultEnvelope?.summary.message ?? lines[0] ?? result}
      </p>
      <CapabilityMetricStrip
        items={[
          { label: "Memories", value: String(countMemoryEntries(lines)) },
          { label: "Surface", value: "Continuity" },
        ]}
      />
      <CapabilityContextPanel
        items={createContextItems([
          {
            label: "Query",
            value: typeof toolCall.args.query === "string" ? toolCall.args.query : null,
          },
          {
            label: "Types",
            value: Array.isArray(toolCall.args.memory_types) ? toolCall.args.memory_types.join(", ") : null,
          },
        ])}
      />
      <CapabilityDisclosure label="Memory details">
        <p className="ui-capability-card-summary whitespace-pre-wrap">{result}</p>
      </CapabilityDisclosure>
      <CapabilityActionRail actions={computedActions} onActionClick={onActionClick} />
    </CapabilityCardShell>
  );
};