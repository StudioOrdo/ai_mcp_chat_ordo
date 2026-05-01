import { describe, expect, it } from "vitest";

import { createDefaultToolRegistry } from "./default-tool-registry";
import { RelationshipMemoryCard } from "../plugins/custom/RelationshipMemoryCard";
import { TranscriptRecallCard } from "../plugins/custom/TranscriptRecallCard";
import { WebSearchCard } from "../plugins/custom/WebSearchCard";
import { InspectThemeCard } from "../plugins/custom/InspectThemeCard";
import { EditorialWorkflowCard } from "../plugins/custom/EditorialWorkflowCard";
import { JournalWorkflowCard } from "../plugins/custom/JournalWorkflowCard";
import { ReferralQrCard } from "../plugins/custom/ReferralQrCard";
import { ChartRendererCard } from "../plugins/custom/ChartRendererCard";
import { JobStatusFallbackCard } from "../plugins/system/JobStatusFallbackCard";

describe("createDefaultToolRegistry", () => {
  const registry = createDefaultToolRegistry();

  it("routes shared renderers by card kind when no tool-specific override is needed", () => {
    expect(registry.getRenderer("search_corpus")).toBe(WebSearchCard);
    expect(registry.getRenderer("set_theme")).toBe(InspectThemeCard);
    expect(registry.getRenderer("draft_content")).toBe(EditorialWorkflowCard);
    expect(registry.getRenderer("prepare_journal_post_for_publish")).toBe(JournalWorkflowCard);
  });

  it("keeps tool-specific overrides for exceptional shared card kinds", () => {
    expect(registry.getRenderer("search_my_conversations")).toBe(TranscriptRecallCard);
    expect(registry.getRenderer("search_relationship_memory")).toBe(RelationshipMemoryCard);
    expect(registry.getRenderer("get_my_referral_qr")).toBe(ReferralQrCard);
    expect(registry.getRenderer("generate_chart")).toBe(ChartRendererCard);
  });

  it("falls back when no descriptor exists", () => {
    expect(registry.getRenderer("missing_tool_name")).toBe(JobStatusFallbackCard);
  });
});