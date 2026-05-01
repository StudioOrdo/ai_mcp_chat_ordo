import type { EvalScenario } from "./domain";
import { getEvalScenarioById } from "./scenarios";
import type {
  EvalWorkspace,
  EvalWorkspaceConversationEventSeed,
  EvalWorkspaceConsultationRequestSeed,
  EvalWorkspaceConversationSeed,
  EvalWorkspaceDealSeed,
  EvalWorkspaceLeadSeed,
  EvalWorkspaceTrainingPathSeed,
  EvalWorkspaceUserSeed,
} from "./workspace";

export interface DeterministicEvalToolFixture {
  id: string;
  toolId: string;
  args: Record<string, unknown>;
  expectedResult?: unknown;
}

export interface DeterministicEvalSeedPack {
  scenarioId: string;
  seedSetId: string;
  refs: {
    primaryConversationId?: string;
    anonymousUserId?: string;
    authenticatedUserId?: string;
    toolFixtureId?: string;
  };
  users: EvalWorkspaceUserSeed[];
  conversations: EvalWorkspaceConversationSeed[];
  conversationEvents: EvalWorkspaceConversationEventSeed[];
  leads: EvalWorkspaceLeadSeed[];
  consultationRequests: EvalWorkspaceConsultationRequestSeed[];
  deals: EvalWorkspaceDealSeed[];
  trainingPaths: EvalWorkspaceTrainingPathSeed[];
  toolFixtures: DeterministicEvalToolFixture[];
}

function buildAuthConversation(seed: {
  id: string;
  userId: string;
  title: string;
  lane: "organization" | "individual" | "development" | "uncertain";
  confidence: number;
  recommendedNextStep: string;
  detectedNeedSummary: string;
  messages: Array<{ id: string; role: "user" | "assistant" | "system"; content: string; createdAt: string }>;
}): EvalWorkspaceConversationSeed {
  return {
    id: seed.id,
    userId: seed.userId,
    title: seed.title,
    sessionSource: "authenticated",
    lane: seed.lane,
    confidence: seed.confidence,
    recommendedNextStep: seed.recommendedNextStep,
    detectedNeedSummary: seed.detectedNeedSummary,
    lastAnalyzedAt: "2026-03-20T09:00:00.000Z",
    createdAt: "2026-03-20T09:00:00.000Z",
    updatedAt: "2026-03-20T09:10:00.000Z",
    messages: seed.messages,
  };
}

export interface InflatedDeterministicEvalSeedPack {
  pack: DeterministicEvalSeedPack;
  refs: DeterministicEvalSeedPack["refs"];
  toolFixtures: Map<string, DeterministicEvalToolFixture>;
}

function assertDeterministicScenario(scenario: EvalScenario): void {
  if (scenario.layer !== "deterministic") {
    throw new Error(`Scenario ${scenario.id} is ${scenario.layer}; deterministic seed packs only support deterministic scenarios.`);
  }
}

function buildAnonymousConversation(seed: {
  id: string;
  userId: string;
  title: string;
  recommendedNextStep: string;
  detectedNeedSummary: string;
  messages: Array<{ id: string; role: "user" | "assistant" | "system"; content: string; createdAt: string }>;
}): EvalWorkspaceConversationSeed {
  return {
    id: seed.id,
    userId: seed.userId,
    title: seed.title,
    sessionSource: "anonymous_cookie",
    lane: "organization",
    confidence: 0.89,
    recommendedNextStep: seed.recommendedNextStep,
    detectedNeedSummary: seed.detectedNeedSummary,
    lastAnalyzedAt: "2026-03-20T09:00:00.000Z",
    createdAt: "2026-03-20T09:00:00.000Z",
    updatedAt: "2026-03-20T09:10:00.000Z",
    messages: seed.messages,
  };
}

export function resolveDeterministicSeedPack(scenarioId: string): DeterministicEvalSeedPack {
  const scenario = getEvalScenarioById(scenarioId);
  assertDeterministicScenario(scenario);

  switch (scenarioId) {
    case "anonymous-high-intent-dropout":
      return {
        scenarioId,
        seedSetId: "seed-anon-dropout-v1",
        refs: {
          primaryConversationId: "conv_eval_anon_dropout",
          anonymousUserId: "anon_eval_dropout",
        },
        users: [
          { id: "anon_eval_dropout", email: "anon.dropout@example.com", name: "Anonymous Dropout" },
        ],
        conversations: [
          buildAnonymousConversation({
            id: "conv_eval_anon_dropout",
            userId: "anon_eval_dropout",
            title: "Anonymous operator asks about redesigning approvals",
            recommendedNextStep: "Invite signup before proposing deeper workflow guidance.",
            detectedNeedSummary: "High-intent approvals workflow redesign request.",
            messages: [
              {
                id: "msg_eval_anon_dropout_1",
                role: "user",
                content: "We need help redesigning how approvals work across three teams.",
                createdAt: "2026-03-20T09:01:00.000Z",
              },
              {
                id: "msg_eval_anon_dropout_2",
                role: "assistant",
                content: "I can help think through the workflow and identify where founder follow-up would matter.",
                createdAt: "2026-03-20T09:02:00.000Z",
              },
            ],
          }),
        ],
        conversationEvents: [
          {
            id: "evt_eval_anon_dropout_1",
            conversationId: "conv_eval_anon_dropout",
            type: "anonymous_high_intent_detected",
            metadata: { lane: "organization", confidence: 0.89 },
            createdAt: "2026-03-20T09:02:30.000Z",
          },
        ],
        leads: [],
        consultationRequests: [],
        deals: [],
        trainingPaths: [],
        toolFixtures: [],
      };
    case "anonymous-signup-continuity":
      return {
        scenarioId,
        seedSetId: "seed-anon-signup-v1",
        refs: {
          primaryConversationId: "conv_eval_signup_continuity",
          anonymousUserId: "anon_eval_signup",
          authenticatedUserId: "usr_eval_signup",
        },
        users: [
          { id: "anon_eval_signup", email: "anon.signup@example.com", name: "Anonymous Signup" },
          { id: "usr_eval_signup", email: "signed.up@example.com", name: "Signed Up User" },
        ],
        conversations: [
          {
            id: "conv_eval_signup_continuity",
            userId: "anon_eval_signup",
            title: "Anonymous learner continues after signup",
            sessionSource: "anonymous_cookie",
            lane: "individual",
            confidence: 0.81,
            recommendedNextStep: "Preserve context and continue the training conversation after signup.",
            detectedNeedSummary: "Learner wants a serious operator path.",
            lastAnalyzedAt: "2026-03-20T10:00:00.000Z",
            createdAt: "2026-03-20T10:00:00.000Z",
            updatedAt: "2026-03-20T10:08:00.000Z",
            messages: [
              {
                id: "msg_eval_signup_1",
                role: "user",
                content: "I want to transition into operator work and need a real path.",
                createdAt: "2026-03-20T10:01:00.000Z",
              },
              {
                id: "msg_eval_signup_2",
                role: "assistant",
                content: "We can keep this conversation intact if you decide to sign up.",
                createdAt: "2026-03-20T10:02:00.000Z",
              },
            ],
          },
        ],
          conversationEvents: [
            {
              id: "evt_eval_signup_1",
              conversationId: "conv_eval_signup_continuity",
              type: "signup_prompted",
              metadata: { lane: "individual" },
              createdAt: "2026-03-20T10:03:00.000Z",
            },
          ],
        leads: [],
        consultationRequests: [],
        deals: [],
        trainingPaths: [],
        toolFixtures: [],
      };
    case "misclassification-reroute":
      return {
        scenarioId,
        seedSetId: "seed-reroute-v1",
        refs: {
          primaryConversationId: "conv_eval_reroute",
          authenticatedUserId: "usr_eval_reroute",
        },
        users: [
          { id: "usr_eval_reroute", email: "reroute@example.com", name: "Reroute Prospect" },
        ],
        conversations: [
          {
            id: "conv_eval_reroute",
            userId: "usr_eval_reroute",
            title: "Prospect starts unclear but reveals implementation needs",
            sessionSource: "authenticated",
            lane: "uncertain",
            confidence: 0.42,
            recommendedNextStep: "Continue discovery before selecting a lane.",
            detectedNeedSummary: "Prospect mentions several possible needs without clear routing.",
            lastAnalyzedAt: "2026-03-20T11:00:00.000Z",
            createdAt: "2026-03-20T11:00:00.000Z",
            updatedAt: "2026-03-20T11:03:00.000Z",
            messages: [
              {
                id: "msg_eval_reroute_1",
                role: "user",
                content: "We may need training, or maybe someone to help ship the system itself.",
                createdAt: "2026-03-20T11:01:00.000Z",
              },
            ],
          },
        ],
          conversationEvents: [
            {
              id: "evt_eval_reroute_1",
              conversationId: "conv_eval_reroute",
              type: "routing_review_requested",
              metadata: { lane: "uncertain" },
              createdAt: "2026-03-20T11:02:00.000Z",
            },
          ],
        leads: [],
        consultationRequests: [],
        deals: [],
        trainingPaths: [],
        toolFixtures: [],
      };
    case "media-workflow-video-completion-deterministic":
      return {
        scenarioId,
        seedSetId: "seed-media-workflow-video-v1",
        refs: {
          primaryConversationId: "conv_eval_media_workflow_video",
          authenticatedUserId: "usr_eval_media_workflow",
        },
        users: [
          { id: "usr_eval_media_workflow", email: "media.workflow@example.com", name: "Media Workflow User" },
        ],
        conversations: [
          buildAuthConversation({
            id: "conv_eval_media_workflow_video",
            userId: "usr_eval_media_workflow",
            title: "Member requests chart audio video workflow",
            lane: "organization",
            confidence: 0.84,
            recommendedNextStep: "Create the requested video as one governed media workflow.",
            detectedNeedSummary: "User wants a chart plus generated audio composed into a final video.",
            messages: [
              {
                id: "msg_eval_media_workflow_user",
                role: "user",
                content: "Make me a short video with a Bloom taxonomy chart and a new 30 second audio explanation.",
                createdAt: "2026-05-01T16:47:22.584Z",
              },
              {
                id: "msg_eval_media_workflow_assistant",
                role: "assistant",
                content: "I am generating the chart and audio, then composing the final video.",
                createdAt: "2026-05-01T16:47:35.000Z",
              },
            ],
          }),
        ],
        conversationEvents: [],
        leads: [],
        consultationRequests: [],
        deals: [],
        trainingPaths: [],
        toolFixtures: [],
      };
    case "mcp-tool-avoidance":
      return {
        scenarioId,
        seedSetId: "seed-tool-avoidance-v1",
        refs: {
          primaryConversationId: "conv_eval_tool_avoidance",
          authenticatedUserId: "usr_eval_tool_avoidance",
        },
        users: [
          { id: "usr_eval_tool_avoidance", email: "avoid@example.com", name: "Tool Avoidance User" },
        ],
        conversations: [
          {
            id: "conv_eval_tool_avoidance",
            userId: "usr_eval_tool_avoidance",
            title: "Simple explanatory question that does not need a tool",
            sessionSource: "authenticated",
            lane: "uncertain",
            confidence: 0.76,
            recommendedNextStep: "Answer directly without a tool.",
            detectedNeedSummary: "User needs a concise direct explanation.",
            lastAnalyzedAt: "2026-03-20T12:00:00.000Z",
            createdAt: "2026-03-20T12:00:00.000Z",
            updatedAt: "2026-03-20T12:02:00.000Z",
            messages: [
              {
                id: "msg_eval_tool_avoid_1",
                role: "user",
                content: "What does founder review mean in this workflow?",
                createdAt: "2026-03-20T12:01:00.000Z",
              },
              {
                id: "msg_eval_tool_avoid_2",
                role: "assistant",
                content: "Founder review means a human decision point before any customer-visible next step is approved.",
                createdAt: "2026-03-20T12:02:00.000Z",
              },
            ],
          },
        ],
          conversationEvents: [],
        leads: [],
        consultationRequests: [],
        deals: [],
        trainingPaths: [],
        toolFixtures: [],
      };
    case "mcp-calculator-must-use":
      return {
        scenarioId,
        seedSetId: "seed-calculator-must-use-v1",
        refs: {
          primaryConversationId: "conv_eval_calculator",
          authenticatedUserId: "usr_eval_calculator",
          toolFixtureId: "tool_fixture_calculator_1",
        },
        users: [
          { id: "usr_eval_calculator", email: "calculator@example.com", name: "Calculator User" },
        ],
        conversations: [
          {
            id: "conv_eval_calculator",
            userId: "usr_eval_calculator",
            title: "Arithmetic request that requires calculator use",
            sessionSource: "authenticated",
            lane: "uncertain",
            confidence: 0.72,
            recommendedNextStep: "Use the calculator tool before answering.",
            detectedNeedSummary: "User asked for a precise arithmetic result.",
            lastAnalyzedAt: "2026-03-20T13:00:00.000Z",
            createdAt: "2026-03-20T13:00:00.000Z",
            updatedAt: "2026-03-20T13:01:00.000Z",
            messages: [
              {
                id: "msg_eval_calc_1",
                role: "user",
                content: "What is 14 multiplied by 3?",
                createdAt: "2026-03-20T13:01:00.000Z",
              },
            ],
          },
        ],
          conversationEvents: [],
        leads: [],
        consultationRequests: [],
        deals: [],
        trainingPaths: [],
        toolFixtures: [
          {
            id: "tool_fixture_calculator_1",
            toolId: "calculator",
            args: {
              operation: "multiply",
              a: 14,
              b: 3,
            },
            expectedResult: 42,
          },
        ],
      };
    case "integrity-canonical-corpus-reference-deterministic":
      return {
        scenarioId,
        seedSetId: "seed-integrity-canonical-corpus-v1",
        refs: {
          primaryConversationId: "conv_eval_integrity_corpus",
          authenticatedUserId: "usr_eval_integrity_corpus",
        },
        users: [
          { id: "usr_eval_integrity_corpus", email: "integrity.corpus@example.com", name: "Integrity Corpus Auditor" },
        ],
        conversations: [
          buildAuthConversation({
            id: "conv_eval_integrity_corpus",
            userId: "usr_eval_integrity_corpus",
            title: "Auditor asks for canonical corpus references",
            lane: "individual",
            confidence: 0.78,
            recommendedNextStep: "Use the structured corpus search contract and cite canonical paths.",
            detectedNeedSummary: "Auditor wants grounded corpus references instead of prose-only summaries.",
            messages: [
              {
                id: "msg_eval_integrity_corpus_1",
                role: "user",
                content: "Find the section about the Sage and make sure the reference is canonical.",
                createdAt: "2026-03-20T13:20:00.000Z",
              },
            ],
          }),
        ],
        conversationEvents: [],
        leads: [],
        consultationRequests: [],
        deals: [],
        trainingPaths: [],
        toolFixtures: [],
      };
    case "integrity-audio-recovery-deterministic":
      return {
        scenarioId,
        seedSetId: "seed-integrity-audio-recovery-v1",
        refs: {
          primaryConversationId: "conv_eval_integrity_audio",
          authenticatedUserId: "usr_eval_integrity_audio",
        },
        users: [
          { id: "usr_eval_integrity_audio", email: "integrity.audio@example.com", name: "Integrity Audio Auditor" },
        ],
        conversations: [
          buildAuthConversation({
            id: "conv_eval_integrity_audio",
            userId: "usr_eval_integrity_audio",
            title: "Auditor checks audio fallback behavior",
            lane: "individual",
            confidence: 0.74,
            recommendedNextStep: "Preserve the transcript and explain the retry path if audio delivery fails.",
            detectedNeedSummary: "Auditor wants the spoken version without losing the text fallback.",
            messages: [
              {
                id: "msg_eval_integrity_audio_1",
                role: "user",
                content: "Generate audio for this answer, but tell me what happens if the stream fails.",
                createdAt: "2026-03-20T13:30:00.000Z",
              },
            ],
          }),
        ],
        conversationEvents: [],
        leads: [],
        consultationRequests: [],
        deals: [],
        trainingPaths: [],
        toolFixtures: [],
      };
    case "integrity-malformed-ui-tags-deterministic":
      return {
        scenarioId,
        seedSetId: "seed-integrity-ui-tags-v1",
        refs: {
          primaryConversationId: "conv_eval_integrity_ui_tags",
          authenticatedUserId: "usr_eval_integrity_ui_tags",
        },
        users: [
          { id: "usr_eval_integrity_ui_tags", email: "integrity.ui@example.com", name: "Integrity UI Auditor" },
        ],
        conversations: [
          buildAuthConversation({
            id: "conv_eval_integrity_ui_tags",
            userId: "usr_eval_integrity_ui_tags",
            title: "Auditor sends malformed UI tags",
            lane: "uncertain",
            confidence: 0.66,
            recommendedNextStep: "Suppress synthetic suggestions and normalize action params.",
            detectedNeedSummary: "Auditor is testing whether malformed chat tags break the surface.",
            messages: [
              {
                id: "msg_eval_integrity_ui_tags_1",
                role: "user",
                content: "Show me the repaired actions even if the raw tags are malformed.",
                createdAt: "2026-03-20T13:40:00.000Z",
              },
            ],
          }),
        ],
        conversationEvents: [],
        leads: [],
        consultationRequests: [],
        deals: [],
        trainingPaths: [],
        toolFixtures: [],
      };
    case "organization-buyer-deterministic":
      return {
        scenarioId,
        seedSetId: "seed-org-buyer-deterministic-v1",
        refs: {
          primaryConversationId: "conv_eval_org_buyer",
          authenticatedUserId: "usr_eval_org_buyer",
        },
        users: [
          { id: "usr_eval_org_buyer", email: "org.buyer@example.com", name: "Organization Buyer" },
        ],
        conversations: [
          buildAuthConversation({
            id: "conv_eval_org_buyer",
            userId: "usr_eval_org_buyer",
            title: "Organization buyer requests a founder-ready next step",
            lane: "organization",
            confidence: 0.94,
            recommendedNextStep: "Review consultation and prepare a founder-approved estimate.",
            detectedNeedSummary: "Team workflow redesign with budget and urgency signal.",
            messages: [
              {
                id: "msg_eval_org_buyer_1",
                role: "user",
                content: "We need an approvals workflow redesign across three teams and can move this quarter.",
                createdAt: "2026-03-20T14:01:00.000Z",
              },
              {
                id: "msg_eval_org_buyer_2",
                role: "assistant",
                content: "This looks like an organization workflow engagement that should move into founder review.",
                createdAt: "2026-03-20T14:02:00.000Z",
              },
            ],
          }),
        ],
        conversationEvents: [
          {
            id: "evt_eval_org_buyer_1",
            conversationId: "conv_eval_org_buyer",
            type: "organization_lane_confirmed",
            metadata: { confidence: 0.94 },
            createdAt: "2026-03-20T14:02:30.000Z",
          },
        ],
        leads: [
          {
            conversationId: "conv_eval_org_buyer",
            lane: "organization",
            name: "Pat Buyer",
            email: "pat.buyer@example.com",
            organization: "Northstar Ops",
            roleOrTitle: "Operations Director",
            trainingGoal: null,
            problemSummary: "Needs a cross-team approvals workflow redesign.",
            recommendedNextAction: "Review consultation and prepare estimate-ready next step.",
            qualification: {
              authorityLevel: "decision_maker",
              urgency: "this_quarter",
              budgetSignal: "confirmed",
              technicalEnvironment: "Notion, Slack, and internal approvals tooling",
            },
            triageState: "qualified",
            founderNote: "Good fit for an advisory workflow package.",
          },
        ],
        consultationRequests: [
          {
            conversationId: "conv_eval_org_buyer",
            userId: "usr_eval_org_buyer",
            lane: "organization",
            requestSummary: "Need a founder review and next-step recommendation for the workflow redesign.",
            status: "reviewed",
            founderNote: "Ready to convert into a scoped deal.",
          },
        ],
        deals: [],
        trainingPaths: [],
        toolFixtures: [],
      };
    case "individual-learner-deterministic":
      return {
        scenarioId,
        seedSetId: "seed-individual-learner-deterministic-v1",
        refs: {
          primaryConversationId: "conv_eval_individual_learner",
          authenticatedUserId: "usr_eval_individual_learner",
        },
        users: [
          { id: "usr_eval_individual_learner", email: "learner@example.com", name: "Individual Learner" },
        ],
        conversations: [
          buildAuthConversation({
            id: "conv_eval_individual_learner",
            userId: "usr_eval_individual_learner",
            title: "Learner asks for a founder-approved training recommendation",
            lane: "individual",
            confidence: 0.91,
            recommendedNextStep: "Prepare a founder-approved training path recommendation.",
            detectedNeedSummary: "Career-transition learner with strong operator intent.",
            messages: [
              {
                id: "msg_eval_individual_1",
                role: "user",
                content: "I want a real path into operator work and I am open to apprenticeship screening if it fits.",
                createdAt: "2026-03-20T15:01:00.000Z",
              },
              {
                id: "msg_eval_individual_2",
                role: "assistant",
                content: "This looks like a strong individual training-path candidate with apprenticeship ambiguity.",
                createdAt: "2026-03-20T15:02:00.000Z",
              },
            ],
          }),
        ],
        conversationEvents: [
          {
            id: "evt_eval_individual_1",
            conversationId: "conv_eval_individual_learner",
            type: "training_fit_confirmed",
            metadata: { trainingFit: "career_transition" },
            createdAt: "2026-03-20T15:02:30.000Z",
          },
        ],
        leads: [
          {
            conversationId: "conv_eval_individual_learner",
            lane: "individual",
            name: "Jordan Learner",
            email: "jordan.learner@example.com",
            organization: null,
            roleOrTitle: "Product Designer",
            trainingGoal: "Transition into operator work with real practice and mentorship.",
            problemSummary: "Needs a serious operator path with founder guidance.",
            recommendedNextAction: "Recommend apprenticeship screening.",
            qualification: {
              trainingFit: "career_transition",
              urgency: "this_quarter",
              budgetSignal: "likely",
            },
            triageState: "qualified",
            founderNote: "High-signal learner with strong apprenticeship interest.",
          },
        ],
        consultationRequests: [],
        deals: [],
        trainingPaths: [],
        toolFixtures: [],
      };
    case "blog-job-status-continuity-deterministic":
      return {
        scenarioId,
        seedSetId: "seed-blog-job-status-continuity-v1",
        refs: {
          primaryConversationId: "conv_eval_blog_status_continuity",
          authenticatedUserId: "usr_eval_blog_admin",
        },
        users: [
          { id: "usr_eval_blog_admin", email: "blog.admin@example.com", name: "Blog Admin" },
        ],
        conversations: [
          buildAuthConversation({
            id: "conv_eval_blog_status_continuity",
            userId: "usr_eval_blog_admin",
            title: "Admin asks whether the blog production job is still running",
            lane: "organization",
            confidence: 0.93,
            recommendedNextStep: "Check the existing job before issuing any new production command.",
            detectedNeedSummary: "Deferred blog job status should be inspected, not rerun.",
            messages: [
              {
                id: "msg_eval_blog_status_continuity_1",
                role: "user",
                content: "Is the existing blog production job done yet?",
                createdAt: "2026-03-20T16:01:00.000Z",
              },
            ],
          }),
        ],
        conversationEvents: [],
        leads: [],
        consultationRequests: [],
        deals: [],
        trainingPaths: [],
        toolFixtures: [],
      };
    case "member-job-status-summary-deterministic":
      return {
        scenarioId,
        seedSetId: "seed-member-job-status-summary-v1",
        refs: {
          primaryConversationId: "conv_eval_member_job_summary",
          authenticatedUserId: "usr_eval_member_jobs",
        },
        users: [
          { id: "usr_eval_member_jobs", email: "member.jobs@example.com", name: "Member Jobs" },
        ],
        conversations: [
          buildAuthConversation({
            id: "conv_eval_member_job_summary",
            userId: "usr_eval_member_jobs",
            title: "Signed-in member asks what jobs are happening",
            lane: "organization",
            confidence: 0.91,
            recommendedNextStep: "Summarize the active job in plain language and avoid rerunning work.",
            detectedNeedSummary: "Member wants a plain-language update on current deferred work.",
            messages: [
              {
                id: "msg_eval_member_job_summary_1",
                role: "user",
                content: "what jobs are happening?",
                createdAt: "2026-03-20T16:31:00.000Z",
              },
            ],
          }),
        ],
        conversationEvents: [],
        leads: [],
        consultationRequests: [],
        deals: [],
        trainingPaths: [],
        toolFixtures: [],
      };
    case "member-explicit-job-status-deterministic":
      return {
        scenarioId,
        seedSetId: "seed-member-explicit-job-status-v1",
        refs: {
          primaryConversationId: "conv_eval_member_explicit_job",
          authenticatedUserId: "usr_eval_member_jobs",
        },
        users: [
          { id: "usr_eval_member_jobs", email: "member.jobs@example.com", name: "Member Jobs" },
        ],
        conversations: [
          buildAuthConversation({
            id: "conv_eval_member_explicit_job",
            userId: "usr_eval_member_jobs",
            title: "Signed-in member asks for one job by id",
            lane: "organization",
            confidence: 0.91,
            recommendedNextStep: "Inspect the named job and explain its status in plain language.",
            detectedNeedSummary: "Member wants the current state of one named deferred job.",
            messages: [
              {
                id: "msg_eval_member_explicit_job_1",
                role: "user",
                content: "what is job job_member_explicit doing?",
                createdAt: "2026-03-20T16:35:00.000Z",
              },
            ],
          }),
        ],
        conversationEvents: [],
        leads: [],
        consultationRequests: [],
        deals: [],
        trainingPaths: [],
        toolFixtures: [],
      };
    case "member-all-jobs-list-deterministic":
      return {
        scenarioId,
        seedSetId: "seed-member-all-jobs-list-v1",
        refs: {
          primaryConversationId: "conv_eval_member_all_jobs",
          authenticatedUserId: "usr_eval_member_jobs",
        },
        users: [
          { id: "usr_eval_member_jobs", email: "member.jobs@example.com", name: "Member Jobs" },
        ],
        conversations: [
          buildAuthConversation({
            id: "conv_eval_member_all_jobs",
            userId: "usr_eval_member_jobs",
            title: "Signed-in member explicitly asks for all jobs",
            lane: "organization",
            confidence: 0.92,
            recommendedNextStep: "Return a concise list of current and recent jobs.",
            detectedNeedSummary: "Member wants a compact list of all jobs, not just prose status.",
            messages: [
              {
                id: "msg_eval_member_all_jobs_1",
                role: "user",
                content: "show me all jobs",
                createdAt: "2026-03-20T16:40:00.000Z",
              },
            ],
          }),
        ],
        conversationEvents: [],
        leads: [],
        consultationRequests: [],
        deals: [],
        trainingPaths: [],
        toolFixtures: [],
      };
    case "anonymous-job-status-guidance-deterministic":
      return {
        scenarioId,
        seedSetId: "seed-anonymous-job-status-guidance-v1",
        refs: {
          primaryConversationId: "conv_eval_anon_job_guidance",
          anonymousUserId: "anon_eval_job_guidance",
        },
        users: [
          { id: "anon_eval_job_guidance", email: "anon.job.guidance@example.com", name: "Anonymous Job Guidance" },
        ],
        conversations: [
          buildAnonymousConversation({
            id: "conv_eval_anon_job_guidance",
            userId: "anon_eval_job_guidance",
            title: "Anonymous visitor asks for job status",
            recommendedNextStep: "Explain the limitation without pushing the user to the signed-in jobs page.",
            detectedNeedSummary: "Anonymous job status guidance should stay inside the chat surface.",
            messages: [
              {
                id: "msg_eval_anon_job_guidance_1",
                role: "user",
                content: "what jobs are happening?",
                createdAt: "2026-03-20T16:45:00.000Z",
              },
            ],
          }),
        ],
        conversationEvents: [],
        leads: [],
        consultationRequests: [],
        deals: [],
        trainingPaths: [],
        toolFixtures: [],
      };
    case "blog-explicit-status-check-deterministic":
      return {
        scenarioId,
        seedSetId: "seed-blog-explicit-status-check-v1",
        refs: {
          primaryConversationId: "conv_eval_blog_explicit_status",
          authenticatedUserId: "usr_eval_blog_admin",
        },
        users: [
          { id: "usr_eval_blog_admin", email: "blog.admin@example.com", name: "Blog Admin" },
        ],
        conversations: [
          buildAuthConversation({
            id: "conv_eval_blog_explicit_status",
            userId: "usr_eval_blog_admin",
            title: "Admin explicitly asks for the status of a known blog job id",
            lane: "organization",
            confidence: 0.94,
            recommendedNextStep: "Read the existing job state and explain it plainly instead of rerunning production.",
            detectedNeedSummary: "Explicit deferred job status checks should stay visible and understandable even without assistant prose deltas.",
            messages: [
              {
                id: "msg_eval_blog_explicit_status_1",
                role: "user",
                content: "Produce a blog post on my capabilities",
                createdAt: "2026-03-20T16:20:00.000Z",
              },
            ],
          }),
        ],
        conversationEvents: [],
        leads: [],
        consultationRequests: [],
        deals: [],
        trainingPaths: [],
        toolFixtures: [],
      };
    case "blog-job-dedupe-clarity-deterministic":
      return {
        scenarioId,
        seedSetId: "seed-blog-job-dedupe-clarity-v1",
        refs: {
          primaryConversationId: "conv_eval_blog_dedupe_clarity",
          authenticatedUserId: "usr_eval_blog_admin",
        },
        users: [
          { id: "usr_eval_blog_admin", email: "blog.admin@example.com", name: "Blog Admin" },
        ],
        conversations: [
          buildAuthConversation({
            id: "conv_eval_blog_dedupe_clarity",
            userId: "usr_eval_blog_admin",
            title: "Admin asks to rerun while the same blog job is already active",
            lane: "organization",
            confidence: 0.93,
            recommendedNextStep: "Reuse the active production job and explain that it is already in progress.",
            detectedNeedSummary: "Deferred blog dedupe copy should state reuse clearly.",
            messages: [
              {
                id: "msg_eval_blog_dedupe_clarity_1",
                role: "user",
                content: "Run the full blog pipeline now.",
                createdAt: "2026-03-20T16:05:00.000Z",
              },
            ],
          }),
        ],
        conversationEvents: [],
        leads: [],
        consultationRequests: [],
        deals: [],
        trainingPaths: [],
        toolFixtures: [],
      };
    case "blog-produce-publish-handoff-deterministic":
      return {
        scenarioId,
        seedSetId: "seed-blog-produce-publish-handoff-v1",
        refs: {
          primaryConversationId: "conv_eval_blog_publish_handoff",
          authenticatedUserId: "usr_eval_blog_admin",
        },
        users: [
          { id: "usr_eval_blog_admin", email: "blog.admin@example.com", name: "Blog Admin" },
        ],
        conversations: [
          buildAuthConversation({
            id: "conv_eval_blog_publish_handoff",
            userId: "usr_eval_blog_admin",
            title: "Admin wants to publish the produced blog draft",
            lane: "organization",
            confidence: 0.95,
            recommendedNextStep: "Publish the completed draft using the preserved post id.",
            detectedNeedSummary: "Completed blog production should hand directly into publish.",
            messages: [
              {
                id: "msg_eval_blog_publish_handoff_1",
                role: "user",
                content: "The draft is ready, publish it now.",
                createdAt: "2026-03-20T16:10:00.000Z",
              },
            ],
          }),
        ],
        conversationEvents: [],
        leads: [],
        consultationRequests: [],
        deals: [],
        trainingPaths: [],
        toolFixtures: [],
      };
    case "blog-missed-sse-recovery-deterministic":
      return {
        scenarioId,
        seedSetId: "seed-blog-missed-sse-recovery-v1",
        refs: {
          primaryConversationId: "conv_eval_blog_sse_recovery",
          authenticatedUserId: "usr_eval_blog_admin",
        },
        users: [
          { id: "usr_eval_blog_admin", email: "blog.admin@example.com", name: "Blog Admin" },
        ],
        conversations: [
          buildAuthConversation({
            id: "conv_eval_blog_sse_recovery",
            userId: "usr_eval_blog_admin",
            title: "Admin reloads after missing the final blog job event",
            lane: "organization",
            confidence: 0.92,
            recommendedNextStep: "Recover the completed blog draft through durable reconciliation.",
            detectedNeedSummary: "Missed SSE should not hide terminal blog job results.",
            messages: [
              {
                id: "msg_eval_blog_sse_recovery_1",
                role: "user",
                content: "Check whether the blog draft finished while I was away.",
                createdAt: "2026-03-20T16:15:00.000Z",
              },
            ],
          }),
        ],
        conversationEvents: [],
        leads: [],
        consultationRequests: [],
        deals: [],
        trainingPaths: [],
        toolFixtures: [],
      };
    case "integrity-session-resolution-deterministic":
      return {
        scenarioId,
        seedSetId: "seed-integrity-session-resolution-v1",
        refs: {
          primaryConversationId: "conv_eval_integrity_session_resolution",
          authenticatedUserId: "usr_eval_integrity_session_resolution",
        },
        users: [
          { id: "usr_eval_integrity_session_resolution", email: "integrity.session@example.com", name: "Integrity Session Auditor" },
        ],
        conversations: [
          buildAuthConversation({
            id: "conv_eval_integrity_session_resolution",
            userId: "usr_eval_integrity_session_resolution",
            title: "Auditor checks session resolution logic",
            lane: "uncertain",
            confidence: 0.66,
            recommendedNextStep: "Resolve session status correctly from actionable vs closed state tags.",
            detectedNeedSummary: "Auditor tests whether session resolution outputs are recognized and recorded correctly.",
            messages: [
              {
                id: "msg_eval_integrity_session_resolution_1",
                role: "user",
                content: "Execute a test resolving a session state.",
                createdAt: "2026-03-20T13:45:00.000Z",
              },
            ],
          }),
        ],
        conversationEvents: [],
        leads: [],
        consultationRequests: [],
        deals: [],
        trainingPaths: [],
        toolFixtures: [],
      };
    case "integrity-retrieval-quality-deterministic":
      return {
        scenarioId,
        seedSetId: "seed-integrity-retrieval-quality-v1",
        refs: {
          primaryConversationId: "conv_eval_integrity_retrieval",
          authenticatedUserId: "usr_eval_integrity_retrieval",
        },
        users: [
          { id: "usr_eval_integrity_retrieval", email: "integrity.retrieval@example.com", name: "Integrity Retrieval Auditor" },
        ],
        conversations: [
          buildAuthConversation({
            id: "conv_eval_integrity_retrieval",
            userId: "usr_eval_integrity_retrieval",
            title: "Auditor checks retrieval quality levels",
            lane: "uncertain",
            confidence: 0.66,
            recommendedNextStep: "Search corpus to verify retrieval qualities.",
            detectedNeedSummary: "Auditor tests strong, partial, and none retrieval configurations.",
            messages: [
              {
                id: "msg_eval_integrity_retrieval_1",
                role: "user",
                content: "Run retrieval tests",
                createdAt: "2026-03-20T13:50:00.000Z",
              },
            ],
          }),
        ],
        conversationEvents: [],
        leads: [],
        consultationRequests: [],
        deals: [],
        trainingPaths: [],
        toolFixtures: [],
      };
    case "integrity-two-stage-retrieval-deterministic":
      return {
        scenarioId,
        seedSetId: "seed-integrity-two-stage-retrieval-v1",
        refs: {
          primaryConversationId: "conv_eval_integrity_two_stage_retrieval",
          authenticatedUserId: "usr_eval_integrity_two_stage_retrieval",
        },
        users: [
          { id: "usr_eval_integrity_two_stage_retrieval", email: "integrity.twostage@example.com", name: "Integrity Two Stage Auditor" },
        ],
        conversations: [
          buildAuthConversation({
            id: "conv_eval_integrity_two_stage_retrieval",
            userId: "usr_eval_integrity_two_stage_retrieval",
            title: "Auditor checks locate then read retrieval behavior",
            lane: "individual",
            confidence: 0.72,
            recommendedNextStep: "Confirm strong matches auto-read while partial matches stay at locate-only.",
            detectedNeedSummary: "Auditor tests whether search_corpus behaves as locate-first retrieval.",
            messages: [
              {
                id: "msg_eval_integrity_two_stage_retrieval_1",
                role: "user",
                content: "Validate that strong matches auto-read and partial matches stay search-only.",
                createdAt: "2026-03-20T13:52:00.000Z",
              },
            ],
          }),
        ],
        conversationEvents: [],
        leads: [],
        consultationRequests: [],
        deals: [],
        trainingPaths: [],
        toolFixtures: [],
      };
    case "integrity-structured-get-section-deterministic":
      return {
        scenarioId,
        seedSetId: "seed-integrity-structured-get-section-v1",
        refs: {
          primaryConversationId: "conv_eval_integrity_structured_get_section",
          authenticatedUserId: "usr_eval_integrity_structured_get_section",
        },
        users: [
          { id: "usr_eval_integrity_structured_get_section", email: "integrity.section@example.com", name: "Integrity Section Auditor" },
        ],
        conversations: [
          buildAuthConversation({
            id: "conv_eval_integrity_structured_get_section",
            userId: "usr_eval_integrity_structured_get_section",
            title: "Auditor checks structured get_section responses",
            lane: "individual",
            confidence: 0.71,
            recommendedNextStep: "Verify alias resolution, structured metadata, and safe related links.",
            detectedNeedSummary: "Auditor tests the structured section payload and adjacent context.",
            messages: [
              {
                id: "msg_eval_integrity_structured_get_section_1",
                role: "user",
                content: "Return a structured section payload with safe related links.",
                createdAt: "2026-03-20T13:53:00.000Z",
              },
            ],
          }),
        ],
        conversationEvents: [],
        leads: [],
        consultationRequests: [],
        deals: [],
        trainingPaths: [],
        toolFixtures: [],
      };
    default:
      throw new Error(`No deterministic seed pack is defined for scenario: ${scenarioId}`);
  }
}

export async function inflateDeterministicSeedPack(
  workspace: EvalWorkspace,
  pack: DeterministicEvalSeedPack,
): Promise<InflatedDeterministicEvalSeedPack> {
  for (const user of pack.users) {
    await workspace.seedUser(user);
  }

  for (const conversation of pack.conversations) {
    await workspace.seedConversation(conversation);
  }

  for (const event of pack.conversationEvents) {
    await workspace.seedConversationEvent(event);
  }

  for (const lead of pack.leads) {
    await workspace.seedLead(lead);
  }

  for (const request of pack.consultationRequests) {
    await workspace.seedConsultationRequest(request);
  }

  for (const deal of pack.deals) {
    await workspace.seedDeal(deal);
  }

  for (const trainingPath of pack.trainingPaths) {
    await workspace.seedTrainingPath(trainingPath);
  }

  return {
    pack,
    refs: pack.refs,
    toolFixtures: new Map(pack.toolFixtures.map((fixture) => [fixture.id, fixture])),
  };
}
