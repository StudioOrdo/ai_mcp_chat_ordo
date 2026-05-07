import React from "react";
import { CodeBlock } from "./CodeBlock";
import { JobStatusFallbackCard } from "./chat/plugins/system/JobStatusFallbackCard";
import type {
  RichContent,
  BlockNode,
  InlineNode,
  ActionLinkType,
} from "../../core/entities/rich-content";
import dynamic from "next/dynamic";
import { OperationActionButton } from "@/frameworks/ui/operations/OperationActionButton";
import { OperationCard } from "@/frameworks/ui/operations/OperationCard";

const MermaidRenderer = dynamic(
  () =>
    import("../../components/MermaidRenderer").then(
      (mod) => mod.MermaidRenderer,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-40 w-full flex items-center justify-center text-xs opacity-50 animate-pulse bg-surface-muted rounded-theme border-theme my-(--space-2)">
        Loading Diagram Engine...
      </div>
    ),
  },
);

const GraphRenderer = dynamic(
  () => import("../../components/GraphRenderer").then((mod) => mod.GraphRenderer),
  {
    ssr: false,
    loading: () => (
      <div className="h-40 w-full flex items-center justify-center text-xs opacity-50 animate-pulse bg-surface-muted rounded-theme border-theme my-(--space-2)">
        Loading Graph Engine...
      </div>
    ),
  },
);

const AudioPlayer = dynamic(
  () => import("../../components/AudioPlayer").then((mod) => mod.AudioPlayer),
  {
    ssr: false,
    loading: () => (
      <div className="h-18 w-full max-w-sm flex items-center justify-center text-xs opacity-50 animate-pulse bg-surface-muted rounded-theme border-theme my-(--space-2)">
        Loading Audio Engine...
      </div>
    ),
  },
);

interface Props {
  content: RichContent;
  onLinkClick?: (slug: string) => void;
  onActionClick?: (actionType: ActionLinkType, value: string, params?: Record<string, string>) => void;
}

export const RichContentRenderer: React.FC<Props> = ({
  content,
  onLinkClick,
  onActionClick,
}) => {
  return (
    <div className="flex flex-col gap-(--space-stack-default)">
      {content.blocks.map((block, i) => {
        // Use stable keys for stateful blocks so React doesn't remount them
        // when preceding blocks shift indices during streaming.
        let key: string | number = i;
        if (block.type === "audio")
          key = `audio-${block.title}-${block.text.substring(0, 50)}`;
        else if (block.type === "code-block" && block.language === "mermaid")
          key = `mermaid-${block.code.substring(0, 50)}`;
        else if (block.type === "graph")
          key = `graph-${block.graph.kind}-${block.title ?? block.caption ?? i}`;
        return <BlockRenderer key={key} block={block} onLinkClick={onLinkClick} onActionClick={onActionClick} />;
      })}
    </div>
  );
};

type BlockProps<T extends BlockNode> = { block: T; onLinkClick?: (slug: string) => void; onActionClick?: (actionType: ActionLinkType, value: string, params?: Record<string, string>) => void };

const blockRegistry: { [K in BlockNode["type"]]: React.FC<BlockProps<Extract<BlockNode, { type: K }>>> } = {
  paragraph: ({ block, onLinkClick, onActionClick }) => (
    <p className="mb-(--space-stack-tight) last:mb-(--space-0) leading-[inherit]">
      <InlineRenderer nodes={block.content} onLinkClick={onLinkClick} onActionClick={onActionClick} />
    </p>
  ),
  heading: ({ block, onLinkClick, onActionClick }) => {
    const Tag = `h${block.level + 1}` as "h1" | "h2" | "h3" | "h4";
    const sizeClass =
      block.level === 1
        ? "theme-display tier-body text-[1.08em] tracking-[-0.03em]"
        : block.level === 2
          ? "theme-display tier-body text-[1em] tracking-[-0.025em]"
          : "theme-label tier-micro text-foreground/62";
    return (
      <Tag className={`${sizeClass} mt-(--space-stack-default) mb-(--space-stack-tight) font-medium`}>
        <InlineRenderer nodes={block.content} onLinkClick={onLinkClick} onActionClick={onActionClick} />
      </Tag>
    );
  },
  blockquote: ({ block, onLinkClick, onActionClick }) => (
    <blockquote className="my-(--space-stack-default) pl-(--space-inset-default) italic text-foreground/68 leading-[inherit]">
      <InlineRenderer nodes={block.content} onLinkClick={onLinkClick} onActionClick={onActionClick} />
    </blockquote>
  ),
  list: ({ block, onLinkClick, onActionClick }) => (
    <ul className="mb-(--space-stack-default) ml-(--space-6) space-y-(--space-2) list-disc marker:text-accent/58">
      {block.items.map((item, i) => (
        <li key={i} className="leading-relaxed pl-(--space-1)">
          <InlineRenderer nodes={item} onLinkClick={onLinkClick} onActionClick={onActionClick} />
        </li>
      ))}
    </ul>
  ),
  divider: () => <hr className="my-(--space-stack-default) border-border" />,
  "operator-brief": ({ block, onLinkClick, onActionClick }) => (
    <div className="grid gap-(--space-cluster-default) lg:grid-cols-3" data-operator-brief="true">
      {block.sections.map((section) => (
        <section
          key={section.label}
          className="rounded-[1.3rem] border border-border/70 bg-surface-muted/55 px-(--space-inset-default) py-(--space-inset-default) shadow-[0_14px_30px_-24px_color-mix(in_srgb,var(--shadow-base)_12%,transparent)]"
          aria-label={section.label}
        >
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-foreground/42">{section.label}</p>
          <div className="mt-(--space-2) text-sm leading-6 text-foreground">
            <InlineRenderer nodes={section.summary} onLinkClick={onLinkClick} onActionClick={onActionClick} />
          </div>
          {section.items && section.items.length > 0 ? (
            <ul className="mt-(--space-3) space-y-(--space-2) text-sm leading-6 text-foreground/72">
              {section.items.map((item, index) => (
                <li key={`${section.label}-${index}`} className="flex gap-(--space-2)">
                  <span aria-hidden="true" className="mt-(--space-2) h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/28" />
                  <span>
                    <InlineRenderer nodes={item} onLinkClick={onLinkClick} onActionClick={onActionClick} />
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}
    </div>
  ),
  "job-status": ({ block, onActionClick }) => (
    <JobStatusFallbackCard
      part={{
        type: "job_status",
        jobId: block.jobId,
        toolName: block.toolName,
        label: block.label,
        title: block.title,
        subtitle: block.subtitle,
        status: block.status,
        progressPercent: block.progressPercent,
        progressLabel: block.progressLabel,
        summary: block.summary,
        error: block.error,
      }}
      computedActions={block.actions}
      isStreaming={false}
      onActionClick={onActionClick}
    />
  ),
  "operation-card": ({ block, onActionClick }) => (
    <OperationCard operation={block.operation} onActionClick={onActionClick} />
  ),
  "code-block": ({ block }) => {
    if (block.language === "mermaid") {
      return (
        <MermaidRenderer
          code={block.code}
          title={block.title}
          caption={block.caption}
          downloadFileName={block.downloadFileName}
        />
      );
    }
    return <CodeBlock code={block.code} lang={block.language} />;
  },
  graph: ({ block }) => (
    <GraphRenderer
      graph={block.graph}
      title={block.title}
      caption={block.caption}
      summary={block.summary}
      downloadFileName={block.downloadFileName}
      dataPreview={block.dataPreview}
    />
  ),
  table: ({ block, onLinkClick, onActionClick }) => (
    <TableRenderer
      header={block.header}
      rows={block.rows}
      onLinkClick={onLinkClick}
      onActionClick={onActionClick}
    />
  ),
  audio: ({ block }) => (
    <div className="my-(--space-2) max-w-sm">
      <AudioPlayer
        text={block.text}
        title={block.title}
        assetId={block.assetId}
        provider={block.provider}
        generationStatus={block.generationStatus}
        estimatedDurationSeconds={block.estimatedDurationSeconds}
        estimatedGenerationSeconds={block.estimatedGenerationSeconds}
      />
    </div>
  ),
};

const BlockRenderer: React.FC<{
  block: BlockNode;
  onLinkClick?: (slug: string) => void;
  onActionClick?: (actionType: ActionLinkType, value: string, params?: Record<string, string>) => void;
}> = ({ block, onLinkClick, onActionClick }) => {
  const RendererComponent = blockRegistry[block.type] as React.FC<BlockProps<BlockNode>>;
  if (!RendererComponent) return null;
  return <RendererComponent block={block} onLinkClick={onLinkClick} onActionClick={onActionClick} />;
};

type InlineProps<T extends InlineNode> = { node: T; onLinkClick?: (slug: string) => void; onActionClick?: (actionType: ActionLinkType, value: string, params?: Record<string, string>) => void };

const inlineRegistry: { [K in InlineNode["type"]]: React.FC<InlineProps<Extract<InlineNode, { type: K }>>> } = {
  text: ({ node }) => <>{node.text}</>,
  bold: ({ node, onLinkClick, onActionClick }) => (
    <strong>
      <InlineRenderer nodes={node.content} onLinkClick={onLinkClick} onActionClick={onActionClick} />
    </strong>
  ),
  "code-inline": ({ node }) => (
    <code className="bg-surface-muted/72 text-foreground px-(--space-2) py-(--space-inset-tight) rounded-md text-[0.85em] font-mono">
      {node.text}
    </code>
  ),
  "library-link": ({ node, onLinkClick }) => (
    <button
      onClick={() => onLinkClick?.(node.slug)}
      className="link-accent"
    >
      {node.slug.replace(/-/g, " ")}
    </button>
  ),
  "action-link": ({ node, onActionClick }) => {
    if (node.actionType === "operation") {
      return <OperationActionButton action={node} onActionClick={onActionClick} />;
    }

    return (
      <button
        onClick={() => onActionClick?.(node.actionType, node.value, node.params)}
        className="inline-flex items-center gap-(--space-1) font-semibold text-accent-interactive underline decoration-accent-interactive/30 underline-offset-2 transition-colors hover:text-accent-interactive/80 hover:decoration-accent-interactive/50 focus-ring rounded-sm"
        data-chat-action-link={node.actionType}
        aria-label={`${node.label} (${node.actionType})`}
      >
        {node.label}
      </button>
    );
  },
};

const InlineRenderer: React.FC<{
  nodes: InlineNode[];
  onLinkClick?: (slug: string) => void;
  onActionClick?: (actionType: ActionLinkType, value: string, params?: Record<string, string>) => void;
}> = ({ nodes, onLinkClick, onActionClick }) => {
  return (
    <>
      {nodes.map((node, i) => {
        const RendererComponent = inlineRegistry[node.type] as React.FC<InlineProps<InlineNode>>;
        if (!RendererComponent) return null;
        return <RendererComponent key={i} node={node} onLinkClick={onLinkClick} onActionClick={onActionClick} />;
      })}
    </>
  );
};

const TableRenderer: React.FC<{
  header?: InlineNode[][];
  rows: InlineNode[][][];
  onLinkClick?: (slug: string) => void;
  onActionClick?: (actionType: ActionLinkType, value: string, params?: Record<string, string>) => void;
}> = ({ header, rows, onLinkClick, onActionClick }) => {
  return (
    <div className="my-(--space-stack-default) w-full overflow-x-auto border-theme rounded-theme">
      <table className="w-full text-sm border-collapse">
        {header && (
          <thead>
            <tr className="accent-fill">
              {header.map((cell, i) => (
                <th
                  key={i}
                  className="px-(--space-inset-default) py-(--space-inset-compact) text-left font-bold text-xs uppercase tracking-wider"
                >
                  <InlineRenderer nodes={cell} onLinkClick={onLinkClick} onActionClick={onActionClick} />
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {rows.map((row, ri) => (
            <tr
              key={ri}
              className={
                ri % 2 === 0
                  ? "bg-surface hover-surface transition-colors"
                  : "bg-surface-muted hover-surface transition-colors"
              }
            >
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className="px-(--space-inset-default) py-(--space-inset-compact) align-top leading-relaxed border-b border-border"
                >
                  <InlineRenderer nodes={cell} onLinkClick={onLinkClick} onActionClick={onActionClick} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
