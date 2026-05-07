import {
  SUPPORTED_COLOR_BLIND_MODES,
  SUPPORTED_DENSITY_LEVELS,
  SUPPORTED_FONT_SIZES,
  SUPPORTED_SPACING_LEVELS,
  SUPPORTED_THEME_IDS,
  SUPPORTED_UI_PRESET_IDS,
} from "@/lib/theme/theme-manifest";
import type { CapabilityDefinition } from "../capability-definition";
import { CATALOG_INPUT_SCHEMAS } from "../catalog-input-schemas";
import { SIGNED_IN_ROLES } from "./shared";

const SUPPORTED_PREFERENCE_KEYS = [
  "response_style",
  "tone",
  "business_context",
  "preferred_name",
] as const;

export const THEME_CAPABILITIES = {
  set_theme: {
    core: {
      name: "set_theme",
      label: "Set Theme",
      description: "Change site aesthetic era.",
      category: "ui",
      roles: "ALL",
    },
    schema: {
      inputSchema: {
        type: "object",
        properties: {
          theme: { type: "string", enum: [...SUPPORTED_THEME_IDS] },
        },
        required: ["theme"],
      },
      outputHint: "Returns a confirmation that the theme request was accepted.",
    },
    executorBinding: {
      bundleId: "theme",
      executorId: "set_theme",
      executionSurface: "internal",
    },
    validationBinding: {
      validatorId: "set_theme",
      mode: "parse",
    },
    runtime: {},
    presentation: {
      family: "theme",
      cardKind: "theme_inspection",
      executionMode: "inline",
    },
  },

  inspect_theme: {
    core: {
      name: "inspect_theme",
      label: "Inspect Theme",
      description:
        "Inspect the active theme configuration and return machine-readable design tokens.",
      category: "ui",
      roles: "ALL",
    },
    schema: {
      inputSchema: CATALOG_INPUT_SCHEMAS.inspect_theme,
      outputHint: "Returns active theme configuration with design tokens",
    },
    runtime: {},
    promptExposure: {
      exposure: "intent_gated",
      rationale: "Theme inspection is useful for UI customization requests but noisy in the default prompt.",
    },
    executorBinding: {
      bundleId: "theme",
      executorId: "inspect_theme",
      executionSurface: "internal",
    },
    validationBinding: {
      validatorId: "inspect_theme",
      mode: "parse",
    },
    presentation: {
      family: "theme",
      cardKind: "theme_inspection",
      executionMode: "inline",
    },
  },

  adjust_ui: {
    core: {
      name: "adjust_ui",
      label: "Adjust UI",
      description:
        "Adjust the UI appearance for accessibility, comfort, or user preference. Supports named presets and individual property overrides.",
      category: "ui",
      roles: "ALL",
    },
    schema: {
      inputSchema: {
        type: "object",
        properties: {
          preset: { type: "string", enum: [...SUPPORTED_UI_PRESET_IDS], description: "Apply a curated preset. Overrides individual settings." },
          fontSize: { type: "string", enum: [...SUPPORTED_FONT_SIZES], description: "Base font size." },
          lineHeight: { type: "string", enum: [...SUPPORTED_SPACING_LEVELS], description: "Line spacing." },
          letterSpacing: { type: "string", enum: [...SUPPORTED_SPACING_LEVELS], description: "Letter spacing." },
          density: { type: "string", enum: [...SUPPORTED_DENSITY_LEVELS], description: "UI density — affects padding and gaps." },
          dark: { type: "boolean", description: "Enable or disable dark mode." },
          theme: { type: "string", enum: [...SUPPORTED_THEME_IDS], description: "Visual theme era." },
          colorBlindMode: { type: "string", enum: [...SUPPORTED_COLOR_BLIND_MODES], description: "Color-blind safe palette." },
        },
      },
      outputHint: "Returns a confirmation describing the applied UI adjustments.",
    },
    executorBinding: {
      bundleId: "theme",
      executorId: "adjust_ui",
      executionSurface: "internal",
    },
    validationBinding: {
      validatorId: "adjust_ui",
      mode: "parse",
    },
    runtime: {},
    promptExposure: {
      exposure: "intent_gated",
      rationale: "Broad UI adjustments should be exposed only for explicit UI customization intent.",
    },
    presentation: {
      family: "theme",
      cardKind: "theme_inspection",
      executionMode: "inline",
    },
  },

  set_preference: {
    core: {
      name: "set_preference",
      label: "Set Preference",
      description:
        "Create or update a user preference key-value pair persisted to the user's profile.",
      category: "system",
      roles: [...SIGNED_IN_ROLES],
    },
    schema: {
      inputSchema: {
        type: "object",
        properties: {
          key: { type: "string", enum: [...SUPPORTED_PREFERENCE_KEYS], description: "Preference key to set." },
          value: {
            type: "string",
            description: "Preference value. For response_style: concise|detailed|bullets. For tone: professional|casual|friendly. For business_context: free text. For preferred_name: free text.",
          },
        },
        required: ["key", "value"],
      },
      outputHint: "Returns confirmation of preference update",
    },
    executorBinding: {
      bundleId: "theme",
      executorId: "set_preference",
      executionSurface: "internal",
    },
    validationBinding: {
      validatorId: "set_preference",
      mode: "parse",
    },
    runtime: {},
    presentation: {
      family: "profile",
      cardKind: "profile_summary",
      executionMode: "inline",
    },
  },
} as const satisfies Record<string, CapabilityDefinition>;
