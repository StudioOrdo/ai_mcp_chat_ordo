"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useChatSurfaceState } from "./useChatSurfaceState";
import { ChatContentSurface } from "./ChatContentSurface";
import { ChatSurfaceHeader } from "./ChatSurfaceHeader";
import { FloatingChatFrame } from "./FloatingChatFrame";
import { FloatingChatLauncher } from "./FloatingChatLauncher";
import { OPEN_GLOBAL_CHAT_EVENT } from "@/lib/chat/chat-events";
import { useViewTransitionReady } from "@/hooks/useViewTransitionReady";

export type ChatSurfaceMode = "embedded" | "floating";

const EMBEDDED_CONTAINER_CLASSES =
  "relative grid h-full min-h-0 flex-1 grid-rows-[minmax(0,1fr)] bg-background";

type ConversationPreviewItem = {
  id: string;
  name: string;
  subtitle: string;
  meta: string;
  initials: string;
  stateLabel: string;
};

const PERSON_TRANSFER_PLACEHOLDER_ROWS: readonly ConversationPreviewItem[] = [
  {
    id: "placeholder-person-transfer",
    name: "Person transfer slot",
    subtitle: "Reserved for a future human conversation",
    meta: "Placeholder - no messages",
    initials: "P",
    stateLabel: "Not live",
  },
  {
    id: "placeholder-follow-up",
    name: "Follow-up thread slot",
    subtitle: "Reserved for a future owner follow-up",
    meta: "Placeholder - no unread activity",
    initials: "F",
    stateLabel: "Not live",
  },
  {
    id: "placeholder-customer-thread",
    name: "Customer thread slot",
    subtitle: "Reserved for a future customer conversation",
    meta: "Placeholder - no customer data",
    initials: "C",
    stateLabel: "Not live",
  },
] as const;

function ConversationAvatar({ initials, active = false }: { initials: string; active?: boolean }) {
  return (
    <span
      className="chat-conversation-avatar"
      data-chat-conversation-avatar-active={active ? "true" : undefined}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}

function ConversationSelectorColumn({
  conversationId,
  currentConversationTitle,
}: {
  conversationId: string | null;
  currentConversationTitle: string | null;
}) {
  const activeTitle = currentConversationTitle?.trim() || "Current Ordo chat";
  const activeMeta = conversationId ? "Live" : "Ready";

  return (
    <aside
      className="chat-conversation-selector-column"
      data-chat-conversation-selector-column="true"
      aria-label="Conversations"
    >
      <div className="chat-conversation-selector-copy">
        <p className="shell-micro-text">Conversations</p>
        <p>
          Ordo is active now. Future person transfer slots are visible but not
          live yet.
        </p>
      </div>

      <div className="chat-conversation-search-row">
        <label className="sr-only" htmlFor="chat-conversation-search">
          Search conversations
        </label>
        <input
          id="chat-conversation-search"
          className="chat-conversation-search focus-ring"
          type="search"
          placeholder="Search conversations..."
          readOnly
          aria-describedby="chat-conversation-search-note"
        />
        <button
          type="button"
          className="chat-conversation-filter-button focus-ring"
          aria-label="Conversation filters coming later"
          disabled
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M4 7h10" />
            <path d="M18 7h2" />
            <path d="M15 5v4" />
            <path d="M4 17h2" />
            <path d="M10 17h10" />
            <path d="M7 15v4" />
          </svg>
        </button>
      </div>
      <p id="chat-conversation-search-note" className="sr-only">
        Conversation search is visible now and will become active when people
        transfer conversations are available.
      </p>

      <div className="chat-conversation-list" role="list" aria-label="Conversation list">
        <Link
          href="/"
          className="chat-conversation-row chat-conversation-row-active focus-ring"
          aria-current="page"
          data-chat-conversation-row="ordo"
        >
          <ConversationAvatar initials="O" active />
          <span className="chat-conversation-row-body">
            <span className="chat-conversation-row-topline">
              <span className="chat-conversation-row-title">Ordo</span>
              <span className="chat-conversation-row-state">{activeMeta}</span>
            </span>
            <span className="chat-conversation-row-subtitle">{activeTitle}</span>
            <span className="chat-conversation-row-meta">Agent conversation</span>
          </span>
        </Link>

        {PERSON_TRANSFER_PLACEHOLDER_ROWS.map((item) => (
          <button
            key={item.id}
            type="button"
            className="chat-conversation-row chat-conversation-row-disabled"
            disabled
            aria-disabled="true"
            data-chat-conversation-row={item.id}
          >
            <ConversationAvatar initials={item.initials} />
            <span className="chat-conversation-row-body">
              <span className="chat-conversation-row-topline">
                <span className="chat-conversation-row-title">{item.name}</span>
                <span className="chat-conversation-row-state">{item.stateLabel}</span>
              </span>
              <span className="chat-conversation-row-subtitle">{item.subtitle}</span>
              <span className="chat-conversation-row-meta">{item.meta}</span>
            </span>
          </button>
        ))}
      </div>
    </aside>
  );
}

export function ChatSurface({
  mode,
  showConversationSelector = false,
}: {
  mode: ChatSurfaceMode;
  showConversationSelector?: boolean;
}) {
  const pathname = usePathname();
  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");
  const routeTone = pathname === "/feed"
    || pathname.startsWith("/feed/")
    ? "quiet"
    : "default";

  if (mode === "floating" && pathname === "/") return null;
  if (mode === "floating" && isAdminRoute) return null;

  if (mode === "embedded") {
    return <EmbeddedSurface showConversationSelector={showConversationSelector} />;
  }

  return <FloatingSurface routeTone={routeTone} />;
}

function EmbeddedSurface({ showConversationSelector }: { showConversationSelector: boolean }) {
  const surfaceState = useChatSurfaceState({ isEmbedded: true });
  const canUseViewTransitions = useViewTransitionReady();

  const sectionStyle: React.CSSProperties = {};
  if (canUseViewTransitions) {
    sectionStyle.viewTransitionName = "chat-container";
  }

  return (
    <section
      className={`${EMBEDDED_CONTAINER_CLASSES} ${showConversationSelector ? "chat-conversation-shell" : ""}`}
      style={sectionStyle}
      data-chat-container-mode="embedded"
      data-chat-layout="message-composer"
      data-chat-conversation-selector={showConversationSelector ? "true" : undefined}
    >
      {showConversationSelector ? (
        <ConversationSelectorColumn
          conversationId={surfaceState.conversationId}
          currentConversationTitle={surfaceState.currentConversation?.title ?? null}
        />
      ) : null}

      <div className="chat-conversation-main" data-chat-conversation-main="true">
        <ChatContentSurface
          {...surfaceState.contentProps}
          isEmbedded={true}
          isFullScreen={false}
        />
      </div>
    </section>
  );
}

function FloatingSurface({ routeTone }: { routeTone: "default" | "quiet" }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const surfaceState = useChatSurfaceState({ isEmbedded: false });
  const canUseViewTransitions = useViewTransitionReady();

  const handleMinimize = useCallback(() => {
    setIsOpen(false);
    setIsFullScreen(false);
  }, []);

  const handleFullScreenToggle = useCallback(() => {
    setIsFullScreen((prev) => !prev);
  }, []);

  useEffect(() => {
    const handler = () => setIsOpen(true);
    window.addEventListener(OPEN_GLOBAL_CHAT_EVENT, handler);
    return () => window.removeEventListener(OPEN_GLOBAL_CHAT_EVENT, handler);
  }, []);

  if (!isOpen) {
    return <FloatingChatLauncher onOpen={() => setIsOpen(true)} routeTone={routeTone} />;
  }

  return (
    <FloatingChatFrame
      canUseViewTransitions={canUseViewTransitions}
      isFullScreen={isFullScreen}
      routeTone={routeTone}
    >
      <ChatSurfaceHeader
        mode="floating"
        isFullScreen={isFullScreen}
        {...surfaceState.headerProps}
        onMinimize={handleMinimize}
        onFullScreenToggle={handleFullScreenToggle}
      />
      <ChatContentSurface
        {...surfaceState.contentProps}
        isEmbedded={false}
        isFullScreen={isFullScreen}
      />
    </FloatingChatFrame>
  );
}
