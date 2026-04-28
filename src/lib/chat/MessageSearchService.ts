import type { BlockNode, InlineNode, RichContent } from "@/core/entities/rich-content";
import type { PresentedMessage } from "@/adapters/ChatPresenter";

export function extractInlineText(nodes: InlineNode[]): string {
  return nodes
    .map((node) => {
      switch (node.type) {
        case "text":
        case "code-inline":
          return node.text;
        case "bold":
          return extractInlineText(node.content);
        case "library-link":
          return node.slug.replace(/-/g, " ");
        case "action-link":
          return node.label;
        default:
          return "";
      }
    })
    .join(" ");
}

export function extractBlockText(block: BlockNode): string {
  switch (block.type) {
    case "paragraph":
    case "heading":
    case "blockquote":
      return extractInlineText(block.content);
    case "list":
      return block.items.map((item) => extractInlineText(item)).join(" ");
    case "table":
      return [
        ...(block.header ?? []).map((cell) => extractInlineText(cell)),
        ...block.rows.flat().map((cell) => extractInlineText(cell)),
      ].join(" ");
    case "audio":
      return `${block.title} ${block.text}`;
    case "operator-brief":
      return block.sections
        .map((section) => `${section.label} ${extractInlineText(section.summary)} ${(section.items ?? []).map((item) => extractInlineText(item)).join(" ")}`)
        .join(" ");
    case "job-status":
      return `${block.label} ${block.status} ${block.progressLabel ?? ""} ${block.summary ?? ""} ${block.error ?? ""} ${(block.actions ?? []).map((action) => extractInlineText([action])).join(" ")}`.trim();
    case "code-block":
      return block.code;
    case "divider":
      return "";
    default:
      return "";
  }
}

export function extractRichContentText(content: RichContent): string {
  return content.blocks.map((block) => extractBlockText(block)).join(" ").trim();
}

const searchableMessageTextCache = new WeakMap<PresentedMessage, string>();

export function getSearchableMessageText(message: PresentedMessage): string {
  const cached = searchableMessageTextCache.get(message);
  if (cached) {
    return cached;
  }

  const searchableText = `${message.rawContent} ${extractRichContentText(message.content)}`.toLowerCase();
  searchableMessageTextCache.set(message, searchableText);
  return searchableText;
}
