import React from "react";

export const TypingIndicator = () => (
  <div className="ui-chat-typing-indicator mt-(--space-stack-tight) flex items-center justify-start gap-(--space-cluster-default) ms-(--chat-message-indent)">
    <div className="flex items-center gap-(--space-2) px-(--space-inset-compact) py-(--space-2)">
      <span className="w-(--space-2) h-(--space-2) rounded-full bg-accent opacity-60 animate-bounce [animation-delay:0ms]" />
      <span className="w-(--space-2) h-(--space-2) rounded-full bg-accent opacity-60 animate-bounce [animation-delay:120ms]" />
      <span className="w-(--space-2) h-(--space-2) rounded-full bg-accent opacity-60 animate-bounce [animation-delay:240ms]" />
    </div>
  </div>
);
