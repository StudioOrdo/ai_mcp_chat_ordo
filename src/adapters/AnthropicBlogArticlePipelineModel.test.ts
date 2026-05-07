import { describe, expect, it, vi } from "vitest";

import { AnthropicBlogArticlePipelineModel } from "@/adapters/AnthropicBlogArticlePipelineModel";

describe("AnthropicBlogArticlePipelineModel", () => {
  it("normalizes QA reports with empty findings and preserves approved=true when findings exist", async () => {
    const create = vi.fn()
      .mockResolvedValueOnce({
        content: [{
          type: "text",
          text: JSON.stringify({
            approved: true,
            summary: "Looks publishable.",
            findings: [],
          }),
        }],
      })
      .mockResolvedValueOnce({
        content: [{
          type: "text",
          text: JSON.stringify({
            approved: true,
            summary: "Approved with minor notes.",
            findings: [{
              id: "finding_1",
              severity: "low",
              issue: "Optional style tweak",
              recommendation: "Tighten the opening sentence.",
            }],
          }),
        }],
      });
    const model = new AnthropicBlogArticlePipelineModel({
      messages: { create },
    } as never, "anthropic", "claude-haiku-4-5");

    const emptyFindings = await model.reviewArticle({
      title: "Title",
      description: "Description",
      content: "## Heading\n\nBody.",
    });
    const approvedWithFindings = await model.reviewArticle({
      title: "Title",
      description: "Description",
      content: "## Heading\n\nBody.",
    });

    expect(emptyFindings).toMatchObject({
      approved: true,
      summary: "Looks publishable.",
      findings: [],
    });
    expect(approvedWithFindings).toMatchObject({
      approved: true,
      summary: "Approved with minor notes.",
    });
    expect(approvedWithFindings.findings).toEqual([
      {
        id: "finding_1",
        severity: "low",
        issue: "Optional style tweak",
        recommendation: "Tighten the opening sentence.",
      },
    ]);
  });

  it("fails closed when the provider returns malformed JSON", async () => {
    const model = new AnthropicBlogArticlePipelineModel({
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{
            type: "text",
            text: "This is not valid JSON.",
          }],
        }),
      },
    } as never, "anthropic", "claude-haiku-4-5");

    await expect(model.reviewArticle({
      title: "Title",
      description: "Description",
      content: "## Heading\n\nBody.",
    })).rejects.toThrow(/did not return valid json/i);
  });

  it("retries truncated resolveQa responses with a larger repair budget and original context", async () => {
    const create = vi.fn()
      .mockResolvedValueOnce({
        content: [{
          type: "text",
          text: '{"title":"Title","description":"Description","content":"## Heading',
        }],
        stop_reason: "max_tokens",
      })
      .mockResolvedValueOnce({
        content: [{
          type: "text",
          text: JSON.stringify({
            title: "Resolved title",
            description: "Resolved description",
            content: "## Heading\n\nResolved body.",
            resolutionSummary: "Applied the requested QA fixes.",
          }),
        }],
        stop_reason: "end_turn",
      });
    const model = new AnthropicBlogArticlePipelineModel({
      messages: { create },
    } as never, "anthropic", "claude-haiku-4-5");

    const resolved = await model.resolveQa({
      title: "Title",
      description: "Description",
      content: "## Heading\n\nDraft body.",
    }, {
      approved: false,
      summary: "Needs clearer supporting detail.",
      findings: [{
        id: "finding_1",
        severity: "medium",
        issue: "The proof point is vague.",
        recommendation: "Add a concrete example.",
      }],
    });

    expect(resolved).toMatchObject({
      title: "Resolved title",
      description: "Resolved description",
      resolutionSummary: "Applied the requested QA fixes.",
    });

    const firstRequest = create.mock.calls[0]?.[0];
    const repairRequest = create.mock.calls[1]?.[0];

    expect(firstRequest?.max_tokens).toBe(5200);
    expect(repairRequest?.max_tokens).toBeGreaterThan(firstRequest?.max_tokens ?? 0);
    expect(repairRequest?.messages?.[0]?.content).toContain("Original user request:");
    expect(repairRequest?.messages?.[0]?.content).toContain("QA report:");
    expect(repairRequest?.messages?.[0]?.content).toContain("Previous response draft to repair or complete:");
  });

  it("falls back to split-pass QA resolution when the full JSON response keeps truncating", async () => {
    const create = vi.fn()
      .mockResolvedValueOnce({
        content: [{
          type: "text",
          text: '{"title":"Title","description":"Description","content":"## Heading',
        }],
        stop_reason: "max_tokens",
      })
      .mockResolvedValueOnce({
        content: [{
          type: "text",
          text: '{"title":"Title","description":"Description","content":"## Heading\n\nStill trunc',
        }],
        stop_reason: "max_tokens",
      })
      .mockResolvedValueOnce({
        content: [{
          type: "text",
          text: "## Heading\n\nResolved body with the QA fixes applied.",
        }],
        stop_reason: "end_turn",
      })
      .mockResolvedValueOnce({
        content: [{
          type: "text",
          text: JSON.stringify({
            title: "Resolved title",
            description: "Resolved description",
            resolutionSummary: "Applied the QA fixes and tightened the argument.",
          }),
        }],
        stop_reason: "end_turn",
      });
    const model = new AnthropicBlogArticlePipelineModel({
      messages: { create },
    } as never, "anthropic", "claude-haiku-4-5");

    const resolved = await model.resolveQa({
      title: "Title",
      description: "Description",
      content: "## Heading\n\nDraft body.",
    }, {
      approved: false,
      summary: "Needs clearer supporting detail.",
      findings: [{
        id: "finding_1",
        severity: "medium",
        issue: "The proof point is vague.",
        recommendation: "Add a concrete example.",
      }],
    });

    expect(resolved).toEqual({
      title: "Resolved title",
      description: "Resolved description",
      content: "## Heading\n\nResolved body with the QA fixes applied.",
      resolutionSummary: "Applied the QA fixes and tightened the argument.",
    });

    const fallbackContentRequest = create.mock.calls[2]?.[0];
    const fallbackMetadataRequest = create.mock.calls[3]?.[0];

    expect(fallbackContentRequest?.max_tokens).toBe(9000);
    expect(fallbackContentRequest?.system).toContain("Return only the final markdown body.");
    expect(fallbackMetadataRequest?.max_tokens).toBe(1400);
    expect(fallbackMetadataRequest?.messages?.[0]?.content).toContain("Return { title, description, resolutionSummary }.");
  });

  it("forwards abort signals to Anthropic requests", async () => {
    const create = vi.fn().mockResolvedValue({
      content: [{
        type: "text",
        text: JSON.stringify({
          title: "Title",
          description: "Description",
          content: "## Heading\n\nBody.",
        }),
      }],
    });
    const model = new AnthropicBlogArticlePipelineModel({
      messages: { create },
    } as never, "anthropic", "claude-haiku-4-5");
    const abortController = new AbortController();

    await model.composeArticle({
      brief: "Launch brief",
    }, {
      abortSignal: abortController.signal,
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "claude-haiku-4-5",
      }),
      expect.objectContaining({
        signal: abortController.signal,
      }),
    );
  });
});