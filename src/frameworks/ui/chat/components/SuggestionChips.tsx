import React from "react";

export const SuggestionChips: React.FC<{
  suggestions: string[];
  onSend: (text: string) => void;
  disabled?: boolean;
  centered?: boolean;
  label?: string;
}> = ({ suggestions, onSend, disabled = false, centered = false, label }) => (
      <div className={`flex flex-col ${centered ? "gap-(--hero-suggestion-stack-gap) items-center" : "gap-(--space-stack-tight) items-start"}`}>
    {label ? (
      <p className={`theme-label tier-micro font-medium text-foreground/20 ${centered ? "text-center" : "ps-(--space-stack-tight)"}`}>
        {label}
      </p>
    ) : null}
    <div
      className={centered
        ? "ui-chat-hero-suggestion-frame w-full rounded-(--hero-suggestion-frame-radius) max-w-(--hero-suggestion-max-width)"
        : "ui-chat-followup-frame w-full max-w-[min(38rem,100%)] rounded-[1.45rem]"
      }
      data-chat-suggestion-group={centered ? "hero" : "followup"}
      data-chat-suggestion-priority={centered ? "balanced" : "promoted"}
      data-chat-suggestion-count={suggestions.length > 3 ? "dense" : "balanced"}
    >
      <div
        className={`flex flex-wrap ${centered ? "gap-x-(--hero-chip-cluster-gap) gap-y-(--hero-suggestion-row-gap) justify-center" : "gap-x-(--space-stack-tight) gap-y-(--space-stack-tight) justify-start"}`}
        data-chat-suggestion-list={centered ? "hero" : "followup"}
      >
      {suggestions.map((s, i) => (
        <button
          key={s}
          type="button"
          disabled={disabled}
          onClick={() => onSend(s)}
          aria-label={s}
          style={{ animationDelay: `${i * 100}ms` }}
          data-chat-suggestion-rank={centered ? "neutral" : i === 0 ? "primary" : "secondary"}
          className={centered
            ? `ui-chat-hero-chip group theme-body relative inline-flex min-h-(--hero-suggestion-chip-height) items-center justify-center gap-(--space-2) rounded-full px-(--hero-suggestion-chip-padding-inline) py-(--hero-suggestion-chip-padding-block) text-[0.88rem] font-medium tracking-[-0.018em] transition-all duration-200 animate-in fade-in slide-in-from-bottom-2 fill-mode-both focus-ring ${disabled ? "cursor-wait opacity-55" : "hover:border-foreground/10 hover:bg-background hover:text-foreground active:scale-[0.995]"}`
            : `ui-chat-followup-chip group theme-body relative inline-flex min-h-(--chat-followup-chip-height) items-center justify-center gap-(--space-2) rounded-full px-(--chat-followup-chip-padding-inline) py-(--chat-followup-chip-padding-block) text-[0.8rem] font-semibold tracking-[-0.012em] transition-all duration-200 animate-in fade-in slide-in-from-bottom-2 fill-mode-both focus-ring ${disabled ? "cursor-wait opacity-55" : "hover:border-foreground/14 hover:text-foreground hover:shadow-[0_14px_24px_-18px_color-mix(in_srgb,var(--shadow-base)_28%,transparent)] active:scale-[0.99]"}`}
        >
          <span className="relative">{s}</span>
        </button>
      ))}
      </div>
    </div>
  </div>
);
