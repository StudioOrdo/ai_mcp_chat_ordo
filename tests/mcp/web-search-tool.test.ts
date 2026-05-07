// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type OpenAI from "openai";
import {
  adminWebSearch,
  type WebSearchToolDeps,
} from "@/lib/capabilities/shared/web-search-tool";
import { getOpenaiApiKey, getAnthropicApiKey } from "@/lib/config/env";

function mockOpenAI(overrides?: {
  output?: unknown[];
  error?: Error;
}): WebSearchToolDeps {
  const create = overrides?.error
    ? vi.fn().mockRejectedValue(overrides.error)
    : vi.fn().mockResolvedValue({ output: overrides?.output ?? [] });
  return {
    openai: { responses: { create } } as unknown as OpenAI,
  };
}

const MOCK_OUTPUT = [
  {
    type: "web_search_call",
    action: {
      sources: [
        { url: "https://en.wikipedia.org/wiki/Transistor" },
        { url: "https://example.com/transistors" },
      ],
    },
  },
  {
    type: "message",
    content: [
      {
        type: "output_text",
        text: "The transistor was invented in 1947.",
        annotations: [
          {
            type: "url_citation",
            url: "https://en.wikipedia.org/wiki/Transistor",
            title: "Transistor - Wikipedia",
            start_index: 0,
            end_index: 36,
          },
        ],
      },
    ],
  },
];

describe("adminWebSearch", () => {
  const originalKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    process.env.OPENAI_API_KEY = "sk-test-key";
  });

  afterEach(() => {
    if (originalKey !== undefined) {
      process.env.OPENAI_API_KEY = originalKey;
    } else {
      delete process.env.OPENAI_API_KEY;
    }
  });

  // --- Input validation ---

  it("rejects empty query", async () => {
    const result = await adminWebSearch(mockOpenAI({ output: MOCK_OUTPUT }), {
      query: "",
    });
    expect(result).toEqual({
      error: "query is required and must be non-empty",
    });
  });

  it("rejects whitespace-only query", async () => {
    const result = await adminWebSearch(mockOpenAI({ output: MOCK_OUTPUT }), {
      query: "   ",
    });
    expect(result).toEqual({
      error: "query is required and must be non-empty",
    });
  });

  it("rejects query over 2000 characters", async () => {
    const result = await adminWebSearch(mockOpenAI({ output: MOCK_OUTPUT }), {
      query: "a".repeat(2001),
    });
    expect(result).toEqual({
      error: "query exceeds maximum length of 2000 characters",
    });
  });

  // --- Provider configuration boundary ---

  it("does not read provider keys inside the shared helper", async () => {
    delete process.env.OPENAI_API_KEY;
    const result = await adminWebSearch(mockOpenAI({ output: MOCK_OUTPUT }), {
      query: "test",
    });
    expect(result).toHaveProperty("answer", "The transistor was invented in 1947.");
  });

  it("accepts API__OPENAI_API_KEY as the OpenAI alias", async () => {
    delete process.env.OPENAI_API_KEY;
    process.env.API__OPENAI_API_KEY = "sk-alias-key";

    const result = await adminWebSearch(mockOpenAI({ output: MOCK_OUTPUT }), {
      query: "test",
    });

    expect(result).toHaveProperty("answer", "The transistor was invented in 1947.");
    delete process.env.API__OPENAI_API_KEY;
  });

  it("resolves provider aliases via shared env helpers", () => {
    const originalAnthropic = process.env.ANTHROPIC_API_KEY;
    const originalOpenAiAlias = process.env.API__OPENAI_API_KEY;
    const originalAnthropicAlias = process.env.API__ANTHROPIC_API_KEY;

    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    process.env.API__OPENAI_API_KEY = "sk-openai-alias";
    process.env.API__ANTHROPIC_API_KEY = "sk-anthropic-alias";

    expect(getOpenaiApiKey()).toBe("sk-openai-alias");
    expect(getAnthropicApiKey()).toBe("sk-anthropic-alias");

    if (originalOpenAiAlias !== undefined) {
      process.env.API__OPENAI_API_KEY = originalOpenAiAlias;
    } else {
      delete process.env.API__OPENAI_API_KEY;
    }

    if (originalAnthropicAlias !== undefined) {
      process.env.API__ANTHROPIC_API_KEY = originalAnthropicAlias;
    } else {
      delete process.env.API__ANTHROPIC_API_KEY;
    }

    if (originalAnthropic !== undefined) {
      process.env.ANTHROPIC_API_KEY = originalAnthropic;
    } else {
      delete process.env.ANTHROPIC_API_KEY;
    }
  });

  // --- Default model ---

  it("defaults model to gpt-5 when omitted", async () => {
    const deps = mockOpenAI({ output: MOCK_OUTPUT });
    await adminWebSearch(deps, { query: "test" });
    const create = deps.openai.responses.create as ReturnType<typeof vi.fn>;
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ model: "gpt-5" }),
    );
  });

  // --- Domain filtering ---

  it("passes allowed_domains as filters", async () => {
    const deps = mockOpenAI({ output: MOCK_OUTPUT });
    await adminWebSearch(deps, {
      query: "transistor history",
      allowed_domains: ["en.wikipedia.org"],
    });
    const create = deps.openai.responses.create as ReturnType<typeof vi.fn>;
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        tools: [
          expect.objectContaining({
            type: "web_search",
            filters: { allowed_domains: ["en.wikipedia.org"] },
          }),
        ],
      }),
    );
  });

  it("omits filters when allowed_domains is empty array", async () => {
    const deps = mockOpenAI({ output: MOCK_OUTPUT });
    await adminWebSearch(deps, {
      query: "test",
      allowed_domains: [],
    });
    const create = deps.openai.responses.create as ReturnType<typeof vi.fn>;
    const callArgs = create.mock.calls[0][0];
    expect(callArgs.tools[0]).toEqual({ type: "web_search" });
  });

  // --- Answer extraction ---

  it("extracts answer text from response", async () => {
    const result = await adminWebSearch(mockOpenAI({ output: MOCK_OUTPUT }), {
      query: "test",
    });
    expect(result).toHaveProperty(
      "answer",
      "The transistor was invented in 1947.",
    );
  });

  it("returns error when response has no message item", async () => {
    const output = [{ type: "web_search_call", action: { sources: [] } }];
    const result = await adminWebSearch(mockOpenAI({ output }), {
      query: "test",
    });
    expect(result).toEqual({ error: "No answer text in response" });
  });

  // --- Citation extraction ---

  it("extracts url_citation annotations", async () => {
    const result = await adminWebSearch(mockOpenAI({ output: MOCK_OUTPUT }), {
      query: "test",
    });
    expect(result).toHaveProperty("citations");
    const r = result as { citations: unknown[] };
    expect(r.citations).toHaveLength(1);
    expect(r.citations[0]).toEqual({
      url: "https://en.wikipedia.org/wiki/Transistor",
      title: "Transistor - Wikipedia",
      start_index: 0,
      end_index: 36,
    });
  });

  it("returns empty citations when no annotations present", async () => {
    const output = [
      {
        type: "message",
        content: [{ type: "output_text", text: "answer" }],
      },
    ];
    const result = await adminWebSearch(mockOpenAI({ output }), {
      query: "test",
    });
    expect(result).toHaveProperty("citations", []);
  });

  // --- Source extraction ---

  it("extracts sources from web_search_call", async () => {
    const result = await adminWebSearch(mockOpenAI({ output: MOCK_OUTPUT }), {
      query: "test",
    });
    expect(result).toHaveProperty("sources", [
      "https://en.wikipedia.org/wiki/Transistor",
      "https://example.com/transistors",
    ]);
  });

  it("returns empty sources when no web_search_call present", async () => {
    const output = [
      {
        type: "message",
        content: [{ type: "output_text", text: "answer" }],
      },
    ];
    const result = await adminWebSearch(mockOpenAI({ output }), {
      query: "test",
    });
    expect(result).toHaveProperty("sources", []);
  });

  // --- Error handling ---

  it("returns structured error with status code on API error", async () => {
    const apiError = Object.assign(new Error("Unauthorized"), {
      status: 401,
      message: "Unauthorized",
    });
    const result = await adminWebSearch(
      mockOpenAI({ error: apiError }),
      { query: "test" },
    );
    expect(result).toEqual({ error: "Unauthorized", code: 401 });
  });

  it("returns error message for non-API errors", async () => {
    const result = await adminWebSearch(
      mockOpenAI({ error: new Error("Network failure") }),
      { query: "test" },
    );
    expect(result).toEqual({ error: "Network failure" });
  });

  // --- End-to-end ---

  it("full mock response parsed correctly", async () => {
    const result = await adminWebSearch(mockOpenAI({ output: MOCK_OUTPUT }), {
      query: "When was the transistor invented?",
    });
    expect(result).toEqual({
      answer: "The transistor was invented in 1947.",
      citations: [
        {
          url: "https://en.wikipedia.org/wiki/Transistor",
          title: "Transistor - Wikipedia",
          start_index: 0,
          end_index: 36,
        },
      ],
      sources: [
        "https://en.wikipedia.org/wiki/Transistor",
        "https://example.com/transistors",
      ],
      model: "gpt-5",
    });
  });
});
