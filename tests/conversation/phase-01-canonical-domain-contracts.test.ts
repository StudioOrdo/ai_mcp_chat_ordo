import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { hasBlockingWorkflowHealth, type BusinessWorkflowContext } from "@/core/entities/business-workflow-context";
import { createSourceRef, isUserOwned, type BusinessObjectRef, type CanonicalEvidenceRef } from "@/core/entities/conversation-continuity";
import { createEmptyWorkspaceSnapshot, isWorkspaceSnapshotRestorable, type WorkspaceSnapshot } from "@/core/entities/conversation-workspace";
import { isIdentityMigrationTerminal, type IdentityMigrationEvent } from "@/core/entities/identity-migration";
import { isReusableMaterialization, type MaterializationRecord } from "@/core/entities/materialization";
import { isOperatorTransitionInMotion, type OperatorTransitionProfile } from "@/core/entities/operator-transition";
import { hasPromptBindingProvenance, type PromptBinding } from "@/core/entities/prompt-binding";
import { isActiveRelationshipMemory, type RelationshipMemoryRecord } from "@/core/entities/relationship-memory";
import { canShareTrustDistribution, type TrustDistributionContext } from "@/core/entities/trust-distribution";

const ENTITY_FILES = [
  "src/core/entities/conversation-continuity.ts",
  "src/core/entities/conversation-workspace.ts",
  "src/core/entities/business-workflow-context.ts",
  "src/core/entities/operator-transition.ts",
  "src/core/entities/trust-distribution.ts",
  "src/core/entities/materialization.ts",
  "src/core/entities/relationship-memory.ts",
  "src/core/entities/prompt-binding.ts",
  "src/core/entities/identity-migration.ts",
] as const;

const PORT_FILES = [
  "src/core/use-cases/WorkspaceSnapshotRepository.ts",
  "src/core/use-cases/BusinessWorkflowContextRepository.ts",
  "src/core/use-cases/OperatorTransitionRepository.ts",
  "src/core/use-cases/TrustDistributionRepository.ts",
  "src/core/use-cases/MaterializationRepository.ts",
  "src/core/use-cases/RelationshipMemoryRepository.ts",
  "src/core/use-cases/PromptBindingRepository.ts",
  "src/core/use-cases/IdentityMigrationRepository.ts",
] as const;

function source(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

function sourceExists(relativePath: string): boolean {
  return fs.existsSync(path.join(process.cwd(), relativePath));
}

const evidenceRef: CanonicalEvidenceRef = {
  source: createSourceRef({
    sourceKind: "conversation_event",
    sourceId: "evt_1",
    userId: "usr_1",
    conversationId: "conv_1",
  }),
  observedAt: "2026-04-28T12:00:00.000Z",
  summary: "User asked to keep the launch offer focused.",
};

const leadRef: BusinessObjectRef = {
  kind: "lead",
  id: "lead_1",
  userId: "usr_1",
  conversationId: "conv_1",
  label: "Launch workshop lead",
  status: "qualified",
};

describe("conversation refactor phase 01 canonical contracts", () => {
  it("adds every planned Phase 01 entity and port file without adding adapters", () => {
    for (const relativePath of [...ENTITY_FILES, ...PORT_FILES]) {
      expect(sourceExists(relativePath), `${relativePath} should exist`).toBe(true);
    }

    expect(source("docs/_refactor/conversation/phases/phase-01-canonical-domain-contracts.md")).toContain(
      "Do not add UI components, routes, restore endpoints, browser hooks, SSE behavior",
    );
  });

  it("keeps Phase 01 entities inside the clean domain boundary", () => {
    for (const relativePath of ENTITY_FILES) {
      const fileSource = source(relativePath);
      expect(fileSource, relativePath).not.toMatch(/from ["']@\/adapters/);
      expect(fileSource, relativePath).not.toMatch(/from ["']@\/lib\/db/);
      expect(fileSource, relativePath).not.toMatch(/from ["']next\//);
      expect(fileSource, relativePath).not.toMatch(/from ["']react/);
      expect(fileSource, relativePath).not.toMatch(/better-sqlite3|getDb\(/);
      expect(fileSource, relativePath).not.toMatch(/export default/);
      expect(fileSource, relativePath).not.toMatch(/MessagePart|tool_result|job_status/);
      expect(fileSource, relativePath).not.toMatch(/metadata:\s*Record<string, unknown>/);
    }
  });

  it("keeps Phase 01 use-case ports independent from concrete data mappers", () => {
    for (const relativePath of PORT_FILES) {
      const fileSource = source(relativePath);
      expect(fileSource, relativePath).not.toMatch(/DataMapper|getDb\(|better-sqlite3/);
      expect(fileSource, relativePath).not.toMatch(/from ["']@\/adapters/);
      expect(fileSource, relativePath).not.toMatch(/export default/);
    }
  });

  it("models workspace state as refs rather than transcript or payload ownership", () => {
    const snapshot = createEmptyWorkspaceSnapshot({
      id: "workspace_1",
      userId: "usr_1",
      conversationId: "conv_1",
      title: "Launch motion",
      updatedAt: "2026-04-28T12:00:00.000Z",
    }) satisfies WorkspaceSnapshot;

    const projected: WorkspaceSnapshot = {
      ...snapshot,
      currentObjective: "Prepare the first trusted launch motion.",
      recommendedNextStep: "Share the QR card with three warm contacts.",
      activeJobRefs: [{
        jobId: "job_1",
        toolName: "generate_audio",
        status: "running",
        materializationKey: "generate_audio:usr_1:offer_intro",
        updatedAt: "2026-04-28T12:01:00.000Z",
      }],
      importantAssetRefs: [{
        assetId: "file_1",
        kind: "audio",
        status: "ready",
        producedByJobId: "job_1",
        materializationKey: "generate_audio:usr_1:offer_intro",
        updatedAt: "2026-04-28T12:02:00.000Z",
      }],
      relatedBusinessRefs: [leadRef],
      latestMemoryRef: "mem_1",
      latestPromptBindingRef: "prompt_binding_1",
    };

    expect(isWorkspaceSnapshotRestorable(projected)).toBe(true);
    expect(projected.activeJobRefs.map((jobRef) => jobRef.status)).toEqual(["running"]);
    expect(JSON.stringify(projected)).not.toContain("tool_result");
    expect(JSON.stringify(projected)).not.toContain("requestPayload");
    expect(JSON.stringify(projected)).not.toContain("resultPayload");
  });

  it("models workflow, transition, and trust distribution without duplicating CRM or referral payloads", () => {
    const workflow = {
      id: "workflow_1",
      userId: "usr_1",
      conversationId: "conv_1",
      primaryMode: "revenue",
      origin: null,
      relatedRefs: [leadRef],
      lifecycleRefs: [],
      notificationRefs: [],
      interruptedTurnRefs: [],
      healthRefs: [{
        id: "health_1",
        severity: "blocking",
        label: "Provider key is missing",
        source: evidenceRef.source,
      }],
      recommendedAction: {
        kind: "configure",
        label: "Finish provider setup",
        targetRef: evidenceRef.source,
      },
      updatedAt: "2026-04-28T12:00:00.000Z",
    } satisfies BusinessWorkflowContext;

    const transition = {
      id: "operator_1",
      userId: "usr_1",
      conversationId: "conv_1",
      status: "sharing",
      operatorMode: "career_transition",
      expertiseRefs: [{ id: "expertise_1", label: "Operations leadership", evidenceRefs: [evidenceRef] }],
      audienceRefs: [],
      offerRefs: [],
      trustDistributionRef: "trust_1",
      recommendedAction: { kind: "share", label: "Share the QR card", targetRef: evidenceRef.source },
      updatedAt: "2026-04-28T12:00:00.000Z",
    } satisfies OperatorTransitionProfile;

    const trust = {
      id: "trust_1",
      userId: "usr_1",
      conversationId: "conv_1",
      referralCode: "KWILLIAMS",
      referralUrl: "/r/KWILLIAMS",
      qrCodeUrl: "/api/qr/KWILLIAMS",
      physicalShareAssets: [],
      introScripts: [{ id: "script_1", label: "Warm intro", text: "I built a quick way to see if this helps.", evidenceRefs: [evidenceRef] }],
      activeCampaignRefs: [],
      recentReferralRefs: [leadRef],
      recommendedAction: transition.recommendedAction,
      updatedAt: "2026-04-28T12:00:00.000Z",
    } satisfies TrustDistributionContext;

    expect(hasBlockingWorkflowHealth(workflow)).toBe(true);
    expect(isOperatorTransitionInMotion(transition)).toBe(true);
    expect(canShareTrustDistribution(trust)).toBe(true);
    expect(JSON.stringify({ workflow, transition, trust })).not.toContain("metadataJson");
  });

  it("models materialization, memory, prompt binding, and migration as first-class refs", () => {
    const materialization = {
      id: "mat_1",
      userId: "usr_1",
      conversationId: "conv_1",
      materializationKey: "generate_audio:usr_1:offer_intro",
      toolName: "generate_audio",
      pipelineVersion: "generate_audio:v1",
      status: "ready",
      reusePolicy: "same_user",
      inputSourceRefs: [evidenceRef.source],
      outputRefs: [{ kind: "asset", id: "file_1", userId: "usr_1", conversationId: "conv_1" }],
      evidenceRefs: [evidenceRef],
      producedByJobId: "job_1",
      supersededByRecordId: null,
      createdAt: "2026-04-28T12:00:00.000Z",
      updatedAt: "2026-04-28T12:01:00.000Z",
    } satisfies MaterializationRecord;

    const memory = {
      id: "mem_1",
      userId: "usr_1",
      conversationId: "conv_1",
      memoryType: "decision",
      summary: "The first launch motion should use warm trust before cold outreach.",
      evidenceRefs: [evidenceRef],
      status: "active",
      confidence: 0.9,
      createdAt: "2026-04-28T12:00:00.000Z",
      updatedAt: "2026-04-28T12:00:00.000Z",
    } satisfies RelationshipMemoryRecord;

    const promptBinding = {
      id: "prompt_binding_1",
      userId: "usr_1",
      conversationId: "conv_1",
      surface: "workspace_projection",
      targetKind: "conversation",
      targetId: "conv_1",
      sourcePromptBindingId: null,
      effectiveHash: "hash_1",
      slotRefs: [{ slotId: "identity", version: 3, effectiveHash: "slot_hash_1" }],
      overlayRefs: [],
      requestRefs: [],
      decisionSourceRefs: [evidenceRef.source],
      evidenceRefs: [evidenceRef],
      createdAt: "2026-04-28T12:00:00.000Z",
    } satisfies PromptBinding;

    const migration = {
      id: "migration_1",
      sourceUserId: "anon_1",
      targetUserId: "usr_1",
      migratedConversationIds: ["conv_1"],
      migratedJobIds: ["job_1"],
      migratedAssetIds: ["file_1"],
      repairedMemoryRefs: ["mem_1"],
      repairedSearchSourceIds: ["anon_1/conv_1"],
      objectCounts: [{ kind: "conversation", attempted: 1, migrated: 1, failed: 0 }],
      repairRefs: [],
      status: "completed",
      createdAt: "2026-04-28T12:00:00.000Z",
      completedAt: "2026-04-28T12:02:00.000Z",
    } satisfies IdentityMigrationEvent;

    expect(isReusableMaterialization(materialization)).toBe(true);
    expect(materialization.outputRefs.map((outputRef) => outputRef.kind)).not.toContain("message");
    expect(isActiveRelationshipMemory(memory)).toBe(true);
    expect(hasPromptBindingProvenance(promptBinding)).toBe(true);
    expect(isIdentityMigrationTerminal(migration)).toBe(true);
    expect(isUserOwned({ scope: "user", userId: "usr_1", role: null })).toBe(true);
  });
});
