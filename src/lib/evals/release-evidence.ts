import fs from "node:fs";
import path from "node:path";

import type {
  ReferralOperationalDiagnostics,
  ReleaseManifestReport,
} from "@/lib/admin/processes";
import {
  getHealthSweepReport,
  getReferralOperationalDiagnostics,
  getReleaseManifestReport,
} from "@/lib/admin/processes";
import {
  readConversationRefactorEvidenceFromFile,
  type ConversationRefactorPhase00Evidence,
} from "./conversation-refactor-evidence";
import {
  readPhase11ToolInvocationEvidenceFromFile,
  validatePhase11ToolInvocationEvidence,
  type Phase11ToolInvocationQaEvidence,
} from "./phase-11-tool-invocation-evidence";
import type { StagingCanarySummary } from "./staging-canary";
import {
  readRuntimeIntegrityQaEvidenceFromFile,
  type RuntimeIntegrityQaEvidence,
} from "./runtime-integrity-evidence";

type ConversationRefactorEvidenceClassification = "missing" | "historical_baseline" | "final_closure";
type HealthSweepReport = Awaited<ReturnType<typeof getHealthSweepReport>>;

export interface ReleaseEvidence {
  version: 1;
  generatedAt: string;
  status: "approved" | "conditional" | "blocked";
  manifest: ReleaseManifestReport;
  health: HealthSweepReport;
  referralDiagnostics: ReferralOperationalDiagnostics;
  runtimeIntegrity: {
    present: boolean;
    artifactPath: string;
    evidence: RuntimeIntegrityQaEvidence | null;
  };
  toolInvocation: {
    present: boolean;
    artifactPath: string;
    evidence: Phase11ToolInvocationQaEvidence | null;
  };
  conversationRefactor: {
    present: boolean;
    artifactPath: string;
    classification: ConversationRefactorEvidenceClassification;
    evidence: ConversationRefactorPhase00Evidence | null;
  };
  eliteOps: {
    present: boolean;
    status: "passed" | "failed" | null;
    sourceArtifactPath: string;
    architectureDriftStatus: "passed" | "failed" | null;
    rbacMatrixStatus: "passed" | "failed" | null;
    latencyBudgetStatus: "passed" | "failed" | null;
    failureModeStatus: "passed" | "failed" | null;
    blockingReasons: string[];
    warnings: string[];
  };
  canary: {
    present: boolean;
    artifactPath: string;
    summary: StagingCanarySummary | null;
  };
  review: {
    blockingReasons: string[];
    warnings: string[];
    manualChecks: string[];
  };
}

interface CreateReleaseEvidenceOptions {
  manifest?: ReleaseManifestReport;
  health?: HealthSweepReport;
  referralDiagnostics?: ReferralOperationalDiagnostics;
  runtimeIntegrityEvidence?: RuntimeIntegrityQaEvidence | null;
  toolInvocationEvidence?: Phase11ToolInvocationQaEvidence | null;
  conversationRefactorEvidence?: ConversationRefactorPhase00Evidence | null;
  canarySummary?: StagingCanarySummary | null;
  warnings?: string[];
  manualChecks?: string[];
  now?: Date;
  runtimeIntegrityArtifactPath?: string;
  toolInvocationArtifactPath?: string;
  conversationRefactorArtifactPath?: string;
  canaryArtifactPath?: string;
}

interface WriteReleaseEvidenceArtifactsOptions extends CreateReleaseEvidenceOptions {
  releaseDir?: string;
}

function serializeJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function uniqueNonEmpty(values: string[] | undefined): string[] {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];
}

function classifyConversationRefactorEvidence(
  evidence: ConversationRefactorPhase00Evidence | null,
): ConversationRefactorEvidenceClassification {
  if (!evidence) {
    return "missing";
  }

  if (evidence.phase === "00-02B" || evidence.bundleId.includes("phase-00-02b")) {
    return "historical_baseline";
  }

  return "final_closure";
}

function createUnavailableHealthSweep(now: Date): HealthSweepReport {
  return {
    status: "error",
    generatedAt: now.toISOString(),
    liveness: {
      status: "ok",
      checks: {
        config: "ok",
        model: "ok",
      },
    },
    readiness: {
      status: "error",
      checks: {
        config: "error",
        model: "error",
      },
      details: "Health sweep was not provided to synchronous release evidence generation.",
    },
    appliance: {
      status: "unknown",
      generatedAt: now.toISOString(),
      profile: {
        profileId: "unknown",
        processRole: "unknown",
        nodeEnv: "production",
        isDocker: false,
        isCompose: false,
        dataDir: "",
        sqlitePath: "",
        sqliteInsideDataDir: false,
        mediaWorker: {
          mode: "disabled",
          url: null,
          port: null,
          disabled: true,
        },
        deferredWorker: {
          mode: "unavailable",
          disabled: true,
          workerId: null,
        },
        warnings: ["Health sweep was not provided."],
      },
      dataBoundary: {
        dataDir: "",
        sqlitePath: "",
        sqliteWalPath: "",
        sqliteShmPath: "",
        sqliteInsideDataDir: false,
        defaultSqlitePath: "",
        blogAssetRoot: "",
        blogAssetRootInsideDataDir: false,
        userFileRoot: "",
        userFileRootInsideDataDir: false,
        requiredIncludePaths: [],
        defaultExcludePaths: [],
        warnings: ["Health sweep was not provided."],
      },
      providerDiagnostics: {
        intelligence: {
          provider: "unknown",
          providerSource: "default",
          model: "",
          modelSource: "default",
          apiKeyConfigured: false,
          apiKeySource: "default",
          baseUrlConfigured: false,
          baseUrlSource: "default",
          warningCodes: ["health_sweep_missing"],
        },
        capabilities: [],
        toolSummary: {
          total: 0,
          byState: {},
          protectedCount: 0,
          staticLockedCount: 0,
          providerGatedCount: 0,
          warnings: 1,
        },
      },
      components: [],
      summary: {
        healthy: 0,
        degraded: 0,
        blocked: 0,
        disabled: 0,
        unknown: 0,
      },
      warnings: ["Health sweep was not provided."],
    },
  };
}

export function createReleaseEvidence(options: CreateReleaseEvidenceOptions = {}): ReleaseEvidence {
  const now = options.now ?? new Date();
  const manifest = options.manifest ?? getReleaseManifestReport();
  const health = options.health ?? createUnavailableHealthSweep(now);
  const referralDiagnostics = options.referralDiagnostics ?? getReferralOperationalDiagnostics();
  const runtimeIntegrityEvidence = options.runtimeIntegrityEvidence ?? null;
  const toolInvocationEvidence = options.toolInvocationEvidence ?? null;
  const conversationRefactorEvidence = options.conversationRefactorEvidence ?? null;
  const canarySummary = options.canarySummary ?? null;
  const warnings = uniqueNonEmpty([...(options.warnings ?? []), ...referralDiagnostics.warnings]);
  const manualChecks = uniqueNonEmpty(options.manualChecks);
  const blockingReasons: string[] = [];
  const toolInvocationErrors = toolInvocationEvidence
    ? validatePhase11ToolInvocationEvidence(toolInvocationEvidence)
    : ["Phase 11 tool invocation QA evidence is missing."];

  if (!manifest.present) {
    blockingReasons.push(manifest.error ?? "Release manifest is missing.");
  }

  if (health.status === "error") {
    blockingReasons.push("Health sweep reported an error.");
  }

  if (!runtimeIntegrityEvidence) {
    blockingReasons.push("Runtime integrity QA evidence is missing.");
  } else if (runtimeIntegrityEvidence.status !== "passed") {
    blockingReasons.push("Runtime integrity QA evidence contains blockers.");
  }

  if (!toolInvocationEvidence) {
    blockingReasons.push("Phase 11 tool invocation QA evidence is missing.");
  } else if (toolInvocationErrors.length > 0) {
    blockingReasons.push("Phase 11 tool invocation QA evidence contains blockers.");
  }

  if (!runtimeIntegrityEvidence?.eliteOps) {
    blockingReasons.push("Elite ops evidence summary is missing from runtime integrity QA evidence.");
  } else if (runtimeIntegrityEvidence.eliteOps.status !== "passed") {
    blockingReasons.push("Elite ops release gates reported blockers.");
  }

  if (!canarySummary) {
    blockingReasons.push("Staging canary summary is missing.");
  } else if (canarySummary.failedScenarioCount > 0 || canarySummary.status !== "passed") {
    blockingReasons.push("One or more staging canary scenarios failed.");
  }

  if (!referralDiagnostics.knownReferrerPromptVerified || !referralDiagnostics.missingReferrerPromptVerified) {
    blockingReasons.push("Referral identity verification checks failed.");
  }

  const status = blockingReasons.length > 0
    ? "blocked"
    : warnings.length > 0 || manualChecks.length > 0
      ? "conditional"
      : "approved";

  return {
    version: 1,
    generatedAt: now.toISOString(),
    status,
    manifest,
    health,
    referralDiagnostics,
    runtimeIntegrity: {
      present: runtimeIntegrityEvidence !== null,
      artifactPath: options.runtimeIntegrityArtifactPath ?? "release/runtime-integrity-evidence.json",
      evidence: runtimeIntegrityEvidence,
    },
    toolInvocation: {
      present: toolInvocationEvidence !== null,
      artifactPath: options.toolInvocationArtifactPath ?? "release/phase-11-tool-invocation-evidence.json",
      evidence: toolInvocationEvidence,
    },
    conversationRefactor: {
      present: conversationRefactorEvidence !== null,
      artifactPath: options.conversationRefactorArtifactPath ?? "release/conversation-refactor-evidence.json",
      classification: classifyConversationRefactorEvidence(conversationRefactorEvidence),
      evidence: conversationRefactorEvidence,
    },
    eliteOps: {
      present: Boolean(runtimeIntegrityEvidence?.eliteOps),
      status: runtimeIntegrityEvidence?.eliteOps?.status ?? null,
      sourceArtifactPath: options.runtimeIntegrityArtifactPath ?? "release/runtime-integrity-evidence.json",
      architectureDriftStatus: runtimeIntegrityEvidence?.eliteOps?.architectureDrift.status ?? null,
      rbacMatrixStatus: runtimeIntegrityEvidence?.eliteOps?.rbacMatrix.status ?? null,
      latencyBudgetStatus: runtimeIntegrityEvidence?.eliteOps?.latencyBudgets.status ?? null,
      failureModeStatus: runtimeIntegrityEvidence?.eliteOps?.failureModes.status ?? null,
      blockingReasons: runtimeIntegrityEvidence?.eliteOps?.blockingReasons ?? [],
      warnings: runtimeIntegrityEvidence?.eliteOps?.warnings ?? [],
    },
    canary: {
      present: canarySummary !== null,
      artifactPath: options.canaryArtifactPath ?? "release/canary-summary.json",
      summary: canarySummary,
    },
    review: {
      blockingReasons,
      warnings,
      manualChecks,
    },
  };
}

export function validateReleaseEvidence(evidence: ReleaseEvidence): string[] {
  const errors: string[] = [];

  if (!evidence.manifest.present) {
    errors.push("Release manifest evidence is missing.");
  }

  if (evidence.health.status === "error") {
    errors.push("Health evidence reported an error.");
  }

  if (!evidence.runtimeIntegrity.present || !evidence.runtimeIntegrity.evidence) {
    errors.push("Runtime integrity QA evidence is missing.");
  }

  if (evidence.runtimeIntegrity.evidence && evidence.runtimeIntegrity.evidence.status !== "passed") {
    errors.push("Runtime integrity QA evidence contains blockers.");
  }

  if (!evidence.toolInvocation.present || !evidence.toolInvocation.evidence) {
    errors.push("Phase 11 tool invocation QA evidence is missing.");
  }

  if (evidence.toolInvocation.evidence) {
    errors.push(...validatePhase11ToolInvocationEvidence(evidence.toolInvocation.evidence));
  }

  if (!evidence.eliteOps.present || evidence.eliteOps.status === null) {
    errors.push("Elite ops evidence summary is missing.");
  }

  if (evidence.eliteOps.status === "failed") {
    errors.push("Elite ops release gates reported blockers.");
  }

  if (!evidence.referralDiagnostics.knownReferrerPromptVerified || !evidence.referralDiagnostics.missingReferrerPromptVerified) {
    errors.push("Referral identity verification evidence failed.");
  }

  if (!evidence.canary.present || !evidence.canary.summary) {
    errors.push("Staging canary evidence is missing.");
  }

  if (evidence.canary.summary && evidence.canary.summary.failedScenarioCount > 0) {
    errors.push("Staging canary evidence contains failed scenarios.");
  }

  return errors;
}

export function readCanarySummaryFromFile(filePath: string): StagingCanarySummary | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(filePath, "utf8")) as StagingCanarySummary;
}

export function readRuntimeIntegrityEvidenceFromFile(filePath: string): RuntimeIntegrityQaEvidence | null {
  return readRuntimeIntegrityQaEvidenceFromFile(filePath);
}

export async function writeReleaseEvidenceArtifacts(options: WriteReleaseEvidenceArtifactsOptions = {}): Promise<{
  runtimeIntegrityPath: string;
  toolInvocationPath: string;
  conversationRefactorPath: string;
  canarySummaryPath: string;
  qaEvidencePath: string;
  evidence: ReleaseEvidence;
}> {
  const releaseDir = options.releaseDir ?? path.join(process.cwd(), "release");
  const runtimeIntegrityPath = path.join(releaseDir, "runtime-integrity-evidence.json");
  const toolInvocationPath = path.join(releaseDir, "phase-11-tool-invocation-evidence.json");
  const conversationRefactorPath = path.join(releaseDir, "conversation-refactor-evidence.json");
  const canarySummaryPath = path.join(releaseDir, "canary-summary.json");
  const qaEvidencePath = path.join(releaseDir, "qa-evidence.json");
  const runtimeIntegrityEvidence = options.runtimeIntegrityEvidence ?? readRuntimeIntegrityQaEvidenceFromFile(runtimeIntegrityPath);
  const toolInvocationEvidence = options.toolInvocationEvidence ?? readPhase11ToolInvocationEvidenceFromFile(toolInvocationPath);
  const conversationRefactorEvidence = options.conversationRefactorEvidence
    ?? readConversationRefactorEvidenceFromFile(conversationRefactorPath);
  const canarySummary = options.canarySummary ?? readCanarySummaryFromFile(canarySummaryPath);
  const health = options.health ?? await getHealthSweepReport();
  const evidence = createReleaseEvidence({
    ...options,
    health,
    runtimeIntegrityEvidence,
    runtimeIntegrityArtifactPath: path.relative(process.cwd(), runtimeIntegrityPath),
    toolInvocationEvidence,
    toolInvocationArtifactPath: path.relative(process.cwd(), toolInvocationPath),
    conversationRefactorEvidence,
    conversationRefactorArtifactPath: path.relative(process.cwd(), conversationRefactorPath),
    canarySummary,
    canaryArtifactPath: path.relative(process.cwd(), canarySummaryPath),
  });

  fs.mkdirSync(releaseDir, { recursive: true });

  if (runtimeIntegrityEvidence) {
    fs.writeFileSync(runtimeIntegrityPath, serializeJson(runtimeIntegrityEvidence), "utf8");
  }

  if (toolInvocationEvidence) {
    fs.writeFileSync(toolInvocationPath, serializeJson(toolInvocationEvidence), "utf8");
  }

  if (conversationRefactorEvidence) {
    fs.writeFileSync(conversationRefactorPath, serializeJson(conversationRefactorEvidence), "utf8");
  }

  if (canarySummary) {
    fs.writeFileSync(canarySummaryPath, serializeJson(canarySummary), "utf8");
  }

  fs.writeFileSync(qaEvidencePath, serializeJson(evidence), "utf8");

  return {
    runtimeIntegrityPath,
    toolInvocationPath,
    conversationRefactorPath,
    canarySummaryPath,
    qaEvidencePath,
    evidence,
  };
}
