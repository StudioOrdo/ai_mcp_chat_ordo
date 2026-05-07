import { describe, expect, it } from "vitest";
import { getAllowedCsrfOrigins, resolvePublicOrigin } from "./public-origin";

describe("public origin resolution", () => {
  it("resolves ORDO_PUBLIC_ORIGIN as the canonical hosted origin", () => {
    const result = resolvePublicOrigin({
      env: {
        ORDO_HOSTED_MODE: "reverse_proxy",
        ORDO_PUBLIC_ORIGIN: "https://tenant.example.com",
      },
    });

    expect(result).toMatchObject({
      mode: "reverse_proxy",
      origin: "https://tenant.example.com",
      source: "ordo_public_origin",
      errors: [],
    });
  });

  it("keeps PUBLIC_SITE_ORIGIN and NEXT_PUBLIC_SITE_ORIGIN as compatibility aliases", () => {
    expect(resolvePublicOrigin({ env: { PUBLIC_SITE_ORIGIN: "https://public.example.com/" } })).toMatchObject({
      origin: "https://public.example.com",
      source: "public_site_origin",
    });
    expect(resolvePublicOrigin({ env: { NEXT_PUBLIC_SITE_ORIGIN: "https://next.example.com/" } })).toMatchObject({
      origin: "https://next.example.com",
      source: "next_public_site_origin",
    });
  });

  it("falls back to localhost in development local mode", () => {
    expect(resolvePublicOrigin({ env: { NODE_ENV: "development", PORT: "4321" } })).toMatchObject({
      mode: "local",
      origin: "http://localhost:4321",
      source: "development_localhost",
    });
  });

  it("falls back to the instance domain outside development local mode", () => {
    expect(resolvePublicOrigin({ env: { NODE_ENV: "production" }, instanceDomain: "tenant.local" })).toMatchObject({
      mode: "local",
      origin: "https://tenant.local",
      source: "instance_domain",
    });
  });

  it("reports hosted mode with no origin as an error", () => {
    const result = resolvePublicOrigin({ env: { ORDO_HOSTED_MODE: "reverse_proxy" } });
    expect(result.origin).toBeNull();
    expect(result.errors).toContain("ORDO_PUBLIC_ORIGIN is required when ORDO_HOSTED_MODE=reverse_proxy.");
  });

  it("reports hosted mode with non-HTTPS origin as an error", () => {
    const result = resolvePublicOrigin({
      env: {
        ORDO_HOSTED_MODE: "reverse_proxy",
        ORDO_PUBLIC_ORIGIN: "http://tenant.example.com",
      },
    });
    expect(result.origin).toBe("http://tenant.example.com");
    expect(result.errors).toContain("ORDO_PUBLIC_ORIGIN must use https:// when ORDO_HOSTED_MODE=reverse_proxy.");
    expect(getAllowedCsrfOrigins({ env: {
      ORDO_HOSTED_MODE: "reverse_proxy",
      ORDO_PUBLIC_ORIGIN: "http://tenant.example.com",
    } })).toEqual([]);
  });

  it("reports malformed origins and ignores them for CSRF", () => {
    const env = {
      ORDO_HOSTED_MODE: "reverse_proxy",
      ORDO_PUBLIC_ORIGIN: "not-a-url",
    };
    const result = resolvePublicOrigin({ env });
    expect(result.origin).toBeNull();
    expect(result.errors).toContain("ORDO_PUBLIC_ORIGIN is not a valid absolute URL.");
    expect(getAllowedCsrfOrigins({ env })).toEqual([]);
  });

  it("normalizes pathful origins with a warning", () => {
    const result = resolvePublicOrigin({
      env: {
        ORDO_PUBLIC_ORIGIN: "https://tenant.example.com/install?x=1#top",
      },
    });
    expect(result.origin).toBe("https://tenant.example.com");
    expect(result.warnings[0]).toContain("normalized to https://tenant.example.com");
  });

  it("dedupes allowed origins and ignores blanks", () => {
    expect(resolvePublicOrigin({
      env: {
        ALLOWED_ORIGINS: "https://a.example.com, , https://a.example.com/, https://b.example.com",
      },
    }).allowedOrigins).toEqual(["https://a.example.com", "https://b.example.com"]);
  });

  it("keeps canonical CSRF origin when optional ALLOWED_ORIGINS contains a malformed entry", () => {
    const env = {
      ORDO_HOSTED_MODE: "reverse_proxy",
      ORDO_PUBLIC_ORIGIN: "https://tenant.example.com",
      ALLOWED_ORIGINS: "not-a-url",
    };

    expect(resolvePublicOrigin({ env }).errors).toContain("ALLOWED_ORIGINS is not a valid absolute URL.");
    expect(getAllowedCsrfOrigins({ env })).toEqual(["https://tenant.example.com"]);
  });
});
