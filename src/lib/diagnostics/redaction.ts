const SECRET_KEY_PATTERN = /^(authorization|cookie|set-cookie|apiKey|api_key|token|secret|password)$/i;
const BEARER_TOKEN_PATTERN = /bearer\s+[a-z0-9._~+/-]+=*/gi;
const MAX_DEPTH = 8;
const REDACTED = "[redacted]";

export interface RedactionResult<T = unknown> {
  value: T;
  fields: string[];
}

function redactString(value: string): string {
  return value.replace(BEARER_TOKEN_PATTERN, "Bearer [redacted]");
}

function pathFor(parentPath: string, key: string): string {
  return parentPath ? `${parentPath}.${key}` : key;
}

function redactValue(value: unknown, fields: Set<string>, path = "", depth = 0): unknown {
  if (value == null || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const redacted = redactString(value);
    if (redacted !== value) fields.add(path || "$");
    return redacted;
  }

  if (depth >= MAX_DEPTH) {
    return Array.isArray(value) ? "[array]" : "[object]";
  }

  if (Array.isArray(value)) {
    return value.map((entry, index) => redactValue(entry, fields, `${path}[${index}]`, depth + 1));
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => {
        const childPath = pathFor(path, key);
        if (SECRET_KEY_PATTERN.test(key)) {
          fields.add(childPath);
          return [key, REDACTED];
        }

        return [key, redactValue(entry, fields, childPath, depth + 1)];
      }),
    );
  }

  return value;
}

export function redactDiagnostics<T = unknown>(value: T): RedactionResult<T> {
  const fields = new Set<string>();
  return {
    value: redactValue(value, fields) as T,
    fields: [...fields].sort(),
  };
}
