import { VALID_ACTION_TYPES } from "@/core/entities/rich-content";
import type { ActionLinkType } from "@/core/entities/rich-content";
import type { MessageAction } from "@/adapters/ChatPresenter";

export function getNormalizedString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

export function sanitizeStringParams(params: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(params)
      .filter(([, value]) => typeof value === "string" && value.trim().length > 0)
      .map(([key, value]) => [key, (value as string).trim()]),
  );
}

export function omitKeys(params: Record<string, string>, keys: string[]): Record<string, string> {
  return Object.fromEntries(
    Object.entries(params).filter(([key]) => !keys.includes(key)),
  );
}

export function normalizeActionParams(action: ActionLinkType, entry: Record<string, unknown>): Record<string, string> | null {
  const explicitParams = typeof entry.params === "object" && entry.params !== null
    ? entry.params as Record<string, unknown>
    : {};
  const rawParams = { ...entry, ...explicitParams };
  const sanitizedParams = sanitizeStringParams(rawParams);
  const baseOmitKeys = ["label", "action", "type", "value", "params"];

  switch (action) {
    case "route": {
      const path = getNormalizedString(rawParams, ["path", "href", "pathname"]) ?? getNormalizedString(entry, ["value"]);
      const baseParams = omitKeys(sanitizedParams, [...baseOmitKeys, "path", "href", "pathname"]);
      return path ? { ...baseParams, path } : baseParams;
    }
    case "send": {
      const text = getNormalizedString(rawParams, ["text", "prompt", "message"]) ?? getNormalizedString(entry, ["value"]);
      const baseParams = omitKeys(sanitizedParams, [...baseOmitKeys, "text", "prompt", "message"]);
      return text ? { ...baseParams, text } : baseParams;
    }
    case "tool": {
      const text = getNormalizedString(rawParams, ["text", "prompt", "message"]) ?? getNormalizedString(entry, ["value"]);
      const baseParams = omitKeys(sanitizedParams, [...baseOmitKeys, "text", "prompt", "message"]);
      return text ? { ...baseParams, text } : baseParams;
    }
    case "corpus": {
      const slug = getNormalizedString(rawParams, ["slug", "id"]) ?? getNormalizedString(entry, ["value"]);
      const baseParams = omitKeys(sanitizedParams, [...baseOmitKeys, "slug", "id"]);
      return slug ? { ...baseParams, slug } : baseParams;
    }
    case "conversation": {
      const id = getNormalizedString(rawParams, ["id", "conversationId"]) ?? getNormalizedString(entry, ["value"]);
      const baseParams = omitKeys(sanitizedParams, [...baseOmitKeys, "id", "conversationId"]);
      return id ? { ...baseParams, id } : baseParams;
    }
    case "external": {
      const url = getNormalizedString(rawParams, ["url", "href", "path"]) ?? getNormalizedString(entry, ["value"]);
      const baseParams = omitKeys(sanitizedParams, [...baseOmitKeys, "url", "href", "path"]);
      return url ? { ...baseParams, url } : baseParams;
    }
    case "job": {
      const jobId = getNormalizedString(rawParams, ["jobId", "id"]) ?? getNormalizedString(entry, ["value"]);
      const operation = getNormalizedString(rawParams, ["operation"]);
      const baseParams = omitKeys(sanitizedParams, [...baseOmitKeys, "jobId", "id", "operation"]);
      return jobId || operation
        ? {
          ...baseParams,
          ...(jobId ? { jobId } : {}),
          ...(operation ? { operation } : {}),
        }
        : baseParams;
    }
    case "operation": {
      const operationId = getNormalizedString(rawParams, ["operationId"]) ?? getNormalizedString(entry, ["value"]);
      const actionId = getNormalizedString(rawParams, ["actionId"]);
      const idempotencyKey = getNormalizedString(rawParams, ["idempotencyKey"]);
      const operationRevision = getNormalizedString(rawParams, ["operationRevision"]);
      const baseParams = omitKeys(sanitizedParams, [...baseOmitKeys, "operationId", "actionId", "idempotencyKey", "operationRevision"]);
      if (!operationId || !actionId || !idempotencyKey || !operationRevision) {
        return null;
      }
      return {
        ...baseParams,
        operationId,
        actionId,
        idempotencyKey,
        operationRevision,
      };
    }
    default:
      return null;
  }
}

export function normalizeMessageActions(payload: unknown[]): MessageAction[] {
  return payload
    .map((entry) => {
      if (typeof entry !== "object" || entry === null) {
        return null;
      }

      const record = entry as Record<string, unknown>;
      const label = getNormalizedString(record, ["label"]);
      const action = getNormalizedString(record, ["action", "type"]);

      if (!label || !action || !VALID_ACTION_TYPES.has(action)) {
        return null;
      }

      const params = normalizeActionParams(action as ActionLinkType, record);
      if (!params) {
        return null;
      }

      return {
        label,
        action: action as ActionLinkType,
        params,
      } satisfies MessageAction;
    })
    .filter((entry): entry is MessageAction => Boolean(entry))
    .slice(0, 3);
}
