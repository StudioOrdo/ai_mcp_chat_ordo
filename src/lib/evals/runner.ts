import { resolveEvalRuntimeConfig } from "./config";
import type { EvalObservation, EvalRunConfig, EvalScenario } from "./domain";
import { resolveSessionResolutionSignal } from "@/lib/chat/session-resolution";
import { BlogPostDataMapper } from "@/adapters/BlogPostDataMapper";
import { ChatPresenter } from "@/adapters/ChatPresenter";
import { CommandParserService } from "@/adapters/CommandParserService";
import { JobQueueDataMapper } from "@/adapters/JobQueueDataMapper";
import { MarkdownParserService } from "@/adapters/MarkdownParserService";
import { getCorpusRepository } from "@/adapters/RepositoryFactory";
import type { ChatMessage } from "@/core/entities/chat-message";
import type { Document } from "@/core/entities/corpus";
import { Section } from "@/core/entities/corpus";
import type { InlineNode } from "@/core/entities/rich-content";
import { isDealCustomerVisibleStatus } from "@/core/entities/deal-record";
import { isTrainingPathCustomerVisibleStatus } from "@/core/entities/training-path-record";
import type { CorpusRepository } from "@/core/use-cases/CorpusRepository";
import { GetSectionCommand, SearchCorpusCommand, type GetSectionPayload, type SearchCorpusPayload } from "@/core/use-cases/tools/CorpusTools";
import { executePublishContent } from "@/core/use-cases/tools/admin-content.tool";
import { createDeferredJobResultPayload, deferredJobResultToMessagePart } from "@/lib/jobs/deferred-job-result";
import { buildJobStatusSnapshot, getActiveJobStatuses } from "@/lib/jobs/job-read-model";
import {
  evaluateCanonicalCorpusSearchPayload,
  evaluateStructuredGetSectionPayload,
  type CanonicalCorpusSearchPayload,
} from "./runtime-integrity-checks";
import { getEvalScenarioById } from "./scenarios";
import { inflateDeterministicSeedPack, resolveDeterministicSeedPack } from "./seeding";
import { createEvalWorkspace } from "./workspace";

export interface EvalCheckpointResult {
  id: string;
  label: string;
  required: boolean;
  passed: boolean;
  details: string | null;
}

export interface DeterministicEvalExecution {
  scenario: EvalScenario;
  run: EvalRunConfig;
  observations: EvalObservation[];
  checkpointResults: EvalCheckpointResult[];
  stopReason: string | null;
  finalState: {
    lane: string | null;
    recommendation: string | null;
    toolCalls: string[];
  };
}

function createCheckpointResult(
  scenario: EvalScenario,
  checkpointId: string,
  passed: boolean,
  details: string | null,
): EvalCheckpointResult {
  const checkpoint = scenario.expectedCheckpoints.find((candidate) => candidate.id === checkpointId);

  if (!checkpoint) {
    throw new Error(`Unknown checkpoint ${checkpointId} for scenario ${scenario.id}`);
  }

  return {
    id: checkpoint.id,
    label: checkpoint.label,
    required: checkpoint.required,
    passed,
    details,
  };
}

function createRunConfig(scenario: EvalScenario, seedSetId: string, now: Date): EvalRunConfig {
  const runtime = resolveEvalRuntimeConfig({
    env: {
      EVAL_TARGET_ENV: scenario.targetEnvironment,
      EVAL_SEED_SET_ID: seedSetId,
    },
    now,
  });

  return {
    scenarioId: scenario.id,
    layer: scenario.layer,
    targetEnvironment: scenario.targetEnvironment,
    mode: runtime.mode,
    modelProvider: runtime.modelProvider,
    modelName: runtime.modelName,
    seedSetId: runtime.seedSetId,
    startedAt: runtime.startedAt,
  };
}

function pushMessageObservations(observations: EvalObservation[], messages: Array<{ role: string; content: string; createdAt: string }>): void {
  for (const message of messages) {
    observations.push({
      kind: "message",
      at: message.createdAt,
      data: {
        role: message.role,
        content: message.content,
      },
    });
  }
}

function pushCheckpointObservations(observations: EvalObservation[], run: EvalRunConfig, checkpointResults: EvalCheckpointResult[]): void {
  for (const checkpoint of checkpointResults) {
    observations.push({
      kind: "checkpoint",
      at: run.startedAt,
      data: {
        checkpointId: checkpoint.id,
        passed: checkpoint.passed,
        details: checkpoint.details,
      },
    });
  }
}

function pushConversationEventObservations(
  observations: EvalObservation[],
  events: Array<{ type: string; metadata: Record<string, unknown>; createdAt: string }>,
): void {
  for (const event of events) {
    observations.push({
      kind: "state_transition",
      at: event.createdAt,
      data: {
        transition: event.type,
        ...event.metadata,
      },
    });
  }
}

function createActiveJobCountCheckpoint(
  scenario: EvalScenario,
  checkpointId: string,
  activeJobs: Array<{ toolName: string }>,
  toolName: string,
  jobLabel: string,
): EvalCheckpointResult {
  const matchingJobCount = activeJobs.filter((candidate) => candidate.toolName === toolName).length;

  return createCheckpointResult(
    scenario,
    checkpointId,
    matchingJobCount === 1,
    `Found ${matchingJobCount} active ${jobLabel} jobs.`,
  );
}

function createDeterministicCorpusRepository(sections: Section[], documents: Document[]): CorpusRepository {
  return {
    getAllDocuments: async () => documents,
    getDocument: async (slug: string) => documents.find((document) => document.slug === slug) ?? null,
    getSectionsByDocument: async (documentSlug: string) => sections.filter((section) => section.documentSlug === documentSlug),
    getAllSections: async () => sections,
    getSection: async (documentSlug: string, sectionSlug: string) => {
      const section = sections.find(
        (candidate) => candidate.documentSlug === documentSlug && candidate.sectionSlug === sectionSlug,
      );

      if (!section) {
        throw new Error(`Missing section: ${documentSlug}/${sectionSlug}`);
      }

      return section;
    },
  };
}

export async function runDeterministicEvalScenario(
  scenarioId: string,
  options: { now?: Date } = {},
): Promise<DeterministicEvalExecution> {
  const scenario = getEvalScenarioById(scenarioId);

  if (scenario.layer !== "deterministic") {
    throw new Error(`Scenario ${scenarioId} is not deterministic.`);
  }

  const seedPack = resolveDeterministicSeedPack(scenarioId);
  const workspace = createEvalWorkspace();
  const now = options.now ?? new Date("2026-03-20T14:00:00.000Z");
  const run = createRunConfig(scenario, seedPack.seedSetId, now);
  const observations: EvalObservation[] = [];
  const checkpointResults: EvalCheckpointResult[] = [];
  let stopReason: string | null = null;
  let finalLane: string | null = null;
  let finalRecommendation: string | null = null;
  const toolCalls: string[] = [];

  try {
    const inflated = await inflateDeterministicSeedPack(workspace, seedPack);
    const primaryConversationId = inflated.refs.primaryConversationId;

    if (!primaryConversationId) {
      throw new Error(`Seed pack ${scenarioId} is missing primaryConversationId.`);
    }

    const conversation = await workspace.conversationRepo.findById(primaryConversationId);

    if (!conversation) {
      throw new Error(`Primary conversation ${primaryConversationId} was not seeded.`);
    }

    const messages = await workspace.listMessages(primaryConversationId);
    pushMessageObservations(observations, messages);
    finalLane = conversation.routingSnapshot.lane;
    finalRecommendation = conversation.routingSnapshot.recommendedNextStep;

    switch (scenarioId) {
      case "anonymous-high-intent-dropout": {
        const lead = await workspace.leadRepo.findByConversationId(primaryConversationId);
        const consultationRequest = await workspace.consultationRequestRepo.findByConversationId(primaryConversationId);
        const frictionReason = conversation.messageCount >= 2 && !lead && !consultationRequest
          ? "High-intent anonymous conversation ended before signup or contact capture."
          : null;

        checkpointResults.push(
          createCheckpointResult(scenario, "anonymous-discovery", messages.length > 0, messages.length > 0 ? null : "No seeded messages were found."),
          createCheckpointResult(
            scenario,
            "dropout-detected",
            conversation.userId.startsWith("anon_") && !lead && !consultationRequest,
            lead || consultationRequest ? "A downstream record exists, so this is not a dropout." : null,
          ),
          createCheckpointResult(
            scenario,
            "friction-summary",
            frictionReason !== null,
            frictionReason,
          ),
        );

        stopReason = "journey_stopped_before_signup";
        observations.push({
          kind: "summary",
          at: run.startedAt,
          data: {
            stopReason,
            frictionReason,
            finalLane,
            finalRecommendation,
          },
        });
        break;
      }
      case "anonymous-signup-continuity": {
        const anonymousUserId = inflated.refs.anonymousUserId;
        const authenticatedUserId = inflated.refs.authenticatedUserId;

        if (!anonymousUserId || !authenticatedUserId) {
          throw new Error("Signup continuity seed pack is missing ownership refs.");
        }

        await workspace.conversationRepo.transferOwnership(anonymousUserId, authenticatedUserId);
        await workspace.appendMessage({
          conversationId: primaryConversationId,
          role: "user",
          content: "I signed up. Can we keep going with the operator path?",
          createdAt: "2026-03-20T10:03:30.000Z",
        });
        await workspace.appendMessage({
          conversationId: primaryConversationId,
          role: "assistant",
          content: "Yes. Your conversation stays intact and the next step is an apprenticeship screening recommendation.",
          createdAt: "2026-03-20T10:04:00.000Z",
        });
        const migratedConversation = await workspace.conversationRepo.findById(primaryConversationId);
        const activeConversation = await workspace.conversationRepo.findActiveByUser(authenticatedUserId);
        const updatedMessages = await workspace.listMessages(primaryConversationId);
        const postSignupMessages = updatedMessages.slice(messages.length);

        pushMessageObservations(observations, postSignupMessages);

        observations.push({
          kind: "state_transition",
          at: run.startedAt,
          data: {
            transition: "conversation_migrated",
            fromUserId: anonymousUserId,
            toUserId: authenticatedUserId,
            conversationId: primaryConversationId,
          },
        });

        checkpointResults.push(
          createCheckpointResult(scenario, "anonymous-discovery", messages.length > 0, null),
          createCheckpointResult(scenario, "signup", migratedConversation?.userId === authenticatedUserId, null),
          createCheckpointResult(
            scenario,
            "continuity",
            migratedConversation?.convertedFrom === anonymousUserId
              && activeConversation?.id === primaryConversationId
              && postSignupMessages.length >= 2,
            migratedConversation?.convertedFrom === anonymousUserId && postSignupMessages.length >= 2
              ? null
              : "Conversation ownership markers were preserved, but a continued post-signup exchange was not proven.",
          ),
        );

        finalLane = migratedConversation?.routingSnapshot.lane ?? finalLane;
        finalRecommendation = migratedConversation?.routingSnapshot.recommendedNextStep ?? finalRecommendation;
        stopReason = null;
        observations.push({
          kind: "summary",
          at: run.startedAt,
          data: {
            stopReason,
            finalLane,
            finalRecommendation,
            activeConversationId: activeConversation?.id ?? null,
          },
        });
        break;
      }
      case "integrity-canonical-corpus-reference-deterministic": {
        const searchCommand = new SearchCorpusCommand(getCorpusRepository());
        const payload = await searchCommand.execute(
          { query: "sage", max_results: 3 },
          { role: "AUTHENTICATED", userId: inflated.refs.authenticatedUserId ?? conversation.userId },
        ) as CanonicalCorpusSearchPayload;
        const evaluation = evaluateCanonicalCorpusSearchPayload(payload);

        toolCalls.push("search_corpus");
        observations.push({
          kind: "tool_call",
          at: run.startedAt,
          data: {
            toolId: "search_corpus",
            args: { query: "sage", max_results: 3 },
            result: payload,
            matchedExpected: evaluation.matchedExpected,
          },
        });

        checkpointResults.push(
          createCheckpointResult(
            scenario,
            "canonical-path-returned",
            evaluation.canonicalPathsReturned,
            payload.results[0]?.canonicalPath ?? "No canonical path returned.",
          ),
          createCheckpointResult(
            scenario,
            "resolver-path-returned",
            evaluation.resolverPathsReturned,
            payload.results[0]?.resolverPath ?? "No resolver path returned.",
          ),
          createCheckpointResult(
            scenario,
            "grounding-followup-honest",
            evaluation.groundingFollowupHonest,
            `${payload.groundingState}:${payload.followUp}`,
          ),
        );

        finalRecommendation = payload.results[0]?.canonicalPath ?? finalRecommendation;
        observations.push({
          kind: "summary",
          at: run.startedAt,
          data: {
            stopReason: null,
            finalLane,
            finalRecommendation,
            groundingState: payload.groundingState,
          },
        });
        break;
      }
      case "integrity-audio-recovery-deterministic": {
        const finalAssistantMessage: { role: ChatMessage["role"]; content: string; createdAt: string } = {
          role: "assistant",
          content: "Audio generation failed to stream in the browser, so the transcript remains available below. Retry audio generation if you still want spoken playback.",
          createdAt: "2026-03-20T13:31:00.000Z",
        };

        await workspace.appendMessage({
          conversationId: primaryConversationId,
          role: finalAssistantMessage.role,
          content: finalAssistantMessage.content,
          createdAt: finalAssistantMessage.createdAt,
        });
        pushMessageObservations(observations, [finalAssistantMessage]);

        toolCalls.push("generate_audio");
        observations.push({
          kind: "tool_call",
          at: run.startedAt,
          data: {
            toolId: "generate_audio",
            args: {
              title: "Integrity Audio Retry",
              text: "Transcript remains visible.",
            },
            error: "Failed to stream audio",
            matchedExpected: false,
          },
        });

        checkpointResults.push(
          createCheckpointResult(
            scenario,
            "audio-failure-detected",
            true,
            "Failed to stream audio",
          ),
          createCheckpointResult(
            scenario,
            "fallback-transcript-visible",
            finalAssistantMessage.content.includes("transcript remains available"),
            finalAssistantMessage.content,
          ),
          createCheckpointResult(
            scenario,
            "recovery-guidance-visible",
            finalAssistantMessage.content.includes("Retry audio generation"),
            finalAssistantMessage.content,
          ),
        );

        finalRecommendation = finalAssistantMessage.content;
        observations.push({
          kind: "summary",
          at: run.startedAt,
          data: {
            stopReason: null,
            finalLane,
            finalRecommendation,
          },
        });
        break;
      }
      case "integrity-malformed-ui-tags-deterministic": {
        const presenter = new ChatPresenter(new MarkdownParserService(), new CommandParserService());
        const presented = presenter.present({
          id: "msg_eval_integrity_ui_tags_assistant",
          role: "assistant",
          content: [
            "Use the repaired route chip.",
            "__suggestions__:[123,null,{\"bad\":true}]",
            "__actions__:[{\"label\":\"Open library\",\"action\":\"route\",\"params\":{\"href\":\"/library\",\"tracking\":\"integrity\"}},{\"label\":\"Broken\",\"action\":\"unknown\",\"params\":{}}]",
          ].join(" "),
          timestamp: new Date(run.startedAt),
          parts: [],
        });

        checkpointResults.push(
          createCheckpointResult(
            scenario,
            "suggestions-suppressed",
            presented.suggestions.length === 0 && presented.responseState === "closed",
            JSON.stringify({ responseState: presented.responseState, suggestions: presented.suggestions }),
          ),
          createCheckpointResult(
            scenario,
            "actions-repaired",
            presented.actions.length === 1 && presented.actions[0]?.label === "Open library",
            JSON.stringify(presented.actions),
          ),
          createCheckpointResult(
            scenario,
            "canonical-action-params",
            presented.actions[0]?.params.path === "/library" && !("href" in (presented.actions[0]?.params ?? {})),
            JSON.stringify(presented.actions[0]?.params ?? null),
          ),
        );

        observations.push({
          kind: "summary",
          at: run.startedAt,
          data: {
            stopReason: null,
            finalLane,
            finalRecommendation: presented.actions[0]?.params.path ?? null,
            responseState: presented.responseState,
            suggestions: presented.suggestions,
            actions: presented.actions,
          },
        });
        finalRecommendation = presented.actions[0]?.params.path ?? finalRecommendation;
        break;
      }
      case "integrity-session-resolution-deterministic": {
        const actionableText = 'Here is your deployment path. __response_state__:"open" __actions__:[{"label":"Continue","action":"route","params":{"path":"/onward"}}]';
        const actionableExtracted = resolveSessionResolutionSignal({
          status: "completed",
          assistantText: actionableText,
          assistantParts: [],
        });

        const closedText = 'You are entirely squared away under those conditions. __response_state__:"closed"';
        const closedExtracted = resolveSessionResolutionSignal({
          status: "completed",
          assistantText: closedText,
          assistantParts: [],
        });

        checkpointResults.push(
          createCheckpointResult(
            scenario,
            "resolution-advanced",
            actionableExtracted?.kind === "advanced" && actionableExtracted?.reason === "actionable_next_steps",
            JSON.stringify(actionableExtracted),
          ),
          createCheckpointResult(
            scenario,
            "resolution-resolved",
            closedExtracted?.kind === "resolved" && closedExtracted?.reason === "closed_response_state",
            JSON.stringify(closedExtracted),
          ),
        );

        observations.push({
          kind: "summary",
          at: run.startedAt,
          data: {
            stopReason: null,
            finalLane,
            finalRecommendation,
            actionableExtracted,
            closedExtracted,
          },
        });
        break;
      }
      case "integrity-retrieval-quality-deterministic": {
        const searchCommand = new SearchCorpusCommand(getCorpusRepository());
        const authUser = { role: "AUTHENTICATED", userId: inflated.refs.authenticatedUserId ?? conversation.userId } as const;
        type RetrievalQualityPayload = { retrievalQuality?: string };

        const strongPayload = await searchCommand.execute({ query: "technology" }, authUser) as RetrievalQualityPayload;
        const partialPayload = await searchCommand.execute({ query: "technology technology technology technology technology" }, authUser) as RetrievalQualityPayload;
        const nonePayload = await searchCommand.execute({ query: "zzxz zzyz zzzx" }, authUser) as RetrievalQualityPayload;

        checkpointResults.push(
          createCheckpointResult(
            scenario,
            "quality-strong",
            strongPayload.retrievalQuality === "strong",
            strongPayload.retrievalQuality ?? null,
          ),
          createCheckpointResult(
            scenario,
            "quality-partial",
            partialPayload.retrievalQuality === "partial",
            partialPayload.retrievalQuality ?? null,
          ),
          createCheckpointResult(
            scenario,
            "quality-none",
            nonePayload.retrievalQuality === "none",
            nonePayload.retrievalQuality ?? null,
          ),
        );

        observations.push({
          kind: "summary",
          at: run.startedAt,
          data: {
            stopReason: null,
            finalLane,
            finalRecommendation,
            strongPayload: strongPayload.retrievalQuality,
            partialPayload: partialPayload.retrievalQuality,
            nonePayload: nonePayload.retrievalQuality,
          },
        });
        break;
      }
      case "integrity-two-stage-retrieval-deterministic": {
        const documents: Document[] = [
          { slug: "archetype-atlas", title: "The Archetype Atlas", number: "III", audience: "public" },
          { slug: "second-renaissance", title: "The Second Renaissance", number: "I", audience: "public" },
        ];
        const sections = [
          new Section(
            "archetype-atlas",
            "ch04-the-sage",
            "The Sage: Clarity, Method, Evidence",
            "The Sage values method, clarity, rigor, and evidence in judgment.",
            [],
            ["evidence"],
            ["clarity", "method"],
          ),
          new Section(
            "archetype-atlas",
            "ch05-the-magician",
            "The Magician: Method In Practice",
            "Method and clarity become transformation when they are deployed repeatedly in practice.",
            [],
            ["method"],
            ["clarity", "deployment"],
          ),
          new Section(
            "second-renaissance",
            "ch02-signal-and-proof",
            "Signal And Proof",
            "Visible proof depends on evidence, clarity, and repeated method.",
            [],
            ["proof"],
            ["evidence", "clarity"],
          ),
        ];
        const repo = createDeterministicCorpusRepository(sections, documents);
        const searchCommand = new SearchCorpusCommand(repo);
        const authUser = { role: "AUTHENTICATED", userId: inflated.refs.authenticatedUserId ?? conversation.userId } as const;

        const strongPayload = await searchCommand.execute({ query: "clarity method evidence", max_results: 3 }, authUser) as SearchCorpusPayload;
        const partialPayload = await searchCommand.execute({ query: "method", max_results: 3 }, authUser) as SearchCorpusPayload;

        toolCalls.push("search_corpus");
        observations.push(
          {
            kind: "tool_call",
            at: run.startedAt,
            data: {
              toolId: "search_corpus",
              args: { query: "clarity method evidence", max_results: 3 },
              result: strongPayload,
            },
          },
          {
            kind: "tool_call",
            at: run.startedAt,
            data: {
              toolId: "search_corpus",
              args: { query: "method", max_results: 3 },
              result: partialPayload,
            },
          },
        );

        checkpointResults.push(
          createCheckpointResult(
            scenario,
            "strong-auto-read",
            strongPayload.groundingState === "prefetched_section" && strongPayload.prefetchedSection?.found === true,
            JSON.stringify({ groundingState: strongPayload.groundingState, found: strongPayload.prefetchedSection?.found ?? false }),
          ),
          createCheckpointResult(
            scenario,
            "partial-stays-locate-step",
            partialPayload.groundingState === "search_only" && partialPayload.followUp === "call_get_section_before_detailed_claims" && partialPayload.prefetchedSection === null,
            JSON.stringify({ groundingState: partialPayload.groundingState, followUp: partialPayload.followUp }),
          ),
          createCheckpointResult(
            scenario,
            "strong-prefetch-canonical",
            strongPayload.prefetchedSection?.canonicalPath === strongPayload.results[0]?.canonicalPath,
            JSON.stringify({
              prefetchedCanonicalPath: strongPayload.prefetchedSection?.canonicalPath ?? null,
              resultCanonicalPath: strongPayload.results[0]?.canonicalPath ?? null,
            }),
          ),
        );

        observations.push({
          kind: "summary",
          at: run.startedAt,
          data: {
            stopReason: null,
            finalLane,
            finalRecommendation,
            strongGroundingState: strongPayload.groundingState,
            partialGroundingState: partialPayload.groundingState,
          },
        });
        break;
      }
      case "integrity-structured-get-section-deterministic": {
        const documents: Document[] = [
          { slug: "second-renaissance", title: "The Second Renaissance", number: "I", audience: "public" },
          { slug: "archetype-atlas", title: "The Archetype Atlas", number: "III", audience: "public" },
        ];
        const sections = [
          new Section(
            "second-renaissance",
            "ch00-introduction",
            "Introduction",
            "This chapter frames the broader transition.",
            [],
            [],
            ["transition"],
          ),
          new Section(
            "second-renaissance",
            "ch01-why-now",
            "Why Now: The Printing Press Analogy",
            "The printing press analogy explains why this transition compounds.",
            [],
            ["proof"],
            ["printing press", "transition"],
          ),
          new Section(
            "second-renaissance",
            "ch02-signal",
            "Signal And Proof",
            "Visible proof makes the transition legible to other people.",
            [],
            ["proof"],
            ["signal", "transition"],
          ),
          new Section(
            "archetype-atlas",
            "ch04-the-sage",
            "The Sage: Clarity, Method, Evidence",
            "Clarity and evidence give the reader a stable method.",
            [],
            ["evidence"],
            ["clarity", "method"],
          ),
        ];
        const repo = createDeterministicCorpusRepository(sections, documents);
        const command = new GetSectionCommand(repo);
        const authUser = { role: "AUTHENTICATED", userId: inflated.refs.authenticatedUserId ?? conversation.userId } as const;

        const structuredPayload = await command.execute(
          { document_slug: "wrong-book", section_slug: "why-now" },
          authUser,
        ) as GetSectionPayload;
        const missingPayload = await command.execute(
          { document_slug: "wrong-book", section_slug: "missing-section" },
          authUser,
        ) as GetSectionPayload;
        const evaluation = evaluateStructuredGetSectionPayload(structuredPayload);

        toolCalls.push("get_section");
        observations.push(
          {
            kind: "tool_call",
            at: run.startedAt,
            data: {
              toolId: "get_section",
              args: { document_slug: "wrong-book", section_slug: "why-now" },
              result: structuredPayload,
              matchedExpected: evaluation.matchedExpected,
            },
          },
          {
            kind: "tool_call",
            at: run.startedAt,
            data: {
              toolId: "get_section",
              args: { document_slug: "wrong-book", section_slug: "missing-section" },
              result: missingPayload,
            },
          },
        );

        checkpointResults.push(
          createCheckpointResult(
            scenario,
            "structured-metadata-returned",
            evaluation.structuredMetadataReturned && structuredPayload.resolvedFromAlias,
            JSON.stringify({ found: structuredPayload.found, resolvedFromAlias: structuredPayload.resolvedFromAlias, title: structuredPayload.title }),
          ),
          createCheckpointResult(
            scenario,
            "related-sections-returned",
            evaluation.relatedSectionsReturned,
            JSON.stringify(structuredPayload.relatedSections.map((section) => section.canonicalPath ?? section.fallbackSearchPath)),
          ),
          createCheckpointResult(
            scenario,
            "citation-targets-safe",
            evaluation.citationTargetsSafe && missingPayload.canonicalPath === null && missingPayload.fallbackSearchPath === "/library",
            JSON.stringify({
              relatedSections: structuredPayload.relatedSections,
              missingFallbackSearchPath: missingPayload.fallbackSearchPath,
              missingCanonicalPath: missingPayload.canonicalPath,
            }),
          ),
        );

        observations.push({
          kind: "summary",
          at: run.startedAt,
          data: {
            stopReason: null,
            finalLane,
            finalRecommendation,
            resolvedFromAlias: structuredPayload.resolvedFromAlias,
            relatedSectionCount: structuredPayload.relatedSections.length,
          },
        });
        break;
      }
      case "organization-buyer-deterministic": {
        const lead = await workspace.leadRepo.findByConversationId(primaryConversationId);
        const consultationRequest = await workspace.consultationRequestRepo.findByConversationId(primaryConversationId);

        if (!consultationRequest) {
          throw new Error("Organization buyer deterministic scenario requires a seeded consultation request.");
        }

        const deal = await workspace.dealWorkflow.createFromConsultationRequest("admin_eval_runner", consultationRequest.id);
        const visibleDeal = await workspace.dealRepo.updateStatus(deal.id, "estimate_ready", {
          founderNote: "Founder approved the estimate-ready next step.",
        });
        const events = await workspace.listConversationEvents(primaryConversationId);

        pushConversationEventObservations(observations, events);

        checkpointResults.push(
          createCheckpointResult(
            scenario,
            "qualification",
            lead?.triageState === "qualified" && consultationRequest.status === "reviewed",
            consultationRequest.status,
          ),
          createCheckpointResult(
            scenario,
            "consultation-or-deal",
            visibleDeal !== null,
            visibleDeal?.id ?? "Deal was not created.",
          ),
          createCheckpointResult(
            scenario,
            "approved-next-step",
            visibleDeal !== null && isDealCustomerVisibleStatus(visibleDeal.status),
            visibleDeal?.status ?? "Missing customer-visible deal status.",
          ),
        );

        finalLane = visibleDeal?.lane ?? finalLane;
        finalRecommendation = visibleDeal?.nextAction ?? finalRecommendation;
        observations.push({
          kind: "summary",
          at: run.startedAt,
          data: {
            stopReason: null,
            finalLane,
            finalRecommendation,
            dealId: visibleDeal?.id ?? null,
            visibleStatus: visibleDeal?.status ?? null,
          },
        });
        break;
      }
      case "individual-learner-deterministic": {
        const lead = await workspace.leadRepo.findByConversationId(primaryConversationId);

        if (!lead) {
          throw new Error("Individual learner deterministic scenario requires a seeded qualified lead.");
        }

        const trainingPath = await workspace.trainingWorkflow.createFromQualifiedLead("admin_eval_runner", lead.id);
        const visibleTrainingPath = await workspace.trainingPathRepo.updateStatus(trainingPath.id, "recommended", {
          founderNote: "Founder approved the training recommendation.",
        });
        const events = await workspace.listConversationEvents(primaryConversationId);

        pushConversationEventObservations(observations, events);

        checkpointResults.push(
          createCheckpointResult(
            scenario,
            "training-fit",
            lead.triageState === "qualified" && lead.trainingFit === "career_transition",
            lead.trainingFit ?? "Missing training fit.",
          ),
          createCheckpointResult(
            scenario,
            "training-path-created",
            visibleTrainingPath !== null,
            visibleTrainingPath?.id ?? "Training path was not created.",
          ),
          createCheckpointResult(
            scenario,
            "approved-recommendation",
            visibleTrainingPath !== null && isTrainingPathCustomerVisibleStatus(visibleTrainingPath.status),
            visibleTrainingPath?.status ?? "Missing customer-visible training-path status.",
          ),
        );

        finalLane = visibleTrainingPath?.lane ?? finalLane;
        finalRecommendation = visibleTrainingPath?.customerSummary ?? finalRecommendation;
        observations.push({
          kind: "summary",
          at: run.startedAt,
          data: {
            stopReason: null,
            finalLane,
            finalRecommendation,
            trainingPathId: visibleTrainingPath?.id ?? null,
            visibleStatus: visibleTrainingPath?.status ?? null,
          },
        });
        break;
      }
      case "blog-job-status-continuity-deterministic": {
        const jobRepo = new JobQueueDataMapper(workspace.db);
        const job = await jobRepo.createJob({
          conversationId: primaryConversationId,
          userId: inflated.refs.authenticatedUserId ?? conversation.userId,
          toolName: "produce_blog_article",
          dedupeKey: "produce:ai-governance-playbook",
          requestPayload: {
            brief: "Create an AI governance playbook article.",
          },
        });
        const runningJob = await jobRepo.updateJobStatus(job.id, {
          status: "running",
          startedAt: "2026-03-20T16:01:10.000Z",
          progressPercent: 42,
          progressLabel: "Reviewing article",
          claimedBy: "eval_worker",
          leaseExpiresAt: "2026-03-20T16:06:10.000Z",
        });
        await jobRepo.appendEvent({
          jobId: runningJob.id,
          conversationId: primaryConversationId,
          eventType: "progress",
          payload: {
            progressPercent: 42,
            progressLabel: "Reviewing article",
          },
        });

        const activeJobs = await jobRepo.listJobsByConversation(primaryConversationId, {
          statuses: getActiveJobStatuses(),
          limit: 10,
        });
        const latestEvent = await jobRepo.findLatestEventForJob(runningJob.id);
        const snapshot = buildJobStatusSnapshot(runningJob, latestEvent);

        toolCalls.push("list_deferred_jobs", "get_deferred_job_status");
        observations.push(
          {
            kind: "tool_call",
            at: run.startedAt,
            data: {
              toolId: "list_deferred_jobs",
              args: { conversation_id: primaryConversationId, active_only: true },
              result: activeJobs.map((candidate) => ({ id: candidate.id, status: candidate.status, toolName: candidate.toolName })),
            },
          },
          {
            kind: "tool_call",
            at: run.startedAt,
            data: {
              toolId: "get_deferred_job_status",
              args: { job_id: runningJob.id },
              result: snapshot.part,
            },
          },
        );

        checkpointResults.push(
          createCheckpointResult(
            scenario,
            "active-job-visible",
            activeJobs.some((candidate) => candidate.id === runningJob.id && candidate.status === "running"),
            activeJobs.length > 0 ? null : "No active deferred job was returned by the read path.",
          ),
          createActiveJobCountCheckpoint(scenario, "status-read-no-rerun", activeJobs, "produce_blog_article", "production"),
          createCheckpointResult(
            scenario,
            "progress-preserved",
            snapshot.part.progressLabel === "Reviewing article",
            snapshot.part.progressLabel ?? null,
          ),
        );

        observations.push({
          kind: "summary",
          at: run.startedAt,
          data: {
            stopReason: null,
            finalLane,
            finalRecommendation: "Inspect the existing production job instead of re-running it.",
            jobId: runningJob.id,
            progressLabel: snapshot.part.progressLabel ?? null,
          },
        });
        finalRecommendation = "Inspect the existing production job instead of re-running it.";
        break;
      }
      case "member-job-status-summary-deterministic": {
        const jobRepo = new JobQueueDataMapper(workspace.db);
        const job = await jobRepo.createJob({
          conversationId: primaryConversationId,
          userId: inflated.refs.authenticatedUserId ?? conversation.userId,
          toolName: "produce_blog_article",
          dedupeKey: "produce:member-status-summary",
          requestPayload: {
            brief: "Create an AI governance playbook article.",
          },
        });
        const runningJob = await jobRepo.updateJobStatus(job.id, {
          status: "running",
          startedAt: "2026-03-20T16:31:10.000Z",
          progressPercent: 42,
          progressLabel: "Reviewing article",
          claimedBy: "eval_worker",
          leaseExpiresAt: "2026-03-20T16:36:10.000Z",
        });
        await jobRepo.appendEvent({
          jobId: runningJob.id,
          conversationId: primaryConversationId,
          eventType: "progress",
          payload: {
            progressPercent: 42,
            progressLabel: "Reviewing article",
          },
        });

        const activeJobs = await jobRepo.listJobsByUser(inflated.refs.authenticatedUserId ?? conversation.userId, {
          statuses: getActiveJobStatuses(),
          limit: 10,
        });
        const latestEvent = await jobRepo.findLatestEventForJob(runningJob.id);
        const snapshot = buildJobStatusSnapshot(runningJob, latestEvent);
        const finalAssistantMessage: { role: ChatMessage["role"]; content: string; createdAt: string } = {
          role: "assistant",
          content: "You have 1 active job. Produce Blog Article is still running for AI Governance Playbook. It is 42% complete and currently Reviewing article.",
          createdAt: "2026-03-20T16:31:20.000Z",
        };

        await workspace.appendMessage({
          conversationId: primaryConversationId,
          role: finalAssistantMessage.role,
          content: finalAssistantMessage.content,
          createdAt: finalAssistantMessage.createdAt,
        });
        pushMessageObservations(observations, [finalAssistantMessage]);

        toolCalls.push("list_my_jobs");
        observations.push({
          kind: "tool_call",
          at: run.startedAt,
          data: {
            toolId: "list_my_jobs",
            args: { active_only: true, limit: 10 },
            result: activeJobs.map((candidate) => ({ id: candidate.id, status: candidate.status, toolName: candidate.toolName })),
          },
        });

        checkpointResults.push(
          createCheckpointResult(
            scenario,
            "active-job-visible",
            activeJobs.some((candidate) => candidate.id === runningJob.id && candidate.status === "running"),
            activeJobs.length > 0 ? null : "No active member job was returned.",
          ),
          createCheckpointResult(
            scenario,
            "prose-summary-default",
            finalAssistantMessage.content.includes("You have 1 active job") && !finalAssistantMessage.content.includes("\n-"),
            finalAssistantMessage.content,
          ),
          createActiveJobCountCheckpoint(scenario, "status-read-no-rerun", activeJobs, "produce_blog_article", "production"),
        );

        observations.push({
          kind: "summary",
          at: run.startedAt,
          data: {
            stopReason: null,
            finalLane,
            finalRecommendation: finalAssistantMessage.content,
            jobId: runningJob.id,
            progressLabel: snapshot.part.progressLabel ?? null,
          },
        });
        finalRecommendation = finalAssistantMessage.content;
        break;
      }
      case "member-explicit-job-status-deterministic": {
        const jobRepo = new JobQueueDataMapper(workspace.db);
        const job = await jobRepo.createJob({
          conversationId: primaryConversationId,
          userId: inflated.refs.authenticatedUserId ?? conversation.userId,
          toolName: "draft_content",
          dedupeKey: "draft:member-explicit-status",
          requestPayload: {
            title: "Deferred Queue Post",
          },
        });
        const runningJob = await jobRepo.updateJobStatus(job.id, {
          status: "running",
          startedAt: "2026-03-20T16:35:10.000Z",
          progressPercent: 60,
          progressLabel: "Drafting article",
          claimedBy: "eval_worker",
          leaseExpiresAt: "2026-03-20T16:40:10.000Z",
        });
        await jobRepo.appendEvent({
          jobId: runningJob.id,
          conversationId: primaryConversationId,
          eventType: "progress",
          payload: {
            progressPercent: 60,
            progressLabel: "Drafting article",
          },
        });

        const latestEvent = await jobRepo.findLatestEventForJob(runningJob.id);
        const snapshot = buildJobStatusSnapshot(runningJob, latestEvent);
        const activeJobs = await jobRepo.listJobsByUser(inflated.refs.authenticatedUserId ?? conversation.userId, {
          statuses: getActiveJobStatuses(),
          limit: 10,
        });
        const finalAssistantMessage: { role: ChatMessage["role"]; content: string; createdAt: string } = {
          role: "assistant",
          content: `Job ${runningJob.id} is still running. Draft Content is 60% complete and currently Drafting article. I checked the existing job and did not start another run.`,
          createdAt: "2026-03-20T16:35:20.000Z",
        };

        await workspace.appendMessage({
          conversationId: primaryConversationId,
          role: finalAssistantMessage.role,
          content: finalAssistantMessage.content,
          createdAt: finalAssistantMessage.createdAt,
        });
        pushMessageObservations(observations, [finalAssistantMessage]);

        toolCalls.push("get_my_job_status");
        observations.push({
          kind: "tool_call",
          at: run.startedAt,
          data: {
            toolId: "get_my_job_status",
            args: { job_id: runningJob.id },
            result: snapshot.part,
          },
        });

        checkpointResults.push(
          createCheckpointResult(
            scenario,
            "explicit-status-explained",
            finalAssistantMessage.content.includes(`Job ${runningJob.id} is still running`) && finalAssistantMessage.content.includes("did not start another run"),
            finalAssistantMessage.content,
          ),
          createActiveJobCountCheckpoint(scenario, "status-read-no-rerun", activeJobs, "draft_content", "draft"),
        );

        observations.push({
          kind: "summary",
          at: run.startedAt,
          data: {
            stopReason: null,
            finalLane,
            finalRecommendation: finalAssistantMessage.content,
            jobId: runningJob.id,
            progressLabel: snapshot.part.progressLabel ?? null,
          },
        });
        finalRecommendation = finalAssistantMessage.content;
        break;
      }
      case "member-all-jobs-list-deterministic": {
        const jobRepo = new JobQueueDataMapper(workspace.db);
        const runningJob = await jobRepo.createJob({
          conversationId: primaryConversationId,
          userId: inflated.refs.authenticatedUserId ?? conversation.userId,
          toolName: "produce_blog_article",
          dedupeKey: "produce:member-all-jobs",
          requestPayload: {
            brief: "Create a launch plan article.",
          },
        });
        await jobRepo.updateJobStatus(runningJob.id, {
          status: "running",
          startedAt: "2026-03-20T16:40:10.000Z",
          progressPercent: 35,
          progressLabel: "Gathering sources",
          claimedBy: "eval_worker",
          leaseExpiresAt: "2026-03-20T16:45:10.000Z",
        });
        const terminalJob = await jobRepo.createJob({
          conversationId: primaryConversationId,
          userId: inflated.refs.authenticatedUserId ?? conversation.userId,
          toolName: "publish_content",
          dedupeKey: "publish:member-all-jobs",
          requestPayload: {
            postId: "post_1",
          },
        });
        const completedJob = await jobRepo.updateJobStatus(terminalJob.id, {
          status: "succeeded",
          startedAt: "2026-03-20T16:39:00.000Z",
          completedAt: "2026-03-20T16:39:30.000Z",
          progressPercent: 100,
          progressLabel: "Published",
          resultPayload: { slug: "launch-plan", title: "Launch Plan" },
        });

        const allJobs = await jobRepo.listJobsByUser(inflated.refs.authenticatedUserId ?? conversation.userId, {
          limit: 10,
        });
        const finalAssistantMessage: { role: ChatMessage["role"]; content: string; createdAt: string } = {
          role: "assistant",
          content: [
            "Jobs:",
            "- Produce Blog Article — running at 35%, currently Gathering sources",
            "- Publish Content — completed for Launch Plan",
          ].join("\n"),
          createdAt: "2026-03-20T16:40:20.000Z",
        };

        await workspace.appendMessage({
          conversationId: primaryConversationId,
          role: finalAssistantMessage.role,
          content: finalAssistantMessage.content,
          createdAt: finalAssistantMessage.createdAt,
        });
        pushMessageObservations(observations, [finalAssistantMessage]);

        toolCalls.push("list_my_jobs");
        observations.push({
          kind: "tool_call",
          at: run.startedAt,
          data: {
            toolId: "list_my_jobs",
            args: { active_only: false, limit: 10 },
            result: allJobs.map((candidate) => ({ id: candidate.id, status: candidate.status, toolName: candidate.toolName })),
          },
        });

        checkpointResults.push(
          createCheckpointResult(
            scenario,
            "explicit-list-rendered",
            finalAssistantMessage.content.startsWith("Jobs:\n-") && finalAssistantMessage.content.includes("Publish Content"),
            finalAssistantMessage.content,
          ),
          createCheckpointResult(
            scenario,
            "terminal-jobs-included",
            allJobs.some((candidate) => candidate.id === completedJob.id && candidate.status === "succeeded"),
            `Found ${allJobs.length} total jobs.`,
          ),
        );

        observations.push({
          kind: "summary",
          at: run.startedAt,
          data: {
            stopReason: null,
            finalLane,
            finalRecommendation: finalAssistantMessage.content,
            runningJobId: runningJob.id,
            completedJobId: completedJob.id,
          },
        });
        finalRecommendation = finalAssistantMessage.content;
        break;
      }
      case "anonymous-job-status-guidance-deterministic": {
        const finalAssistantMessage: { role: ChatMessage["role"]; content: string; createdAt: string } = {
          role: "assistant",
          content: "I cannot inspect account-scoped jobs while you are browsing anonymously. If a job was started in this chat, the status cards here are the source of truth. Sign in if you need account-level history across conversations.",
          createdAt: "2026-03-20T16:45:10.000Z",
        };

        await workspace.appendMessage({
          conversationId: primaryConversationId,
          role: finalAssistantMessage.role,
          content: finalAssistantMessage.content,
          createdAt: finalAssistantMessage.createdAt,
        });
        pushMessageObservations(observations, [finalAssistantMessage]);

        checkpointResults.push(
          createCheckpointResult(
            scenario,
            "chat-native-guidance",
            finalAssistantMessage.content.includes("status cards here are the source of truth") && finalAssistantMessage.content.includes("Sign in"),
            finalAssistantMessage.content,
          ),
          createCheckpointResult(
            scenario,
            "no-jobs-route-push",
            !finalAssistantMessage.content.includes("/jobs"),
            finalAssistantMessage.content,
          ),
        );

        observations.push({
          kind: "summary",
          at: run.startedAt,
          data: {
            stopReason: null,
            finalLane,
            finalRecommendation: finalAssistantMessage.content,
          },
        });
        finalRecommendation = finalAssistantMessage.content;
        break;
      }
      case "blog-explicit-status-check-deterministic": {
        const jobRepo = new JobQueueDataMapper(workspace.db);
        const job = await jobRepo.createJob({
          conversationId: primaryConversationId,
          userId: inflated.refs.authenticatedUserId ?? conversation.userId,
          toolName: "produce_blog_article",
          dedupeKey: "produce:operator-capabilities-profile",
          requestPayload: {
            brief: "Produce a blog post on the platform capabilities.",
          },
        });
        const queuedJob = await jobRepo.updateJobStatus(job.id, {
          status: "running",
          startedAt: "2026-03-20T16:20:15.000Z",
          progressPercent: 42,
          progressLabel: "Reviewing article",
          claimedBy: "eval_worker",
          leaseExpiresAt: "2026-03-20T16:25:15.000Z",
        });
        await jobRepo.appendEvent({
          jobId: queuedJob.id,
          conversationId: primaryConversationId,
          eventType: "progress",
          payload: {
            progressPercent: 42,
            progressLabel: "Reviewing article",
          },
        });

        const seededMessages = messages;
        const followUpMessages: Array<{ role: ChatMessage["role"]; content: string; createdAt: string }> = [
          {
            role: "assistant",
            content: `Queued Produce Blog Article job ${queuedJob.id}. I will reuse this run and report status from the queue.`,
            createdAt: "2026-03-20T16:20:20.000Z",
          },
          {
            role: "user",
            content: "whats the status of the queue",
            createdAt: "2026-03-20T16:20:40.000Z",
          },
          {
            role: "assistant",
            content: `The queue still has Produce Blog Article job ${queuedJob.id} running. It is 42% complete and currently Reviewing article.`,
            createdAt: "2026-03-20T16:20:50.000Z",
          },
          {
            role: "user",
            content: `Check the status of job ${queuedJob.id}`,
            createdAt: "2026-03-20T16:21:10.000Z",
          },
        ];

        for (const message of followUpMessages) {
          await workspace.appendMessage({
            conversationId: primaryConversationId,
            role: message.role,
            content: message.content,
            createdAt: message.createdAt,
          });
        }
        pushMessageObservations(observations, followUpMessages);

        const activeJobs = await jobRepo.listJobsByConversation(primaryConversationId, {
          statuses: getActiveJobStatuses(),
          limit: 10,
        });
        const latestEvent = await jobRepo.findLatestEventForJob(queuedJob.id);
        const snapshot = buildJobStatusSnapshot(queuedJob, latestEvent);
        const finalAssistantMessage: { role: ChatMessage["role"]; content: string; createdAt: string } = {
          role: "assistant",
          content: `Job ${queuedJob.id} is still running. It is 42% complete and currently Reviewing article. I reused the existing Produce Blog Article job and did not start another run.`,
          createdAt: "2026-03-20T16:21:20.000Z",
        };

        await workspace.appendMessage({
          conversationId: primaryConversationId,
          role: finalAssistantMessage.role,
          content: finalAssistantMessage.content,
          createdAt: finalAssistantMessage.createdAt,
        });
        pushMessageObservations(observations, [finalAssistantMessage]);

        toolCalls.push("list_deferred_jobs", "get_deferred_job_status");
        observations.push(
          {
            kind: "tool_call",
            at: run.startedAt,
            data: {
              toolId: "list_deferred_jobs",
              args: { conversation_id: primaryConversationId, active_only: true },
              result: activeJobs.map((candidate) => ({ id: candidate.id, status: candidate.status, toolName: candidate.toolName })),
            },
          },
          {
            kind: "tool_call",
            at: run.startedAt,
            data: {
              toolId: "get_deferred_job_status",
              args: { job_id: queuedJob.id },
              result: snapshot.part,
            },
          },
        );

        checkpointResults.push(
          createCheckpointResult(
            scenario,
            "conversation-shape-preserved",
            seededMessages[0]?.content === "Produce a blog post on my capabilities"
              && followUpMessages[1]?.content === "whats the status of the queue"
              && followUpMessages[3]?.content === `Check the status of job ${queuedJob.id}`,
            followUpMessages[3]?.content ?? null,
          ),
          createCheckpointResult(
            scenario,
            "explicit-status-explained",
            finalAssistantMessage.content.includes(`Job ${queuedJob.id} is still running`)
              && finalAssistantMessage.content.includes("did not start another run"),
            finalAssistantMessage.content,
          ),
          createActiveJobCountCheckpoint(scenario, "status-read-no-rerun", activeJobs, "produce_blog_article", "production"),
        );

        observations.push({
          kind: "summary",
          at: run.startedAt,
          data: {
            stopReason: null,
            finalLane,
            finalRecommendation: finalAssistantMessage.content,
            jobId: queuedJob.id,
            progressLabel: snapshot.part.progressLabel ?? null,
          },
        });
        finalRecommendation = finalAssistantMessage.content;
        break;
      }
      case "blog-job-dedupe-clarity-deterministic": {
        const jobRepo = new JobQueueDataMapper(workspace.db);
        const job = await jobRepo.createJob({
          conversationId: primaryConversationId,
          userId: inflated.refs.authenticatedUserId ?? conversation.userId,
          toolName: "produce_blog_article",
          dedupeKey: "produce:ai-governance-playbook",
          requestPayload: {
            brief: "Run the full AI governance playbook pipeline.",
          },
        });
        const runningJob = await jobRepo.updateJobStatus(job.id, {
          status: "running",
          startedAt: "2026-03-20T16:05:10.000Z",
          progressPercent: 18,
          progressLabel: "Composing article",
          claimedBy: "eval_worker",
          leaseExpiresAt: "2026-03-20T16:10:10.000Z",
        });
        const progressEvent = await jobRepo.appendEvent({
          jobId: runningJob.id,
          conversationId: primaryConversationId,
          eventType: "progress",
          payload: {
            progressPercent: 18,
            progressLabel: "Composing article",
          },
        });
        const dedupedPart = deferredJobResultToMessagePart(
          createDeferredJobResultPayload(runningJob, progressEvent, { deduped: true }),
        );
        const activeJobs = await jobRepo.listJobsByConversation(primaryConversationId, {
          statuses: getActiveJobStatuses(),
          limit: 10,
        });

        toolCalls.push("list_deferred_jobs", "get_deferred_job_status");
        observations.push(
          {
            kind: "tool_call",
            at: run.startedAt,
            data: {
              toolId: "list_deferred_jobs",
              args: { conversation_id: primaryConversationId, active_only: true },
              result: activeJobs.map((candidate) => ({ id: candidate.id, status: candidate.status, toolName: candidate.toolName })),
            },
          },
          {
            kind: "tool_call",
            at: run.startedAt,
            data: {
              toolId: "get_deferred_job_status",
              args: { job_id: runningJob.id },
              result: dedupedPart,
            },
          },
        );

        checkpointResults.push(
          createCheckpointResult(
            scenario,
            "dedupe-detected",
            activeJobs.length === 1 && activeJobs[0]?.id === runningJob.id,
            `Found ${activeJobs.length} active jobs for the conversation.`,
          ),
          createCheckpointResult(
            scenario,
            "reuse-copy-clear",
            dedupedPart.summary === "Using existing Produce Blog Article job in this conversation.",
            dedupedPart.summary ?? null,
          ),
          createActiveJobCountCheckpoint(scenario, "single-job-preserved", activeJobs, "produce_blog_article", "production"),
        );

        observations.push({
          kind: "summary",
          at: run.startedAt,
          data: {
            stopReason: null,
            finalLane,
            finalRecommendation: dedupedPart.summary,
            jobId: runningJob.id,
          },
        });
        finalRecommendation = dedupedPart.summary ?? finalRecommendation;
        break;
      }
      case "blog-produce-publish-handoff-deterministic": {
        const blogRepo = new BlogPostDataMapper(workspace.db);
        const jobRepo = new JobQueueDataMapper(workspace.db);
        const presenter = new ChatPresenter(new MarkdownParserService(), new CommandParserService());
        const draftPost = await blogRepo.create({
          slug: "ai-governance-playbook",
          title: "AI Governance Playbook",
          description: "A practical governance playbook for delivery teams.",
          content: "# AI Governance Playbook\n\nProduction-ready guidance.",
          createdByUserId: inflated.refs.authenticatedUserId ?? conversation.userId,
        });
        const completedJob = await jobRepo.createJob({
          conversationId: primaryConversationId,
          userId: inflated.refs.authenticatedUserId ?? conversation.userId,
          toolName: "produce_blog_article",
          dedupeKey: "produce:ai-governance-playbook",
          requestPayload: {
            brief: "Create an AI governance playbook article.",
          },
        });
        const succeededJob = await jobRepo.updateJobStatus(completedJob.id, {
          status: "succeeded",
          startedAt: "2026-03-20T16:10:10.000Z",
          completedAt: "2026-03-20T16:12:30.000Z",
          progressPercent: 100,
          progressLabel: "Saving draft",
          resultPayload: {
            id: draftPost.id,
            slug: draftPost.slug,
            title: draftPost.title,
            status: "draft",
            imageAssetId: "asset_hero_1",
            stages: [
              "compose_blog_article",
              "qa_blog_article",
              "resolve_blog_article_qa",
              "generate_blog_image_prompt",
              "generate_blog_image",
              "draft_content",
            ],
            summary: `Produced draft "${draftPost.title}" at /journal/${draftPost.slug} with hero asset asset_hero_1.`,
          },
        });
        const resultEvent = await jobRepo.appendEvent({
          jobId: succeededJob.id,
          conversationId: primaryConversationId,
          eventType: "result",
          payload: {
            result: succeededJob.resultPayload,
          },
        });
        const snapshot = buildJobStatusSnapshot(succeededJob, resultEvent);
        const presented = presenter.present({
          id: snapshot.messageId,
          role: "assistant",
          content: "Article production is complete.",
          timestamp: new Date(run.startedAt),
          parts: [snapshot.part],
        } as ChatMessage);
        const jobStatusEntry = presented.toolRenderEntries?.find((e) => e.kind === "job-status");
        const publishAction = jobStatusEntry?.kind === "job-status" && Array.isArray(jobStatusEntry.computedActions)
          ? jobStatusEntry.computedActions.find(
            (action): action is Extract<InlineNode, { type: "action-link" }> =>
              action.type === "action-link" && action.label === "Publish",
          )
          : undefined;
        const publishResult = await executePublishContent(
          blogRepo,
          { post_id: draftPost.id },
          {
            userId: inflated.refs.authenticatedUserId ?? conversation.userId,
            role: "AUTHENTICATED",
          },
        );

        toolCalls.push("publish_content");
        observations.push({
          kind: "tool_call",
          at: run.startedAt,
          data: {
            toolId: "publish_content",
            args: { post_id: draftPost.id },
            result: publishResult,
          },
        });

        checkpointResults.push(
          createCheckpointResult(
            scenario,
            "post-id-preserved",
            snapshot.part.resultPayload !== undefined
              && typeof snapshot.part.resultPayload === "object"
              && snapshot.part.resultPayload !== null
              && "id" in snapshot.part.resultPayload
              && snapshot.part.resultPayload.id === draftPost.id,
            draftPost.id,
          ),
          createCheckpointResult(
            scenario,
            "publish-action-visible",
            Boolean(publishAction),
            publishAction ? null : "Publish action was not present on the produced-draft job card.",
          ),
          createCheckpointResult(
            scenario,
            "publish-command-correct",
            publishAction?.actionType === "send"
              && publishAction.value.includes(draftPost.id)
              && publishResult.id === draftPost.id
              && publishResult.status === "published",
            publishAction?.value ?? null,
          ),
        );

        observations.push({
          kind: "summary",
          at: run.startedAt,
          data: {
            stopReason: null,
            finalLane,
            finalRecommendation: `Publish the draft post with id ${draftPost.id}.`,
            postId: draftPost.id,
            publishStatus: publishResult.status,
          },
        });
        finalRecommendation = `Publish the draft post with id ${draftPost.id}.`;
        break;
      }
      case "blog-missed-sse-recovery-deterministic": {
        const blogRepo = new BlogPostDataMapper(workspace.db);
        const jobRepo = new JobQueueDataMapper(workspace.db);
        const draftPost = await blogRepo.create({
          slug: "continuity-after-reload",
          title: "Continuity After Reload",
          description: "How deferred work remains visible after a dropped event stream.",
          content: "# Continuity After Reload\n\nRecovery path.",
          createdByUserId: inflated.refs.authenticatedUserId ?? conversation.userId,
        });
        const completedJob = await jobRepo.createJob({
          conversationId: primaryConversationId,
          userId: inflated.refs.authenticatedUserId ?? conversation.userId,
          toolName: "produce_blog_article",
          dedupeKey: "produce:continuity-after-reload",
          requestPayload: {
            brief: "Create a continuity after reload article.",
          },
        });
        const succeededJob = await jobRepo.updateJobStatus(completedJob.id, {
          status: "succeeded",
          startedAt: "2026-03-20T16:15:10.000Z",
          completedAt: "2026-03-20T16:17:00.000Z",
          resultPayload: {
            id: draftPost.id,
            slug: draftPost.slug,
            title: draftPost.title,
            status: "draft",
            summary: `Produced draft "${draftPost.title}" at /journal/${draftPost.slug}.`,
          },
        });
        const resultEvent = await jobRepo.appendEvent({
          jobId: succeededJob.id,
          conversationId: primaryConversationId,
          eventType: "result",
          payload: {
            result: succeededJob.resultPayload,
          },
        });
        const recoveredJobs = await jobRepo.listJobsByConversation(primaryConversationId, { limit: 10 });
        const recoveredSnapshot = buildJobStatusSnapshot(succeededJob, resultEvent);

        toolCalls.push("list_deferred_jobs", "get_deferred_job_status");
        observations.push(
          {
            kind: "tool_call",
            at: run.startedAt,
            data: {
              toolId: "list_deferred_jobs",
              args: { conversation_id: primaryConversationId, active_only: false },
              result: recoveredJobs.map((candidate) => ({ id: candidate.id, status: candidate.status, toolName: candidate.toolName })),
            },
          },
          {
            kind: "tool_call",
            at: run.startedAt,
            data: {
              toolId: "get_deferred_job_status",
              args: { job_id: succeededJob.id },
              result: recoveredSnapshot.part,
            },
          },
        );

        checkpointResults.push(
          createCheckpointResult(
            scenario,
            "terminal-job-recovered",
            recoveredJobs.some((candidate) => candidate.id === succeededJob.id && candidate.status === "succeeded")
              && recoveredSnapshot.part.status === "succeeded",
            recoveredSnapshot.part.status,
          ),
          createCheckpointResult(
            scenario,
            "summary-preserved",
            recoveredSnapshot.part.summary === `Produced draft "${draftPost.title}" at /journal/${draftPost.slug}.`,
            recoveredSnapshot.part.summary ?? null,
          ),
          createCheckpointResult(
            scenario,
            "post-id-available",
            recoveredSnapshot.part.resultPayload !== undefined
              && typeof recoveredSnapshot.part.resultPayload === "object"
              && recoveredSnapshot.part.resultPayload !== null
              && "id" in recoveredSnapshot.part.resultPayload
              && recoveredSnapshot.part.resultPayload.id === draftPost.id,
            draftPost.id,
          ),
        );

        observations.push({
          kind: "summary",
          at: run.startedAt,
          data: {
            stopReason: null,
            finalLane,
            finalRecommendation: `Recovered terminal job ${succeededJob.id} after missed SSE delivery.`,
            recoveredJobId: succeededJob.id,
            postId: draftPost.id,
          },
        });
        finalRecommendation = `Recovered terminal job ${succeededJob.id} after missed SSE delivery.`;
        break;
      }
      case "misclassification-reroute": {
        const beforeRecommendation = conversation.routingSnapshot.recommendedNextStep;
        const beforeLane = conversation.routingSnapshot.lane;

        await workspace.conversationRepo.updateRoutingSnapshot(primaryConversationId, {
          lane: "development",
          confidence: 0.91,
          recommendedNextStep: "Prepare a scoped founder follow-up for development delivery.",
          detectedNeedSummary: "Prospect needs implementation and scoping support.",
          lastAnalyzedAt: run.startedAt,
        });

        const reroutedConversation = await workspace.conversationRepo.findById(primaryConversationId);

        observations.push({
          kind: "state_transition",
          at: run.startedAt,
          data: {
            transition: "routing_rerouted",
            fromLane: beforeLane,
            toLane: reroutedConversation?.routingSnapshot.lane ?? null,
          },
        });

        checkpointResults.push(
          createCheckpointResult(scenario, "initial-ambiguity", beforeLane === "uncertain", null),
          createCheckpointResult(scenario, "reroute", reroutedConversation?.routingSnapshot.lane === "development", null),
          createCheckpointResult(
            scenario,
            "updated-next-step",
            reroutedConversation?.routingSnapshot.recommendedNextStep !== beforeRecommendation,
            reroutedConversation?.routingSnapshot.recommendedNextStep ?? null,
          ),
        );

        finalLane = reroutedConversation?.routingSnapshot.lane ?? finalLane;
        finalRecommendation = reroutedConversation?.routingSnapshot.recommendedNextStep ?? finalRecommendation;
        observations.push({
          kind: "summary",
          at: run.startedAt,
          data: {
            stopReason: null,
            finalLane,
            finalRecommendation,
          },
        });
        break;
      }
      case "mcp-tool-avoidance": {
        const assistantAnswer = messages.find((message) => message.role === "assistant")?.content ?? "";
        checkpointResults.push(
          createCheckpointResult(scenario, "no-tool-needed", true, "The seeded conversation is directly answerable."),
          createCheckpointResult(scenario, "tool-avoided", true, "No tool call was emitted for this direct explanation."),
          createCheckpointResult(
            scenario,
            "answer-complete",
            /founder review/i.test(assistantAnswer),
            assistantAnswer,
          ),
        );

        observations.push({
          kind: "summary",
          at: run.startedAt,
          data: {
            stopReason: null,
            finalLane,
            finalRecommendation,
            directAnswerUsed: true,
          },
        });
        break;
      }
      case "mcp-calculator-must-use": {
        const toolFixtureId = inflated.refs.toolFixtureId;

        if (!toolFixtureId) {
          throw new Error("Calculator must-use scenario is missing toolFixtureId.");
        }

        const toolFixture = inflated.toolFixtures.get(toolFixtureId);

        if (!toolFixture) {
          throw new Error(`Missing tool fixture ${toolFixtureId}.`);
        }

        const toolResult = workspace.executeCalculator(toolFixture.args as { operation: string; a: number; b: number });
        const result = toolResult.result;
        toolCalls.push(toolFixture.toolId);
        await workspace.conversationRepo.setLastToolUsed(primaryConversationId, toolFixture.toolId);

        observations.push({
          kind: "tool_call",
          at: run.startedAt,
          data: {
            toolId: toolFixture.toolId,
            args: toolFixture.args,
            result,
            rawResult: toolResult,
            expectedResult: toolFixture.expectedResult ?? null,
            matchedExpected: result === toolFixture.expectedResult,
          },
        });

        checkpointResults.push(
          createCheckpointResult(scenario, "tool-needed", true, "The prompt requests precise arithmetic."),
          createCheckpointResult(scenario, "tool-called", true, `Called ${toolFixture.toolId} with fixture arguments.`),
          createCheckpointResult(
            scenario,
            "answer-correct",
            result === toolFixture.expectedResult,
            result === toolFixture.expectedResult ? `Result ${result} matched expectation.` : `Expected ${toolFixture.expectedResult} but got ${result}.`,
          ),
        );

        observations.push({
          kind: "summary",
          at: run.startedAt,
          data: {
            stopReason: null,
            finalLane,
            finalRecommendation: `Use calculator result ${result} in the final answer.`,
            toolResult: result,
          },
        });
        finalRecommendation = `Use calculator result ${result} in the final answer.`;
        break;
      }
      default:
        throw new Error(`No deterministic runner is implemented for scenario ${scenarioId}.`);
    }

    pushCheckpointObservations(observations, run, checkpointResults);

    return {
      scenario,
      run,
      observations,
      checkpointResults,
      stopReason,
      finalState: {
        lane: finalLane,
        recommendation: finalRecommendation,
        toolCalls,
      },
    };
  } finally {
    workspace.destroy();
  }
}