import { afterEach, describe, expect, it, vi } from "vitest";
import { generateMetadata } from "./layout";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getSessionUser: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getDb: vi.fn(),
}));

describe("root layout hosted metadata", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses ORDO_PUBLIC_ORIGIN for browser-facing metadata", async () => {
    vi.stubEnv("ORDO_PUBLIC_ORIGIN", "https://tenant.example.com");

    const metadata = await generateMetadata();

    expect(String(metadata.metadataBase)).toBe("https://tenant.example.com/");
    expect(metadata.openGraph).toMatchObject({
      url: "https://tenant.example.com",
    });
  });
});
