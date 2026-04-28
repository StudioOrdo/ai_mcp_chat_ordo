import { describe, expect, it } from "vitest";

import { JobStatusFallbackCard } from "@/frameworks/ui/chat/plugins/system/JobStatusFallbackCard";
import { getCapabilityPresentationDescriptor } from "@/frameworks/ui/chat/registry/capability-presentation-registry";
import { createDefaultToolRegistry } from "@/frameworks/ui/chat/registry/default-tool-registry";

describe("Default tool registry coverage", () => {
  const registry = createDefaultToolRegistry();

  for (const tool of [
    "generate_chart",
    "generate_graph",
    "generate_audio",
    "admin_web_search",
    "search_corpus",
    "search_my_conversations",
    "get_section",
    "get_corpus_summary",
    "list_practitioners",
    "inspect_theme",
    "set_theme",
    "adjust_ui",
    "get_my_profile",
    "update_my_profile",
    "get_my_referral_qr",
    "set_preference",
    "get_my_affiliate_summary",
    "list_my_referral_activity",
    "draft_content",
    "publish_content",
    "compose_blog_article",
    "qa_blog_article",
    "resolve_blog_article_qa",
    "generate_blog_image_prompt",
    "generate_blog_image",
    "produce_blog_article",
    "get_journal_workflow_summary",
    "list_journal_posts",
    "get_journal_post",
    "list_journal_revisions",
    "update_journal_metadata",
    "update_journal_draft",
    "submit_journal_review",
    "approve_journal_post",
    "publish_journal_post",
    "restore_journal_revision",
    "select_journal_hero_image",
    "prepare_journal_post_for_publish",
  ]) {
    it(`registers a custom renderer for ${tool}`, () => {
      expect(getCapabilityPresentationDescriptor(tool)).toBeDefined();
      expect(registry.getRenderer(tool)).not.toBe(JobStatusFallbackCard);
    });
  }

  for (const tool of [
    "get_checklist",
    "list_available_pages",
    "get_current_page",
    "navigate_to_page",
    "calculator",
    "inspect_runtime_context",
  ]) {
    it(`keeps ${tool} in the conversation manifest even while it falls back`, () => {
      expect(getCapabilityPresentationDescriptor(tool)).toBeDefined();
      expect(registry.getRenderer(tool)).toBe(JobStatusFallbackCard);
    });
  }

  for (const tool of [
    "get_deferred_job_status",
    "list_deferred_jobs",
    "get_my_job_status",
    "list_my_jobs",
    "admin_prioritize_leads",
    "admin_prioritize_offer",
    "admin_triage_routing_risk",
    "get_admin_affiliate_summary",
    "list_admin_referral_exceptions",
  ]) {
    it(`keeps ${tool} on the fallback renderer path`, () => {
      expect(getCapabilityPresentationDescriptor(tool)).toBeDefined();
      expect(registry.getRenderer(tool)).toBe(JobStatusFallbackCard);
    });
  }

  it("maps admin_search to the search result renderer", () => {
    expect(getCapabilityPresentationDescriptor("admin_search")).toBeDefined();
    expect(registry.getRenderer("admin_search")).not.toBe(JobStatusFallbackCard);
  });

  it("falls back cleanly for unknown tools", () => {
    expect(getCapabilityPresentationDescriptor("nonexistent_tool")).toBeUndefined();
    expect(registry.getRenderer("nonexistent_tool")).toBe(JobStatusFallbackCard);
  });
});
