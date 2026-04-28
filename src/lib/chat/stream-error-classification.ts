export function isProviderCreditExhaustionMessage(message: string | null | undefined): boolean {
  const normalized = message?.toLowerCase() ?? "";
  return normalized.includes("credit balance is too low")
    || normalized.includes("insufficient credits")
    || (normalized.includes("update the production ai key or billing") && normalized.includes("retry"));
}

export function getCreditExhaustionStatusLabel(message: string | null | undefined): string {
  return isProviderCreditExhaustionMessage(message)
    ? "Provider credits exhausted"
    : "Response interrupted";
}

export function getCreditExhaustionRetryLabel(message: string | null | undefined): string {
  return isProviderCreditExhaustionMessage(message)
    ? "Retry after billing fix"
    : "Retry";
}