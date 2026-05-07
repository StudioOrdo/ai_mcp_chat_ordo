import { redactSecrets } from "@/lib/observability/secret-redaction";

export interface RedactionResult<T = unknown> {
  value: T;
  fields: string[];
}

export function redactDiagnostics<T = unknown>(value: T): RedactionResult<T> {
  return redactSecrets(value);
}
