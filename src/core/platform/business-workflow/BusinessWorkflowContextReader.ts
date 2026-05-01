import type { JobEvent, JobStatus } from "@/core/entities/job";
import type { Referral } from "@/core/entities/Referral";
import type { ReferralEvent } from "@/core/entities/ReferralEvent";
import type { ConversationRepository } from "@/core/use-cases/ConversationRepository";
import type { BusinessWorkflowContextReader } from "@/core/use-cases/BusinessWorkflowContextRepository";
import type { ConsultationRequestRepository } from "@/core/use-cases/ConsultationRequestRepository";
import type { DealRecordRepository } from "@/core/use-cases/DealRecordRepository";
import type { JobQueueRepository } from "@/core/use-cases/JobQueueRepository";
import type { LeadRecordRepository } from "@/core/use-cases/LeadRecordRepository";
import type { TrainingPathRecordRepository } from "@/core/use-cases/TrainingPathRecordRepository";
import type { BusinessWorkflowContext } from "@/core/entities/business-workflow-context";
import {
  projectBusinessWorkflowContext,
  type WorkflowReadinessProbeResult,
} from "@/core/platform/business-workflow/BusinessWorkflowContextProjector";

export interface ReferralWorkflowReader {
  findByConversation(conversationId: string): Referral | null | Promise<Referral | null>;
}

export interface ReferralEventWorkflowReader {
  listByReferralId(referralId: string): ReferralEvent[] | Promise<ReferralEvent[]>;
}

export interface WorkflowReadinessProbe {
  getReadiness(): WorkflowReadinessProbeResult | Promise<WorkflowReadinessProbeResult>;
}

export interface RepositoryBackedBusinessWorkflowContextReaderDeps {
  conversationRepository: ConversationRepository;
  leadRecordRepository: LeadRecordRepository;
  consultationRequestRepository: ConsultationRequestRepository;
  dealRecordRepository: DealRecordRepository;
  trainingPathRecordRepository: TrainingPathRecordRepository;
  referralReader?: ReferralWorkflowReader;
  referralEventReader?: ReferralEventWorkflowReader;
  jobQueueRepository?: JobQueueRepository;
  readinessProbe?: WorkflowReadinessProbe;
}

const TERMINAL_JOB_STATUSES: JobStatus[] = ["succeeded", "failed", "canceled", "dead_letter"];
const NOTIFICATION_EVENT_TYPES = new Set(["notification_sent", "notification_failed"]);

function isNotificationEvent(event: JobEvent): boolean {
  return NOTIFICATION_EVENT_TYPES.has(event.eventType);
}

export class RepositoryBackedBusinessWorkflowContextReader implements BusinessWorkflowContextReader {
  constructor(private readonly deps: RepositoryBackedBusinessWorkflowContextReaderDeps) {}

  async findById(id: string): Promise<BusinessWorkflowContext | null> {
    if (!id.startsWith("bwc_")) {
      return null;
    }

    return this.findByConversationId(id.slice("bwc_".length));
  }

  async findByConversationId(conversationId: string): Promise<BusinessWorkflowContext | null> {
    const conversation = await this.deps.conversationRepository.findById(conversationId);
    if (!conversation) {
      return null;
    }

    const [lead, consultation, deal, trainingPath, referral, readiness, jobNotificationEvents] = await Promise.all([
      this.deps.leadRecordRepository.findByConversationId(conversationId),
      this.deps.consultationRequestRepository.findByConversationId(conversationId),
      this.deps.dealRecordRepository.findByConversationId(conversationId),
      this.deps.trainingPathRecordRepository.findByConversationId(conversationId),
      this.deps.referralReader?.findByConversation(conversationId) ?? Promise.resolve(null),
      this.deps.readinessProbe?.getReadiness() ?? Promise.resolve(null),
      this.loadJobNotificationEvents(conversationId),
    ]);

    const referralEvents = referral && this.deps.referralEventReader
      ? await this.deps.referralEventReader.listByReferralId(referral.id)
      : [];

    return projectBusinessWorkflowContext({
      conversation,
      lead,
      consultation,
      deal,
      trainingPath,
      referral,
      referralEvents,
      jobNotificationEvents,
      readiness,
    });
  }

  private async loadJobNotificationEvents(conversationId: string): Promise<JobEvent[]> {
    if (!this.deps.jobQueueRepository) {
      return [];
    }

    const terminalJobs = await this.deps.jobQueueRepository.listJobsByConversation(conversationId, {
      statuses: TERMINAL_JOB_STATUSES,
      limit: 50,
    });
    if (terminalJobs.length === 0) {
      return [];
    }

    const terminalJobIds = new Set(terminalJobs.map((job) => job.id));
    const events = await this.deps.jobQueueRepository.listConversationEvents(conversationId, { limit: 200 });
    return events.filter((event) => terminalJobIds.has(event.jobId) && isNotificationEvent(event));
  }
}

export function createBusinessWorkflowContextReader(
  deps: RepositoryBackedBusinessWorkflowContextReaderDeps,
): BusinessWorkflowContextReader {
  return new RepositoryBackedBusinessWorkflowContextReader(deps);
}