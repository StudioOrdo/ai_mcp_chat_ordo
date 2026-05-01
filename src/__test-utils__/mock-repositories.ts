/**
 * RepositoryFactory mock builder.
 *
 * The real RepositoryFactory exports 25 getter functions. Tests mock a
 * subset per file. This builder provides a full factory with safe defaults
 * (all methods return vi.fn() stubs) so each test only overrides the
 * methods it actually exercises.
 *
 * Usage:
 * ```ts
 * const factory = createMockRepositoryFactory({
 *   getBlogPostRepository: () => ({
 *     findById: vi.fn().mockResolvedValue(myPost),
 *   }),
 * });
 * vi.mock("@/adapters/RepositoryFactory", () => factory);
 * ```
 */
import { vi } from "vitest";

type MockRepo = Record<string, (...args: never[]) => unknown>;
type RepoGetter = () => MockRepo;
type FactoryOverrides = Partial<Record<string, RepoGetter>>;

function emptyRepo(): MockRepo {
  return {};
}

/**
 * Create a complete RepositoryFactory mock with safe defaults.
 *
 * Every getter returns an object whose methods are `vi.fn()` stubs.
 * Pass overrides for the specific repos your test exercises.
 */
export function createMockRepositoryFactory(overrides?: FactoryOverrides): Record<string, RepoGetter> {
  const defaults: Record<string, RepoGetter> = {
    // --- Corpus ---
    getCorpusRepository: () => ({
      getAllDocuments: vi.fn().mockResolvedValue([]),
      getAllSections: vi.fn().mockResolvedValue([]),
      getSectionsByDocument: vi.fn().mockResolvedValue([]),
      getSection: vi.fn(),
      getDocument: vi.fn(),
      search: vi.fn().mockResolvedValue([]),
      getSummary: vi.fn(),
    }),

    // --- Blog / Journal ---
    getBlogPostRepository: () => ({
      findById: vi.fn(),
      findBySlug: vi.fn(),
      listPublished: vi.fn().mockResolvedValue([]),
      listForAdmin: vi.fn().mockResolvedValue([]),
      countForAdmin: vi.fn().mockResolvedValue(0),
      create: vi.fn(),
      update: vi.fn(),
      updateStatus: vi.fn(),
    }),
    getBlogAssetRepository: () => ({
      findById: vi.fn(),
      listByPostId: vi.fn().mockResolvedValue([]),
      listHeroCandidates: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      setVisibility: vi.fn(),
    }),
    getBlogPostArtifactRepository: () => ({
      findById: vi.fn(),
      listByPostId: vi.fn().mockResolvedValue([]),
      listByPost: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
    }),
    getBlogPostRevisionRepository: () => ({
      listByPostId: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      restoreRevisionAtomically: vi.fn(),
    }),
    getJournalEditorialMutationRepository: () => ({
      create: vi.fn(),
    }),

    // --- Jobs ---
    getJobQueueRepository: () => ({
      createJob: vi.fn(),
      appendEvent: vi.fn(),
      findJobById: vi.fn(),
      findActiveJobByDedupeKey: vi.fn(),
      updateJobStatus: vi.fn(),
      listEventsForJob: vi.fn().mockResolvedValue([]),
      findLatestRenderableEventForJob: vi.fn(),
      cancelJob: vi.fn(),
      countByStatus: vi.fn().mockResolvedValue(0),
      countByToolName: vi.fn().mockResolvedValue([]),
      transferJobsToUser: vi.fn(),
    }),
    getJobQueueDataMapper: () => ({
      listForAdmin: vi.fn().mockResolvedValue([]),
      countForAdmin: vi.fn().mockResolvedValue(0),
    }),
    getJobStatusQuery: () => ({
      getJobSnapshot: vi.fn(),
      getUserJobSnapshot: vi.fn(),
      listUserJobSnapshots: vi.fn().mockResolvedValue([]),
      listEventsForUserJob: vi.fn().mockResolvedValue([]),
      listConversationJobSnapshots: vi.fn().mockResolvedValue([]),
    }),
    getExecutionTimelineReader: () => ({
      getJobTimeline: vi.fn(),
      getUserJobTimeline: vi.fn(),
      listConversationJobTimelines: vi.fn().mockResolvedValue([]),
      listUserJobTimelines: vi.fn().mockResolvedValue([]),
      getUserJobHistory: vi.fn(),
      getWorkOrderTimeline: vi.fn(),
      readExecutionTimeline: vi.fn(),
      getJobSnapshot: vi.fn(),
      getUserJobSnapshot: vi.fn(),
      listUserJobSnapshots: vi.fn().mockResolvedValue([]),
      listConversationJobSnapshots: vi.fn().mockResolvedValue([]),
    }),
    getRevisionReader: () => ({
      getJobRevision: vi.fn(),
      getUserJobRevision: vi.fn(),
      getWorkOrderRevision: vi.fn(),
      readRevision: vi.fn(),
    }),
    getPlatformInteractionFacade: () => ({
      listUserJobInteractions: vi.fn().mockResolvedValue([]),
      listConversationJobInteractions: vi.fn().mockResolvedValue([]),
      getJobInteraction: vi.fn(),
      getUserJobInteraction: vi.fn(),
      getUserJobHistoryInteraction: vi.fn(),
      getWorkOrderInteraction: vi.fn(),
    }),
    getFactoryRepository: emptyRepo,

    // --- Users & Preferences ---
    getUserDataMapper: () => ({
      findById: vi.fn(),
      findProfileById: vi.fn(),
      findByEmail: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    }),
    getUserPreferencesDataMapper: () => ({
      getSync: vi.fn(),
      get: vi.fn().mockResolvedValue([]),
      set: vi.fn(),
    }),
    getUserFileDataMapper: () => ({
      findById: vi.fn(),
      listForUser: vi.fn().mockResolvedValue([]),
      listForAdmin: vi.fn().mockResolvedValue([]),
      countForAdmin: vi.fn().mockResolvedValue(0),
      create: vi.fn(),
      purge: vi.fn(),
      reapUnattachedFiles: vi.fn(),
    }),
    getAssetCatalogReader: () => ({
      listConversationMediaAssets: vi.fn().mockResolvedValue([]),
    }),

    // --- CRM entities ---
    getLeadRecordDataMapper: () => ({
      findById: vi.fn(),
      updateTriageState: vi.fn(),
      listOverdueFollowUps: vi.fn().mockResolvedValue([]),
      listForAdmin: vi.fn().mockResolvedValue([]),
      countForAdmin: vi.fn().mockResolvedValue(0),
      countByTriageState: vi.fn().mockResolvedValue([]),
      updateFollowUp: vi.fn(),
    }),
    getConsultationRequestDataMapper: () => ({
      findById: vi.fn(),
      create: vi.fn(),
      listForAdmin: vi.fn().mockResolvedValue([]),
      countForAdmin: vi.fn().mockResolvedValue(0),
    }),
    getDealRecordDataMapper: () => ({
      findById: vi.fn(),
      update: vi.fn(),
      updateStatus: vi.fn(),
    }),
    getTrainingPathRecordDataMapper: () => ({
      findById: vi.fn(),
      update: vi.fn(),
      updateStatus: vi.fn(),
    }),

    // --- Conversations ---
    getConversationDataMapper: () => ({
      findById: vi.fn(),
      listByUser: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      archive: vi.fn(),
      restore: vi.fn(),
      listForAdmin: vi.fn().mockResolvedValue([]),
      countForAdmin: vi.fn().mockResolvedValue(0),
      countByStatus: vi.fn().mockResolvedValue([]),
      countByLane: vi.fn().mockResolvedValue([]),
      findIdsByUserAndConvertedFrom: vi.fn().mockResolvedValue([]),
      setConversationMode: vi.fn(),
      archiveById: vi.fn(),
      restoreDeleted: vi.fn(),
    }),
    getMessageDataMapper: () => ({
      listByConversation: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
    }),
    getConversationEventDataMapper: () => ({
      listByConversation: vi.fn().mockResolvedValue([]),
      listConversationEvents: vi.fn().mockResolvedValue([]),
      listUserEvents: vi.fn().mockResolvedValue([]),
      record: vi.fn(),
    }),

    // --- System ---
    getSystemPromptDataMapper: () => ({
      listVersions: vi.fn().mockResolvedValue([]),
      createVersion: vi.fn(),
      activate: vi.fn(),
    }),
    getPromptProvenanceDataMapper: emptyRepo,
    getSystemSettingsDataMapper: () => ({
      get: vi.fn(),
      set: vi.fn(),
    }),
    getPushSubscriptionRepository: () => ({
      findByEndpoint: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn(),
      deleteByEndpoint: vi.fn(),
      listByUser: vi.fn().mockResolvedValue([]),
      markNotified: vi.fn(),
    }),
    getVectorStore: () => ({
      search: vi.fn().mockResolvedValue([]),
    }),
    getRelationshipMemoryRepository: () => ({
      search: vi.fn().mockResolvedValue([]),
    }),
  };

  // Merge overrides: each override replaces the entire getter function
  const merged = { ...defaults };
  if (overrides) {
    for (const [key, getter] of Object.entries(overrides)) {
      if (getter) {
        merged[key] = getter;
      }
    }
  }

  return merged;
}

// ---------------------------------------------------------------------------
// Individual repository mock creators
// (Absorbed from tests/helpers/repository-fixture.ts)
//
// These are simpler, standalone mocks for tests that mock a single repo
// rather than the entire RepositoryFactory.
// ---------------------------------------------------------------------------

/** Create a mock DealRecord repository. */
export function createDealRecordRepositoryMock(overrides: {
  findById?: ReturnType<typeof vi.fn>;
  update?: ReturnType<typeof vi.fn>;
  updateStatus?: ReturnType<typeof vi.fn>;
} = {}) {
  return {
    findById: overrides.findById ?? vi.fn(),
    update: overrides.update ?? vi.fn(),
    updateStatus: overrides.updateStatus ?? vi.fn(),
  };
}

/** Create a mock TrainingPathRecord repository. */
export function createTrainingPathRecordRepositoryMock(overrides: {
  findById?: ReturnType<typeof vi.fn>;
  update?: ReturnType<typeof vi.fn>;
  updateStatus?: ReturnType<typeof vi.fn>;
} = {}) {
  return {
    findById: overrides.findById ?? vi.fn(),
    update: overrides.update ?? vi.fn(),
    updateStatus: overrides.updateStatus ?? vi.fn(),
  };
}

/** Create a mock ConsultationRequest repository. */
export function createConsultationRequestRepositoryMock(overrides: {
  findById?: ReturnType<typeof vi.fn>;
} = {}) {
  return {
    findById: overrides.findById ?? vi.fn(),
  };
}

/** Create a mock LeadRecord repository. */
export function createLeadRecordRepositoryMock(overrides: {
  findById?: ReturnType<typeof vi.fn>;
  updateTriageState?: ReturnType<typeof vi.fn>;
} = {}) {
  return {
    findById: overrides.findById ?? vi.fn(),
    updateTriageState: overrides.updateTriageState ?? vi.fn(),
  };
}

/** Create a mock ConversationEventRecorder. */
export function createConversationEventRecorderMock(overrides: {
  record?: ReturnType<typeof vi.fn>;
} = {}) {
  return {
    record: overrides.record ?? vi.fn(),
  };
}
