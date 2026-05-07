import { describe, it, expect } from "vitest";
import { MarkdownParserService } from "./MarkdownParserService";
import type { BlockNode, InlineNode } from "../core/entities/rich-content";
import { INLINE_TYPES } from "../core/entities/rich-content";

describe("MarkdownParserService", () => {
  const parser = new MarkdownParserService();

  it("should parse a simple paragraph", () => {
    const result = parser.parse("Hello world");
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0]).toMatchObject({
      type: "paragraph",
      content: [{ type: "text", text: "Hello world" }],
    });
  });

  it("should parse inlines (bold, code, links)", () => {
    const result = parser.parse("Hello **bold** and `code` with [[slug]]");
    const p = result.blocks[0] as Extract<BlockNode, { type: "paragraph" }>;
    expect(p.content).toHaveLength(6);
    expect(p.content[1]).toEqual({ type: "bold", content: [{ type: "text", text: "bold" }] });
    expect(p.content[3]).toEqual({ type: "code-inline", text: "code" });
    expect(p.content[5]).toEqual({ type: "library-link", slug: "slug" });
  });

  it("should parse headings", () => {
    const result = parser.parse("# H1\n## H2\n### H3");
    expect(result.blocks).toHaveLength(3);
    expect(result.blocks[0].type).toBe("heading");
    expect((result.blocks[0] as Extract<BlockNode, { type: "heading" }>).level).toBe(1);
  });

  it("should parse lists", () => {
    const result = parser.parse("- item 1\n- item 2");
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0].type).toBe("list");
    expect((result.blocks[0] as Extract<BlockNode, { type: "list" }>).items).toHaveLength(2);
  });

  it("should parse code blocks", () => {
    const result = parser.parse("```ts\nconst x = 1;\n```");
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0]).toMatchObject({
      type: "code-block",
      code: "const x = 1;",
      language: "ts",
    });
  });

  it("should parse tables", () => {
    const markdown = "| H1 | H2 |\n|---|---|\n| C1 | C2 |";
    const result = parser.parse(markdown);
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0].type).toBe("table");
    const table = result.blocks[0] as Extract<BlockNode, { type: "table" }>;
    expect(table.header).toHaveLength(2);
    expect(table.rows).toHaveLength(1);
    expect((table.rows[0][0][0] as Extract<InlineNode, { type: "text" }>).text).toBe("C1");
  });

  it("should parse NOW NEXT WAIT sections into an operator brief", () => {
    const result = parser.parse(
      "NOW\nHandle the founder response first.\n- Reply to Alex\nNEXT\nReview routing drift.\nWAIT\nLeave funnel cleanup for later.",
    );

    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0].type).toBe("operator-brief");
    const brief = result.blocks[0] as Extract<BlockNode, { type: "operator-brief" }>;
    expect(brief.sections.map((section) => section.label)).toEqual(["NOW", "NEXT", "WAIT"]);
    expect(brief.sections[0].items).toHaveLength(1);
  });

  describe("action links", () => {
    it("should parse a simple action link", () => {
      const result = parser.parse("Click [Browse books](?corpus=lean-startup) now");
      const p = result.blocks[0] as Extract<BlockNode, { type: "paragraph" }>;
      expect(p.content).toHaveLength(3);
      expect(p.content[1]).toEqual({
        type: INLINE_TYPES.ACTION_LINK,
        label: "Browse books",
        actionType: "corpus",
        value: "lean-startup",
      });
    });

    it("should parse action link with extra params", () => {
      const result = parser.parse("[Open chat](?conversation=abc&title=Hello%20World)");
      const p = result.blocks[0] as Extract<BlockNode, { type: "paragraph" }>;
      expect(p.content[0]).toMatchObject({
        type: INLINE_TYPES.ACTION_LINK,
        label: "Open chat",
        actionType: "conversation",
        value: "abc",
        params: { title: "Hello World" },
      });
    });

    it("should parse operation action links only when durable params are present", () => {
      const result = parser.parse("[Execute restore](?operation=op_1&operationId=op_1&actionId=action_1&idempotencyKey=idem_1&operationRevision=3)");
      const p = result.blocks[0] as Extract<BlockNode, { type: "paragraph" }>;
      expect(p.content[0]).toMatchObject({
        type: INLINE_TYPES.ACTION_LINK,
        label: "Execute restore",
        actionType: "operation",
        value: "op_1",
        params: {
          operationId: "op_1",
          actionId: "action_1",
          idempotencyKey: "idem_1",
          operationRevision: "3",
        },
      });
    });

    it("should leave operation action links without durable params as plain text", () => {
      const result = parser.parse("[Execute restore](?operation=op_1)");
      const p = result.blocks[0] as Extract<BlockNode, { type: "paragraph" }>;
      expect(p.content).toEqual([{ type: "text", text: "[Execute restore](?operation=op_1)" }]);
    });

    it("should parse action links alongside bold and code", () => {
      const result = parser.parse("**bold** then [Go](?route=/home) then `code`");
      const p = result.blocks[0] as Extract<BlockNode, { type: "paragraph" }>;
      expect(p.content[0]).toEqual({ type: "bold", content: [{ type: "text", text: "bold" }] });
      expect(p.content[2]).toMatchObject({ type: INLINE_TYPES.ACTION_LINK, label: "Go" });
      expect(p.content[4]).toEqual({ type: "code-inline", text: "code" });
    });

    it("should parse action links nested inside bold text", () => {
      const result = parser.parse("**1. [The Outlaw](?corpus=the-outlaw) - Reform**");
      const p = result.blocks[0] as Extract<BlockNode, { type: "paragraph" }>;
      expect(p.content[0]).toEqual({
        type: "bold",
        content: [
          { type: "text", text: "1. " },
          { type: INLINE_TYPES.ACTION_LINK, label: "The Outlaw", actionType: "corpus", value: "the-outlaw" },
          { type: "text", text: " - Reform" },
        ],
      });
    });

    it("should parse action link inside a list item", () => {
      const result = parser.parse("- Click [here](?send=hello)");
      const list = result.blocks[0] as Extract<BlockNode, { type: "list" }>;
      const inlines = list.items[0]; // InlineNode[]
      const actionNode = inlines.find((n) => n.type === INLINE_TYPES.ACTION_LINK);
      expect(actionNode).toMatchObject({
        type: INLINE_TYPES.ACTION_LINK,
        label: "here",
        actionType: "send",
        value: "hello",
      });
    });

    it("should parse action link inside operator brief", () => {
      const result = parser.parse("NOW\n- [Do this](?send=task) first\nNEXT\nReview results.\nWAIT\nNothing yet.");
      const brief = result.blocks[0] as Extract<BlockNode, { type: "operator-brief" }>;
      expect(brief).toBeDefined();
      expect(brief.type).toBe("operator-brief");
      const nowSection = brief.sections.find((s) => s.label === "NOW");
      expect(nowSection).toBeDefined();
      if (!nowSection) {
        throw new Error("Expected NOW section in operator brief.");
      }
      // items is InlineNode[][] — each sub-array is one bullet/paragraph line
      const allInlines = (nowSection.items ?? []).flat();
      const actionNode = allInlines.find((n) => n.type === INLINE_TYPES.ACTION_LINK);
      expect(actionNode).toMatchObject({
        type: INLINE_TYPES.ACTION_LINK,
        actionType: "send",
        value: "task",
      });
    });

    it("should treat partial action link syntax as plain text", () => {
      const result = parser.parse("Hello [label](?invalid=value) world");
      const p = result.blocks[0] as Extract<BlockNode, { type: "paragraph" }>;
      // "invalid" is not a valid action type, so emitted as plain text
      const textNodes = p.content.filter((n) => n.type === "text");
      const fullText = textNodes.map((n) => (n as Extract<InlineNode, { type: "text" }>).text).join("");
      expect(fullText).toContain("[label](?invalid=value)");
    });

    it("should parse same-origin markdown links as route actions", () => {
      const result = parser.parse("See [Library](/library) for more");
      const p = result.blocks[0] as Extract<BlockNode, { type: "paragraph" }>;
      expect(p.content[1]).toEqual({
        type: INLINE_TYPES.ACTION_LINK,
        label: "Library",
        actionType: "route",
        value: "/library",
      });
    });

    it("should parse absolute markdown links as external actions", () => {
      const result = parser.parse("See [Google](https://google.com) for more");
      const p = result.blocks[0] as Extract<BlockNode, { type: "paragraph" }>;
      expect(p.content[1]).toEqual({
        type: INLINE_TYPES.ACTION_LINK,
        label: "Google",
        actionType: "external",
        value: "https://google.com",
      });
    });

    it("should leave unsupported markdown link schemes as plain text", () => {
      const result = parser.parse("See [Email](mailto:hello@studioordo.com) for more");
      const p = result.blocks[0] as Extract<BlockNode, { type: "paragraph" }>;
      const hasActionLink = p.content.some((n) => n.type === INLINE_TYPES.ACTION_LINK);
      expect(hasActionLink).toBe(false);
    });
  });

  describe("streaming partial syntax resilience", () => {
    it("treats bare opening bracket as plain text", () => {
      const result = parser.parse("[Morg");
      const p = result.blocks[0] as Extract<BlockNode, { type: "paragraph" }>;
      expect(p.content.every((n) => n.type === "text")).toBe(true);
    });

    it("treats label-only without query as plain text", () => {
      const result = parser.parse("[Morgan Lee]");
      const p = result.blocks[0] as Extract<BlockNode, { type: "paragraph" }>;
      expect(p.content.every((n) => n.type === "text")).toBe(true);
    });

    it("treats incomplete query string as plain text", () => {
      const result = parser.parse("[Morgan Lee](?conv");
      const p = result.blocks[0] as Extract<BlockNode, { type: "paragraph" }>;
      expect(p.content.every((n) => n.type === "text")).toBe(true);
    });

    it("treats unclosed paren as plain text", () => {
      const result = parser.parse("[Morgan Lee](?conversation=conv_001");
      const p = result.blocks[0] as Extract<BlockNode, { type: "paragraph" }>;
      expect(p.content.every((n) => n.type === "text")).toBe(true);
    });

    it("parses complete action link after incremental build", () => {
      const result = parser.parse("[Morgan Lee](?conversation=conv_001)");
      const p = result.blocks[0] as Extract<BlockNode, { type: "paragraph" }>;
      expect(p.content[0]).toMatchObject({
        type: INLINE_TYPES.ACTION_LINK,
        label: "Morgan Lee",
        actionType: "conversation",
        value: "conv_001",
      });
    });

    it("treats action link with unknown type as plain text", () => {
      const result = parser.parse("[Foo](?unknown=bar)");
      const p = result.blocks[0] as Extract<BlockNode, { type: "paragraph" }>;
      const hasActionLink = p.content.some((n) => n.type === INLINE_TYPES.ACTION_LINK);
      expect(hasActionLink).toBe(false);
    });

    it("treats empty label as plain text", () => {
      // Regex requires [^\]]+ inside brackets — empty brackets don't match
      const result = parser.parse("[](?conversation=x)");
      const p = result.blocks[0] as Extract<BlockNode, { type: "paragraph" }>;
      const hasActionLink = p.content.some((n) => n.type === INLINE_TYPES.ACTION_LINK);
      expect(hasActionLink).toBe(false);
    });

    it("parses action link with empty value as valid", () => {
      // Empty value is syntactically valid — the parser accepts it
      const result = parser.parse("[Label](?conversation=)");
      const p = result.blocks[0] as Extract<BlockNode, { type: "paragraph" }>;
      expect(p.content[0]).toMatchObject({
        type: INLINE_TYPES.ACTION_LINK,
        label: "Label",
        actionType: "conversation",
        value: "",
      });
    });
  });
});
