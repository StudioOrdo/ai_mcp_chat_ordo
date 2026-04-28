import type { UICommand } from "@/core/entities/ui-command";
import { UI_COMMAND_TYPE } from "@/core/entities/ui-command";
import { getSupportedTheme } from "@/lib/theme/theme-manifest";

export const TOOL_NAMES = {
  SET_THEME: "set_theme",
  NAVIGATE: "navigate",
  NAVIGATE_TO_PAGE: "navigate_to_page",
  ADJUST_UI: "adjust_ui",
  PREPARE_JOURNAL_POST_FOR_PUBLISH: "prepare_journal_post_for_publish",
} as const;

export type ToolCallWithResult = {
  name: string;
  args: Record<string, unknown>;
  result?: unknown;
};

export type NavigateToPageResultPayload = {
  path: string;
  label: string | null;
  description: string | null;
  __actions__: Array<{ type: "navigate"; path: string }>;
};

export function isNavigateToPageResultPayload(value: unknown): value is NavigateToPageResultPayload {
  return typeof value === "object"
    && value !== null
    && typeof (value as { path?: unknown }).path === "string"
    && Array.isArray((value as { __actions__?: unknown }).__actions__);
}

export function sanitizeUiAdjustmentSettings(args: Record<string, unknown>): Record<string, unknown> {
  if (!("theme" in args)) {
    return args;
  }

  const theme = getSupportedTheme(args.theme as string);
  if (theme) {
    return {
      ...args,
      theme,
    };
  }

  const { theme: _theme, ...rest } = args;
  return rest;
}

export type ToolCommandResolver = (call: ToolCallWithResult) => UICommand | null;

export const TOOL_COMMAND_RESOLVERS: Partial<Record<string, ToolCommandResolver>> = {
  [TOOL_NAMES.SET_THEME]: (call) => {
    const validTheme = getSupportedTheme(call.args.theme as string);
    if (!validTheme) {
      return null;
    }

    return {
      type: UI_COMMAND_TYPE.SET_THEME,
      theme: validTheme,
    };
  },
  [TOOL_NAMES.NAVIGATE]: (call) => ({
    type: UI_COMMAND_TYPE.NAVIGATE,
    path: call.args.path as string,
  }),
  [TOOL_NAMES.NAVIGATE_TO_PAGE]: (call) => {
    if (!isNavigateToPageResultPayload(call.result)) {
      return null;
    }

    return {
      type: UI_COMMAND_TYPE.NAVIGATE,
      path: call.result.path,
    };
  },
  [TOOL_NAMES.ADJUST_UI]: (call) => ({
    type: UI_COMMAND_TYPE.ADJUST_UI,
    settings: sanitizeUiAdjustmentSettings(call.args as Record<string, unknown>),
  }),
};

export function resolveToolCommand(call: ToolCallWithResult): UICommand | null {
  return TOOL_COMMAND_RESOLVERS[call.name]?.(call) ?? null;
}

export function shouldPreserveToolRenderEntry(call: ToolCallWithResult): boolean {
  return (
    call.result !== undefined
    && (call.name === TOOL_NAMES.SET_THEME || call.name === TOOL_NAMES.ADJUST_UI)
  );
}
