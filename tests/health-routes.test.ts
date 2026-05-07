import { afterEach, describe, expect, it, vi } from "vitest";
import { GET as liveGet } from "@/app/api/health/live/route";
import { GET as readyGet } from "@/app/api/health/ready/route";

describe("health routes", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 200 from live endpoint", async () => {
    const response = await liveGet();
    expect(response.status).toBe(200);
  });

  it("returns 200 from ready endpoint when config valid", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");

    const response = await readyGet();
    expect(response.status).toBe(200);
  });

  it("returns 503 from ready endpoint when config invalid", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("API__ANTHROPIC_API_KEY", "");

    const response = await readyGet();
    expect(response.status).toBe(503);
  });

  it("returns 503 from ready endpoint when hosted public origin is invalid", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    vi.stubEnv("ORDO_HOSTED_MODE", "reverse_proxy");
    vi.stubEnv("ORDO_PUBLIC_ORIGIN", "http://tenant.example.com");

    const response = await readyGet();

    expect(response.status).toBe(503);
  });
});
