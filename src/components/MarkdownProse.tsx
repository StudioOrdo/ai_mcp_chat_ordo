import { Children, isValidElement, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import {
  JournalArticleFigure,
  JournalPullQuote,
  JournalSideNote,
} from "@/components/journal/JournalLayout";

interface MarkdownProseProps {
  content: string;
  className?: string;
  variant?: "default" | "journal";
}

function isStandaloneBlockChild(children: ReactNode): boolean {
  const childArray = Children.toArray(children);

  return childArray.length === 1
    && isValidElement(childArray[0])
    && (typeof childArray[0].type !== "string" || childArray[0].type === "figure");
}

function flattenChildrenText(children: ReactNode): string {
  return Children.toArray(children)
    .map((child) => {
      if (typeof child === "string") {
        return child;
      }

      if (typeof child === "number") {
        return String(child);
      }

      if (isValidElement<{ children?: ReactNode }>(child)) {
        return flattenChildrenText(child.props.children);
      }

      return "";
    })
    .join("")
    .trim();
}

function parseDirective(text: string) {
  const normalized = text.trim();
  const pullQuoteMatch = normalized.match(/^(?:\[!pullquote\]|pull\s*quote:)\s*/i);
  const sideNoteMatch = normalized.match(/^(?:\[!sidenote\]|\[!side-note\]|side\s*note:)\s*/i);

  if (pullQuoteMatch) {
    return {
      kind: "pullquote" as const,
      content: normalized.slice(pullQuoteMatch[0].length).trim(),
    };
  }

  if (sideNoteMatch) {
    return {
      kind: "sidenote" as const,
      content: normalized.slice(sideNoteMatch[0].length).trim(),
    };
  }

  return null;
}

function parseFigureTitle(title: string | null | undefined) {
  if (!title) {
    return { caption: undefined, variant: "wide" as const };
  }

  const [head, ...tail] = title.split("|");
  const variantMatch = head.trim().match(/^variant\s*=\s*(wide|inset|compact)$/i);

  if (!variantMatch) {
    return { caption: title, variant: "wide" as const };
  }

  return {
    caption: tail.join("|").trim() || undefined,
    variant: variantMatch[1].toLowerCase() as "wide" | "inset" | "compact",
  };
}

export function MarkdownProse({
  content,
  className = "library-prose",
  variant = "default",
}: MarkdownProseProps) {
  const resolvedClassName = variant === "journal"
    ? `${className} journal-prose`.trim()
    : className;

  return (
    <div className={resolvedClassName}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          h1: ({ node: _node, ...props }) => <h1 {...props} />,
          h2: ({ node: _node, ...props }) => <h2 {...props} />,
          h3: ({ node: _node, ...props }) => <h3 {...props} />,
          p: ({ node: _node, children, ...props }) => {
            if (isStandaloneBlockChild(children)) {
              if (variant === "journal") {
                return <div className="my-(--space-8)">{children}</div>;
              }

              return <>{children}</>;
            }

            return <p {...props}>{children}</p>;
          },
          a: ({ node: _node, ...props }) => <a {...props} />,
          ul: ({ node: _node, ...props }) => <ul {...props} />,
          ol: ({ node: _node, ...props }) => <ol {...props} />,
          li: ({ node: _node, ...props }) => <li {...props} />,
          blockquote: ({ node: _node, children, ...props }) => {
            if (variant === "journal") {
              const text = flattenChildrenText(children);
              const directive = parseDirective(text);

              if (directive?.kind === "pullquote") {
                return <JournalPullQuote>{directive.content}</JournalPullQuote>;
              }

              if (directive?.kind === "sidenote") {
                return <JournalSideNote>{directive.content}</JournalSideNote>;
              }

              return <blockquote className="my-(--space-8) border-l border-foreground/16 pl-(--space-inset-panel) text-[1.08rem] italic leading-8 text-foreground/70" {...props}>{children}</blockquote>;
            }

            return <blockquote {...props}>{children}</blockquote>;
          },
          hr: ({ node: _node, ...props }) => <hr {...props} />,
          img: ({ node: _node, alt, title, ...props }) => (
            variant === "journal" && typeof props.src === "string" ? (
              <JournalArticleFigure
                src={props.src}
                alt={alt || ""}
                width={1200}
                height={750}
                caption={parseFigureTitle(title).caption}
                variant={parseFigureTitle(title).variant}
              />
            ) : (
              <figure>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt={alt || ""} title={title} {...props} />
                {(title || alt) && <figcaption>{title || alt}</figcaption>}
              </figure>
            )
          ),
          pre: ({ node: _node, ...props }) => (
            <pre className="code-chrome" {...props} />
          ),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          code: ({ node: _node, inline, ...props }: any) =>
            inline ? <code {...props} /> : <code className="font-mono" {...props} />,
          table: ({ node: _node, ...props }) => (
            <div className={variant === "journal" ? "my-(--space-8) overflow-x-auto rounded-[1.25rem] border border-foreground/10" : "overflow-x-auto"}>
              <table {...props} />
            </div>
          ),
          th: ({ node: _node, ...props }) => <th {...props} />,
          td: ({ node: _node, ...props }) => <td {...props} />,
          script: () => null,
          style: () => null,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
