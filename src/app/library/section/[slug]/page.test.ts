import { describe, expect, it, vi } from "vitest";

const { notFoundMock } = vi.hoisted(() => ({
  notFoundMock: vi.fn(() => {
    throw new Error("notFound");
  }),
}));

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
}));

import LibrarySectionResolverPage from "@/app/library/section/[slug]/page";

describe("retired library section resolver route", () => {
  it("fails visibly instead of preserving public library redirects", () => {
    expect(() => LibrarySectionResolverPage()).toThrow("notFound");
    expect(notFoundMock).toHaveBeenCalled();
  });
});
