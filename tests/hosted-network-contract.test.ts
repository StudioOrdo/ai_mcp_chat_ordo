import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf-8");
}

describe("hosted appliance network contract", () => {
  it("keeps hosted compose on reverse-proxy exposure with explicit network env", () => {
    const compose = source("compose.hosted.yaml");

    expect(compose).toContain("expose:\n      - \"3000\"");
    expect(compose).not.toContain("ports:");
    expect(compose).not.toContain("traefik.");
    expect(compose).not.toContain("container_name:");
    expect(compose).toContain("ORDO_HOSTED_MODE: ${ORDO_HOSTED_MODE:-reverse_proxy}");
    expect(compose).toContain("ORDO_PUBLIC_ORIGIN: ${ORDO_PUBLIC_ORIGIN:-}");
    expect(compose).toContain("TRUST_PROXY_HEADERS: ${TRUST_PROXY_HEADERS:-0}");
    expect(compose).toContain("ALLOWED_ORIGINS: ${ALLOWED_ORIGINS:-}");
  });

  it("routes hosted origin behavior through shared network modules", () => {
    expect(source("src/lib/security/origin-check.ts")).toContain("resolvePublicOrigin");
    expect(source("src/lib/referrals/referral-origin.ts")).toContain("resolvePublicOrigin");
    expect(source("src/app/layout.tsx")).toContain("resolvePublicOrigin");
    expect(source("src/lib/appliance/health-facade.ts")).toContain("createNetworkProbe");
  });
});
