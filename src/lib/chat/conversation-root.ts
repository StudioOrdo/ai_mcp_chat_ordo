import { getDb } from "../db";
import { ConversationDataMapper } from "../../adapters/ConversationDataMapper";
import { MessageDataMapper } from "../../adapters/MessageDataMapper";
import { ConversationEventDataMapper } from "../../adapters/ConversationEventDataMapper";
import { RelationshipMemoryDataMapper } from "../../adapters/RelationshipMemoryDataMapper";
import { LeadRecordDataMapper } from "../../adapters/LeadRecordDataMapper";
import { ConsultationRequestDataMapper } from "../../adapters/ConsultationRequestDataMapper";
import { DealRecordDataMapper } from "../../adapters/DealRecordDataMapper";
import { TrainingPathRecordDataMapper } from "../../adapters/TrainingPathRecordDataMapper";
import { getPromptBindingRepository, getUserFileDataMapper } from "@/adapters/RepositoryFactory";
import { ConversationInteractor } from "../../core/use-cases/ConversationInteractor";
import { ConversationEventRecorder } from "../../core/use-cases/ConversationEventRecorder";
import { LeadCaptureInteractor } from "../../core/use-cases/LeadCaptureInteractor";
import { RequestConsultationInteractor } from "../../core/use-cases/RequestConsultationInteractor";
import { TriageConsultationRequestInteractor } from "../../core/use-cases/TriageConsultationRequestInteractor";
import { CreateDealFromWorkflowInteractor } from "../../core/use-cases/CreateDealFromWorkflowInteractor";
import { CreateTrainingPathFromWorkflowInteractor } from "../../core/use-cases/CreateTrainingPathFromWorkflowInteractor";
import { SummarizationInteractor } from "../../core/use-cases/SummarizationInteractor";
import { AnthropicSummarizer as SelectedProviderSummarizerAdapter } from "../../adapters/AnthropicSummarizer";
import { createRelationshipMemoryProjectionService } from "@/core/platform/relationship-memory/RelationshipMemoryProjectionService";
import { createSelectedIntelligenceRuntime } from "@/lib/ai/providers/selected-intelligence-runtime";
import { getReferralLedgerService } from "@/lib/referrals/referral-ledger";
import type { RelationshipMemoryReader } from "@/core/use-cases/RelationshipMemoryRepository";
import {
  HeuristicConversationRoutingAnalyzer,
  type ConversationRoutingAnalyzer,
} from "./routing-analysis";

type ChatPersistence = {
  conversationRepo: ConversationDataMapper;
  messageRepo: MessageDataMapper;
  relationshipMemoryRepo: RelationshipMemoryDataMapper;
};

type WorkflowRepositories = {
  consultationRequestRepo: ConsultationRequestDataMapper;
  leadRecordRepo: LeadRecordDataMapper;
  dealRecordRepo: DealRecordDataMapper;
  trainingPathRecordRepo: TrainingPathRecordDataMapper;
};

function createConversationPersistence(): ChatPersistence {
  // These builders remain request-scoped around the shared DB handle.
  // getDb() approved: intentional request-scoped grouping (Sprint 6) — see data-access-canary.test.ts (Sprint 9)
  const db = getDb();

  return {
    conversationRepo: new ConversationDataMapper(db),
    messageRepo: new MessageDataMapper(db),
    relationshipMemoryRepo: new RelationshipMemoryDataMapper(db),
  };
}

function createEventRecorder(): ConversationEventRecorder {
  // Event recording stays lightweight enough to construct per request.
  // getDb() approved: intentional request-scoped grouping (Sprint 6) — see data-access-canary.test.ts (Sprint 9)
  const db = getDb();
  const eventRepo = new ConversationEventDataMapper(db);
  return new ConversationEventRecorder(eventRepo);
}

function createWorkflowRepositories(): WorkflowRepositories {
  // Workflow repositories are grouped here so getters stop rewiring them ad hoc.
  // getDb() approved: intentional request-scoped grouping (Sprint 6) — see data-access-canary.test.ts (Sprint 9)
  const db = getDb();

  return {
    consultationRequestRepo: new ConsultationRequestDataMapper(db),
    leadRecordRepo: new LeadRecordDataMapper(db),
    dealRecordRepo: new DealRecordDataMapper(db),
    trainingPathRecordRepo: new TrainingPathRecordDataMapper(db),
  };
}

function createConversationSummarizer(): SelectedProviderSummarizerAdapter {
  const runtime = createSelectedIntelligenceRuntime();
  return new SelectedProviderSummarizerAdapter(
    runtime.client,
    runtime.provider,
    runtime.model,
  );
}

export type ConversationRuntimeServices = {
  interactor: ConversationInteractor;
  routingAnalyzer: ConversationRoutingAnalyzer;
  summarizationInteractor: SummarizationInteractor;
  relationshipMemoryReader: RelationshipMemoryReader;
};

export type ConversationRouteServices = {
  interactor: ConversationInteractor;
};

export function createConversationRouteServices(): ConversationRouteServices {
  return {
    interactor: getConversationInteractor(),
  };
}

export function createConversationRuntimeServices(): ConversationRuntimeServices {
  const { conversationRepo, messageRepo, relationshipMemoryRepo } = createConversationPersistence();
  const eventRecorder = createEventRecorder();
  const relationshipMemoryProjectionService = createRelationshipMemoryProjectionService({
    messageRepository: messageRepo,
    relationshipMemoryRepository: relationshipMemoryRepo,
    promptBindingRepository: getPromptBindingRepository(),
  });

  return {
    interactor: new ConversationInteractor(
      conversationRepo,
      messageRepo,
      eventRecorder,
      getUserFileDataMapper(),
      relationshipMemoryProjectionService,
    ),
    routingAnalyzer: new HeuristicConversationRoutingAnalyzer(),
    summarizationInteractor: new SummarizationInteractor(
      messageRepo,
      createConversationSummarizer(),
      eventRecorder,
    ),
    relationshipMemoryReader: relationshipMemoryRepo,
  };
}

export function getConversationInteractor(): ConversationInteractor {
  const { conversationRepo, messageRepo, relationshipMemoryRepo } = createConversationPersistence();
  const eventRecorder = createEventRecorder();
  const relationshipMemoryProjectionService = createRelationshipMemoryProjectionService({
    messageRepository: messageRepo,
    relationshipMemoryRepository: relationshipMemoryRepo,
    promptBindingRepository: getPromptBindingRepository(),
  });
  return new ConversationInteractor(
    conversationRepo,
    messageRepo,
    eventRecorder,
    getUserFileDataMapper(),
    relationshipMemoryProjectionService,
  );
}

export function getSummarizationInteractor(): SummarizationInteractor {
  const { messageRepo } = createConversationPersistence();
  const eventRecorder = createEventRecorder();
  const summarizer = createConversationSummarizer();
  return new SummarizationInteractor(messageRepo, summarizer, eventRecorder);
}

export function getLeadCaptureInteractor(): LeadCaptureInteractor {
  const { leadRecordRepo } = createWorkflowRepositories();
  const { conversationRepo } = createConversationPersistence();
  const eventRecorder = createEventRecorder();
  return new LeadCaptureInteractor(
    leadRecordRepo,
    conversationRepo,
    eventRecorder,
    getReferralLedgerService(),
  );
}

export function getLeadRecordRepository(): LeadRecordDataMapper {
  return createWorkflowRepositories().leadRecordRepo;
}

export function getConsultationRequestRepository(): ConsultationRequestDataMapper {
  return createWorkflowRepositories().consultationRequestRepo;
}

export function getDealRecordRepository(): DealRecordDataMapper {
  return createWorkflowRepositories().dealRecordRepo;
}

export function getTrainingPathRecordRepository(): TrainingPathRecordDataMapper {
  return createWorkflowRepositories().trainingPathRecordRepo;
}

export function getRequestConsultationInteractor(): RequestConsultationInteractor {
  const { consultationRequestRepo } = createWorkflowRepositories();
  const { conversationRepo } = createConversationPersistence();
  const eventRecorder = createEventRecorder();
  return new RequestConsultationInteractor(
    consultationRequestRepo,
    conversationRepo,
    eventRecorder,
    getReferralLedgerService(),
  );
}

export function getTriageConsultationRequestInteractor(): TriageConsultationRequestInteractor {
  const { consultationRequestRepo } = createWorkflowRepositories();
  const eventRecorder = createEventRecorder();
  return new TriageConsultationRequestInteractor(consultationRequestRepo, eventRecorder);
}

export function getCreateDealFromWorkflowInteractor(): CreateDealFromWorkflowInteractor {
  const { dealRecordRepo, consultationRequestRepo, leadRecordRepo } = createWorkflowRepositories();
  const { conversationRepo } = createConversationPersistence();
  const eventRecorder = createEventRecorder();
  return new CreateDealFromWorkflowInteractor(
    dealRecordRepo,
    consultationRequestRepo,
    leadRecordRepo,
    conversationRepo,
    eventRecorder,
    getReferralLedgerService(),
  );
}

export function getCreateTrainingPathFromWorkflowInteractor(): CreateTrainingPathFromWorkflowInteractor {
  const { trainingPathRecordRepo, consultationRequestRepo, leadRecordRepo } = createWorkflowRepositories();
  const { conversationRepo } = createConversationPersistence();
  const eventRecorder = createEventRecorder();
  return new CreateTrainingPathFromWorkflowInteractor(
    trainingPathRecordRepo,
    consultationRequestRepo,
    leadRecordRepo,
    conversationRepo,
    eventRecorder,
    getReferralLedgerService(),
  );
}

export function getConversationEventRecorder(): ConversationEventRecorder {
  return createEventRecorder();
}

export function getConversationRoutingAnalyzer(): ConversationRoutingAnalyzer {
  return new HeuristicConversationRoutingAnalyzer();
}
