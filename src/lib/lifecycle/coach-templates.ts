import type { CoachPayload } from "@/core/entities/coach";
import type { LifecyclePayload, LifecycleVariant } from "@/core/entities/lifecycle";

/**
 * Built-in coach sequences paired with each lifecycle variant. These are
 * the default, honest sequences shipped with the product: they reference
 * real surfaces only (no promised features), and step completion is
 * tracked by the user navigating to those surfaces, not by coach state.
 */

function makePayload(variant: LifecycleVariant): CoachPayload | null {
  switch (variant) {
    case "installed":
      return {
        variant,
        title: "Finish setting up your workspace",
        subtitle: "A few quick steps to make the workspace yours.",
        steps: [
          {
            key: "identity",
            label: "Set your studio identity",
            status: "active",
            detail: "Name, brand, and the voice you want the assistant to use.",
          },
          {
            key: "first-question",
            label: "Ask your first real question",
            status: "pending",
            detail: "Try a question a new client might ask.",
          },
          {
            key: "invite",
            label: "Invite a teammate (optional)",
            status: "pending",
          },
        ],
        currentStep: 0,
        actions: [
          {
            key: "open-settings",
            kind: "navigate",
            label: "Open settings",
            href: "/admin/settings",
          },
        ],
      };

    case "onboarded":
      return {
        variant,
        title: "Welcome back — here's what to try next",
        steps: [
          {
            key: "ask",
            label: "Ask a question grounded in your library",
            status: "active",
          },
          {
            key: "review",
            label: "Review your first conversation",
            status: "pending",
          },
        ],
        currentStep: 0,
        actions: [
          {
            key: "library",
            kind: "navigate",
            label: "Browse library",
            href: "/library",
          },
        ],
      };

    case "role_changed":
      return {
        variant,
        title: "Your role has changed — new surfaces are available",
        subtitle: "Take a quick tour of what's newly accessible.",
        steps: [
          {
            key: "view-access",
            label: "Review what you can access",
            status: "active",
          },
          {
            key: "try-tool",
            label: "Try a tool that your new role unlocks",
            status: "pending",
          },
        ],
        currentStep: 0,
        actions: [
          {
            key: "open-home",
            kind: "navigate",
            label: "Open home",
            href: "/",
          },
        ],
      };

    case "tier_upgraded":
      return {
        variant,
        title: "Premium tier is active",
        subtitle: "Premium-audience material is now visible in search and library.",
        steps: [
          {
            key: "browse-premium",
            label: "Browse premium content",
            status: "active",
          },
          {
            key: "ask-premium",
            label: "Ask a question that draws on premium material",
            status: "pending",
          },
        ],
        currentStep: 0,
        actions: [
          {
            key: "library",
            kind: "navigate",
            label: "Open library",
            href: "/library",
          },
        ],
      };

    case "capability_unlocked":
      // No generic coach for this variant yet; the lifecycle card alone
      // is sufficient until we know which capability to point at.
      return null;

    default: {
      const _exhaustive: never = variant;
      return _exhaustive;
    }
  }
}

export function buildCoachPayloadForLifecycle(
  event: LifecyclePayload,
): CoachPayload | null {
  return makePayload(event.variant);
}
