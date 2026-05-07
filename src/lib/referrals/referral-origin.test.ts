import { afterEach, describe, expect, it, vi } from "vitest";
import { buildPublicReferralUrl, resolveReferralPublicOrigin } from "./referral-origin";

describe("referral public origin", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses ORDO_PUBLIC_ORIGIN before legacy aliases", () => {
    vi.stubEnv("ORDO_PUBLIC_ORIGIN", "https://tenant.example.com");
    vi.stubEnv("PUBLIC_SITE_ORIGIN", "https://legacy.example.com");

    expect(resolveReferralPublicOrigin()).toMatchObject({
      origin: "https://tenant.example.com",
      source: "environment",
      localhostFallback: false,
    });
    expect(buildPublicReferralUrl("mentor-42")).toBe("https://tenant.example.com/r/mentor-42");
  });

  it("keeps the development localhost fallback", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("PORT", "3333");

    expect(resolveReferralPublicOrigin()).toMatchObject({
      origin: "http://localhost:3333",
      source: "development-localhost",
      localhostFallback: true,
    });
  });
});
