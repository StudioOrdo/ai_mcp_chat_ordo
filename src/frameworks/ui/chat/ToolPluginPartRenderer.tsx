"use client";

import { createElement, useMemo } from "react";
import { projectCapabilityResultEnvelope } from "@/lib/capabilities/capability-result-envelope";
import { CapabilityErrorCard } from "./plugins/system/CapabilityErrorCard";
import { resolveSystemCardKind } from "./plugins/system/resolve-system-card";
import { useToolPluginRegistry } from "./registry/ToolPluginContext";
import type { ToolPluginProps } from "./registry/types";
import type { InlineNode } from "@/core/entities/rich-content";

/**
 * Wrapper component that resolves the correct plugin for a tool part or tool call.
 * Exists to keep the useToolPluginRegistry() call inside a component body,
 * not inside a .map() loop in AssistantBubble.
 */
export function ToolPluginPartRenderer(props: ToolPluginProps) {
  const {
    part,
    toolCall,
    descriptor: providedDescriptor,
    resultEnvelope: providedResultEnvelope,
    isStreaming,
    onActionClick,
    computedActions,
  } = props;
  const registry = useToolPluginRegistry();
  const toolName = toolCall?.name ?? part?.toolName ?? "";
  const descriptor = useMemo(
    () => providedDescriptor ?? registry.getDescriptor(toolName),
    [providedDescriptor, registry, toolName],
  );
  const resultEnvelope = useMemo(() => {
    if (!toolName) {
      return null;
    }

    const baseEnvelope = providedResultEnvelope
      ?? part?.resultEnvelope
      ?? projectCapabilityResultEnvelope({
        toolName,
        payload: toolCall?.result ?? part?.resultPayload ?? null,
        inputSnapshot: toolCall?.args,
        descriptor,
        executionMode: part
          ? (part.resultEnvelope?.executionMode ?? descriptor?.executionMode ?? "deferred")
          : descriptor?.executionMode,
      });

    return projectCapabilityResultEnvelope({
      toolName,
      payload: baseEnvelope ?? toolCall?.result ?? part?.resultPayload ?? null,
      inputSnapshot: toolCall?.args,
      descriptor,
      executionMode: part
        ? (baseEnvelope?.executionMode ?? descriptor?.executionMode ?? "deferred")
        : descriptor?.executionMode,
      summary: part
        ? {
            title: part.title,
            subtitle: part.subtitle,
            statusLine:
              part.status === "queued" || part.status === "running" || part.status === "failed" || part.status === "canceled"
                ? part.status
                : undefined,
            message: part.error ?? part.summary,
          }
        : undefined,
      progress:
        part && (
          part.progressPercent != null
          || part.progressLabel
          || baseEnvelope?.progress?.phases
          || baseEnvelope?.progress?.activePhaseKey !== undefined
        )
          ? {
              percent: part.progressPercent ?? baseEnvelope?.progress?.percent,
              label: part.progressLabel ?? baseEnvelope?.progress?.label,
              phases: baseEnvelope?.progress?.phases,
              activePhaseKey: baseEnvelope?.progress?.activePhaseKey,
            }
          : baseEnvelope?.progress,
      replaySnapshot: baseEnvelope?.replaySnapshot,
      artifacts: baseEnvelope?.artifacts,
    });
  }, [descriptor, part, providedResultEnvelope, toolCall, toolName]);
  const effectiveToolCall = useMemo(() => {
    if (toolCall) {
      return {
        ...toolCall,
        result: resultEnvelope?.payload ?? toolCall.result,
      };
    }

    if (!part || (part.resultPayload == null && resultEnvelope?.payload == null)) {
      return undefined;
    }

    return {
      name: part.toolName,
      args: {},
      result: resultEnvelope?.payload ?? part.resultPayload,
      toolInvocationId: part.toolInvocationId,
    };
  }, [part, resultEnvelope, toolCall]);
  const effectiveActions = useMemo(
    () => computedActions ?? extractResultActions(resultEnvelope?.payload),
    [computedActions, resultEnvelope],
  );
  const Plugin = useMemo(
    () => registry.getRenderer(toolName),
    [registry, toolName],
  );
  const systemCardKind = useMemo(
    () => resolveSystemCardKind({ part, toolCall: effectiveToolCall, descriptor, resultEnvelope }),
    [descriptor, effectiveToolCall, part, resultEnvelope],
  );

  if (systemCardKind === "error") {
    const element = createElement(CapabilityErrorCard, {
      part,
      toolCall: effectiveToolCall,
      computedActions: effectiveActions,
      descriptor,
      resultEnvelope,
      isStreaming,
      onActionClick,
    });
    const toolInvocationId = part?.toolInvocationId ?? effectiveToolCall?.toolInvocationId;
    return toolInvocationId
      ? createElement("div", { "data-tool-invocation-id": toolInvocationId }, element)
      : element;
  }

  const element = createElement(Plugin, {
    part,
    toolCall: effectiveToolCall,
    computedActions: effectiveActions,
    descriptor,
    resultEnvelope,
    isStreaming,
    onActionClick,
  });
  const toolInvocationId = part?.toolInvocationId ?? effectiveToolCall?.toolInvocationId;
  return toolInvocationId
    ? createElement("div", { "data-tool-invocation-id": toolInvocationId }, element)
    : element;
}

function extractResultActions(payload: unknown): InlineNode[] | undefined {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return undefined;
  }
  const actions = (payload as { actions?: unknown }).actions;
  if (!Array.isArray(actions)) {
    return undefined;
  }
  const actionNodes = actions.filter((action): action is InlineNode =>
    typeof action === "object"
    && action !== null
    && !Array.isArray(action)
    && (action as { type?: unknown }).type === "action-link",
  );
  return actionNodes.length > 0 ? actionNodes : undefined;
}
