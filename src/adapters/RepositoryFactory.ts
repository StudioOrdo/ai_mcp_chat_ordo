import type { CorpusRepository } from "../core/use-cases/CorpusRepository";
import { FileSystemCorpusRepository } from "./FileSystemCorpusRepository";
import { CachedCorpusRepository } from "./CachedCorpusRepository";
import type { BlogPostRepository } from "../core/use-cases/BlogPostRepository";
import type { BlogAssetRepository } from "../core/use-cases/BlogAssetRepository";
import type { BlogPostArtifactRepository } from "../core/use-cases/BlogPostArtifactRepository";
import type { BlogPostRevisionRepository } from "../core/use-cases/BlogPostRevisionRepository";
import type { JournalEditorialMutationRepository } from "../core/use-cases/JournalEditorialMutationRepository";
import type { FactoryRepository } from "../core/use-cases/FactoryRepository";
import { BlogAssetDataMapper } from "./BlogAssetDataMapper";
import { BlogPostArtifactDataMapper } from "./BlogPostArtifactDataMapper";
import { BlogPostDataMapper } from "./BlogPostDataMapper";
import { BlogPostRevisionDataMapper } from "./BlogPostRevisionDataMapper";
import { FactoryDataMapper } from "./FactoryDataMapper";
import { JournalEditorialMutationDataMapper } from "./JournalEditorialMutationDataMapper";
import type { JobQueueRepository } from "../core/use-cases/JobQueueRepository";
import type { JobStatusQuery } from "../core/use-cases/JobStatusQuery";
import { JobQueueDataMapper } from "./JobQueueDataMapper";
import type { PushSubscriptionRepository } from "../core/use-cases/PushSubscriptionRepository";
import { PushSubscriptionDataMapper } from "./PushSubscriptionDataMapper";
import { UserDataMapper } from "./UserDataMapper";
import { LeadRecordDataMapper } from "./LeadRecordDataMapper";
import { ConsultationRequestDataMapper } from "./ConsultationRequestDataMapper";
import { DealRecordDataMapper } from "./DealRecordDataMapper";
import { TrainingPathRecordDataMapper } from "./TrainingPathRecordDataMapper";
import { ReferralDataMapper } from "./ReferralDataMapper";
import { ReferralEventDataMapper } from "./ReferralEventDataMapper";
import { SystemPromptDataMapper } from "./SystemPromptDataMapper";
import { SystemSettingsDataMapper } from "./SystemSettingsDataMapper";
import { ConversationDataMapper } from "./ConversationDataMapper";
import { MessageDataMapper } from "./MessageDataMapper";
import { ConversationEventDataMapper } from "./ConversationEventDataMapper";
import { PromptProvenanceDataMapper } from "./PromptProvenanceDataMapper";
import { PromptBindingDataMapper } from "./PromptBindingDataMapper";
import { RelationshipMemoryDataMapper } from "./RelationshipMemoryDataMapper";
import { MaterializationDataMapper } from "./MaterializationDataMapper";
import { IdentityMigrationDataMapper } from "./IdentityMigrationDataMapper";
import { UserPreferencesDataMapper } from "./UserPreferencesDataMapper";
import { UserFileDataMapper } from "./UserFileDataMapper";
import { SQLiteVectorStore } from "./SQLiteVectorStore";
import { getDb } from "@/lib/db";
import {
  createExecutionTimelineReader,
  type ExecutionTimelineReader,
} from "@/core/platform/execution/ExecutionTimelineReader";
import {
  createRevisionReader,
  type RevisionReader,
} from "@/core/platform/revision/RevisionReader";
import { PlatformInteractionFacade } from "@/core/platform/facade/PlatformInteractionFacade";
import {
  createBusinessWorkflowContextReader,
  type WorkflowReadinessProbe,
} from "@/core/platform/business-workflow/BusinessWorkflowContextReader";
import {
  createAssetCatalogReader,
} from "@/core/platform/asset-catalog/AssetCatalogReader";
import type { AssetCatalogReader } from "@/core/use-cases/AssetCatalogReader";
import type { BusinessWorkflowContextReader } from "@/core/use-cases/BusinessWorkflowContextRepository";
import {
  createWorkspaceSnapshotReader,
} from "@/core/platform/conversation-workspace/WorkspaceSnapshotReader";
import type { WorkspaceSnapshotReader } from "@/core/use-cases/WorkspaceSnapshotRepository";
import {
  createWorkspaceRestoreReader,
  type WorkspaceRestoreReader,
} from "@/core/platform/conversation-restore/WorkspaceRestoreReader";
import { createRelationshipMemoryProjectionService } from "@/core/platform/relationship-memory/RelationshipMemoryProjectionService";
import {
  createOperatorTransitionReader,
  type OperatorTransitionProfileReader,
} from "@/core/platform/operator-transition/OperatorTransitionReader";
import type { OperatorTransitionReader } from "@/core/use-cases/OperatorTransitionRepository";
import {
  createTrustDistributionReader,
  type TrustDistributionProfileReader,
} from "@/core/platform/operator-transition/TrustDistributionReader";
import type { TrustDistributionReader } from "@/core/use-cases/TrustDistributionRepository";
import { getReadinessProbe } from "@/lib/health/probes";
import { createProfileService } from "@/lib/profile/profile-service";
import { createAdminReferralAnalyticsService } from "@/lib/referrals/admin-referral-analytics";
import { createReferralAnalyticsService } from "@/lib/referrals/referral-analytics";
import type { MaterializationRepository } from "@/core/use-cases/MaterializationRepository";
import type { PromptBindingRepository } from "@/core/use-cases/PromptBindingRepository";
import type { IdentityMigrationRepository } from "@/core/use-cases/IdentityMigrationRepository";
import type { RelationshipMemoryProjectionService } from "@/core/use-cases/RelationshipMemoryProjectionService";
import type { RelationshipMemoryRepository } from "@/core/use-cases/RelationshipMemoryRepository";
import { MediaWorkflowReadModel } from "@/lib/media/workflows/media-workflow-read-model";
import { MediaWorkflowOrchestrator } from "@/lib/media/workflows/orchestrator";
import { SqliteMediaWorkflowRepository } from "@/lib/media/workflows/sqlite-media-workflow-repository";

/**
 * Repository Factory — Service Locator
 *
 * Next.js Server Components (RSC) cannot receive constructor-injected dependencies.
 * Page components call these factory functions directly. This is an accepted DIP
 * exception for the RSC layer. The tool/chat pipeline uses proper constructor
 * injection via tool-composition-root.ts.
 *
 * ## Lifetime Policy (Sprint 6)
 *
 * All repository exports use the **process-cached singleton** pattern:
 * first access lazily initializes the instance against the shared `getDb()`
 * handle, and the instance lives until the Node.js process restarts.
 *
 * This is the canonical lifetime for all repositories. Request-scoped
 * construction (as in `conversation-root.ts`) should only be used when a
 * composition root needs to group multiple repos under a single DB handle
 * for transactional consistency.
 *
 * A small number of route handlers still call `getDb()` directly when they
 * need transaction-local composition or read-model access that is not yet
 * wrapped by a repository export. Treat those as explicit shrink-only
 * exceptions rather than the preferred integration pattern.
 */

let repository: CorpusRepository | null = null;

/** @lifetime process-cached singleton */
export function getCorpusRepository(): CorpusRepository {
  if (!repository) {
    // In a multi-environment setup, we would check ENV here
    // to return a MockRepository or a CloudRepository.
    repository = new CachedCorpusRepository(new FileSystemCorpusRepository());
  }
  return repository;
}

let blogRepo: BlogPostRepository | null = null;
let blogAssetRepo: BlogAssetRepository | null = null;
let blogArtifactRepo: BlogPostArtifactRepository | null = null;
let blogRevisionRepo: BlogPostRevisionRepository | null = null;
let journalEditorialMutationRepo: JournalEditorialMutationRepository | null = null;
let jobQueueRepo: JobQueueRepository | null = null;
let jobQueueRepoDb: ReturnType<typeof getDb> | null = null;
let jobStatusQuery: JobStatusQuery | null = null;
let executionTimelineReader: ExecutionTimelineReader | null = null;
let revisionReader: RevisionReader | null = null;
let platformInteractionFacade: PlatformInteractionFacade | null = null;
let factoryRepo: FactoryRepository | null = null;
let factoryRepoDb: ReturnType<typeof getDb> | null = null;
let pushSubscriptionRepo: PushSubscriptionRepository | null = null;
let userDataMapper: UserDataMapper | null = null;
let leadRecordDataMapper: LeadRecordDataMapper | null = null;
let consultationRequestDataMapper: ConsultationRequestDataMapper | null = null;
let dealRecordDataMapper: DealRecordDataMapper | null = null;
let trainingPathRecordDataMapper: TrainingPathRecordDataMapper | null = null;
let referralDataMapper: ReferralDataMapper | null = null;
let referralEventDataMapper: ReferralEventDataMapper | null = null;
let assetCatalogReader: AssetCatalogReader | null = null;
let workspaceSnapshotReader: WorkspaceSnapshotReader | null = null;
let workspaceRestoreReader: WorkspaceRestoreReader | null = null;
let businessWorkflowContextReader: BusinessWorkflowContextReader | null = null;
let trustDistributionReader: TrustDistributionReader | null = null;
let operatorTransitionReader: OperatorTransitionReader | null = null;
let systemPromptDataMapper: SystemPromptDataMapper | null = null;
let systemSettingsDataMapper: SystemSettingsDataMapper | null = null;
let conversationDataMapper: ConversationDataMapper | null = null;
let messageDataMapper: MessageDataMapper | null = null;
let conversationEventDataMapper: ConversationEventDataMapper | null = null;
let promptProvenanceDataMapper: PromptProvenanceDataMapper | null = null;
let promptBindingRepository: PromptBindingRepository | null = null;
let relationshipMemoryRepository: RelationshipMemoryRepository | null = null;
let relationshipMemoryProjectionService: RelationshipMemoryProjectionService | null = null;
let materializationRepository: MaterializationRepository | null = null;
let materializationRepositoryDb: ReturnType<typeof getDb> | null = null;
let mediaWorkflowRepository: SqliteMediaWorkflowRepository | null = null;
let mediaWorkflowRepositoryDb: ReturnType<typeof getDb> | null = null;
let mediaWorkflowReadModel: MediaWorkflowReadModel | null = null;
let mediaWorkflowOrchestrator: MediaWorkflowOrchestrator | null = null;
let identityMigrationRepository: IdentityMigrationRepository | null = null;
let userPreferencesDataMapper: UserPreferencesDataMapper | null = null;
let userFileDataMapper: UserFileDataMapper | null = null;
let vectorStore: SQLiteVectorStore | null = null;

/** @lifetime process-cached singleton */
export function getBlogPostRepository(): BlogPostRepository {
  if (!blogRepo) {
    blogRepo = new BlogPostDataMapper(getDb());
  }
  return blogRepo;
}

/** @lifetime process-cached singleton */
export function getBlogAssetRepository(): BlogAssetRepository {
  if (!blogAssetRepo) {
    blogAssetRepo = new BlogAssetDataMapper(getDb());
  }
  return blogAssetRepo;
}

/** @lifetime process-cached singleton */
export function getBlogPostArtifactRepository(): BlogPostArtifactRepository {
  if (!blogArtifactRepo) {
    blogArtifactRepo = new BlogPostArtifactDataMapper(getDb());
  }
  return blogArtifactRepo;
}

/** @lifetime process-cached singleton */
export function getBlogPostRevisionRepository(): BlogPostRevisionRepository {
  if (!blogRevisionRepo) {
    blogRevisionRepo = new BlogPostRevisionDataMapper(getDb());
  }
  return blogRevisionRepo;
}

/** @lifetime process-cached singleton */
export function getJournalEditorialMutationRepository(): JournalEditorialMutationRepository {
  if (!journalEditorialMutationRepo) {
    journalEditorialMutationRepo = new JournalEditorialMutationDataMapper(getDb());
  }
  return journalEditorialMutationRepo;
}

/** @lifetime process-cached singleton (invalidated on DB handle change) */
export function getFactoryRepository(): FactoryRepository {
  const db = getDb();

  if (!factoryRepo || factoryRepoDb !== db) {
    factoryRepo = new FactoryDataMapper(db);
    factoryRepoDb = db;
    executionTimelineReader = null;
    revisionReader = null;
    platformInteractionFacade = null;
  }

  return factoryRepo;
}

/** @lifetime process-cached singleton (invalidated on DB handle change) */
export function getJobQueueRepository(): JobQueueRepository {
  const db = getDb();

  if (!jobQueueRepo || jobQueueRepoDb !== db) {
    jobQueueRepo = new JobQueueDataMapper(db);
    jobQueueRepoDb = db;
    jobStatusQuery = null;
    executionTimelineReader = null;
    revisionReader = null;
    platformInteractionFacade = null;
  }
  return jobQueueRepo;
}

/** @lifetime process-cached singleton (narrow type alias for getJobQueueRepository) */
export function getJobQueueDataMapper(): JobQueueDataMapper {
  return getJobQueueRepository() as JobQueueDataMapper;
}

/** @lifetime process-cached singleton (invalidated on DB handle change) */
export function getMaterializationRepository(): MaterializationRepository {
  const db = getDb();

  if (!materializationRepository || materializationRepositoryDb !== db) {
    materializationRepository = new MaterializationDataMapper(db);
    materializationRepositoryDb = db;
  }

  return materializationRepository;
}

/** @lifetime process-cached singleton */
export function getIdentityMigrationRepository(): IdentityMigrationRepository {
  if (!identityMigrationRepository) {
    identityMigrationRepository = new IdentityMigrationDataMapper(getDb());
  }

  return identityMigrationRepository;
}

/** @lifetime process-cached singleton */
export function getRelationshipMemoryRepository(): RelationshipMemoryRepository {
  if (!relationshipMemoryRepository) {
    relationshipMemoryRepository = new RelationshipMemoryDataMapper(getDb());
  }

  return relationshipMemoryRepository;
}

/** @lifetime process-cached singleton */
export function getRelationshipMemoryProjectionService(): RelationshipMemoryProjectionService {
  if (!relationshipMemoryProjectionService) {
    relationshipMemoryProjectionService = createRelationshipMemoryProjectionService({
      messageRepository: getMessageDataMapper(),
      relationshipMemoryRepository: getRelationshipMemoryRepository(),
      promptBindingRepository: getPromptBindingRepository(),
    });
  }

  return relationshipMemoryProjectionService;
}

/** @lifetime process-cached singleton */
export function getExecutionTimelineReader(): ExecutionTimelineReader {
  if (!executionTimelineReader) {
    executionTimelineReader = createExecutionTimelineReader(
      getJobQueueRepository(),
      getFactoryRepository(),
      {
        promptTurnReader: getPromptProvenanceDataMapper(),
        messageRepository: getMessageDataMapper(),
      },
      getMaterializationRepository(),
    );
  }

  return executionTimelineReader;
}

/** @lifetime process-cached singleton */
export function getRevisionReader(): RevisionReader {
  if (!revisionReader) {
    revisionReader = createRevisionReader(
      getJobQueueRepository(),
      getFactoryRepository(),
      getExecutionTimelineReader(),
    );
  }

  return revisionReader;
}

/** @lifetime process-cached singleton */
export function getPlatformInteractionFacade(): PlatformInteractionFacade {
  if (!platformInteractionFacade) {
    platformInteractionFacade = new PlatformInteractionFacade({
      executionTimelineReader: getExecutionTimelineReader(),
    });
  }

  return platformInteractionFacade;
}

/** @lifetime process-cached singleton */
export function getJobStatusQuery(): JobStatusQuery {
  if (!jobStatusQuery) {
    jobStatusQuery = getExecutionTimelineReader();
  }

  return jobStatusQuery;
}

/** @lifetime process-cached singleton (invalidated on DB handle change) */
export function getMediaWorkflowRepository(): SqliteMediaWorkflowRepository {
  const db = getDb();
  if (!mediaWorkflowRepository || mediaWorkflowRepositoryDb !== db) {
    mediaWorkflowRepository = new SqliteMediaWorkflowRepository(db);
    mediaWorkflowRepositoryDb = db;
    mediaWorkflowReadModel = null;
    mediaWorkflowOrchestrator = null;
  }
  return mediaWorkflowRepository;
}

/** @lifetime process-cached singleton */
export function getMediaWorkflowReadModel(): MediaWorkflowReadModel {
  if (!mediaWorkflowReadModel) {
    mediaWorkflowReadModel = new MediaWorkflowReadModel({
      workflowRepository: getMediaWorkflowRepository(),
      jobStatusQuery: getJobStatusQuery(),
    });
  }
  return mediaWorkflowReadModel;
}

/** @lifetime process-cached singleton */
export function getMediaWorkflowOrchestrator(): MediaWorkflowOrchestrator {
  if (!mediaWorkflowOrchestrator) {
    mediaWorkflowOrchestrator = new MediaWorkflowOrchestrator({
      workflowRepository: getMediaWorkflowRepository(),
      jobRepository: getJobQueueRepository(),
      materializationRepository: getMaterializationRepository(),
    });
  }
  return mediaWorkflowOrchestrator;
}

/** @lifetime process-cached singleton */
export function getPushSubscriptionRepository(): PushSubscriptionRepository {
  if (!pushSubscriptionRepo) {
    pushSubscriptionRepo = new PushSubscriptionDataMapper(getDb());
  }
  return pushSubscriptionRepo;
}

/** @lifetime process-cached singleton */
export function getUserDataMapper(): UserDataMapper {
  if (!userDataMapper) {
    userDataMapper = new UserDataMapper(getDb());
  }
  return userDataMapper;
}

/** @lifetime process-cached singleton */
export function getLeadRecordDataMapper(): LeadRecordDataMapper {
  if (!leadRecordDataMapper) {
    leadRecordDataMapper = new LeadRecordDataMapper(getDb());
  }
  return leadRecordDataMapper;
}

/** @lifetime process-cached singleton */
export function getConsultationRequestDataMapper(): ConsultationRequestDataMapper {
  if (!consultationRequestDataMapper) {
    consultationRequestDataMapper = new ConsultationRequestDataMapper(getDb());
  }
  return consultationRequestDataMapper;
}

/** @lifetime process-cached singleton */
export function getDealRecordDataMapper(): DealRecordDataMapper {
  if (!dealRecordDataMapper) {
    dealRecordDataMapper = new DealRecordDataMapper(getDb());
  }
  return dealRecordDataMapper;
}

/** @lifetime process-cached singleton */
export function getTrainingPathRecordDataMapper(): TrainingPathRecordDataMapper {
  if (!trainingPathRecordDataMapper) {
    trainingPathRecordDataMapper = new TrainingPathRecordDataMapper(getDb());
  }
  return trainingPathRecordDataMapper;
}

/** @lifetime process-cached singleton */
export function getReferralDataMapper(): ReferralDataMapper {
  if (!referralDataMapper) {
    referralDataMapper = new ReferralDataMapper(getDb());
  }
  return referralDataMapper;
}

/** @lifetime process-cached singleton */
export function getReferralEventDataMapper(): ReferralEventDataMapper {
  if (!referralEventDataMapper) {
    referralEventDataMapper = new ReferralEventDataMapper(getDb());
  }
  return referralEventDataMapper;
}

/** @lifetime process-cached singleton */
export function getAssetCatalogReader(): AssetCatalogReader {
  if (!assetCatalogReader) {
    assetCatalogReader = createAssetCatalogReader({
      userFileRepository: getUserFileDataMapper(),
      materializationRepository: getMaterializationRepository(),
      blogAssetRepository: getBlogAssetRepository(),
    });
  }

  return assetCatalogReader;
}

/** @lifetime process-cached singleton */
export function getWorkspaceSnapshotReader(): WorkspaceSnapshotReader {
  if (!workspaceSnapshotReader) {
    workspaceSnapshotReader = createWorkspaceSnapshotReader({
      conversationRepository: getConversationDataMapper(),
      jobQueueRepository: getJobQueueRepository(),
      assetCatalogReader: getAssetCatalogReader(),
      workflowContextReader: getBusinessWorkflowContextReader(),
      operatorTransitionReader: getOperatorTransitionReader(),
      trustDistributionReader: getTrustDistributionReader(),
      relationshipMemoryReader: getRelationshipMemoryRepository(),
      promptBindingReader: getPromptBindingRepository(),
    });
  }

  return workspaceSnapshotReader;
}

/** @lifetime process-cached singleton */
export function getWorkspaceRestoreReader(): WorkspaceRestoreReader {
  if (!workspaceRestoreReader) {
    workspaceRestoreReader = createWorkspaceRestoreReader({
      workspaceSnapshotReader: getWorkspaceSnapshotReader(),
      jobStatusQuery: getExecutionTimelineReader(),
      messageRepository: getMessageDataMapper(),
      assetCatalogReader: getAssetCatalogReader(),
      workflowReader: getBusinessWorkflowContextReader(),
      operatorTransitionReader: getOperatorTransitionReader(),
      trustDistributionReader: getTrustDistributionReader(),
      relationshipMemoryReader: getRelationshipMemoryRepository(),
      identityMigrationReader: getIdentityMigrationRepository(),
    });
  }

  return workspaceRestoreReader;
}

/** @lifetime process-cached singleton */
export function getBusinessWorkflowContextReader(): BusinessWorkflowContextReader {
  if (!businessWorkflowContextReader) {
    const readinessProbe: WorkflowReadinessProbe = {
      getReadiness: () => getReadinessProbe(),
    };

    businessWorkflowContextReader = createBusinessWorkflowContextReader({
      conversationRepository: getConversationDataMapper(),
      leadRecordRepository: getLeadRecordDataMapper(),
      consultationRequestRepository: getConsultationRequestDataMapper(),
      dealRecordRepository: getDealRecordDataMapper(),
      trainingPathRecordRepository: getTrainingPathRecordDataMapper(),
      referralReader: getReferralDataMapper(),
      referralEventReader: getReferralEventDataMapper(),
      jobQueueRepository: getJobQueueRepository(),
      readinessProbe,
    });
  }
  return businessWorkflowContextReader;
}

/** @lifetime process-cached singleton */
export function getTrustDistributionReader(): TrustDistributionReader {
  if (!trustDistributionReader) {
    const profileService = createProfileService();
    const referralAnalytics = createReferralAnalyticsService();
    const profileReader: TrustDistributionProfileReader = {
      getProfile: async (userId) => profileService.getProfile(userId).catch(() => null),
    };

    trustDistributionReader = createTrustDistributionReader({
      conversationRepository: getConversationDataMapper(),
      profileReader,
      activityReader: {
        getRecentActivity: (userId, limit) => referralAnalytics.getRecentActivity(userId, limit),
      },
      adminPressureReader: {
        getExceptions: () => createAdminReferralAnalyticsService().getExceptions(),
      },
      readinessProbe: {
        getReadiness: () => getReadinessProbe(),
      },
    });
  }

  return trustDistributionReader;
}

/** @lifetime process-cached singleton */
export function getOperatorTransitionReader(): OperatorTransitionReader {
  if (!operatorTransitionReader) {
    const profileService = createProfileService();
    const profileReader: OperatorTransitionProfileReader = {
      getProfile: async (userId) => profileService.getProfile(userId).catch(() => null),
    };

    operatorTransitionReader = createOperatorTransitionReader({
      conversationRepository: getConversationDataMapper(),
      profileReader,
      trustDistributionReader: getTrustDistributionReader(),
      businessWorkflowContextReader: getBusinessWorkflowContextReader(),
      adminPressureReader: {
        getExceptions: () => createAdminReferralAnalyticsService().getExceptions(),
      },
      readinessProbe: {
        getReadiness: () => getReadinessProbe(),
      },
    });
  }

  return operatorTransitionReader;
}

/** @lifetime process-cached singleton */
export function getSystemPromptDataMapper(): SystemPromptDataMapper {
  if (!systemPromptDataMapper) {
    systemPromptDataMapper = new SystemPromptDataMapper(getDb());
  }
  return systemPromptDataMapper;
}

/** @lifetime process-cached singleton */
export function getSystemSettingsDataMapper(): SystemSettingsDataMapper {
  if (!systemSettingsDataMapper) {
    systemSettingsDataMapper = new SystemSettingsDataMapper(getDb());
  }
  return systemSettingsDataMapper;
}

/** @lifetime process-cached singleton */
export function getConversationDataMapper(): ConversationDataMapper {
  if (!conversationDataMapper) {
    conversationDataMapper = new ConversationDataMapper(getDb());
  }
  return conversationDataMapper;
}

/** @lifetime process-cached singleton */
export function getMessageDataMapper(): MessageDataMapper {
  if (!messageDataMapper) {
    messageDataMapper = new MessageDataMapper(getDb());
  }
  return messageDataMapper;
}

/** @lifetime process-cached singleton */
export function getConversationEventDataMapper(): ConversationEventDataMapper {
  if (!conversationEventDataMapper) {
    conversationEventDataMapper = new ConversationEventDataMapper(getDb());
  }
  return conversationEventDataMapper;
}

/** @lifetime process-cached singleton */
export function getPromptProvenanceDataMapper(): PromptProvenanceDataMapper {
  if (!promptProvenanceDataMapper) {
    promptProvenanceDataMapper = new PromptProvenanceDataMapper(getDb());
  }
  return promptProvenanceDataMapper;
}

/** @lifetime process-cached singleton */
export function getPromptBindingRepository(): PromptBindingRepository {
  if (!promptBindingRepository) {
    promptBindingRepository = new PromptBindingDataMapper(getDb());
  }

  return promptBindingRepository;
}

/** @lifetime process-cached singleton (Sprint 9) */
export function getUserPreferencesDataMapper(): UserPreferencesDataMapper {
  if (!userPreferencesDataMapper) {
    userPreferencesDataMapper = new UserPreferencesDataMapper(getDb());
  }
  return userPreferencesDataMapper;
}

/** @lifetime process-cached singleton (Sprint 9) */
export function getUserFileDataMapper(): UserFileDataMapper {
  if (!userFileDataMapper) {
    userFileDataMapper = new UserFileDataMapper(getDb());
  }
  return userFileDataMapper;
}

/** @lifetime process-cached singleton (Sprint 9) */
export function getVectorStore(): SQLiteVectorStore {
  if (!vectorStore) {
    vectorStore = new SQLiteVectorStore(getDb());
  }
  return vectorStore;
}

/**
 * Sprint 25 — elite ops degraded-path probe support.
 * Keeps DB pragma introspection behind the approved RepositoryFactory seam.
 */
export function getDbBusyTimeoutMs(): number | null {
  const db = getDb();

  try {
    const value = db.pragma("busy_timeout", { simple: true }) as unknown;
    return typeof value === "number" ? value : null;
  } catch {
    try {
      const rows = db.pragma("busy_timeout") as Array<Record<string, unknown>>;
      const value = rows[0]?.busy_timeout;
      return typeof value === "number" ? value : null;
    } catch {
      return null;
    }
  }
}

/**
 * FOR TESTS ONLY — resets all process-cached singleton references so the
 * next call will re-initialize against the current `getDb()` handle.
 * This prevents stale DB references when tests swap the DB instance.
 */
export function _resetRepositorySingletons(): void {
  repository = null;
  blogRepo = null;
  blogAssetRepo = null;
  blogArtifactRepo = null;
  blogRevisionRepo = null;
  journalEditorialMutationRepo = null;
  factoryRepo = null;
  factoryRepoDb = null;
  jobQueueRepo = null;
  jobQueueRepoDb = null;
  jobStatusQuery = null;
  executionTimelineReader = null;
  pushSubscriptionRepo = null;
  userDataMapper = null;
  leadRecordDataMapper = null;
  consultationRequestDataMapper = null;
  dealRecordDataMapper = null;
  trainingPathRecordDataMapper = null;
  referralDataMapper = null;
  referralEventDataMapper = null;
  workspaceSnapshotReader = null;
  workspaceRestoreReader = null;
  businessWorkflowContextReader = null;
  trustDistributionReader = null;
  operatorTransitionReader = null;
  systemPromptDataMapper = null;
  systemSettingsDataMapper = null;
  conversationDataMapper = null;
  messageDataMapper = null;
  conversationEventDataMapper = null;
  promptProvenanceDataMapper = null;
  materializationRepository = null;
  materializationRepositoryDb = null;
  mediaWorkflowRepository = null;
  mediaWorkflowRepositoryDb = null;
  mediaWorkflowReadModel = null;
  mediaWorkflowOrchestrator = null;
  identityMigrationRepository = null;
  promptBindingRepository = null;
  relationshipMemoryRepository = null;
  relationshipMemoryProjectionService = null;
  userPreferencesDataMapper = null;
  userFileDataMapper = null;
  vectorStore = null;
}
