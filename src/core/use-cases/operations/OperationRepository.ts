import type {
  Operation,
  OperationAction,
  OperationActionConfirmation,
  OperationActorType,
  OperationArtifact,
  OperationEvent,
  OperationEventType,
  OperationKind,
  OperationRiskLevel,
  OperationStatus,
  OperationStep,
  OperationStepStatus,
  OperationVisibility,
} from "@/core/entities/operation";
import type { RoleName } from "@/core/entities/user";
import type { OperationActionAccepted } from "@/core/use-cases/operations/OperationActionPolicy";
import type {
  AdminOperationSummary,
  ConversationOperationSummary,
  OperationHealthAggregate,
  OperationProgressSummary,
  PromptGroundingOperationSummary,
} from "@/core/use-cases/operations/OperationReadModel";

export interface OperationSnapshot {
  operation: Operation;
  steps: OperationStep[];
  actions: OperationAction[];
  events: OperationEvent[];
  artifacts: OperationArtifact[];
}

export interface OperationSummary {
  id: string;
  kind: OperationKind;
  title: string;
  status: OperationStatus;
  riskLevel: OperationRiskLevel;
  revision: number;
  conversationId: string | null;
  currentStepId: string | null;
  summary: string | null;
  createdByUserId: string | null;
  createdByRole: RoleName;
  visibility: OperationVisibility;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  stepCount: number;
  actionCount: number;
  artifactCount: number;
  eventCount: number;
  latestEventType: OperationEventType | null;
  latestEventAt: string | null;
  progress: OperationProgressSummary;
}

export interface OperationWriteContext {
  actorType?: OperationActorType;
  actorId?: string | null;
  now?: string;
}

export interface CreateOperationInput extends OperationWriteContext {
  id: string;
  kind: OperationKind;
  title: string;
  riskLevel?: OperationRiskLevel;
  status?: OperationStatus;
  conversationId?: string | null;
  originMessageId?: string | null;
  createdByUserId?: string | null;
  createdByRole: RoleName;
  visibility?: OperationVisibility;
  currentStepId?: string | null;
  summary?: string | null;
  input?: Record<string, unknown>;
  result?: Record<string, unknown> | null;
  error?: Operation["error"];
}

export interface UpdateOperationStatusInput extends OperationWriteContext {
  operationId: string;
  status: OperationStatus;
  supportsRetry?: boolean;
}

export interface UpsertStepInput extends OperationWriteContext {
  step: OperationStep;
}

export interface TransitionStepInput extends OperationWriteContext {
  operationId: string;
  stepId: string;
  status: OperationStepStatus;
  supportsRetry?: boolean;
}

export interface ReplaceActionsInput extends OperationWriteContext {
  operationId: string;
  actions: OperationAction[];
}

export interface AcceptActionInput {
  operationId: string;
  actionId: string;
  idempotencyKey: string;
  actorRole: RoleName;
  actorUserId?: string | null;
  payload?: Record<string, unknown>;
  confirmation?: OperationActionConfirmation;
  now?: string;
}

export interface AppendOperationEventInput extends OperationWriteContext {
  id?: string;
  operationId: string;
  stepId?: string | null;
  type: OperationEventType;
  payload?: Record<string, unknown>;
}

export interface AttachOperationArtifactInput extends OperationWriteContext {
  artifact: Omit<OperationArtifact, "createdAt"> & { createdAt?: string };
}

export interface OperationListOptions {
  status?: OperationStatus;
  kind?: OperationKind;
  limit?: number;
  offset?: number;
  createdFrom?: string;
  createdTo?: string;
}

export interface OperationEventListOptions {
  afterSequence?: number;
  limit?: number;
}

export interface OperationRepository {
  createOperation(input: CreateOperationInput): Promise<OperationSnapshot>;
  updateOperationStatus(input: UpdateOperationStatusInput): Promise<OperationSnapshot>;
  upsertStep(input: UpsertStepInput): Promise<OperationSnapshot>;
  transitionStep(input: TransitionStepInput): Promise<OperationSnapshot>;
  replaceActions(input: ReplaceActionsInput): Promise<OperationSnapshot>;
  acceptAction(input: AcceptActionInput): Promise<OperationActionAccepted>;
  appendEvent(input: AppendOperationEventInput): Promise<OperationEvent>;
  attachArtifact(input: AttachOperationArtifactInput): Promise<OperationArtifact>;
  findOperationById(id: string): Promise<OperationSnapshot | null>;
  listOperationsByConversation(conversationId: string, options?: OperationListOptions): Promise<OperationSummary[]>;
  listOperationsForUser(userId: string, options?: OperationListOptions): Promise<OperationSummary[]>;
  listOperationsForAdmin(options?: OperationListOptions): Promise<OperationSummary[]>;
  listEvents(operationId: string, options?: OperationEventListOptions): Promise<OperationEvent[]>;
  listArtifacts(operationId: string, options?: OperationEventListOptions): Promise<OperationArtifact[]>;
  listAvailableActions(operationId: string, options?: { now?: string }): Promise<OperationAction[]>;
  getConversationSummary(operationId: string): Promise<ConversationOperationSummary | null>;
  getAdminSummary(operationId: string): Promise<AdminOperationSummary | null>;
  getHealthAggregate(now?: string): Promise<OperationHealthAggregate>;
  getPromptGroundingSummary(operationId: string): Promise<PromptGroundingOperationSummary | null>;
}
