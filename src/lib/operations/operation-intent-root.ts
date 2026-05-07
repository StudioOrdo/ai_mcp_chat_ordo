import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";

import type { RoleName } from "@/core/entities/user";
import type { ConversationRoutingSnapshot } from "@/core/entities/conversation-routing";
import type {
  OperationGateFact,
  OperationGateSnapshot,
  OperationIntentCompilerInput,
} from "@/core/use-cases/operations/OperationIntent";
import type { OperationPromptGroundingSnapshot } from "@/core/use-cases/operations/OperationPromptGrounding";
import { OperationDraftFactory } from "@/core/use-cases/operations/OperationDraftFactory";
import { OperationIntentPolicy } from "@/core/use-cases/operations/OperationIntentPolicy";
import { OperationIntentRouter } from "@/core/use-cases/operations/OperationIntentRouter";
import { createDefaultOperationKindRegistry } from "@/core/use-cases/operations/OperationKindRegistry";
import { getOperationRepository } from "@/adapters/RepositoryFactory";
import { getToolAvailabilityService } from "@/lib/tools/tool-availability-service";
import type { EffectiveToolManifest } from "@/lib/tools/tool-policy-types";
import { ResourcePressureService } from "@/lib/appliance/resources/resource-pressure-service";
import { getNativeBinaryStatus } from "@/lib/appliance/native/native-binary-registry";
import { DeterministicOperationIntentCompiler } from "@/lib/operations/operation-intent-compiler";
import {
  OperationIntentIngress,
  type OperationIntentIngressDeps,
} from "@/lib/operations/operation-intent-ingress";

export interface BuildOperationIntentCompilerInputOptions {
  conversationId: string;
  originMessageId: string | null;
  userId: string;
  role: RoleName;
  latestUserText: string;
  latestUserContent: string;
  routingSnapshot: ConversationRoutingSnapshot;
  attachments?: readonly unknown[];
  taskOriginHandoff?: unknown | null;
  mediaContinuityHandoff?: unknown | null;
  now?: string;
  env?: Record<string, string | undefined>;
  fileExists?: (filePath: string) => boolean;
  resourcePressureService?: ResourcePressureService;
  toolManifest?: EffectiveToolManifest;
  availableToolNames?: readonly string[];
  gateSnapshot?: OperationGateSnapshot;
  operationGrounding?: OperationPromptGroundingSnapshot | null;
  providerCapabilitySummary?: Record<string, unknown>;
}

export function createOperationIntentIngress(
  overrides: Partial<OperationIntentIngressDeps> = {},
): OperationIntentIngress {
  const registry = createDefaultOperationKindRegistry();
  const repository = getOperationRepository();
  return new OperationIntentIngress({
    compiler: new DeterministicOperationIntentCompiler(),
    router: new OperationIntentRouter({
      repository,
      kindRegistry: registry,
      policy: new OperationIntentPolicy(registry),
      draftFactory: new OperationDraftFactory((prefix) => `${prefix}_${randomUUID()}`, registry),
    }),
    ...overrides,
  });
}

export async function buildOperationIntentCompilerInput(
  options: BuildOperationIntentCompilerInputOptions,
): Promise<OperationIntentCompilerInput> {
  const manifest = options.toolManifest ?? getToolAvailabilityService().getEffectiveManifestSync();
  const availableToolNames = options.availableToolNames
    ?? getToolAvailabilityService().getAvailableRoleToolNames(manifest, { role: options.role });
  const now = options.now ?? new Date().toISOString();
  const gateSnapshot = options.gateSnapshot ?? await buildDefaultGateSnapshot({
    now,
    env: options.env,
    fileExists: options.fileExists,
    resourcePressureService: options.resourcePressureService,
  });

  return {
    conversationId: options.conversationId,
    originMessageId: options.originMessageId,
    userId: options.userId,
    role: options.role,
    latestUserText: options.latestUserText,
    latestUserContent: options.latestUserContent,
    routingSnapshot: options.routingSnapshot,
    attachments: options.attachments ?? [],
    taskOriginHandoff: options.taskOriginHandoff ?? null,
    mediaContinuityHandoff: options.mediaContinuityHandoff ?? null,
    effectiveToolManifestVersion: manifest.version,
    availableToolNames,
    providerCapabilitySummary: options.providerCapabilitySummary ?? summarizeProviderCapabilities(manifest),
    gateSnapshot,
    operationGrounding: options.operationGrounding ?? null,
    now,
  };
}

export async function buildDefaultGateSnapshot(options: {
  now: string;
  env?: Record<string, string | undefined>;
  fileExists?: (filePath: string) => boolean;
  resourcePressureService?: ResourcePressureService;
}): Promise<OperationGateSnapshot> {
  const gates: OperationGateFact[] = [
    buildBackupExecutorGate({
      env: options.env,
      fileExists: options.fileExists,
    }),
    buildMediaRuntimeGate({
      env: options.env,
    }),
  ].filter((gate): gate is OperationGateFact => Boolean(gate));

  const resourceGate = await buildResourceGate(options.resourcePressureService);
  if (resourceGate) {
    gates.push(resourceGate);
  }

  return {
    generatedAt: options.now,
    gates,
  };
}

function buildMediaRuntimeGate(input: {
  env?: Record<string, string | undefined>;
}): OperationGateFact | null {
  const env = input.env ?? process.env;
  const affectedOperationKinds = ["media_workflow"] as const;
  const affectedCapabilities = [
    "generate_audio",
    "compose_media",
    "generate_blog_image",
  ];

  if (env.DISABLE_MEDIA_WORKER === "1" || env.DISABLE_MEDIA_WORKER === "true") {
    return {
      id: "worker:media",
      state: "blocked",
      source: "media_worker_probe",
      summary: "Media worker is disabled.",
      remediation: "Unset DISABLE_MEDIA_WORKER before creating media workflow operations.",
      affectedOperationKinds,
      affectedCapabilities,
      metadata: { mediaWorkerDisabled: true },
    };
  }

  if (env.DISABLE_MEDIA_COMPOSITION === "1" || env.DISABLE_MEDIA_COMPOSITION === "true") {
    return {
      id: "runtime:media-composition",
      state: "blocked",
      source: "ffmpeg_capability_probe",
      summary: "Media composition runtime is disabled.",
      remediation: "Unset DISABLE_MEDIA_COMPOSITION before composing media.",
      affectedOperationKinds,
      affectedCapabilities: ["compose_media"],
      metadata: { mediaCompositionDisabled: true },
    };
  }

  return null;
}

function buildBackupExecutorGate(input: {
  env?: Record<string, string | undefined>;
  fileExists?: (filePath: string) => boolean;
}): OperationGateFact | null {
  const env = input.env ?? process.env;
  const fileExists = input.fileExists ?? existsSync;
  const executor = getNativeBinaryStatus("ordo-backup", {
    env,
    exists: fileExists,
    executable: fileExists,
  });
  const affectedOperationKinds = ["backup_create", "restore_execute"] as const;
  const affectedCapabilities = [
    "create_appliance_backup",
    "prepare_appliance_restore",
    "request_pre_restore_backup",
    "execute_appliance_restore",
  ];

  if (executor.disabled) {
    return {
      id: "executor:ordo-backup",
      state: "blocked",
      source: "backup_restore_probe",
      summary: executor.summary,
      remediation: executor.remediation ?? undefined,
      affectedOperationKinds,
      affectedCapabilities,
      metadata: { executorPath: executor.path, executorDisabled: true },
    };
  }

  if (!executor.available) {
    return {
      id: "executor:ordo-backup",
      state: "blocked",
      source: "backup_restore_probe",
      summary: `${executor.summary} Path: ${executor.path}.`,
      remediation: executor.remediation ?? undefined,
      affectedOperationKinds,
      affectedCapabilities,
      metadata: {
        executorPath: executor.path,
        executorAvailable: false,
        executorExecutable: executor.executable,
      },
    };
  }

  return {
    id: "executor:ordo-backup",
    state: "available",
    source: "backup_restore_probe",
    summary: "Backup executor binary is available.",
    affectedOperationKinds,
    affectedCapabilities,
    metadata: { executorPath: executor.path, executorAvailable: true, executorExecutable: executor.executable },
  };
}

async function buildResourceGate(
  resourcePressureService = new ResourcePressureService(),
): Promise<OperationGateFact | null> {
  try {
    const pressure = await resourcePressureService.getResourcePressureSummary();
    if (pressure.status === "healthy") {
      return null;
    }

    return {
      id: "resource:data-volume",
      state: pressure.status === "blocked" ? "blocked" : "warning",
      source: "resource_pressure",
      summary: pressure.summary,
      remediation: pressure.remediation,
      affectedOperationKinds: ["backup_create", "restore_execute", "media_workflow"],
      metadata: pressure.metadata,
    };
  } catch (error) {
    return {
      id: "resource:data-volume",
      state: "unknown",
      source: "resource_pressure",
      summary: "Writable data volume resource pressure could not be checked.",
      remediation: error instanceof Error ? error.message : String(error),
      affectedOperationKinds: ["backup_create", "restore_execute", "media_workflow"],
    };
  }
}

function summarizeProviderCapabilities(manifest: EffectiveToolManifest): Record<string, unknown> {
  return {
    providerBackedTools: manifest.tools
      .filter((tool) => tool.providerCapabilitySlot)
      .map((tool) => ({
        name: tool.name,
        slot: tool.providerCapabilitySlot,
        state: tool.providerCapabilityState,
        provider: tool.providerCapabilityProvider,
      })),
  };
}
