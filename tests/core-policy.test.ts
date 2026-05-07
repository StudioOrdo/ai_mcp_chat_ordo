import { describe, expect, it } from "vitest";
import { ChatPolicyInteractor } from "@/core/use-cases/ChatPolicyInteractor";
import { ROLE_DIRECTIVES } from "@/core/entities/role-directives";
import { DefaultingSystemPromptRepository } from "@/core/use-cases/DefaultingSystemPromptRepository";
import { getToolComposition } from "@/lib/chat/tool-composition-root";
import { createAdminWebSearchTool } from "@/core/use-cases/tools/admin-web-search.tool";
import { createAdminPrioritizeLeadsTool } from "@/core/use-cases/tools/admin-prioritize-leads.tool";
import { createAdminPrioritizeOfferTool } from "@/core/use-cases/tools/admin-prioritize-offer.tool";
import { createAdminTriageRoutingRiskTool } from "@/core/use-cases/tools/admin-triage-routing-risk.tool";
import { EXPECTED_ROLE_TOOL_SETS } from "./helpers/role-tool-sets";
import type {
  OperatorAnonymousOpportunitiesData,
  OperatorFunnelRecommendationsData,
  OperatorLeadQueueData,
  OperatorRoutingReviewData,
  OperatorSignalPayload,
} from "@/lib/operator/operator-signal-loaders";
import type { SystemPromptRepository } from "@/core/use-cases/SystemPromptRepository";

// Minimal in-memory stub that always returns null (forces fallback)
const nullRepo: SystemPromptRepository = {
  getActive: async () => null,
  listVersions: async () => [],
  getByVersion: async () => null,
  createVersion: async () => { throw new Error("not implemented"); },
  activate: async () => {},
};

describe("ChatPolicyInteractor", () => {
  const basePrompt = "You are an advisor.";
  const directives: Record<string, string> = {
    ANONYMOUS: "\nDEMO MODE",
    AUTHENTICATED: "\nregistered member",
    STAFF: "\nstaff member",
    ADMIN: "\nSYSTEM ADMINISTRATOR",
  };
  const repo = new DefaultingSystemPromptRepository(nullRepo, basePrompt, directives);
  const interactor = new ChatPolicyInteractor(repo);

  it("ANONYMOUS prompt includes DEMO mode framing", async () => {
    const prompt = await interactor.execute({ role: "ANONYMOUS" });
    expect(prompt).toContain(basePrompt);
    expect(prompt).toContain("DEMO MODE");
  });

  it("ADMIN prompt includes system administrator framing", async () => {
    const prompt = await interactor.execute({ role: "ADMIN" });
    expect(prompt).toContain(basePrompt);
    expect(prompt).toContain("SYSTEM ADMINISTRATOR");
  });

  it("real admin fallback directive includes operator tool guidance", () => {
    expect(ROLE_DIRECTIVES.ADMIN).toContain("admin_prioritize_leads");
    expect(ROLE_DIRECTIVES.ADMIN).toContain("admin_prioritize_offer");
    expect(ROLE_DIRECTIVES.ADMIN).toContain("admin_triage_routing_risk");
    expect(ROLE_DIRECTIVES.ADMIN).toContain("get_journal_workflow_summary");
    expect(ROLE_DIRECTIVES.ADMIN).toContain("prepare_journal_post_for_publish");
    expect(ROLE_DIRECTIVES.ADMIN).toContain("publish_journal_post");
    expect(ROLE_DIRECTIVES.ADMIN).toContain("exactly three headings: NOW, NEXT, WAIT");
    expect(ROLE_DIRECTIVES.ADMIN).toContain("always summarize the current job state in plain language");
    expect(ROLE_DIRECTIVES.ADMIN).toContain("Do not rely on job cards alone for status reads");
  });

  it("member directives include prose-first job status guidance", () => {
    expect(ROLE_DIRECTIVES.AUTHENTICATED).toContain("answer in plain language by default");
    expect(ROLE_DIRECTIVES.AUTHENTICATED).toContain("Only render a concise list when the user explicitly asks");
    expect(ROLE_DIRECTIVES.STAFF).toContain("Do not start or repeat work when the user asked only for status");
    expect(ROLE_DIRECTIVES.APPRENTICE).toContain("review the full production view at /studio");
    expect(ROLE_DIRECTIVES.ANONYMOUS).toContain("Do not send them to /jobs");
  });

  it("AUTHENTICATED prompt includes registered member framing", async () => {
    const prompt = await interactor.execute({ role: "AUTHENTICATED" });
    expect(prompt).toContain("registered member");
  });

  it("STAFF prompt includes staff framing", async () => {
    const prompt = await interactor.execute({ role: "STAFF" });
    expect(prompt).toContain("staff member");
  });
});

describe("ToolRegistry RBAC", () => {
  const registry = getToolComposition().registry;
  const createLeadQueuePayload = (): OperatorSignalPayload<OperatorLeadQueueData> => ({
    blockId: "lead_queue",
    state: "empty",
    data: {
      summary: {
        submittedLeadCount: 0,
        newLeadCount: 0,
        contactedLeadCount: 0,
        qualifiedLeadCount: 0,
        deferredLeadCount: 0,
      },
      leads: [],
      emptyReason: null,
    },
  });
  const createFunnelPayload = (): OperatorSignalPayload<OperatorFunnelRecommendationsData> => ({
    blockId: "funnel_recommendations",
    state: "empty",
    data: {
      summary: {
        recommendationCount: 0,
        anonymousDropOffCount: 0,
        uncertainConversationCount: 0,
        newLeadCount: 0,
      },
      recommendations: [],
      emptyReason: null,
    },
  });
  const createAnonymousPayload = (): OperatorSignalPayload<OperatorAnonymousOpportunitiesData> => ({
    blockId: "anonymous_opportunities",
    state: "empty",
    data: {
      summary: {
        opportunityCount: 0,
        organizationCount: 0,
        individualCount: 0,
        developmentCount: 0,
      },
      opportunities: [],
      emptyReason: null,
    },
  });
  const createRoutingPayload = (): OperatorSignalPayload<OperatorRoutingReviewData> => ({
    blockId: "routing_review",
    state: "empty",
    data: {
      summary: {
        recentlyChangedCount: 0,
        uncertainCount: 0,
        followUpReadyCount: 0,
      },
      recentlyChanged: [],
      uncertainConversations: [],
      followUpReady: [],
    },
  });

  it("ANONYMOUS gets exactly the allowed tool set", () => {
    const names = registry.getSchemasForRole("ANONYMOUS").map((s) => s.name).sort();
    expect(names).toEqual(EXPECTED_ROLE_TOOL_SETS.ANONYMOUS);
  });

  it("ANONYMOUS keeps the public self-serve tool subset while member tools stay restricted", () => {
    expect(registry.canExecute("get_section", "ANONYMOUS")).toBe(true);
    expect(registry.canExecute("get_checklist", "ANONYMOUS")).toBe(true);
    expect(registry.canExecute("generate_audio", "ANONYMOUS")).toBe(false);
    expect(registry.canExecute("generate_chart", "ANONYMOUS")).toBe(true);
    expect(registry.canExecute("generate_graph", "ANONYMOUS")).toBe(true);
    expect(registry.canExecute("list_practitioners", "ANONYMOUS")).toBe(true);
    expect(registry.canExecute("compose_media", "ANONYMOUS")).toBe(false);
    expect(registry.canExecute("search_my_conversations", "ANONYMOUS")).toBe(false);
    expect(registry.canExecute("set_preference", "ANONYMOUS")).toBe(false);
    expect(registry.canExecute("update_my_profile", "ANONYMOUS")).toBe(false);
  });

  it("AUTHENTICATED gets exactly the allowed tool set", () => {
    const names = registry.getSchemasForRole("AUTHENTICATED").map((s) => s.name).sort();
    expect(names).toEqual(EXPECTED_ROLE_TOOL_SETS.AUTHENTICATED);
  });

  it("APPRENTICE gets exactly the allowed tool set", () => {
    const names = registry.getSchemasForRole("APPRENTICE").map((s) => s.name).sort();
    expect(names).toEqual(EXPECTED_ROLE_TOOL_SETS.APPRENTICE);
  });

  it("STAFF gets exactly the allowed tool set", () => {
    const names = registry.getSchemasForRole("STAFF").map((s) => s.name).sort();
    expect(names).toEqual(EXPECTED_ROLE_TOOL_SETS.STAFF);
  });

  it("ADMIN gets exactly the allowed tool set", () => {
    const names = registry.getSchemasForRole("ADMIN").map((s) => s.name).sort();
    expect(names).toEqual(EXPECTED_ROLE_TOOL_SETS.ADMIN);
  });

  it("ADMIN gets admin_web_search descriptor with correct RBAC", () => {
    const descriptor = createAdminWebSearchTool();
    expect(descriptor.name).toBe("admin_web_search");
    expect(descriptor.roles).toEqual(["ADMIN"]);
    expect(descriptor.category).toBe("content");
    expect(descriptor.schema.input_schema.required).toEqual(["query"]);
  });

  it("ADMIN gets admin_prioritize_leads descriptor with correct RBAC", () => {
    const mockLoader: Parameters<typeof createAdminPrioritizeLeadsTool>[0] = async () => createLeadQueuePayload();
    const descriptor = createAdminPrioritizeLeadsTool(mockLoader);
    expect(descriptor.name).toBe("admin_prioritize_leads");
    expect(descriptor.roles).toEqual(["ADMIN"]);
    expect(descriptor.category).toBe("system");
  });

  it("ADMIN gets admin_prioritize_offer descriptor with correct RBAC", () => {
    const funnelLoader: Parameters<typeof createAdminPrioritizeOfferTool>[0] = async () => createFunnelPayload();
    const anonymousLoader: Parameters<typeof createAdminPrioritizeOfferTool>[1] = async () => createAnonymousPayload();
    const leadLoader: Parameters<typeof createAdminPrioritizeOfferTool>[2] = async () => createLeadQueuePayload();
    const descriptor = createAdminPrioritizeOfferTool(
      funnelLoader,
      anonymousLoader,
      leadLoader,
    );
    expect(descriptor.name).toBe("admin_prioritize_offer");
    expect(descriptor.roles).toEqual(["ADMIN"]);
    expect(descriptor.category).toBe("system");
  });

  it("ADMIN gets admin_triage_routing_risk descriptor with correct RBAC", () => {
    const mockLoader: Parameters<typeof createAdminTriageRoutingRiskTool>[0] = async () => createRoutingPayload();
    const descriptor = createAdminTriageRoutingRiskTool(mockLoader);
    expect(descriptor.name).toBe("admin_triage_routing_risk");
    expect(descriptor.roles).toEqual(["ADMIN"]);
    expect(descriptor.category).toBe("system");
  });
});
