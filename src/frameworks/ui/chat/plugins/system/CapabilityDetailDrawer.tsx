"use client";

import * as Dialog from "@radix-ui/react-dialog";

import type { ReactNode } from "react";

export interface CapabilityDetailDrawerSection {
  title: string;
  content: ReactNode;
}

export interface CapabilityDetailDrawerProps {
  triggerLabel?: string;
  title: string;
  subtitle?: string | null;
  summary?: string | null;
  sections: CapabilityDetailDrawerSection[];
}

function isRenderableContent(content: ReactNode): boolean {
  if (content == null || content === false) {
    return false;
  }

  if (typeof content === "string") {
    return content.trim().length > 0;
  }

  return true;
}

export function CapabilityDetailDrawer({
  triggerLabel = "View details",
  title,
  subtitle,
  summary,
  sections,
}: CapabilityDetailDrawerProps) {
  const visibleSections = sections.filter((section) => isRenderableContent(section.content));

  if (visibleSections.length === 0) {
    return null;
  }

  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button type="button" className="ui-capability-detail-drawer-trigger focus-ring">
          {triggerLabel}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="ui-capability-detail-drawer-overlay" />
        <Dialog.Content className="ui-capability-detail-drawer-content">
          <div className="ui-capability-detail-drawer-chrome">
            <div className="ui-capability-detail-drawer-header">
              <Dialog.Title className="ui-capability-detail-drawer-title">{title}</Dialog.Title>
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="ui-capability-detail-drawer-close focus-ring"
                  aria-label="Close details"
                >
                  Close
                </button>
              </Dialog.Close>
            </div>
            {subtitle ? <p className="ui-capability-detail-drawer-subtitle">{subtitle}</p> : null}
            <Dialog.Description className={summary ? "ui-capability-detail-drawer-summary" : "sr-only"}>
              {summary ?? `${title} details`}
            </Dialog.Description>

            <div className="ui-capability-detail-drawer-body" data-capability-detail-drawer="true">
              {visibleSections.map((section) => (
                <section key={section.title} className="ui-capability-detail-drawer-section">
                  <h4 className="ui-capability-detail-drawer-section-title">{section.title}</h4>
                  <div className="ui-capability-detail-drawer-section-content">{section.content}</div>
                </section>
              ))}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
