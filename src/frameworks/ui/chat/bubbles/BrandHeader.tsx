import React from "react";
import { useHeroProofPoints } from "@/hooks/chat/useHeroProofPoints";

const HERO_PROOF_POINTS = [
  {
    title: "Conversation-first",
    body: "Start with chat. Jobs, publishing, and tools surface only when the work calls for them.",
  },
  {
    title: "Governed for solopreneurs",
    body: "Tier and role shape every surface, so premium content and admin tools stay cleanly separated.",
  },
  {
    title: "Lifecycle-aware",
    body: "Install, onboarding, and tier changes render inline as lifecycle cards so progress stays visible.",
  },
] as const;

export const BrandHeader = ({ isEmbedded = false, serviceChips, heroHeading, heroSubheading }: { isEmbedded?: boolean; serviceChips: readonly string[]; heroHeading: string; heroSubheading: string }) => {
  const corpusProofPoints = useHeroProofPoints();
  const proofPoints = corpusProofPoints && corpusProofPoints.length > 0
    ? corpusProofPoints.map((point) => ({ title: point.title, body: point.body }))
    : HERO_PROOF_POINTS;

  return (
  <div
    className={`mx-auto flex w-full max-w-4xl flex-col items-center justify-center px-(--space-3) text-center animate-in fade-in slide-in-from-top-4 duration-700 ease-out fill-mode-both sm:px-(--space-4) ${isEmbedded ? "pb-(--hero-intro-stack-gap) space-y-(--hero-intro-stack-gap)" : "pt-(--phi-1) pb-(--hero-intro-stack-gap) space-y-(--hero-intro-stack-gap)"}`}
    data-homepage-chat-intro="true"
    data-homepage-proof-source={corpusProofPoints && corpusProofPoints.length > 0 ? "corpus" : "fallback"}
  >
    <div className="ui-chat-brand-chip-cluster flex flex-wrap items-center justify-center gap-x-(--hero-badge-gap) gap-y-(--phi-2) rounded-full px-(--hero-badge-padding-inline) py-(--hero-badge-padding-block) text-[0.66rem] font-medium uppercase tracking-[0.18em] text-foreground/56">
      {serviceChips.map((chip, index) => (
        <React.Fragment key={chip}>
          {index > 0 ? (
            <span aria-hidden="true" className="hidden text-foreground/20 sm:inline">
              /
            </span>
          ) : null}
          <span data-homepage-service-chip="true">{chip}</span>
        </React.Fragment>
      ))}
    </div>

    <h2
      className="theme-body text-foreground balance font-semibold"
      style={{
        maxWidth: "var(--hero-title-max-width)",
        fontSize: "var(--hero-title-font-size)",
        lineHeight: "var(--hero-title-line-height)",
        letterSpacing: "var(--tier-display-tracking)",
      }}
    >
      {heroHeading}
    </h2>

    <p
      className="theme-body text-foreground/64"
      style={{
        maxWidth: "var(--hero-greeting-max-width)",
        fontSize: "var(--hero-body-font-size)",
        lineHeight: "var(--hero-body-line-height)",
      }}
    >
      {heroSubheading}
    </p>

    <div
      className="grid w-full max-w-5xl gap-3 pt-(--phi-2) text-left sm:grid-cols-3"
      data-homepage-proof-strip="true"
    >
      {proofPoints.map((item) => (
        <div
          key={item.title}
          className="rounded-3xl border border-foreground/10 bg-background/75 px-4 py-4 shadow-[0_18px_50px_-32px_rgba(15,23,42,0.28)] backdrop-blur-sm"
          data-homepage-proof-card="true"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-foreground/46">
            {item.title}
          </p>
          <p className="mt-2 text-sm leading-6 text-foreground/74">
            {item.body}
          </p>
        </div>
      ))}
    </div>
  </div>
  );
};
