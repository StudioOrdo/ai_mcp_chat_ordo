import { describe, it, expect, vi } from "vitest";
import { ChatPresenter } from "./ChatPresenter";
import type { ChatMessage } from "../core/entities/chat-message";
import type { MarkdownParserService } from "./MarkdownParserService";
import type { CommandParserService } from "./CommandParserService";

describe("ChatPresenter", () => {
  const mockMarkdownParser = {
    parse: vi.fn().mockReturnValue({ blocks: [] }),
  } as unknown as MarkdownParserService;

  const mockCommandParser = {
    parse: vi.fn().mockReturnValue([]),
  } as unknown as CommandParserService;

  it("should transform a ChatMessage into a PresentedMessage", () => {
    const presenter = new ChatPresenter(mockMarkdownParser, mockCommandParser);
    const message: ChatMessage = {
      id: "msg-1",
      role: "assistant",
      content: "Hello __ui_command__:set_theme:bauhaus",
      timestamp: new Date("2023-01-01T12:00:00Z"),
    };

    const presented = presenter.present(message);

    expect(presented.id).toBe("msg-1");
    expect(presented.role).toBe("assistant");
    expect(mockMarkdownParser.parse).toHaveBeenCalledWith(message.content);
    expect(mockCommandParser.parse).toHaveBeenCalledWith(message.content);
    expect(presented.timestamp).toBeDefined();
  });

  it("should extract actions from __actions__ tag", () => {
    const presenter = new ChatPresenter(mockMarkdownParser, mockCommandParser);
    const message: ChatMessage = {
      id: "msg-2",
      role: "assistant",
      content: 'Here is help __actions__:[{"label":"View","action":"route","params":{"path":"/help"}}]',
      timestamp: new Date("2023-01-01T12:00:00Z"),
    };

    const presented = presenter.present(message);
    expect(presented.actions).toHaveLength(1);
    expect(presented.actions[0]).toMatchObject({
      label: "View",
      action: "route",
      params: { path: "/help" },
    });
  });

  it("should remove __actions__ tag from text passed to markdown parser", () => {
    const freshParser = {
      parse: vi.fn().mockReturnValue({ blocks: [] }),
    } as unknown as MarkdownParserService;
    const presenter = new ChatPresenter(freshParser, mockCommandParser);
    const message: ChatMessage = {
      id: "msg-3",
      role: "assistant",
      content: 'Hello __actions__:[{"label":"Go","action":"send","params":{"text":"hi"}}]',
      timestamp: new Date("2023-01-01T12:00:00Z"),
    };

    presenter.present(message);
    expect(freshParser.parse).toHaveBeenCalledWith("Hello");
  });

  it("should handle both __actions__ and __suggestions__ tags", () => {
    const presenter = new ChatPresenter(mockMarkdownParser, mockCommandParser);
    const message: ChatMessage = {
      id: "msg-4",
      role: "assistant",
      content:
        'Content __actions__:[{"label":"Go","action":"corpus","params":{"slug":"lean"}}] __response_state__:"open" __suggestions__:["tip1","tip2"]',
      timestamp: new Date("2023-01-01T12:00:00Z"),
    };

    const presented = presenter.present(message);
    expect(presented.suggestions).toEqual(["tip1", "tip2"]);
    expect(presented.responseState).toBe("open");
    expect(presented.actions).toHaveLength(1);
    expect(presented.actions[0].action).toBe("corpus");
  });

  it("repairs malformed action params without synthesizing fallback suggestions", () => {
    const presenter = new ChatPresenter(mockMarkdownParser, mockCommandParser);
    const message: ChatMessage = {
      id: "msg-4b",
      role: "assistant",
      content:
        'Content __suggestions__:[] __actions__:[{"label":"Open library","action":"route","params":{"href":"/library"}},{"label":"Draft reply","type":"send","params":{"prompt":"Draft the reply"}}]',
      timestamp: new Date("2023-01-01T12:00:00Z"),
    };

    const presented = presenter.present(message);
    expect(presented.responseState).toBe("closed");
    expect(presented.suggestions).toEqual([]);
    expect(presented.actions).toEqual([
      { label: "Open library", action: "route", params: { path: "/library" } },
      { label: "Draft reply", action: "send", params: { text: "Draft the reply" } },
    ]);
  });

  it("suppresses suggestions when the response is explicitly closed", () => {
    const presenter = new ChatPresenter(mockMarkdownParser, mockCommandParser);
    const message: ChatMessage = {
      id: "msg-4c",
      role: "assistant",
      content: 'That resolves it. __response_state__:"closed" __suggestions__:["Ask another thing"]',
      timestamp: new Date("2023-01-01T12:00:00Z"),
    };

    const presented = presenter.present(message);

    expect(presented.responseState).toBe("closed");
    expect(presented.suggestions).toEqual([]);
  });

  it("keeps only high-value suggestions instead of padding to a quota", () => {
    const presenter = new ChatPresenter(mockMarkdownParser, mockCommandParser);
    const message: ChatMessage = {
      id: "msg-4c2",
      role: "assistant",
      content: 'Here is the plan. __response_state__:"open" __suggestions__:["Anything else?","Draft the rollout plan","draft the rollout plan","Review the API dependencies","Need more help?"]',
      timestamp: new Date("2023-01-01T12:00:00Z"),
    };

    const presented = presenter.present(message);

    expect(presented.responseState).toBe("open");
    expect(presented.suggestions).toEqual([
      "Draft the rollout plan",
      "Review the API dependencies",
    ]);
  });

  it("derives needs_input when the assistant is blocked by one precise question", () => {
    const presenter = new ChatPresenter(mockMarkdownParser, mockCommandParser);
    const message: ChatMessage = {
      id: "msg-4d",
      role: "assistant",
      content: "Before I scope this, which workflow do you want audited?",
      timestamp: new Date("2023-01-01T12:00:00Z"),
    };

    const presented = presenter.present(message);

    expect(presented.responseState).toBe("needs_input");
    expect(presented.suggestions).toEqual([]);
  });

  it("derives needs_input after stripping trailing actions", () => {
    const presenter = new ChatPresenter(mockMarkdownParser, mockCommandParser);
    const message: ChatMessage = {
      id: "msg-4e",
      role: "assistant",
      content:
        'Which workflow do you want audited? __actions__:[{"label":"Open library","action":"route","params":{"path":"/library"}}]',
      timestamp: new Date("2023-01-01T12:00:00Z"),
    };

    const presented = presenter.present(message);

    expect(presented.responseState).toBe("needs_input");
    expect(presented.rawContent).toBe("Which workflow do you want audited?");
    expect(presented.actions).toEqual([
      { label: "Open library", action: "route", params: { path: "/library" } },
    ]);
  });

  it("preserves literal response-state syntax in body text while stripping the trailing control tag", () => {
    const freshParser = {
      parse: vi.fn().mockReturnValue({ blocks: [] }),
    } as unknown as MarkdownParserService;
    const presenter = new ChatPresenter(freshParser, mockCommandParser);
    const message: ChatMessage = {
      id: "msg-4f",
      role: "assistant",
      content:
        'Example syntax: __response_state__:"closed" should be emitted on the final line.\n\nActual answer here.\n\n__response_state__:"closed"',
      timestamp: new Date("2023-01-01T12:00:00Z"),
    };

    const presented = presenter.present(message);

    expect(presented.responseState).toBe("closed");
    expect(presented.rawContent).toBe(
      'Example syntax: __response_state__:"closed" should be emitted on the final line.\n\nActual answer here.',
    );
    expect(freshParser.parse).toHaveBeenCalledWith(
      'Example syntax: __response_state__:"closed" should be emitted on the final line.\n\nActual answer here.',
    );
  });

  it("should produce empty actions array for malformed JSON", () => {
    const markdownParser = {
      parse: vi.fn().mockReturnValue({ blocks: [] }),
    } as unknown as MarkdownParserService;
    const presenter = new ChatPresenter(markdownParser, mockCommandParser);
    const message: ChatMessage = {
      id: "msg-5",
      role: "assistant",
      content: "Text __actions__:[not valid json]",
      timestamp: new Date("2023-01-01T12:00:00Z"),
    };

    const presented = presenter.present(message);
    expect(presented.actions).toEqual([]);
    expect(markdownParser.parse).toHaveBeenCalledWith("Text");
  });

  it("should filter out unknown action types", () => {
    const presenter = new ChatPresenter(mockMarkdownParser, mockCommandParser);
    const message: ChatMessage = {
      id: "msg-6",
      role: "assistant",
      content:
        'Text __actions__:[{"label":"Ok","action":"route","params":{}},{"label":"Bad","action":"unknown","params":{}}]',
      timestamp: new Date("2023-01-01T12:00:00Z"),
    };

    const presented = presenter.present(message);
    expect(presented.actions).toHaveLength(1);
    expect(presented.actions[0].label).toBe("Ok");
  });

  it("should produce empty actions when no __actions__ tag present", () => {
    const presenter = new ChatPresenter(mockMarkdownParser, mockCommandParser);
    const message: ChatMessage = {
      id: "msg-7",
      role: "assistant",
      content: "Just a regular message",
      timestamp: new Date("2023-01-01T12:00:00Z"),
    };

    const presented = presenter.present(message);
    expect(presented.actions).toEqual([]);
  });

  it("pairs repeated same-name tool calls and results by invocation id", () => {
    const presenter = new ChatPresenter(mockMarkdownParser, mockCommandParser);
    const message: ChatMessage = {
      id: "msg-tools-1",
      role: "assistant",
      content: "Two audio generations.",
      timestamp: new Date("2023-01-01T12:00:00Z"),
      parts: [
        { type: "tool_call", name: "generate_audio", args: { text: "first" }, toolInvocationId: "toolu_audio_1" },
        { type: "tool_call", name: "generate_audio", args: { text: "second" }, toolInvocationId: "toolu_audio_2" },
        { type: "tool_result", name: "generate_audio", result: { assetId: "uf_audio_2" }, toolInvocationId: "toolu_audio_2" },
        { type: "tool_result", name: "generate_audio", result: { assetId: "uf_audio_1" }, toolInvocationId: "toolu_audio_1" },
      ],
    };

    const presented = presenter.present(message);

    expect(presented.toolRenderEntries).toEqual([
      expect.objectContaining({
        kind: "tool-call",
        args: { text: "first" },
        result: { assetId: "uf_audio_1" },
        toolInvocationId: "toolu_audio_1",
      }),
      expect.objectContaining({
        kind: "tool-call",
        args: { text: "second" },
        result: { assetId: "uf_audio_2" },
        toolInvocationId: "toolu_audio_2",
      }),
    ]);
  });

  it("derives publish and revise actions for completed draft jobs", () => {
    const presenter = new ChatPresenter(mockMarkdownParser, mockCommandParser);
    const message: ChatMessage = {
      id: "msg-job-1",
      role: "assistant",
      content: "Your draft is ready.",
      timestamp: new Date("2023-01-01T12:00:00Z"),
      parts: [
        {
          type: "job_status",
          jobId: "job_1",
          toolName: "draft_content",
          label: "Draft Content",
          status: "succeeded",
          summary: 'Draft journal article "Launch Plan" ready at /admin/journal/preview/launch-plan.',
          resultPayload: {
            id: "post_1",
            slug: "launch-plan",
            title: "Launch Plan",
            status: "draft",
          },
        },
      ],
    };

    const presented = presenter.present(message);
    expect(presented.toolRenderEntries).toContainEqual(
      expect.objectContaining({
        kind: "job-status",
        descriptor: expect.objectContaining({ toolName: "draft_content" }),
        resultEnvelope: expect.objectContaining({ toolName: "draft_content" }),
        computedActions: [
          expect.objectContaining({ label: "Revise", actionType: "send" }),
          expect.objectContaining({ label: "Publish", actionType: "send" }),
        ],
      }),
    );
  });

  it("derives retry action for failed jobs", () => {
    const presenter = new ChatPresenter(mockMarkdownParser, mockCommandParser);
    const message: ChatMessage = {
      id: "msg-job-2",
      role: "assistant",
      content: "Draft failed.",
      timestamp: new Date("2023-01-01T12:00:00Z"),
      parts: [
        {
          type: "job_status",
          jobId: "job_2",
          toolName: "draft_content",
          label: "Draft Content",
          status: "failed",
          error: "Provider offline",
        },
      ],
    };

    const presented = presenter.present(message);
    expect(presented.toolRenderEntries).toContainEqual(
      expect.objectContaining({
        kind: "job-status",
        descriptor: expect.objectContaining({ toolName: "draft_content" }),
        resultEnvelope: expect.objectContaining({ toolName: "draft_content" }),
        computedActions: [expect.objectContaining({ label: "Retry", actionType: "job", value: "job_2" })],
      }),
    );
  });

  it("does not expose retry actions when the descriptor disables whole-job retry", () => {
    const presenter = new ChatPresenter(mockMarkdownParser, mockCommandParser);
    const message: ChatMessage = {
      id: "msg-job-3",
      role: "assistant",
      content: "Theme sync failed.",
      timestamp: new Date("2023-01-01T12:00:00Z"),
      parts: [
        {
          type: "job_status",
          jobId: "job_3",
          toolName: "set_theme",
          label: "Set Theme",
          status: "failed",
          error: "Theme registry unavailable",
        },
      ],
    };

    const presented = presenter.present(message);
    expect(presented.toolRenderEntries).toContainEqual(
      expect.objectContaining({
        kind: "job-status",
        descriptor: expect.objectContaining({ toolName: "set_theme" }),
        computedActions: undefined,
      }),
    );
  });

  it("does not expose retry actions for synthetic browser runtime jobs", () => {
    const presenter = new ChatPresenter(mockMarkdownParser, mockCommandParser);
    const message: ChatMessage = {
      id: "msg-browser-job-1",
      role: "assistant",
      content: "Browser compose failed.",
      timestamp: new Date("2023-01-01T12:00:00Z"),
      parts: [
        {
          type: "job_status",
          jobId: "browser:msg_1:compose_media:18",
          toolName: "compose_media",
          label: "Compose Media",
          status: "failed",
          error: "Browser compose failed.",
        },
      ],
    };

    const presented = presenter.present(message);
    expect(presented.toolRenderEntries).toContainEqual(
      expect.objectContaining({
        kind: "job-status",
        descriptor: expect.objectContaining({ toolName: "compose_media" }),
        computedActions: undefined,
      }),
    );
  });

  it("derives image and linked-post actions for completed image-generation jobs", () => {
    const presenter = new ChatPresenter(mockMarkdownParser, mockCommandParser);
    const message: ChatMessage = {
      id: "msg-job-image-1",
      role: "assistant",
      content: "Hero image is ready.",
      timestamp: new Date("2023-01-01T12:00:00Z"),
      parts: [
        {
          type: "job_status",
          jobId: "job_image_1",
          toolName: "generate_blog_image",
          label: "Generate Blog Image",
          status: "succeeded",
          summary: 'Generated hero image for "Launch Plan" and linked it at /journal/launch-plan.',
          resultPayload: {
            assetId: "asset_1",
            imageUrl: "/api/blog/assets/asset_1",
            postSlug: "launch-plan",
          },
        },
      ],
    };

    const presented = presenter.present(message);
    expect(presented.toolRenderEntries).toContainEqual(
      expect.objectContaining({
        kind: "job-status",
        descriptor: expect.objectContaining({ toolName: "generate_blog_image" }),
        resultEnvelope: expect.objectContaining({ toolName: "generate_blog_image" }),
        computedActions: [
          expect.objectContaining({ label: "Open article", actionType: "route", value: "/journal/launch-plan" }),
          expect.objectContaining({ label: "Open image", actionType: "route", value: "/api/blog/assets/asset_1" }),
        ],
      }),
    );
  });

  it("projects descriptors and result envelopes for inline tool-call entries", () => {
    const presenter = new ChatPresenter(mockMarkdownParser, mockCommandParser);
    const message: ChatMessage = {
      id: "msg-tool-1",
      role: "assistant",
      content: "Here are the search results.",
      timestamp: new Date("2023-01-01T12:00:00Z"),
      parts: [
        {
          type: "tool_call",
          name: "admin_web_search",
          args: { query: "ordo site architecture" },
        },
        {
          type: "tool_result",
          name: "admin_web_search",
          result: {
            action: "admin_web_search",
            query: "ordo site architecture",
            answer: "A sourced answer.",
            citations: [],
            sources: ["https://example.com/architecture"],
            model: "gpt-5",
          },
        },
      ],
    };

    const presented = presenter.present(message);
    expect(presented.toolRenderEntries).toContainEqual(
      expect.objectContaining({
        kind: "tool-call",
        name: "admin_web_search",
        descriptor: expect.objectContaining({ toolName: "admin_web_search", family: "search" }),
        resultEnvelope: expect.objectContaining({
          toolName: "admin_web_search",
          family: "search",
          cardKind: "search_result",
          inputSnapshot: { query: "ordo site architecture" },
        }),
      }),
    );
  });

  it("derives draft and hero-image actions for completed article-orchestration jobs", () => {
    const presenter = new ChatPresenter(mockMarkdownParser, mockCommandParser);
    const message: ChatMessage = {
      id: "msg-job-produce-1",
      role: "assistant",
      content: "Article production is complete.",
      timestamp: new Date("2023-01-01T12:00:00Z"),
      parts: [
        {
          type: "job_status",
          jobId: "job_produce_1",
          toolName: "produce_blog_article",
          label: "Produce Blog Article",
          status: "succeeded",
          summary: 'Produced draft "Launch Plan" at /journal/launch-plan with hero asset asset_1.',
          resultPayload: {
            id: "post_1",
            slug: "launch-plan",
            title: "Launch Plan",
            status: "draft",
            imageAssetId: "asset_1",
            stages: [
              "compose_blog_article",
              "qa_blog_article",
              "resolve_blog_article_qa",
              "generate_blog_image_prompt",
              "generate_blog_image",
              "draft_content",
            ],
            summary: 'Produced draft "Launch Plan" at /journal/launch-plan with hero asset asset_1.',
          },
        },
      ],
    };

    const presented = presenter.present(message);
    expect(presented.toolRenderEntries).toContainEqual(
      expect.objectContaining({
        kind: "job-status",
        computedActions: [
          expect.objectContaining({ label: "Open draft", actionType: "route", value: "/admin/journal/preview/launch-plan" }),
          expect.objectContaining({ label: "Publish", actionType: "send" }),
          expect.objectContaining({ label: "Open hero image", actionType: "route", value: "/api/blog/assets/asset_1" }),
        ],
      }),
    );
  });

  it("renders deferred status tool results even when the assistant text is empty", () => {
    const presenter = new ChatPresenter(mockMarkdownParser, mockCommandParser);
    const message: ChatMessage = {
      id: "msg-job-status-tool-1",
      role: "assistant",
      content: "",
      timestamp: new Date("2023-01-01T12:00:00Z"),
      parts: [
        {
          type: "tool_call",
          name: "get_deferred_job_status",
          args: { job_id: "job_1" },
        },
        {
          type: "tool_result",
          name: "get_deferred_job_status",
          result: {
            ok: true,
            job: {
              messageId: "jobmsg_job_1",
              part: {
                type: "job_status",
                jobId: "job_1",
                toolName: "produce_blog_article",
                label: "Produce Blog Article",
                status: "queued",
                sequence: 3,
                updatedAt: "2026-03-25T14:52:00.000Z",
              },
            },
          },
        },
      ],
    };

    const presented = presenter.present(message);

    expect(presented.toolRenderEntries).toContainEqual(
      expect.objectContaining({
        kind: "job-status",
        part: expect.objectContaining({
          jobId: "job_1",
          status: "queued",
        }),
        computedActions: [expect.objectContaining({ label: "Cancel", actionType: "job", value: "job_1" })],
      }),
    );
  });

  it("does not produce content blocks for unknown tool results (handled by plugin fallback)", () => {
    const markdownParser = {
      parse: vi.fn().mockReturnValue({ blocks: [] }),
    } as unknown as MarkdownParserService;
    const commandParser = {
      parse: vi.fn().mockReturnValue([]),
    } as unknown as CommandParserService;
    const presenter = new ChatPresenter(markdownParser, commandParser);
    const message: ChatMessage = {
      id: "msg-calculator-result-1",
      role: "assistant",
      content: "",
      timestamp: new Date("2023-01-01T12:00:00Z"),
      parts: [
        {
          type: "tool_call",
          name: "calculator",
          args: { expression: "2+2" },
        },
        {
          type: "tool_result",
          name: "calculator",
          result: 4,
        },
      ],
    };

    const presented = presenter.present(message);

    expect(presented.content.blocks).toEqual([]);
  });

  it("keeps unresolved inline tool calls payload-empty while preserving the input snapshot", () => {
    const markdownParser = {
      parse: vi.fn().mockReturnValue({ blocks: [] }),
    } as unknown as MarkdownParserService;
    const commandParser = {
      parse: vi.fn().mockReturnValue([]),
    } as unknown as CommandParserService;
    const presenter = new ChatPresenter(markdownParser, commandParser);
    const message: ChatMessage = {
      id: "msg-calculator-call-only-1",
      role: "assistant",
      content: "",
      timestamp: new Date("2023-01-01T12:00:00Z"),
      parts: [
        {
          type: "tool_call",
          name: "calculator",
          args: { expression: "8*8" },
        },
      ],
    };

    const presented = presenter.present(message);

    expect(presented.toolRenderEntries).toContainEqual(
      expect.objectContaining({
        kind: "tool-call",
        name: "calculator",
        args: { expression: "8*8" },
        result: undefined,
        resultEnvelope: expect.objectContaining({
          inputSnapshot: { expression: "8*8" },
          payload: null,
        }),
      }),
    );
  });

  it("renders generic object tool results as JSON blocks when the assistant text is empty", () => {
    const markdownParser = {
      parse: vi.fn().mockReturnValue({ blocks: [] }),
    } as unknown as MarkdownParserService;
    const commandParser = {
      parse: vi.fn().mockReturnValue([]),
    } as unknown as CommandParserService;
    const presenter = new ChatPresenter(markdownParser, commandParser);
    const message: ChatMessage = {
      id: "msg-generic-tool-result-1",
      role: "assistant",
      content: "",
      timestamp: new Date("2023-01-01T12:00:00Z"),
      parts: [
        {
          type: "tool_call",
          name: "inspect_runtime_context",
          args: {},
        },
        {
          type: "tool_result",
          name: "inspect_runtime_context",
          result: {
            route: "/library",
            role: "ANONYMOUS",
          },
        },
      ],
    };

    const presented = presenter.present(message);

    expect(presented.content.blocks).toEqual([]);
  });

  it("renders workflow-summary tool results as operator-facing journal blocks", () => {
    const presenter = new ChatPresenter(mockMarkdownParser, mockCommandParser);
    const message: ChatMessage = {
      id: "msg-workflow-summary-1",
      role: "assistant",
      content: "",
      timestamp: new Date("2023-01-01T12:00:00Z"),
      parts: [
        {
          type: "tool_call",
          name: "get_journal_workflow_summary",
          args: {},
        },
        {
          type: "tool_result",
          name: "get_journal_workflow_summary",
          result: {
            action: "get_journal_workflow_summary",
            summary: "1 journal post is approved and ready to publish.",
            counts: {
              draft: 2,
              review: 1,
              approved: 1,
              blocked: 1,
              ready_to_publish: 1,
              active_jobs: 0,
            },
            blocked_posts: [
              {
                title: "Blocked Draft",
                detail_route: "/admin/journal/post_2",
                blockers: ["Standfirst is missing."],
              },
            ],
            ready_to_publish_posts: [
              {
                title: "Launch Plan",
                detail_route: "/admin/journal/post_1",
                preview_route: "/admin/journal/preview/launch-plan",
              },
            ],
          },
        },
      ],
    };

    const presented = presenter.present(message);

    expect(presented.toolRenderEntries).toContainEqual(
      expect.objectContaining({
        kind: "tool-call",
        name: "get_journal_workflow_summary",
        result: expect.objectContaining({ action: "get_journal_workflow_summary" }),
      }),
    );
  });

  it("renders inspect_theme tool results as operator-facing theme summary blocks", () => {
    const presenter = new ChatPresenter(mockMarkdownParser, mockCommandParser);
    const message: ChatMessage = {
      id: "msg-inspect-theme-1",
      role: "assistant",
      content: "",
      timestamp: new Date("2023-01-01T12:00:00Z"),
      parts: [
        {
          type: "tool_call",
          name: "inspect_theme",
          args: {},
        },
        {
          type: "tool_result",
          name: "inspect_theme",
          result: {
            action: "inspect_theme",
            message: "Returned the manifest-backed supported theme profiles and bounded control metadata.",
            supported_theme_ids: ["bauhaus", "swiss"],
            ordered_theme_profiles: [
              {
                id: "bauhaus",
                name: "Bauhaus",
                description: "Functionalism, grid-based, bold primary colors.",
                yearRange: "1919-1933",
                primaryAttributes: ["Geometry", "Primary Colors"],
                motionIntent: "restrained",
                shadowIntent: "editorial",
                densityDefaults: {
                  standard: "normal",
                  dataDense: "compact",
                  touch: "relaxed",
                },
                approvedControlAxes: ["theme", "density"],
              },
            ],
            approved_control_axes: [
              {
                id: "theme",
                label: "Named theme selection",
                options: ["bauhaus", "swiss"],
                defaultValue: "fluid",
                mutationTools: ["set_theme", "adjust_ui"],
              },
            ],
            active_theme_state: {
              available: false,
              reason: "Active theme selection is applied in the client runtime.",
            },
          },
        },
      ],
    };

    const presented = presenter.present(message);

    expect(presented.toolRenderEntries).toContainEqual(
      expect.objectContaining({
        kind: "tool-call",
        name: "inspect_theme",
        result: expect.objectContaining({ action: "inspect_theme" }),
      }),
    );
  });

  it("derives workspace, preview, and publish actions for completed journal readiness jobs", () => {
    const presenter = new ChatPresenter(mockMarkdownParser, mockCommandParser);
    const message: ChatMessage = {
      id: "msg-job-ready-1",
      role: "assistant",
      content: "Publish readiness is complete.",
      timestamp: new Date("2023-01-01T12:00:00Z"),
      parts: [
        {
          type: "job_status",
          jobId: "job_ready_1",
          toolName: "prepare_journal_post_for_publish",
          label: "Prepare Journal Post For Publish",
          title: "Journal publish readiness for post_1",
          subtitle: "Check blockers, active work, and QA before publication",
          status: "succeeded",
          summary: '"Launch Plan" is ready to publish.',
          resultPayload: {
            action: "prepare_journal_post_for_publish",
            ready: true,
            summary: '"Launch Plan" is ready to publish.',
            blockers: [],
            revision_count: 2,
            post: {
              id: "post_1",
              title: "Launch Plan",
              detail_route: "/admin/journal/post_1",
              preview_route: "/admin/journal/preview/launch-plan",
            },
          },
        },
      ],
    };

    const presented = presenter.present(message);
    expect(presented.toolRenderEntries).toContainEqual(
      expect.objectContaining({
        kind: "job-status",
        computedActions: [
          expect.objectContaining({ label: "Open journal workspace", actionType: "route", value: "/admin/journal/post_1" }),
          expect.objectContaining({ label: "Open journal draft", actionType: "route", value: "/admin/journal/preview/launch-plan" }),
          expect.objectContaining({ label: "Publish", actionType: "send" }),
        ],
      }),
    );
  });

  it("maps structured UI tool_call parts into UI commands", () => {
    const presenter = new ChatPresenter(mockMarkdownParser, mockCommandParser);
    const message: ChatMessage = {
      id: "msg-8",
      role: "assistant",
      content: "Applying your preferences.",
      timestamp: new Date("2023-01-01T12:00:00Z"),
      parts: [
        {
          type: "tool_call",
          name: "set_theme",
          args: { theme: "bauhaus" },
        },
        {
          type: "tool_call",
          name: "adjust_ui",
          args: { density: "compact", fontSize: "xl" },
        },
      ],
    };

    const presented = presenter.present(message);

    expect(presented.commands).toEqual([
      { type: "set_theme", theme: "bauhaus" },
      {
        type: "adjust_ui",
        settings: { density: "compact", fontSize: "xl" },
      },
    ]);
  });

  it("preserves completed theme mutations as tool render entries while still emitting UI commands", () => {
    const presenter = new ChatPresenter(mockMarkdownParser, mockCommandParser);
    const message: ChatMessage = {
      id: "msg-8c",
      role: "assistant",
      content: "Applying your preferences.",
      timestamp: new Date("2023-01-01T12:00:00Z"),
      parts: [
        {
          type: "tool_call",
          name: "set_theme",
          args: { theme: "bauhaus" },
        },
        {
          type: "tool_result",
          name: "set_theme",
          result: "Success. The theme has been changed to bauhaus.",
        },
        {
          type: "tool_call",
          name: "adjust_ui",
          args: { density: "compact", fontSize: "large" },
        },
        {
          type: "tool_result",
          name: "adjust_ui",
          result: "Success. UI adjusted: density=compact, fontSize=large.",
        },
      ],
    };

    const presented = presenter.present(message);

    expect(presented.commands).toEqual([
      { type: "set_theme", theme: "bauhaus" },
      {
        type: "adjust_ui",
        settings: { density: "compact", fontSize: "large" },
      },
    ]);
    expect(presented.toolRenderEntries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "tool-call",
          name: "set_theme",
          result: "Success. The theme has been changed to bauhaus.",
        }),
        expect.objectContaining({
          kind: "tool-call",
          name: "adjust_ui",
          result: "Success. UI adjusted: density=compact, fontSize=large.",
        }),
      ]),
    );
  });

  it("maps validated navigate_to_page results into navigate UI commands", () => {
    const presenter = new ChatPresenter(mockMarkdownParser, mockCommandParser);
    const message: ChatMessage = {
      id: "msg-8b",
      role: "assistant",
      content: "Opening the library.",
      timestamp: new Date("2023-01-01T12:00:00Z"),
      parts: [
        {
          type: "tool_call",
          name: "navigate_to_page",
          args: { path: "/library" },
        },
        {
          type: "tool_result",
          name: "navigate_to_page",
          result: {
            path: "/library",
            label: "Library",
            description: "Browse the library and structured reference material.",
            __actions__: [{ type: "navigate", path: "/library" }],
          },
        },
      ],
    };

    const presented = presenter.present(message);

    expect(presented.commands).toEqual([
      { type: "navigate", path: "/library" },
    ]);
  });

  it("renders audio blocks from structured generate_audio result payloads", () => {
    const presenter = new ChatPresenter(mockMarkdownParser, mockCommandParser);
    const message: ChatMessage = {
      id: "msg-audio-1",
      role: "assistant",
      content: "Here is the audio version.",
      timestamp: new Date("2023-01-01T12:00:00Z"),
      parts: [
        {
          type: "tool_call",
          name: "generate_audio",
          args: { title: "Founder memo", text: "Weekly review audio" },
        },
        {
          type: "tool_result",
          name: "generate_audio",
          result: {
            action: "generate_audio",
            title: "Founder memo",
            text: "Weekly review audio",
            assetId: "uf_audio_1",
            provider: "user-file-cache",
            generationStatus: "cached_asset",
            estimatedDurationSeconds: 12,
            estimatedGenerationSeconds: 3,
          },
        },
      ],
    };

    const presented = presenter.present(message);
    expect(presented.toolRenderEntries).toContainEqual(
      expect.objectContaining({
        kind: "tool-call",
        name: "generate_audio",
        args: { title: "Founder memo", text: "Weekly review audio" },
        result: {
          action: "generate_audio",
          title: "Founder memo",
          text: "Weekly review audio",
          assetId: "uf_audio_1",
          provider: "user-file-cache",
          generationStatus: "cached_asset",
          estimatedDurationSeconds: 12,
          estimatedGenerationSeconds: 3,
        },
      }),
    );
  });

  it("replaces stale assistant prose with canonical running audio status text", () => {
    const presenter = new ChatPresenter(mockMarkdownParser, mockCommandParser);
    const message: ChatMessage = {
      id: "msg-audio-running-1",
      role: "assistant",
      content: "Your audio is ready.",
      timestamp: new Date("2023-01-01T12:00:00Z"),
      parts: [
        {
          type: "job_status",
          jobId: "browser:msg-audio-running-1:generate_audio:1",
          toolName: "generate_audio",
          label: "Generate Audio",
          status: "running",
          progressPercent: 25,
          progressLabel: "Generating audio",
          lifecyclePhase: "pending_local_generation",
        },
      ],
    };

    const presented = presenter.present(message);

    expect(presented.rawContent).toBe("Generate Audio job running: Generating audio (25%).");
    expect(mockMarkdownParser.parse).toHaveBeenCalledWith(
      "Generate Audio job running: Generating audio (25%).",
    );
  });

  it("replaces stale assistant prose with canonical failed media status text", () => {
    const presenter = new ChatPresenter(mockMarkdownParser, mockCommandParser);
    const message: ChatMessage = {
      id: "msg-media-failed-1",
      role: "assistant",
      content: "Your video is ready.",
      timestamp: new Date("2023-01-01T12:00:00Z"),
      parts: [
        {
          type: "job_status",
          jobId: "browser:msg-media-failed-1:compose_media:1",
          toolName: "compose_media",
          label: "Compose Media",
          status: "failed",
          error: "Remote FFmpeg failed.",
          lifecyclePhase: "compose_failed_terminal",
          failureStage: "deferred_execution",
        },
      ],
    };

    const presented = presenter.present(message);

    expect(presented.rawContent).toBe("Compose Media job failed: Remote FFmpeg failed.");
    expect(mockMarkdownParser.parse).toHaveBeenCalledWith(
      "Compose Media job failed: Remote FFmpeg failed.",
    );
  });

  it("drops unsupported theme values from structured UI tool calls", () => {
    const presenter = new ChatPresenter(mockMarkdownParser, mockCommandParser);
    const message: ChatMessage = {
      id: "msg-ui-invalid-theme-1",
      role: "assistant",
      content: "",
      timestamp: new Date("2023-01-01T12:00:00Z"),
      parts: [
        {
          type: "tool_call",
          name: "set_theme",
          args: { theme: "postmodern" },
        },
        {
          type: "tool_call",
          name: "adjust_ui",
          args: { theme: "postmodern", density: "compact" },
        },
      ],
    };

    const presented = presenter.present(message);

    expect(presented.commands).toEqual([
      {
        type: "adjust_ui",
        settings: { density: "compact" },
      },
    ]);
  });

  it("preserves generate_chart metadata for mermaid blocks", () => {
    const presenter = new ChatPresenter(mockMarkdownParser, mockCommandParser);
    const message: ChatMessage = {
      id: "msg-9",
      role: "assistant",
      content: "Here is the funnel chart.",
      timestamp: new Date("2023-01-01T12:00:00Z"),
      parts: [
        {
          type: "tool_call",
          name: "generate_chart",
          args: {
            code: "flowchart TD\nA[Anonymous conversations: 53] --> B[Drop-off risk: 23]",
            title: "Anonymous Funnel",
            caption: "Anonymous Funnel",
            downloadFileName: "anonymous_funnel",
          },
        },
      ],
    };

    const presented = presenter.present(message);

    expect(presented.toolRenderEntries).toContainEqual(
      expect.objectContaining({
        kind: "tool-call",
        name: "generate_chart",
        args: {
          code: "flowchart TD\nA[Anonymous conversations: 53] --> B[Drop-off risk: 23]",
          title: "Anonymous Funnel",
          caption: "Anonymous Funnel",
          downloadFileName: "anonymous_funnel",
        },
        result: undefined,
      }),
    );
  });

  it("builds mermaid code from structured generate_chart specs", () => {
    const presenter = new ChatPresenter(mockMarkdownParser, mockCommandParser);
    const message: ChatMessage = {
      id: "msg-10",
      role: "assistant",
      content: "Here is the funnel chart.",
      timestamp: new Date("2023-01-01T12:00:00Z"),
      parts: [
        {
          type: "tool_call",
          name: "generate_chart",
          args: {
            title: "Pipeline Health",
            caption: "Live conversion flow",
            spec: {
              chartType: "flowchart",
              direction: "LR",
              nodes: [
                { id: "conversations", label: "Anonymous conversations: 53" },
                { id: "risk", label: "At-risk drop-off: 23", shape: "diamond" },
                { id: "converted", label: "Converted leads: 1", shape: "round" },
              ],
              edges: [
                { from: "conversations", to: "risk", label: "review now" },
                { from: "risk", to: "converted", label: "recover" },
              ],
            },
          },
        },
      ],
    };

    const presented = presenter.present(message);
    expect(presented.toolRenderEntries).toContainEqual(
      expect.objectContaining({
        kind: "tool-call",
        name: "generate_chart",
      }),
    );
  });

  it("skips invalid generate_chart tool payloads", () => {
    const markdownParser = {
      parse: vi.fn().mockReturnValue({ blocks: [] }),
    } as unknown as MarkdownParserService;
    const presenter = new ChatPresenter(markdownParser, mockCommandParser);
    const message: ChatMessage = {
      id: "msg-11",
      role: "assistant",
      content: "Broken chart attempt.",
      timestamp: new Date("2023-01-01T12:00:00Z"),
      parts: [
        {
          type: "tool_call",
          name: "generate_chart",
          args: {
            spec: { chartType: "flowchart", nodes: [] },
          },
        },
      ],
    };

    const presented = presenter.present(message);
    expect(presented.content.blocks).toEqual([]);
  });

  it("maps generate_graph tool calls into graph blocks", () => {
    const presenter = new ChatPresenter(mockMarkdownParser, mockCommandParser);
    const message: ChatMessage = {
      id: "msg-12",
      role: "assistant",
      content: "Here is the weekly trend.",
      timestamp: new Date("2023-01-01T12:00:00Z"),
      parts: [
        {
          type: "tool_call",
          name: "generate_graph",
          args: {
            title: "Lead trend",
            caption: "Weekly qualified leads",
            summary: "Qualified leads increased week over week.",
            data: {
              rows: [
                { week: "W1", leads: 4 },
                { week: "W2", leads: 7 },
              ],
            },
            spec: {
              graphType: "line",
              xField: "week",
              yField: "leads",
            },
          },
        },
      ],
    };

    const presented = presenter.present(message);
    expect(presented.toolRenderEntries).toContainEqual(
      expect.objectContaining({
        kind: "tool-call",
        name: "generate_graph",
        args: expect.objectContaining({
          title: "Lead trend",
        }),
      }),
    );
  });

  it("prefers resolved generate_graph tool results when present", () => {
    const presenter = new ChatPresenter(mockMarkdownParser, mockCommandParser);
    const message: ChatMessage = {
      id: "msg-12b",
      role: "assistant",
      content: "Here is the routing view.",
      timestamp: new Date("2023-01-01T12:00:00Z"),
      parts: [
        {
          type: "tool_call",
          name: "generate_graph",
          args: {
            data: { source: { sourceType: "routing_review" } },
            spec: { graphType: "bar", xField: "bucket", yField: "count" },
          },
        },
        {
          type: "tool_result",
          name: "generate_graph",
          result: {
            summary: "Uncertain conversations dominate the review queue.",
            source: {
              sourceType: "routing_review",
              label: "Routing review summary",
              rowCount: 2,
            },
            graph: {
              kind: "bar",
              data: [
                { bucket: "Recently changed", count: 2 },
                { bucket: "Uncertain", count: 5 },
              ],
              x: { field: "bucket", type: "ordinal" },
              y: { field: "count", type: "quantitative" },
              columns: ["bucket", "count"],
              source: {
                sourceType: "routing_review",
                label: "Routing review summary",
                rowCount: 2,
              },
            },
            dataPreview: [
              { bucket: "Recently changed", count: 2 },
              { bucket: "Uncertain", count: 5 },
            ],
          },
        },
      ],
    };

    const presented = presenter.present(message);
    expect(presented.toolRenderEntries).toContainEqual(
      expect.objectContaining({
        kind: "tool-call",
        name: "generate_graph",
        result: expect.objectContaining({
          graph: expect.objectContaining({ kind: "bar" }),
        }),
      }),
    );
  });

  it("skips invalid generate_graph payloads", () => {
    const markdownParser = {
      parse: vi.fn().mockReturnValue({ blocks: [] }),
    } as unknown as MarkdownParserService;
    const presenter = new ChatPresenter(markdownParser, mockCommandParser);
    const message: ChatMessage = {
      id: "msg-13",
      role: "assistant",
      content: "Broken graph attempt.",
      timestamp: new Date("2023-01-01T12:00:00Z"),
      parts: [
        {
          type: "tool_call",
          name: "generate_graph",
          args: {
            data: {
              rows: [{ label: "W1", status: "high" }],
            },
            spec: {
              graphType: "bar",
              xField: "label",
              yField: "status",
            },
          },
        },
      ],
    };

    const presented = presenter.present(message);
    expect(presented.content.blocks).toEqual([]);
  });

  it("renders profile tool results as rich content instead of raw JSON", () => {
    const presenter = new ChatPresenter(mockMarkdownParser, mockCommandParser);
    const message: ChatMessage = {
      id: "msg-profile",
      role: "assistant",
      content: "Here are your account details.",
      timestamp: new Date("2023-01-01T12:00:00Z"),
      parts: [
        {
          type: "tool_call",
          name: "get_my_profile",
          args: {},
        },
        {
          type: "tool_result",
          name: "get_my_profile",
          result: {
            action: "get_my_profile",
            message: "Returned the current profile fields and referral settings for this account.",
            profile: {
              name: "Morgan Lee",
              email: "morgan@example.com",
              credential: "Enterprise AI practitioner",
              affiliate_enabled: true,
              referral_code: "mentor-42",
              referral_url: "https://studioordo.com/r/mentor-42",
              qr_code_url: "/api/qr/mentor-42",
              roles: ["APPRENTICE"],
            },
          },
        },
      ],
    };

    const presented = presenter.present(message);
    expect(presented.toolRenderEntries).toContainEqual(
      expect.objectContaining({
        kind: "tool-call",
        name: "get_my_profile",
        result: expect.objectContaining({ action: "get_my_profile" }),
      }),
    );
  });

  it("renders referral QR tool results with a share summary", () => {
    const presenter = new ChatPresenter(mockMarkdownParser, mockCommandParser);
    const message: ChatMessage = {
      id: "msg-qr",
      role: "assistant",
      content: "Here is the referral package.",
      timestamp: new Date("2023-01-01T12:00:00Z"),
      parts: [
        {
          type: "tool_call",
          name: "get_my_referral_qr",
          args: {},
        },
        {
          type: "tool_result",
          name: "get_my_referral_qr",
          result: {
            action: "get_my_referral_qr",
            message: "Returned the share link and QR code URL for this account's referral code.",
            referral_code: "mentor-42",
            referral_url: "https://studioordo.com/r/mentor-42",
            qr_code_url: "/api/qr/mentor-42",
            manage_route: "/profile",
          },
        },
      ],
    };

    const presented = presenter.present(message);
    expect(presented.toolRenderEntries).toContainEqual(
      expect.objectContaining({
        kind: "tool-call",
        name: "get_my_referral_qr",
        result: expect.objectContaining({ action: "get_my_referral_qr" }),
      }),
    );
  });

  describe("__actions__ streaming safety", () => {
    const freshPresenter = () =>
      new ChatPresenter(
        { parse: vi.fn().mockReturnValue({ blocks: [] }) } as unknown as MarkdownParserService,
        { parse: vi.fn().mockReturnValue([]) } as unknown as CommandParserService,
      );

    const msg = (content: string): ChatMessage => ({
      id: "stream-test",
      role: "assistant",
      content,
      timestamp: new Date("2023-01-01T12:00:00Z"),
    });

    it("does not extract from partial tag", () => {
      const p = freshPresenter();
      const mdParser = (p as unknown as { markdownParser: { parse: ReturnType<typeof vi.fn> } }).markdownParser;
      const presented = p.present(msg('__actions__:[{"label":"Open'));
      expect(presented.actions).toEqual([]);
      expect(mdParser.parse).toHaveBeenCalledWith("");
    });

    it("does not extract from unclosed JSON array", () => {
      const p = freshPresenter();
      const mdParser = (p as unknown as { markdownParser: { parse: ReturnType<typeof vi.fn> } }).markdownParser;
      const presented = p.present(msg('__actions__:[{"label":"Open","action":"conversation"}'));
      expect(presented.actions).toEqual([]);
      expect(mdParser.parse).toHaveBeenCalledWith("");
    });

    it("preserves surrounding text while hiding incomplete tag markup", () => {
      const p = freshPresenter();
      const mdParser = (p as unknown as { markdownParser: { parse: ReturnType<typeof vi.fn> } }).markdownParser;
      p.present(msg('Hello __actions__:[{"label":"Open'));
      expect(mdParser.parse).toHaveBeenCalledWith("Hello");
    });

    it("extracts correctly when tag is complete", () => {
      const presented = freshPresenter().present(
        msg('Hello __actions__:[{"label":"Go","action":"route","params":{"path":"/x"}}]'),
      );
      expect(presented.actions).toHaveLength(1);
      expect(presented.actions[0]).toMatchObject({ label: "Go", action: "route" });
    });

    it("produces empty actions array for syntactically complete but malformed JSON", () => {
      const p = freshPresenter();
      const mdParser = (p as unknown as { markdownParser: { parse: ReturnType<typeof vi.fn> } }).markdownParser;
      const presented = p.present(msg("__actions__:[{bad json}]"));
      expect(presented.actions).toEqual([]);
      expect(mdParser.parse).toHaveBeenCalledWith("");
    });

    it("filters out entries with invalid action types from otherwise valid array", () => {
      const presented = freshPresenter().present(
        msg('__actions__:[{"label":"Ok","action":"send","params":{}},{"label":"Bad","action":"nope","params":{}}]'),
      );
      expect(presented.actions).toHaveLength(1);
      expect(presented.actions[0].label).toBe("Ok");
    });

    it("filters out entries missing required action field", () => {
      const presented = freshPresenter().present(
        msg('__actions__:[{"label":"NoAction","params":{}},{"label":"Ok","action":"route","params":{}}]'),
      );
      expect(presented.actions).toHaveLength(1);
      expect(presented.actions[0].label).toBe("Ok");
    });

    it("extracts complete action arrays with nested params without leaking raw markup", () => {
      const presenter = freshPresenter();
      const markdownParser = (presenter as unknown as { markdownParser: { parse: ReturnType<typeof vi.fn> } }).markdownParser;

      const presented = presenter.present(
        msg(
          'Want me to generate this? __actions__:[{"label":"Generate training path chart","action":"send","params":{"text":"Generate a chart of the mixed product team training path"}},{"label":"Open Cross-Functional Leadership","action":"corpus","params":{"id":"cross-functional-leadership","highlights":["phase-1","phase-2"]}}]',
        ),
      );

      expect(presented.actions).toHaveLength(2);
      expect(presented.actions[1]).toMatchObject({
        label: "Open Cross-Functional Leadership",
        action: "corpus",
      });
      expect(markdownParser.parse).toHaveBeenCalledWith("Want me to generate this?");
    });
  });
});
