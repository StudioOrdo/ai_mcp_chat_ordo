import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createAdminWebSearchTool } from "./admin-web-search.tool";

describe("createAdminWebSearchTool", () => {
  const originalOpenAiKey = process.env.OPENAI_API_KEY;
  const originalWebSearchProvider = process.env.WEB_SEARCH_PROVIDER;
  const originalWebSearchModel = process.env.WEB_SEARCH_MODEL;

  beforeEach(() => {
    process.env.OPENAI_API_KEY = "sk-test-key";
    process.env.WEB_SEARCH_PROVIDER = "openai";
  });

  afterEach(() => {
    if (originalOpenAiKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalOpenAiKey;
    }
    if (originalWebSearchProvider === undefined) {
      delete process.env.WEB_SEARCH_PROVIDER;
    } else {
      process.env.WEB_SEARCH_PROVIDER = originalWebSearchProvider;
    }
    if (originalWebSearchModel === undefined) {
      delete process.env.WEB_SEARCH_MODEL;
    } else {
      process.env.WEB_SEARCH_MODEL = originalWebSearchModel;
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

  it("uses the configured web search model when the tool call omits a model", async () => {
    process.env.WEB_SEARCH_MODEL = "gpt-5-mini";
    const create = vi.fn(async () => ({
      output: [
        {
          type: "message",
          content: [{ type: "output_text", text: "Configured model answer." }],
        },
      ],
    }));
    const descriptor = createAdminWebSearchTool(() => ({
      openai: {
        responses: { create },
      } as never,
    }));

    const result = await descriptor.command.execute({
      query: "ordo architecture",
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ model: "gpt-5-mini" }),
    );
    expect(result).toMatchObject({
      action: "admin_web_search",
      model: "gpt-5-mini",
      answer: "Configured model answer.",
    });
  });

  it("returns a structured error payload when the OpenAI key is missing", async () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.WEB_SEARCH_PROVIDER;

    const descriptor = createAdminWebSearchTool();

    const result = await descriptor.command.execute({
      query: "ordo architecture",
    });

    expect(result).toMatchObject({
      action: "admin_web_search",
      query: "ordo architecture",
      allowed_domains: undefined,
      model: "gpt-5",
      error: expect.stringMatching(/web_search capability is disabled|required key is missing/i),
      code: undefined,
    });
  });

  it("fails before OpenAI construction when web search capability is disabled", async () => {
    process.env.WEB_SEARCH_PROVIDER = "disabled";
    const depsFactory = vi.fn(() => {
      throw new Error("deps should not be constructed");
    });
    const descriptor = createAdminWebSearchTool(depsFactory);

    const result = await descriptor.command.execute({
      query: "ordo architecture",
    });

    expect(depsFactory).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      action: "admin_web_search",
      query: "ordo architecture",
      error: expect.stringMatching(/web_search capability is disabled/i),
    });
  });
});
