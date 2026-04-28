import type { ChatResponseState } from "@/core/entities/chat-message";
import type { ChatMessage } from "@/core/entities/chat-message";

export const SUGGESTIONS_MARKER = "__suggestions__:";
export const ACTIONS_MARKER = "__actions__:";
export const RESPONSE_STATE_MARKER = "__response_state__:";

type TrailingArrayTagMatch = {
  markerIndex: number;
  payload: unknown[];
};

type TrailingStringTagMatch = {
  markerIndex: number;
  payload: string | null;
};

type TrailingControlTagMatch =
  | { kind: "suggestions"; match: TrailingArrayTagMatch }
  | { kind: "actions"; match: TrailingArrayTagMatch }
  | { kind: "responseState"; match: TrailingStringTagMatch };

export type ExtractedControlTags = {
  text: string;
  suggestionsPayload: unknown[];
  actionsPayload: unknown[];
  responseStatePayload: string | null;
};

export function findJsonArrayEnd(input: string, arrayStart: number, endBound: number = input.length): number {
  let depth = 0;
  let inString = false;
  let escaping = false;

  for (let index = arrayStart; index < endBound; index += 1) {
    const character = input[index];

    if (escaping) {
      escaping = false;
      continue;
    }

    if (character === "\\") {
      escaping = true;
      continue;
    }

    if (character === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (character === "[") {
      depth += 1;
      continue;
    }

    if (character === "]") {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

export function findJsonStringEnd(input: string, stringStart: number, endBound: number = input.length): number {
  let escaping = false;

  for (let index = stringStart + 1; index < endBound; index += 1) {
    const character = input[index];

    if (escaping) {
      escaping = false;
      continue;
    }

    if (character === "\\") {
      escaping = true;
      continue;
    }

    if (character === '"') {
      return index;
    }
  }

  return -1;
}

export function extractTrailingTaggedArray(text: string, marker: string, endBound: number = text.length): TrailingArrayTagMatch | null {
  const markerIndex = text.lastIndexOf(marker, endBound);
  if (markerIndex < 0) return null;

  let arrayStart = -1;
  for (let i = markerIndex + marker.length; i < endBound; i++) {
    if (/\S/.test(text[i])) {
      arrayStart = i;
      break;
    }
  }

  if (arrayStart < 0 || text[arrayStart] !== "[") {
    return null;
  }

  const arrayEnd = findJsonArrayEnd(text, arrayStart, endBound);
  if (arrayEnd < 0) {
    return { markerIndex, payload: [] };
  }

  for (let i = arrayEnd + 1; i < endBound; i++) {
    if (/\S/.test(text[i])) return null;
  }

  let payload: unknown[] = [];
  try {
    const parsed = JSON.parse(text.slice(arrayStart, arrayEnd + 1));
    if (Array.isArray(parsed)) payload = parsed;
  } catch {
    payload = [];
  }

  return { markerIndex, payload };
}

export function extractTrailingTaggedString(text: string, marker: string, endBound: number = text.length): TrailingStringTagMatch | null {
  const markerIndex = text.lastIndexOf(marker, endBound);
  if (markerIndex < 0) return null;

  let stringStart = -1;
  for (let i = markerIndex + marker.length; i < endBound; i++) {
    if (/\S/.test(text[i])) {
      stringStart = i;
      break;
    }
  }

  if (stringStart < 0 || text[stringStart] !== '"') {
    return null;
  }

  const stringEnd = findJsonStringEnd(text, stringStart, endBound);
  if (stringEnd < 0) return null;

  for (let i = stringEnd + 1; i < endBound; i++) {
    if (/\S/.test(text[i])) return null;
  }

  let payload: string | null = null;
  try {
    const parsed = JSON.parse(text.slice(stringStart, stringEnd + 1));
    if (typeof parsed === "string") payload = parsed;
  } catch {
    payload = null;
  }

  return { markerIndex, payload };
}

export function extractControlTags(text: string): ExtractedControlTags {
  let currentEndBound = text.length;
  while (currentEndBound > 0 && /\s/.test(text[currentEndBound - 1])) {
    currentEndBound--;
  }

  let suggestionsPayload: unknown[] = [];
  let actionsPayload: unknown[] = [];
  let responseStatePayload: string | null = null;
  let hasSuggestionsTag = false;
  let hasActionsTag = false;
  let hasResponseStateTag = false;

  while (true) {
    const candidates: TrailingControlTagMatch[] = [];

    if (!hasSuggestionsTag) {
      const match = extractTrailingTaggedArray(text, SUGGESTIONS_MARKER, currentEndBound);
      if (match) candidates.push({ kind: "suggestions", match });
    }

    if (!hasActionsTag) {
      const match = extractTrailingTaggedArray(text, ACTIONS_MARKER, currentEndBound);
      if (match) candidates.push({ kind: "actions", match });
    }

    if (!hasResponseStateTag) {
      const match = extractTrailingTaggedString(text, RESPONSE_STATE_MARKER, currentEndBound);
      if (match) candidates.push({ kind: "responseState", match });
    }

    if (candidates.length === 0) break;

    candidates.sort((left, right) => right.match.markerIndex - left.match.markerIndex);
    const [candidate] = candidates;

    currentEndBound = candidate.match.markerIndex;
    while (currentEndBound > 0 && /\s/.test(text[currentEndBound - 1])) {
      currentEndBound--;
    }

    switch (candidate.kind) {
      case "suggestions":
        hasSuggestionsTag = true;
        suggestionsPayload = candidate.match.payload;
        break;
      case "actions":
        hasActionsTag = true;
        actionsPayload = candidate.match.payload;
        break;
      case "responseState":
        hasResponseStateTag = true;
        responseStatePayload = candidate.match.payload;
        break;
    }
  }

  return {
    text: text.slice(0, currentEndBound).trim(),
    suggestionsPayload,
    actionsPayload,
    responseStatePayload,
  };
}

const LOW_VALUE_SUGGESTION_PATTERNS = [
  /^anything else\??$/i,
  /^what else\??$/i,
  /^need (?:anything else|more help)\??$/i,
  /^want (?:more|another)\??$/i,
  /^tell me more\??$/i,
  /^continue\??$/i,
  /^keep going\??$/i,
];

export function normalizeSuggestionKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function isLowValueSuggestion(value: string): boolean {
  return LOW_VALUE_SUGGESTION_PATTERNS.some((pattern) => pattern.test(value));
}

export function normalizeSuggestions(payload: unknown[]): string[] {
  const normalizedSuggestions: string[] = [];
  const seen = new Set<string>();

  for (const entry of payload) {
    if (typeof entry !== "string") continue;

    const candidate = entry.trim();
    if (candidate.length === 0 || candidate.length > 60 || isLowValueSuggestion(candidate)) continue;

    const key = normalizeSuggestionKey(candidate);
    if (!key || seen.has(key)) continue;

    seen.add(key);
    normalizedSuggestions.push(candidate);
    if (normalizedSuggestions.length === 4) break;
  }

  return normalizedSuggestions;
}

export function normalizeResponseState(payload: string | null): ChatResponseState | null {
  if (payload === "open" || payload === "closed" || payload === "needs_input") {
    return payload;
  }
  return null;
}

export function looksLikeBlockingQuestion(textContent: string): boolean {
  const trimmed = textContent.trim();
  if (!trimmed.endsWith("?")) return false;
  return trimmed.split("?").length - 1 === 1;
}

export function deriveResponseState(
  message: ChatMessage,
  explicitState: ChatResponseState | null,
  suggestions: string[],
  textContent: string,
): ChatResponseState | undefined {
  if (explicitState) return explicitState;
  if (message.metadata?.responseState) return message.metadata.responseState;
  if (message.role !== "assistant") return undefined;
  if (suggestions.length > 0) return "open";
  return looksLikeBlockingQuestion(textContent) ? "needs_input" : "closed";
}
