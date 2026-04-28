import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createAdminWebSearchTool } from "./admin-web-search.tool";

describe("createAdminWebSearchTool", () => {
  const originalOpenAiKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    process.env.OPENAI_API_KEY = "sk-test-key";
  });

  afterEach(() => {
    if (originalOpenAiKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalOpenAiKey;
    }
  });

  it("returns a structured success payload from the shared web search implementation", async () => {
    const descriptor = createAdminWebSearchTool(() => ({
      openai: {
        responses: {
          create: async () => ({
            output: [
              {
                type: "message",
                content: [
                  {
                    type: "output_text",
                    text: "A sourced answer.",
                    annotations: [
                      {
                        type: "url_citation",
                        url: "https://example.com/source",
                        title: "Example Source",
                        start_index: 0,
                        end_index: 6,
                      },
                    ],
                  },
                ],
              },
              {
                type: "web_search_call",
                action: {
                  sources: [{ url: "https://example.com/source" }],
                },
              },
            ],
          }),
        },
      } as never,
    }));

    const result = await descriptor.command.execute({
      query: "ordo architecture",
      allowed_domains: ["example.com"],
      model: "gpt-5",
    });

    expect(result).toEqual({
      action: "admin_web_search",
      query: "ordo architecture",
      allowed_domains: ["example.com"],
      answer: "A sourced answer.",
      citations: [
        {
          url: "https://example.com/source",
          title: "Example Source",
          start_index: 0,
          end_index: 6,
        },
      ],
      sources: ["https://example.com/source"],
      model: "gpt-5",
    });
  });

  it("returns a structured error payload when the shared web search implementation fails", async () => {
    const descriptor = createAdminWebSearchTool(() => ({
      openai: {
        responses: {
          create: async () => {
            throw { status: 429, message: "Rate limited" };
          },
        },
      } as never,
    }));

    const result = await descriptor.command.execute({
      query: "ordo architecture",
    });

    expect(result).toEqual({
      action: "admin_web_search",
      query: "ordo architecture",
      allowed_domains: undefined,
      model: "gpt-5",
      error: "Rate limited",
      code: 429,
    });
  });

  it("returns a structured error payload when dependency creation fails", async () => {
    delete process.env.OPENAI_API_KEY;

    const descriptor = createAdminWebSearchTool();

    const result = await descriptor.command.execute({
      query: "ordo architecture",
    });

    expect(result).toEqual({
      action: "admin_web_search",
      query: "ordo architecture",
      allowed_domains: undefined,
      model: "gpt-5",
      error: "OPENAI_API_KEY or API__OPENAI_API_KEY must be set to a non-empty value.",
      code: undefined,
    });
  });
});