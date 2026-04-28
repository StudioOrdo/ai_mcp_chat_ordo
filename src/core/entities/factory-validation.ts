export function isNonEmptyTrimmedString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function hasDuplicateStrings(values: readonly string[]): boolean {
  return new Set(values).size !== values.length;
}

export function hasDuplicates<T>(values: readonly T[]): boolean {
  return new Set(values).size !== values.length;
}

export function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) > 0;
}

export function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export function isUnitIntervalNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

export function isValidTimestamp(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && !Number.isNaN(Date.parse(value));
}

export function hasContiguousOrder(values: readonly number[]): boolean {
  if (values.length === 0) {
    return true;
  }

  const sorted = [...values].sort((left, right) => left - right);
  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index] - sorted[index - 1] !== 1) {
      return false;
    }
  }

  return true;
}

export function pushError(errors: string[], condition: boolean, message: string): void {
  if (condition) {
    errors.push(message);
  }
}