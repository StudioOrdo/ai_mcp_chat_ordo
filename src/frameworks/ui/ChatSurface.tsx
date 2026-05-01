"use client";

import React, { useState, useEffect, useCallback } from "react";
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

export function ChatSurface({ mode }: { mode: ChatSurfaceMode }) {
  const pathname = usePathname();
  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");
  const routeTone = pathname === "/journal"
    || pathname.startsWith("/journal/")
    || pathname === "/blog"
    || pathname.startsWith("/blog/")
    ? "quiet"
    : "default";

  if (mode === "floating" && pathname === "/") return null;
  if (mode === "floating" && isAdminRoute) return null;

  if (mode === "embedded") return <EmbeddedSurface />;

  return <FloatingSurface routeTone={routeTone} />;
}

function EmbeddedSurface() {
  const surfaceState = useChatSurfaceState({ isEmbedded: true });
  const canUseViewTransitions = useViewTransitionReady();

  const sectionStyle: React.CSSProperties = {};
  if (canUseViewTransitions) {
    sectionStyle.viewTransitionName = "chat-container";
  }

  return (
    <section
      className={EMBEDDED_CONTAINER_CLASSES}
      style={sectionStyle}
      data-chat-container-mode="embedded"
      data-chat-layout="message-composer"
    >
      <ChatContentSurface
        {...surfaceState.contentProps}
        isEmbedded={true}
        isFullScreen={false}
      />
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
