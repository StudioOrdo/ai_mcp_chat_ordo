import { describe, expect, it } from "vitest";

import {
  formatStableDateTimeOrValue,
  formatStableUpdatedAt,
  formatStableUtcShortDateTime,
} from "./stable-date";

describe("stable date formatting", () => {
  it("formats timestamps without host locale punctuation or timezone drift", () => {
    expect(formatStableUtcShortDateTime("2026-05-04T12:00:00.000Z")).toBe("May 4 at 12:00 PM");
    expect(formatStableUpdatedAt("2026-05-04T00:05:00.000Z")).toBe("Updated May 4 at 12:05 AM");
  });

  it("keeps invalid values explicit for detail surfaces", () => {
    expect(formatStableUtcShortDateTime("not-a-date")).toBeNull();
    expect(formatStableUpdatedAt("not-a-date")).toBe("Recently updated");
    expect(formatStableDateTimeOrValue("not-a-date")).toBe("not-a-date");
  });
});
