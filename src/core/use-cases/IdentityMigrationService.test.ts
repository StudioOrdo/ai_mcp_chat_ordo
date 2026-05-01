import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IdentityMigrationEvent } from "../entities/identity-migration";
import { IdentityMigrationService, type IdentityMigrationServiceDeps } from "./IdentityMigrationService";

function createDeps(overrides: Partial<IdentityMigrationServiceDeps> = {}) {
  const events = {
    recorded: [] as IdentityMigrationEvent[],
    updated: [] as IdentityMigrationEvent[],
  };
  const deps: IdentityMigrationServiceDeps = {
    identityMigrationRepository: {
      record: vi.fn(async (event: IdentityMigrationEvent) => {
        events.recorded.push({ ...event });
        return event;
      }),
      update: vi.fn(async (event: IdentityMigrationEvent) => {
        events.updated.push({ ...event });
        return event;
      }),
      findById: vi.fn(),
      findLatestForSourceIdentity: vi.fn(),
      findLatestForTargetIdentity: vi.fn(),
    },
    conversationMigrator: {
      migrateAnonymousConversations: vi.fn().mockResolvedValue(["conv_1", "conv_1", "conv_2"]),
    },
    convertedConversationRecovery: {
      findIdsByUserAndConvertedFrom: vi.fn().mockResolvedValue(["conv_retry"]),
    },
    jobQueueRepository: {
      createJob: vi.fn(),
      findJobById: vi.fn(),
      findLatestEventForJob: vi.fn(),
      findLatestRenderableEventForJob: vi.fn(),
      findActiveJobByDedupeKey: vi.fn(),
      listJobsByConversation: vi.fn(),
      listJobsByUser: vi.fn(),
      appendEvent: vi.fn(),
      requeueExpiredRunningJobs: vi.fn(),
      listConversationEvents: vi.fn(),
      listUserEvents: vi.fn(),
      listEventsForUserJob: vi.fn(),
      claimNextQueuedJob: vi.fn(),
      transferJobsToUser: vi.fn().mockResolvedValue([{ id: "job_1" }]),
      updateJobStatus: vi.fn(),
      cancelJob: vi.fn(),
    },
    userFileRepository: {
      transferOwnershipForConversations: vi.fn().mockResolvedValue([{ id: "file_1" }]),
    } as unknown as IdentityMigrationServiceDeps["userFileRepository"],
    materializationRepository: {
      transferOwnershipForConversations: vi.fn().mockResolvedValue([{ id: "mat_1" }]),
    } as unknown as IdentityMigrationServiceDeps["materializationRepository"],
    relationshipMemoryRepository: {
      transferOwnershipForConversations: vi.fn().mockResolvedValue([{ id: "mem_1" }]),
    } as unknown as IdentityMigrationServiceDeps["relationshipMemoryRepository"],
    promptBindingRepository: {
      transferOwnershipForConversations: vi.fn().mockResolvedValue([{ id: "pb_1" }]),
    } as unknown as IdentityMigrationServiceDeps["promptBindingRepository"],
    promptProvenancePolicy: {
      countByConversations: vi.fn().mockResolvedValue(2),
    },
    referralRepair: {
      linkConversationToAuthenticatedUser: vi.fn().mockResolvedValue(undefined),
    },
    repairConversationOwnershipIndex: vi.fn().mockResolvedValue(undefined),
    now: () => "2026-04-30T10:00:00.000Z",
    idGenerator: () => "idmig_test",
    ...overrides,
  };

  return { deps, events };
}

describe("IdentityMigrationService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("coordinates every Phase 09 ownership repair stage and records durable status", async () => {
    const { deps, events } = createDeps();
    const service = new IdentityMigrationService(deps);

    const result = await service.execute({
      sourceUserId: "anon_seed_1",
      targetUserId: "usr_1",
      source: "registration",
    });

    expect(result).toEqual(
      expect.objectContaining({
        id: "idmig_test",
        migratedConversationIds: ["conv_1", "conv_2"],
        migratedJobIds: ["job_1"],
        migratedAssetIds: ["file_1"],
        repairedMemoryRefs: ["mem_1"],
        status: "completed",
        currentStage: "completed",
      }),
    );
    expect(deps.jobQueueRepository.transferJobsToUser).toHaveBeenCalledWith({
      conversationIds: ["conv_1", "conv_2"],
      previousUserId: "anon_seed_1",
      userId: "usr_1",
      source: "registration",
    });
    expect(deps.userFileRepository.transferOwnershipForConversations).toHaveBeenCalledWith({
      conversationIds: ["conv_1", "conv_2"],
      previousUserId: "anon_seed_1",
      userId: "usr_1",
    });
    expect(deps.promptProvenancePolicy?.countByConversations).toHaveBeenCalledWith(["conv_1", "conv_2"]);
    expect(events.recorded).toHaveLength(1);
    expect(events.updated.at(-1)).toEqual(expect.objectContaining({ status: "completed" }));
  });

  it("recovers converted conversations on retry and marks search repair failures as partial", async () => {
    const { deps } = createDeps();
    vi.mocked(deps.conversationMigrator.migrateAnonymousConversations).mockResolvedValue([]);
    const service = new IdentityMigrationService(deps);

    const result = await service.execute({
      sourceUserId: "anon_seed_1",
      targetUserId: "usr_1",
      source: "login",
    });

    expect(deps.convertedConversationRecovery.findIdsByUserAndConvertedFrom).toHaveBeenCalledWith(
      "usr_1",
      "anon_seed_1",
    );
    expect(result).toEqual(
      expect.objectContaining({
        migratedConversationIds: ["conv_retry"],
        status: "completed",
      }),
    );

    const partialDeps = createDeps({
      repairConversationOwnershipIndex: vi.fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error("index down")),
    }).deps;
    vi.mocked(partialDeps.conversationMigrator.migrateAnonymousConversations).mockResolvedValue([]);
    vi.mocked(partialDeps.convertedConversationRecovery.findIdsByUserAndConvertedFrom).mockResolvedValue(["conv_1", "conv_2"]);
    const partial = await new IdentityMigrationService(partialDeps).execute({
      sourceUserId: "anon_seed_1",
      targetUserId: "usr_1",
      source: "login",
    });

    expect(partial.status).toBe("partially_repaired");
    expect(partial.repairRefs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "search_source", id: "anon_seed_1/conv_2", status: "failed" }),
      ]),
    );
  });

  it("persists failed terminal state when a required repair stage throws", async () => {
    const { deps, events } = createDeps({
      referralRepair: {
        linkConversationToAuthenticatedUser: vi.fn().mockRejectedValue(new Error("referral unavailable")),
      },
    });
    const service = new IdentityMigrationService(deps);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(service.execute({
      sourceUserId: "anon_seed_1",
      targetUserId: "usr_1",
      source: "login",
    })).rejects.toThrow("referral unavailable");

    expect(events.updated.at(-1)).toEqual(
      expect.objectContaining({
        status: "partially_repaired",
        currentStage: "failed",
        failureMessage: "referral unavailable",
      }),
    );
    consoleError.mockRestore();
  });
});
