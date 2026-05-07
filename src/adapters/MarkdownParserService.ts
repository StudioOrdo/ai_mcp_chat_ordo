import type {
  RichContent,
  BlockNode,
  InlineNode,
} from "../core/entities/rich-content";
import { BLOCK_TYPES, INLINE_TYPES, VALID_ACTION_TYPES } from "../core/entities/rich-content";
import type { ActionLinkType } from "../core/entities/rich-content";
import { operationCardBlock, parseSerializedOperationCard } from "@/lib/operations/operation-presentation";

export class MarkdownParserService {
  parse(markdown: string): RichContent {
    const lines = markdown.split("\n");
    const blocks: BlockNode[] = [];

    let listBuffer: string[] = [];
    let tableBuffer: string[][] = [];
    let tableHasHeader = false;
    let codeBuffer: string[] = [];
    let codeLang = "";
    let inCode = false;

    const flushList = () => {
      if (listBuffer.length > 0) {
        blocks.push({
          type: BLOCK_TYPES.LIST,
          items: listBuffer.map((item) => this.parseInlines(item)),
        });
        listBuffer = [];
      }
    };

    const flushTable = () => {
      if (tableBuffer.length > 0) {
        const header = tableHasHeader
          ? tableBuffer[0].map((c) => this.parseInlines(c))
          : undefined;
        const rows = (tableHasHeader ? tableBuffer.slice(1) : tableBuffer).map(
          (row) => row.map((cell) => this.parseInlines(cell)),
        );

        blocks.push({ type: BLOCK_TYPES.TABLE, header, rows });
        tableBuffer = [];
        tableHasHeader = false;
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      if (trimmed.startsWith("```")) {
        if (!inCode) {
          flushList();
          flushTable();
          codeLang = trimmed.slice(3).trim();
          inCode = true;
          codeBuffer = [];
        } else {
          blocks.push({
            type: BLOCK_TYPES.CODE,
            code: codeBuffer.join("\n"),
            language: codeLang,
          });
          codeBuffer = [];
          inCode = false;
        }
        continue;
      }

      if (inCode) {
        codeBuffer.push(line);
        continue;
      }

      const operationCard = parseSerializedOperationCard(trimmed);
      if (operationCard) {
        flushList();
        flushTable();
        blocks.push(operationCardBlock(operationCard));
        continue;
      }

      const operatorHeading = this.getOperatorSectionHeading(trimmed);
      if (operatorHeading === "NOW") {
        flushList();
        flushTable();

        const operatorBrief = this.parseOperatorBrief(lines, i);
        if (operatorBrief) {
          blocks.push(operatorBrief.block);
          i = operatorBrief.endIndex;
          continue;
        }
      }

      if (trimmed.startsWith("|")) {
        if (this.isTableSeparator(trimmed)) {
          tableHasHeader = true;
        } else {
          tableBuffer.push(this.parseTableRow(trimmed));
        }
        continue;
      } else if (tableBuffer.length > 0) {
        flushTable();
      }

      if (trimmed.startsWith("### ")) {
        flushList();
        blocks.push({
          type: BLOCK_TYPES.HEADING,
          level: 3,
          content: this.parseInlines(trimmed.slice(4)),
        });
      } else if (trimmed.startsWith("## ")) {
        flushList();
        blocks.push({
          type: BLOCK_TYPES.HEADING,
          level: 2,
          content: this.parseInlines(trimmed.slice(3)),
        });
      } else if (trimmed.startsWith("# ")) {
        flushList();
        blocks.push({
          type: BLOCK_TYPES.HEADING,
          level: 1,
          content: this.parseInlines(trimmed.slice(2)),
        });
      } else if (trimmed.startsWith("> ")) {
        flushList();
        blocks.push({
          type: BLOCK_TYPES.BLOCKQUOTE,
          content: this.parseInlines(trimmed.slice(2)),
        });
      } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        listBuffer.push(trimmed.slice(2));
      } else if (trimmed === "---" || trimmed === "***") {
        flushList();
        blocks.push({ type: BLOCK_TYPES.DIVIDER });
      } else if (!trimmed) {
        flushList();
      } else {
        flushList();
        blocks.push({ type: BLOCK_TYPES.PARAGRAPH, content: this.parseInlines(trimmed) });
      }
    }

    flushList();
    flushTable();
    return { blocks };
  }

  private parseOperatorBrief(lines: string[], startIndex: number): {
    block: Extract<BlockNode, { type: typeof BLOCK_TYPES.OPERATOR_BRIEF }>;
    endIndex: number;
  } | null {
    const expectedLabels: Array<"NOW" | "NEXT" | "WAIT"> = ["NOW", "NEXT", "WAIT"];
    const sections: Extract<BlockNode, { type: typeof BLOCK_TYPES.OPERATOR_BRIEF }>["sections"] = [];
    let cursor = startIndex;

    for (const label of expectedLabels) {
      const heading = this.getOperatorSectionHeading(lines[cursor]?.trim() ?? "");
      if (heading !== label) {
        return null;
      }

      cursor += 1;
      const summaryLines: string[] = [];
      const items: string[] = [];

      while (cursor < lines.length) {
        const trimmed = lines[cursor].trim();
        const nextHeading = this.getOperatorSectionHeading(trimmed);

        if (nextHeading) {
          break;
        }

        if (!trimmed) {
          cursor += 1;
          continue;
        }

        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          items.push(trimmed.slice(2));
        } else if (/^\d+\.\s/.test(trimmed)) {
          items.push(trimmed.replace(/^\d+\.\s/, ""));
        } else {
          summaryLines.push(trimmed);
        }

        cursor += 1;
      }

      sections.push({
        label,
        summary: this.parseInlines(summaryLines.join(" ") || label),
        items: items.length > 0 ? items.map((item) => this.parseInlines(item)) : undefined,
      });
    }

    return {
      block: {
        type: BLOCK_TYPES.OPERATOR_BRIEF,
        sections,
      },
      endIndex: cursor - 1,
    };
  }

  private getOperatorSectionHeading(line: string): "NOW" | "NEXT" | "WAIT" | null {
    const normalized = line.replace(/^#{1,3}\s*/, "").replace(/:$/, "").trim().toUpperCase();

    if (normalized === "NOW" || normalized === "NEXT" || normalized === "WAIT") {
      return normalized;
    }

    return null;
  }

  private parseInlines(text: string, allowBold = true): InlineNode[] {
    const nodes: InlineNode[] = [];
    const inlinePatterns = [
      allowBold ? "\\*\\*[^*]+\\*\\*" : null,
      "`[^`]+`",
      "\\[\\[[^\\]]+\\]\\]",
      "\\[[^\\]]+\\]\\(\\?[^)]+\\)",
      "\\[[^\\]]+\\]\\((?!\\?)[^)]+\\)",
    ].filter((pattern): pattern is string => pattern !== null);
    const combined = new RegExp(`(${inlinePatterns.join("|")})`, "g");
    let last = 0;
    let m: RegExpExecArray | null;

    while ((m = combined.exec(text)) !== null) {
      if (m.index > last) {
        nodes.push({ type: INLINE_TYPES.TEXT, text: text.slice(last, m.index) });
      }

      const match = m[0];
      if (match.startsWith("**")) {
        nodes.push({
          type: INLINE_TYPES.BOLD,
          content: this.parseInlines(match.slice(2, -2), false),
        });
      } else if (match.startsWith("`")) {
        nodes.push({ type: INLINE_TYPES.CODE, text: match.slice(1, -1) });
      } else if (match.startsWith("[[")) {
        nodes.push({ type: INLINE_TYPES.LINK, slug: match.slice(2, -2) });
      } else if (match.startsWith("[")) {
        const parsed = this.parseActionLink(match) ?? this.parseMarkdownLink(match);
        if (parsed) {
          nodes.push(parsed);
        } else {
          // Malformed action link — emit as plain text
          nodes.push({ type: INLINE_TYPES.TEXT, text: match });
        }
      }

      last = m.index + match.length;
    }

    if (last < text.length) {
      nodes.push({ type: INLINE_TYPES.TEXT, text: text.slice(last) });
    }

    return nodes.length > 0 ? nodes : [{ type: INLINE_TYPES.TEXT, text }];
  }

  private parseActionLink(match: string): InlineNode | null {
    // Extract label from [label](?...)
    const labelEnd = match.indexOf("]");
    if (labelEnd < 0) return null;
    const label = match.slice(1, labelEnd);
    // Extract query string from (?key=value&key=value)
    const queryStart = match.indexOf("(?", labelEnd);
    if (queryStart < 0) return null;
    const queryStr = match.slice(queryStart + 2, -1); // strip "(?" and ")"
    if (!queryStr || !queryStr.includes("=")) return null;

    const parts = queryStr.split("&");
    const firstPart = parts[0];
    const eqIndex = firstPart.indexOf("=");
    if (eqIndex <= 0) return null; // no action type before "="

    const actionType = firstPart.slice(0, eqIndex);
    if (!VALID_ACTION_TYPES.has(actionType)) return null;

    const value = decodeURIComponent(firstPart.slice(eqIndex + 1).replace(/\+/g, " "));

    const params: Record<string, string> = {};
    for (let i = 1; i < parts.length; i++) {
      const pEq = parts[i].indexOf("=");
      if (pEq > 0) {
        params[parts[i].slice(0, pEq)] = decodeURIComponent(parts[i].slice(pEq + 1).replace(/\+/g, " "));
      }
    }

    if (
      actionType === "operation"
      && (!params.operationId || !params.actionId || !params.idempotencyKey || !params.operationRevision)
    ) {
      return null;
    }

    return {
      type: INLINE_TYPES.ACTION_LINK,
      label,
      actionType: actionType as ActionLinkType,
      value,
      ...(Object.keys(params).length > 0 ? { params } : {}),
    };
  }

  private parseMarkdownLink(match: string): InlineNode | null {
    const labelEnd = match.indexOf("]");
    if (labelEnd < 0) return null;

    const label = match.slice(1, labelEnd);
    const hrefStart = match.indexOf("(", labelEnd);
    if (hrefStart < 0) return null;

    const href = match.slice(hrefStart + 1, -1).trim();
    if (!href) return null;

    if (href.startsWith("/") && !href.startsWith("//")) {
      return {
        type: INLINE_TYPES.ACTION_LINK,
        label,
        actionType: "route",
        value: href,
      };
    }

    if (href.startsWith("http://") || href.startsWith("https://")) {
      return {
        type: INLINE_TYPES.ACTION_LINK,
        label,
        actionType: "external",
        value: href,
      };
    }

    return null;
  }

  private parseTableRow(line: string): string[] {
    return line
      .split("|")
      .map((cell) => cell.trim())
      .filter(
        (_, i, arr) =>
          !(i === 0 && _ === "") && !(i === arr.length - 1 && _ === ""),
      );
  }

  private isTableSeparator(line: string): boolean {
    return (
      /^\|[\s|\-:]+\|$/.test(line.trim()) ||
      /^[\-:]+(\|[\-:\s]*)+$/.test(line.trim())
    );
  }
}
