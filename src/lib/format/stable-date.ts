const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export function formatStableUtcShortDateTime(value: Date | string): string | null {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const hour24 = date.getUTCHours();
  const hour12 = hour24 % 12 || 12;
  const meridiem = hour24 >= 12 ? "PM" : "AM";
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");

  return `${MONTH_LABELS[date.getUTCMonth()]} ${date.getUTCDate()} at ${hour12}:${minutes} ${meridiem}`;
}

export function formatStableUpdatedAt(value: Date | string): string {
  const label = formatStableUtcShortDateTime(value);
  return label ? `Updated ${label}` : "Recently updated";
}

export function formatStableDateTimeOrValue(value: string): string {
  return formatStableUtcShortDateTime(value) ?? value;
}
