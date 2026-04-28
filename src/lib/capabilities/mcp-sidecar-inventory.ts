import {
  getMcpProcessMetadata,
  MCP_PROCESS_METADATA,
} from "@/core/capability-catalog/mcp-process-metadata";
import { projectAllCapabilityRuntimeStatics } from "@/core/platform/capability-runtime/CapabilityRuntime";

export interface LocalMcpStdioTargetConfig {
  capabilityName: string;
  processId: string;
  entrypoint: string;
  toolName: string;
}

export interface LocalMcpContainerTargetConfig {
  capabilityName: string;
  processId: string;
  serviceName: string;
  entrypoint: string;
  toolName: string;
  healthcheckToolName: string;
}

export interface McpSidecarInventoryEntry {
  processId: string;
  serverName: string;
  entrypoint: string;
  canonicalCommand: string;
  transports: readonly ("stdio" | "container")[];
  capabilityNames: readonly string[];
  containerServiceName?: string;
  healthcheckToolName?: string;
}

const LOCAL_MCP_STDIO_TARGETS = Object.freeze(
  Object.fromEntries(
    projectAllCapabilityRuntimeStatics().flatMap((runtime) => {
      const target = runtime.localExecutionTargets?.mcpStdio;
      if (!target) {
        return [];
      }

      const process = getMcpProcessMetadata(target.processId);
      return [[runtime.capabilityName, {
        capabilityName: runtime.capabilityName,
        processId: target.processId,
        entrypoint: target.entrypoint ?? process.entrypoint,
        toolName: target.toolName,
      }] as const];
    }),
  ) as Readonly<Record<string, LocalMcpStdioTargetConfig>>,
);

const LOCAL_MCP_CONTAINER_TARGETS = Object.freeze(
  Object.fromEntries(
    projectAllCapabilityRuntimeStatics().flatMap((runtime) => {
      const target = runtime.localExecutionTargets?.mcpContainer;
      if (!target) {
        return [];
      }

      const process = getMcpProcessMetadata(target.processId);
      return [[runtime.capabilityName, {
        capabilityName: runtime.capabilityName,
        processId: target.processId,
        serviceName: target.serviceName,
        entrypoint: target.entrypoint ?? process.entrypoint,
        toolName: target.toolName ?? runtime.capabilityName,
        healthcheckToolName: target.healthcheckToolName ?? runtime.capabilityName,
      }] as const];
    }),
  ) as Readonly<Record<string, LocalMcpContainerTargetConfig>>,
);

export function getLocalMcpStdioTarget(capabilityName: string): LocalMcpStdioTargetConfig | null {
  return LOCAL_MCP_STDIO_TARGETS[capabilityName] ?? null;
}

export function getLocalMcpContainerTarget(capabilityName: string): LocalMcpContainerTargetConfig | null {
  return LOCAL_MCP_CONTAINER_TARGETS[capabilityName] ?? null;
}

export function getCanonicalMcpSidecarInventory(): McpSidecarInventoryEntry[] {
  return MCP_PROCESS_METADATA.map((process) => {
    const stdioTargets = Object.values(LOCAL_MCP_STDIO_TARGETS)
      .filter((target) => target.processId === process.id);
    const containerTargets = Object.values(LOCAL_MCP_CONTAINER_TARGETS)
      .filter((target) => target.processId === process.id);
    const transports = [
      ...(stdioTargets.length > 0 || process.entrypoint ? ["stdio" as const] : []),
      ...(containerTargets.length > 0 ? ["container" as const] : []),
    ];
    const capabilityNames = [...new Set([
      ...stdioTargets.map((target) => target.capabilityName),
      ...containerTargets.map((target) => target.capabilityName),
    ])].sort((left, right) => left.localeCompare(right));
    const primaryContainerTarget = containerTargets[0];

    return {
      processId: process.id,
      serverName: process.serverName,
      entrypoint: process.entrypoint,
      canonicalCommand: process.canonicalCommand,
      transports,
      capabilityNames,
      containerServiceName: primaryContainerTarget?.serviceName,
      healthcheckToolName: primaryContainerTarget?.healthcheckToolName,
    };
  });
}