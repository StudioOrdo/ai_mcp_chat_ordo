/**
 * Config type definitions and hardcoded fallback values.
 * When config files are absent, the system uses these defaults —
 * identical behavior to before Sprint 0.
 */

import type { RoleName } from "@/core/entities/user";

// ── Type definitions ────────────────────────────────────────────────

export interface InstanceIdentity {
  name: string;
  shortName: string;
  tagline: string;
  description: string;
  domain: string;
  linkedInUrl?: string;
  logoPath: string;
  markText: string;
  accentColor?: string;
  copyright?: string;
  serviceChips?: string[];
  fonts?: {
    body: string;
    display: string;
    mono: string;
  };
  analytics?: {
    plausibleDomain?: string;
    plausibleSrc?: string;
  };
}

export interface InstancePrompts {
  personality?: string;
  heroHeading?: string;
  heroSubheading?: string;
  firstMessage?: {
    default?: string;
    withReferral?: string;
  };
  defaultSuggestions?: string[];
  referralSuggestions?: string[];
  roleBootstraps?: Partial<Record<Exclude<RoleName, "ANONYMOUS">, RoleBootstrapPromptConfig>>;
}

export interface RoleBootstrapPromptConfig {
  message?: string;
  suggestions?: string[];
}

export interface ServiceOffering {
  id: string;
  name: string;
  description: string;
  lane: "organization" | "individual" | "both";
  estimatedPrice?: number;
  estimatedHours?: number;
}

export interface InstanceServices {
  offerings: ServiceOffering[];
  bookingEnabled: boolean;
}

export interface InstanceTools {
  enabled?: string[];
  disabled?: string[];
}

export interface FullInstanceConfig {
  identity: InstanceIdentity;
  prompts: InstancePrompts;
  services: InstanceServices;
  tools: InstanceTools;
}

// ── Default values (extracted from pre-Sprint-0 hardcoded constants) ─

export const DEFAULT_IDENTITY: InstanceIdentity = {
  name: "Studio Ordo",
  shortName: "Ordo",
  tagline: "All-in-One AI Operator System",
  description:
    "A governed all-in-one AI workspace for solopreneurs who want chat, search, workflows, and publishing in one easy-to-host system.",
  domain: "studioordo.com",
  logoPath: "/logo_with_words.png",
  markText: "O",
  copyright: "© 2026 Studio Ordo. All rights reserved.",
  serviceChips: [
    "All-in-One AI Workspace",
    "Local Search + Memory",
    "Deferred AI Workflows",
  ],
  fonts: {
    body: "IBM Plex Sans",
    display: "Fraunces",
    mono: "IBM Plex Mono",
  },
};

export const DEFAULT_PROMPTS: InstancePrompts = {
  heroHeading: "Run the work from one AI workspace.",
  heroSubheading:
    "Studio Ordo gives solopreneurs chat, workflow automation, local search, publishing, and operator control in one easy-to-host system with no separate database, queue, or search server to manage.",
  firstMessage: {
    default:
      "Bring me the messy workflow, half-finished idea, or customer task. I can help you plan the work, search your library, turn it into assets, and keep it moving from one governed workspace.",
    withReferral:
      "Welcome — {{referrer.name}} sent you here for a reason. I can show you how {{brand.name}} helps a solo operator run research, workflows, and publishing from one place.",
  },
  defaultSuggestions: [
    "Plan this workflow",
    "Search my library",
    "Turn this into an asset",
    "What makes this different?",
  ],
  referralSuggestions: [
    "Why is this different?",
    "Show me the library",
    "How do the workflows work?",
    "What unlocks after I register?",
  ],
  roleBootstraps: {
    AUTHENTICATED: {
      message:
        "Welcome back. Bring me the customer workflow, implementation question, or training decision you need help moving forward.",
      suggestions: [
        "Recommend my next step",
        "Review my active workflow",
        "Help me scope this request",
        "Turn this into a training plan",
      ],
    },
    APPRENTICE: {
      message:
        "Welcome back. Bring me your assignment, referral question, or training goal.",
      suggestions: [
        "Check my referral stats",
        "Help me with my assignment",
        "Review my active workflow",
        "Recommend my next step",
      ],
    },
    STAFF: {
      message:
        "What needs attention in the workspace right now? I can help triage service risk, review workflow quality, and prepare the next operational move.",
      suggestions: [
        "Triage service risk",
        "Review routing risk",
        "Summarize the active workflow",
        "Prepare an operator brief",
      ],
    },
    ADMIN: {
      message:
        "Operator console is ready. Bring me the queue, routing risk, or revenue decision that needs founder-level attention right now.",
      suggestions: [
        "Prioritize founder work",
        "Triage service risk",
        "Pick today's offer",
        "Check live market signal",
      ],
    },
  },
};

export const DEFAULT_SERVICES: InstanceServices = {
  offerings: [],
  bookingEnabled: false,
};

export const DEFAULT_TOOLS: InstanceTools = {};

export const DEFAULT_CONFIG: FullInstanceConfig = {
  identity: DEFAULT_IDENTITY,
  prompts: DEFAULT_PROMPTS,
  services: DEFAULT_SERVICES,
  tools: DEFAULT_TOOLS,
};
