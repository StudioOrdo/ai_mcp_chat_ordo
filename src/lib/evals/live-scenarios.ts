import type Anthropic from "@anthropic-ai/sdk";

import type { RoleName } from "@/core/entities/user";
import type { CurrentPageSnapshot } from "@/lib/chat/current-page-context";
import type { DeterministicEvalSeedPack } from "./seeding";

export interface LiveEvalScenarioFixture {
  scenarioId: string;
  role: RoleName;
  userId: string;
  seedPack: DeterministicEvalSeedPack;
  promptMessages: Anthropic.MessageParam[];
  currentPageSnapshot?: CurrentPageSnapshot;
}

function buildAnonymousConversation(seed: {
  id: string;
  userId: string;
  title: string;
  recommendedNextStep: string;
  detectedNeedSummary: string;
  messages: Array<{ id: string; role: "user" | "assistant" | "system"; content: string; createdAt: string }>;
}) {
  return {
    id: seed.id,
    userId: seed.userId,
    title: seed.title,
    sessionSource: "anonymous_cookie",
    lane: "organization" as const,
    confidence: 0.89,
    recommendedNextStep: seed.recommendedNextStep,
    detectedNeedSummary: seed.detectedNeedSummary,
    lastAnalyzedAt: "2026-03-20T09:00:00.000Z",
    createdAt: "2026-03-20T09:00:00.000Z",
    updatedAt: "2026-03-20T09:10:00.000Z",
    messages: seed.messages,
  };
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
}) {
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

const LIVE_SCENARIO_FIXTURES: Record<string, LiveEvalScenarioFixture> = {
  "live-anonymous-high-intent-loss": {
    scenarioId: "live-anonymous-high-intent-loss",
    role: "ANONYMOUS",
    userId: "anon_eval_live_dropout",
    seedPack: {
      scenarioId: "live-anonymous-high-intent-loss",
      seedSetId: "seed-live-anon-dropout-v1",
      refs: {
        primaryConversationId: "conv_eval_live_anon_dropout",
        anonymousUserId: "anon_eval_live_dropout",
      },
      users: [
        { id: "anon_eval_live_dropout", email: "live.dropout@example.com", name: "Live Anonymous Dropout" },
      ],
      conversations: [
        buildAnonymousConversation({
          id: "conv_eval_live_anon_dropout",
          userId: "anon_eval_live_dropout",
          title: "Anonymous operator asks for a next step but does not sign up",
          recommendedNextStep: "Encourage signup before recommending a founder-reviewed path.",
          detectedNeedSummary: "High-intent workflow redesign request without account creation.",
          messages: [
            {
              id: "msg_eval_live_anon_dropout_1",
              role: "user",
              content: "We need help redesigning our approvals workflow across multiple teams.",
              createdAt: "2026-03-20T09:01:00.000Z",
            },
            {
              id: "msg_eval_live_anon_dropout_2",
              role: "assistant",
              content: "I can help clarify the likely path and where founder review would matter.",
              createdAt: "2026-03-20T09:02:00.000Z",
            },
          ],
        }),
      ],
      conversationEvents: [
        {
          id: "evt_eval_live_anon_dropout_1",
          conversationId: "conv_eval_live_anon_dropout",
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
    },
    promptMessages: [
      { role: "user", content: "What should happen next if I am not ready to sign up yet?" },
    ],
  },
  "live-anonymous-signup-continuity": {
    scenarioId: "live-anonymous-signup-continuity",
    role: "AUTHENTICATED",
    userId: "usr_eval_live_signup",
    seedPack: {
      scenarioId: "live-anonymous-signup-continuity",
      seedSetId: "seed-live-anon-signup-v1",
      refs: {
        primaryConversationId: "conv_eval_live_signup_continuity",
        anonymousUserId: "anon_eval_live_signup",
        authenticatedUserId: "usr_eval_live_signup",
      },
      users: [
        { id: "anon_eval_live_signup", email: "anon.live.signup@example.com", name: "Anon Live Signup" },
        { id: "usr_eval_live_signup", email: "signed.live@example.com", name: "Signed Live User" },
      ],
      conversations: [
        {
          id: "conv_eval_live_signup_continuity",
          userId: "anon_eval_live_signup",
          title: "Anonymous learner continues after signup in a live eval",
          sessionSource: "anonymous_cookie",
          lane: "individual",
          confidence: 0.84,
          recommendedNextStep: "Preserve the conversation and continue with a training-path recommendation after signup.",
          detectedNeedSummary: "Learner wants a serious operator path.",
          lastAnalyzedAt: "2026-03-20T10:00:00.000Z",
          createdAt: "2026-03-20T10:00:00.000Z",
          updatedAt: "2026-03-20T10:08:00.000Z",
          messages: [
            {
              id: "msg_eval_live_signup_1",
              role: "user",
              content: "I want a real path into operator work.",
              createdAt: "2026-03-20T10:01:00.000Z",
            },
            {
              id: "msg_eval_live_signup_2",
              role: "assistant",
              content: "We can keep the conversation intact if you create an account.",
              createdAt: "2026-03-20T10:02:00.000Z",
            },
          ],
        },
      ],
      conversationEvents: [
        {
          id: "evt_eval_live_signup_1",
          conversationId: "conv_eval_live_signup_continuity",
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
    },
    promptMessages: [
      { role: "user", content: "I signed up. What should my next step be now that we kept the conversation?" },
    ],
  },
  "organization-buyer-funnel": {
    scenarioId: "organization-buyer-funnel",
    role: "AUTHENTICATED",
    userId: "usr_eval_live_org_buyer",
    seedPack: {
      scenarioId: "organization-buyer-funnel",
      seedSetId: "seed-live-org-buyer-v1",
      refs: {
        primaryConversationId: "conv_eval_live_org_buyer",
        authenticatedUserId: "usr_eval_live_org_buyer",
      },
      users: [
        { id: "usr_eval_live_org_buyer", email: "org.live@example.com", name: "Live Organization Buyer" },
      ],
      conversations: [
        buildAuthConversation({
          id: "conv_eval_live_org_buyer",
          userId: "usr_eval_live_org_buyer",
          title: "Live organization buyer funnel",
          lane: "organization",
          confidence: 0.95,
          recommendedNextStep: "Prepare a founder-reviewed estimate-ready next step.",
          detectedNeedSummary: "Operations buyer with budget and urgency signal.",
          messages: [
            {
              id: "msg_eval_live_org_buyer_1",
              role: "user",
              content: "We need help redesigning our team approvals process this quarter.",
              createdAt: "2026-03-20T14:01:00.000Z",
            },
          ],
        }),
      ],
      conversationEvents: [],
      leads: [
        {
          conversationId: "conv_eval_live_org_buyer",
          lane: "organization",
          name: "Pat Live Buyer",
          email: "pat.live@example.com",
          organization: "Northstar Ops",
          roleOrTitle: "Operations Director",
          trainingGoal: null,
          problemSummary: "Needs a workflow redesign for approvals.",
          recommendedNextAction: "Prepare a founder-reviewed estimate.",
          qualification: {
            authorityLevel: "decision_maker",
            urgency: "this_quarter",
            budgetSignal: "confirmed",
            technicalEnvironment: "Slack and Notion",
          },
          triageState: "qualified",
          founderNote: "Strong org buyer signal.",
        },
      ],
      consultationRequests: [
        {
          conversationId: "conv_eval_live_org_buyer",
          userId: "usr_eval_live_org_buyer",
          lane: "organization",
          requestSummary: "Need the founder-reviewed next step for our workflow redesign.",
          status: "reviewed",
          founderNote: "Ready to scope.",
        },
      ],
      deals: [],
      trainingPaths: [],
      toolFixtures: [],
    },
    promptMessages: [
      { role: "user", content: "Please recommend the next step and whether we are ready for a founder-approved estimate." },
    ],
  },
  "individual-learner-funnel": {
    scenarioId: "individual-learner-funnel",
    role: "AUTHENTICATED",
    userId: "usr_eval_live_individual",
    seedPack: {
      scenarioId: "individual-learner-funnel",
      seedSetId: "seed-live-individual-v1",
      refs: {
        primaryConversationId: "conv_eval_live_individual",
        authenticatedUserId: "usr_eval_live_individual",
      },
      users: [
        { id: "usr_eval_live_individual", email: "individual.live@example.com", name: "Live Individual Learner" },
      ],
      conversations: [
        buildAuthConversation({
          id: "conv_eval_live_individual",
          userId: "usr_eval_live_individual",
          title: "Live individual learner funnel",
          lane: "individual",
          confidence: 0.92,
          recommendedNextStep: "Prepare a founder-approved training recommendation.",
          detectedNeedSummary: "Career-transition learner with apprenticeship ambiguity.",
          messages: [
            {
              id: "msg_eval_live_individual_1",
              role: "user",
              content: "I want a real operator path and I am open to apprenticeship screening if that is the right fit.",
              createdAt: "2026-03-20T15:01:00.000Z",
            },
          ],
        }),
      ],
      conversationEvents: [],
      leads: [
        {
          conversationId: "conv_eval_live_individual",
          lane: "individual",
          name: "Jordan Live Learner",
          email: "jordan.live@example.com",
          organization: null,
          roleOrTitle: "Designer",
          trainingGoal: "Transition into operator work",
          problemSummary: "Needs a structured operator path.",
          recommendedNextAction: "Recommend apprenticeship screening.",
          qualification: {
            trainingFit: "career_transition",
            urgency: "this_quarter",
            budgetSignal: "likely",
          },
          triageState: "qualified",
          founderNote: "Strong learner signal.",
        },
      ],
      consultationRequests: [],
      deals: [],
      trainingPaths: [],
      toolFixtures: [],
    },
    promptMessages: [
      { role: "user", content: "Please recommend the next founder-approved training step for me." },
    ],
  },
  "development-prospect-funnel": {
    scenarioId: "development-prospect-funnel",
    role: "AUTHENTICATED",
    userId: "usr_eval_live_development",
    seedPack: {
      scenarioId: "development-prospect-funnel",
      seedSetId: "seed-live-development-v1",
      refs: {
        primaryConversationId: "conv_eval_live_development",
        authenticatedUserId: "usr_eval_live_development",
      },
      users: [
        { id: "usr_eval_live_development", email: "development.live@example.com", name: "Live Development Prospect" },
      ],
      conversations: [
        buildAuthConversation({
          id: "conv_eval_live_development",
          userId: "usr_eval_live_development",
          title: "Live development prospect funnel",
          lane: "development",
          confidence: 0.9,
          recommendedNextStep: "Prepare a scoping-ready founder follow-up.",
          detectedNeedSummary: "Prospect needs implementation and scoping support.",
          messages: [
            {
              id: "msg_eval_live_development_1",
              role: "user",
              content: "We need someone to help implement and scope the system itself.",
              createdAt: "2026-03-20T16:01:00.000Z",
            },
          ],
        }),
      ],
      conversationEvents: [],
      leads: [
        {
          conversationId: "conv_eval_live_development",
          lane: "development",
          name: "Dana Builder",
          email: "dana.builder@example.com",
          organization: "Builder Labs",
          roleOrTitle: "Engineering Lead",
          trainingGoal: null,
          problemSummary: "Needs implementation and scoping support.",
          recommendedNextAction: "Prepare a founder-reviewed scope and estimate.",
          qualification: {
            authorityLevel: "decision_maker",
            urgency: "immediate",
            budgetSignal: "confirmed",
            technicalEnvironment: "Next.js, Postgres, Anthropic tools",
          },
          triageState: "qualified",
          founderNote: "Good fit for development delivery.",
        },
      ],
      consultationRequests: [],
      deals: [],
      trainingPaths: [],
      toolFixtures: [],
    },
    promptMessages: [
      { role: "user", content: "Please recommend the next scoping-ready founder-approved step for this implementation request." },
    ],
  },
  "live-runtime-self-knowledge-honesty": {
    scenarioId: "live-runtime-self-knowledge-honesty",
    role: "AUTHENTICATED",
    userId: "usr_eval_live_runtime_truth",
    seedPack: {
      scenarioId: "live-runtime-self-knowledge-honesty",
      seedSetId: "seed-live-runtime-truth-v1",
      refs: {
        primaryConversationId: "conv_eval_live_runtime_truth",
        authenticatedUserId: "usr_eval_live_runtime_truth",
      },
      users: [
        { id: "usr_eval_live_runtime_truth", email: "runtime.truth@example.com", name: "Runtime Truth Auditor" },
      ],
      conversations: [
        buildAuthConversation({
          id: "conv_eval_live_runtime_truth",
          userId: "usr_eval_live_runtime_truth",
          title: "Live runtime self-knowledge honesty",
          lane: "uncertain",
          confidence: 0.67,
          recommendedNextStep: "Inspect runtime context before answering fourth-wall questions.",
          detectedNeedSummary: "Auditor asks what the assistant can verify about tools and the current page.",
          messages: [
            {
              id: "msg_eval_live_runtime_truth_1",
              role: "assistant",
              content: "Earlier I guessed we were probably still on the homepage.",
              createdAt: "2026-03-20T18:20:00.000Z",
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
    },
    promptMessages: [
      { role: "user", content: "What tools can you verify you have right now, and what page am I on? Do not guess." },
    ],
    currentPageSnapshot: {
      pathname: "/library/archetype-atlas/ch04-the-sage",
      title: "The Sage | Studio Ordo",
      mainHeading: "The Sage",
      sectionHeadings: ["Core Tension", "Second-Renaissance Relevance"],
      selectedText: null,
      contentExcerpt: "The Sage is the archetype of disciplined interpretation and long-horizon pattern recognition.",
    },
  },
  "live-current-page-truthfulness": {
    scenarioId: "live-current-page-truthfulness",
    role: "AUTHENTICATED",
    userId: "usr_eval_live_page_truth",
    seedPack: {
      scenarioId: "live-current-page-truthfulness",
      seedSetId: "seed-live-page-truth-v1",
      refs: {
        primaryConversationId: "conv_eval_live_page_truth",
        authenticatedUserId: "usr_eval_live_page_truth",
      },
      users: [
        { id: "usr_eval_live_page_truth", email: "page.truth@example.com", name: "Page Truth Auditor" },
      ],
      conversations: [
        buildAuthConversation({
          id: "conv_eval_live_page_truth",
          userId: "usr_eval_live_page_truth",
          title: "Live current page truthfulness",
          lane: "uncertain",
          confidence: 0.64,
          recommendedNextStep: "Use the authoritative page snapshot instead of stale assistant memory.",
          detectedNeedSummary: "Auditor checks whether stale assistant page claims are overridden.",
          messages: [
            {
              id: "msg_eval_live_page_truth_1",
              role: "assistant",
              content: "You are on the blog page.",
              createdAt: "2026-03-20T18:25:00.000Z",
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
    },
    promptMessages: [
      { role: "user", content: "Am I still on the blog page, or somewhere else?" },
    ],
    currentPageSnapshot: {
      pathname: "/library/archetype-atlas/ch04-the-sage",
      title: "The Sage | Studio Ordo",
      mainHeading: "The Sage",
      sectionHeadings: ["Core Tension", "Second-Renaissance Relevance"],
      selectedText: null,
      contentExcerpt: "The Sage is the archetype of disciplined interpretation and long-horizon pattern recognition.",
    },
  },
  "live-duplicate-navigation-avoidance": {
    scenarioId: "live-duplicate-navigation-avoidance",
    role: "AUTHENTICATED",
    userId: "usr_eval_live_navigation",
    seedPack: {
      scenarioId: "live-duplicate-navigation-avoidance",
      seedSetId: "seed-live-navigation-v1",
      refs: {
        primaryConversationId: "conv_eval_live_navigation",
        authenticatedUserId: "usr_eval_live_navigation",
      },
      users: [
        { id: "usr_eval_live_navigation", email: "navigation.truth@example.com", name: "Navigation Auditor" },
      ],
      conversations: [
        buildAuthConversation({
          id: "conv_eval_live_navigation",
          userId: "usr_eval_live_navigation",
          title: "Live duplicate navigation avoidance",
          lane: "uncertain",
          confidence: 0.69,
          recommendedNextStep: "Use the validated navigation tool surface for route changes.",
          detectedNeedSummary: "Auditor checks that only navigate_to_page is used for model-facing navigation.",
          messages: [
            {
              id: "msg_eval_live_navigation_1",
              role: "user",
              content: "Take me to my profile page.",
              createdAt: "2026-03-20T18:30:00.000Z",
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
    },
    promptMessages: [
      { role: "user", content: "Navigate me to /profile using the validated route surface." },
    ],
    currentPageSnapshot: {
      pathname: "/",
      title: "Studio Ordo",
      mainHeading: "Studio Ordo",
      sectionHeadings: ["Enterprise AI Cockpit Framework"],
      selectedText: null,
      contentExcerpt: "Studio Ordo is a governed AI operator environment.",
    },
  },
  "live-blog-job-status-and-publish-handoff": {
    scenarioId: "live-blog-job-status-and-publish-handoff",
    role: "ADMIN",
    userId: "usr_eval_live_blog_admin",
    seedPack: {
      scenarioId: "live-blog-job-status-and-publish-handoff",
      seedSetId: "seed-live-blog-status-publish-v1",
      refs: {
        primaryConversationId: "conv_eval_live_blog_status_publish",
        authenticatedUserId: "usr_eval_live_blog_admin",
      },
      users: [
        { id: "usr_eval_live_blog_admin", email: "blog.live.admin@example.com", name: "Live Blog Admin" },
      ],
      conversations: [
        buildAuthConversation({
          id: "conv_eval_live_blog_status_publish",
          userId: "usr_eval_live_blog_admin",
          title: "Live blog job status and publish handoff",
          lane: "organization",
          confidence: 0.95,
          recommendedNextStep: "Inspect the current production job and publish the draft if it is complete.",
          detectedNeedSummary: "Operator needs blog job continuity and publish handoff.",
          messages: [
            {
              id: "msg_eval_live_blog_status_publish_1",
              role: "user",
              content: "Check the latest blog production job and publish it if the draft is ready.",
              createdAt: "2026-03-20T19:01:00.000Z",
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
    },
    promptMessages: [
      { role: "user", content: "Use the deferred job tools to inspect the latest blog production job, then publish the resulting draft if the job already completed." },
    ],
  },
  "live-blog-job-reuse-instead-of-rerun": {
    scenarioId: "live-blog-job-reuse-instead-of-rerun",
    role: "ADMIN",
    userId: "usr_eval_live_blog_admin",
    seedPack: {
      scenarioId: "live-blog-job-reuse-instead-of-rerun",
      seedSetId: "seed-live-blog-reuse-v1",
      refs: {
        primaryConversationId: "conv_eval_live_blog_reuse",
        authenticatedUserId: "usr_eval_live_blog_admin",
      },
      users: [
        { id: "usr_eval_live_blog_admin", email: "blog.live.admin@example.com", name: "Live Blog Admin" },
      ],
      conversations: [
        buildAuthConversation({
          id: "conv_eval_live_blog_reuse",
          userId: "usr_eval_live_blog_admin",
          title: "Live blog job reuse instead of rerun",
          lane: "organization",
          confidence: 0.94,
          recommendedNextStep: "Check the already-running production job before doing anything else.",
          detectedNeedSummary: "Operator asked for another run even though one is already active.",
          messages: [
            {
              id: "msg_eval_live_blog_reuse_1",
              role: "user",
              content: "Do not start over if the article is already in progress. Tell me the status.",
              createdAt: "2026-03-20T19:11:00.000Z",
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
    },
    promptMessages: [
      { role: "user", content: "Use the deferred job tools to find the existing production job and explain its active status without running a new one." },
    ],
  },
  "live-blog-completion-recovery": {
    scenarioId: "live-blog-completion-recovery",
    role: "ADMIN",
    userId: "usr_eval_live_blog_admin",
    seedPack: {
      scenarioId: "live-blog-completion-recovery",
      seedSetId: "seed-live-blog-recovery-v1",
      refs: {
        primaryConversationId: "conv_eval_live_blog_recovery",
        authenticatedUserId: "usr_eval_live_blog_admin",
      },
      users: [
        { id: "usr_eval_live_blog_admin", email: "blog.live.admin@example.com", name: "Live Blog Admin" },
      ],
      conversations: [
        buildAuthConversation({
          id: "conv_eval_live_blog_recovery",
          userId: "usr_eval_live_blog_admin",
          title: "Live blog completion recovery",
          lane: "organization",
          confidence: 0.93,
          recommendedNextStep: "Recover the completed production job and explain whether the draft is publish-ready.",
          detectedNeedSummary: "Operator missed the live completion signal and needs snapshot recovery.",
          messages: [
            {
              id: "msg_eval_live_blog_recovery_1",
              role: "user",
              content: "I think I missed the completion update. Recover the latest result and tell me if it is ready to publish.",
              createdAt: "2026-03-20T19:21:00.000Z",
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
    },
    promptMessages: [
      { role: "user", content: "Recover the completed blog production job from the latest durable state and explain the publish-ready outcome without starting a new run." },
    ],
  },
  "mcp-tool-choice-and-recovery": {
    scenarioId: "mcp-tool-choice-and-recovery",
    role: "AUTHENTICATED",
    userId: "usr_eval_live_tool_recovery",
    seedPack: {
      scenarioId: "mcp-tool-choice-and-recovery",
      seedSetId: "seed-live-tool-recovery-v1",
      refs: {
        primaryConversationId: "conv_eval_live_tool_recovery",
        authenticatedUserId: "usr_eval_live_tool_recovery",
      },
      users: [
        { id: "usr_eval_live_tool_recovery", email: "tool.recovery@example.com", name: "Tool Recovery User" },
      ],
      conversations: [
        buildAuthConversation({
          id: "conv_eval_live_tool_recovery",
          userId: "usr_eval_live_tool_recovery",
          title: "Live MCP tool choice and recovery",
          lane: "uncertain",
          confidence: 0.71,
          recommendedNextStep: "Use the appropriate tool and recover coherently if it fails.",
          detectedNeedSummary: "Tool-heavy task with possible failure handling.",
          messages: [
            {
              id: "msg_eval_live_tool_recovery_1",
              role: "user",
              content: "Please add 4 and 5, and recover cleanly if the calculator fails once.",
              createdAt: "2026-03-20T17:01:00.000Z",
            },
          ],
        }),
      ],
      conversationEvents: [],
      leads: [],
      consultationRequests: [],
      deals: [],
      trainingPaths: [],
      toolFixtures: [
        {
          id: "tool_fixture_live_tool_recovery_1",
          toolId: "calculator",
          args: {
            operation: "add",
            a: 4,
            b: 5,
          },
          expectedResult: 9,
        },
      ],
    },
    promptMessages: [
      { role: "user", content: "Use the calculator tool with 4 and 5, retry once if it fails, and then give me the final total clearly." },
    ],
  },
  "mcp-multi-tool-synthesis": {
    scenarioId: "mcp-multi-tool-synthesis",
    role: "AUTHENTICATED",
    userId: "usr_eval_live_multi_tool",
    seedPack: {
      scenarioId: "mcp-multi-tool-synthesis",
      seedSetId: "seed-live-multi-tool-v1",
      refs: {
        primaryConversationId: "conv_eval_live_multi_tool",
        authenticatedUserId: "usr_eval_live_multi_tool",
      },
      users: [
        { id: "usr_eval_live_multi_tool", email: "multi.tool@example.com", name: "Multi Tool User" },
      ],
      conversations: [
        buildAuthConversation({
          id: "conv_eval_live_multi_tool",
          userId: "usr_eval_live_multi_tool",
          title: "Live MCP multi-tool synthesis",
          lane: "uncertain",
          confidence: 0.73,
          recommendedNextStep: "Combine multiple tools into one coherent answer.",
          detectedNeedSummary: "Task requires more than one tool result.",
          messages: [
            {
              id: "msg_eval_live_multi_tool_1",
              role: "user",
              content: "Use multiple tools if needed and combine the results into one answer.",
              createdAt: "2026-03-20T18:01:00.000Z",
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
    },
    promptMessages: [
      { role: "user", content: "Combine the relevant tool outputs and give me one final answer." },
    ],
  },
};

export function resolveLiveEvalScenarioFixture(scenarioId: string): LiveEvalScenarioFixture {
  const fixture = LIVE_SCENARIO_FIXTURES[scenarioId];

  if (!fixture) {
    throw new Error(`No live eval fixture is defined for scenario: ${scenarioId}`);
  }

  return fixture;
}
