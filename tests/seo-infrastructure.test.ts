/**
 * Sprint 6 — SEO Infrastructure tests
 *
 * Verifies sitemap.xml, robots.txt, root layout OG/canonical/metadataBase,
 * Plausible analytics conditional rendering, dead code removal, and
 * analytics config field.
 */
import { beforeEach, describe, it, expect, vi } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { validateIdentity } from "@/lib/config/instance.schema";

const { loadPublicShellNavigationContextMock } = vi.hoisted(() => ({
  loadPublicShellNavigationContextMock: vi.fn(),
}));

// ── Helpers ─────────────────────────────────────────────────────────

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf-8");
}

// ── §1 Sitemap tests (P1–P3, N1–N2, E1–E4) ────────────────────────

vi.mock("@/lib/config/instance", () => ({
  getInstanceIdentity: () => ({
    name: "Studio Ordo",
    shortName: "Ordo",
    domain: "studioordo.com",
    logoPath: "/ordo-avatar.png",
    tagline: "Strategic AI Advisory",
    description: "Test description",
    markText: "O",
    analytics: { plausibleDomain: "studioordo.com" },
  }),
  getInstancePrompts: () => ({
    heroHeading: "Test",
    heroSubheading: "Test",
  }),
}));

vi.mock("@/lib/shell/public-shell-state", () => ({
  loadPublicShellNavigationContext: loadPublicShellNavigationContextMock,
}));

import sitemap from "@/app/sitemap";
import robots from "@/app/robots";

describe("sitemap.xml generation", () => {
  beforeEach(() => {
    loadPublicShellNavigationContextMock.mockResolvedValue({
      hasPublicFeedItems: false,
    });
  });

  it("P1: returns homepage entry", async () => {
    const entries = await sitemap();
    const home = entries.find((e) => e.url === "https://studioordo.com");
    expect(home).toBeDefined();
  });

  it("P2: returns target public route entries for empty feed state", async () => {
    const entries = await sitemap();
    expect(entries.map((entry) => entry.url)).toEqual([
      "https://studioordo.com",
      "https://studioordo.com/offers",
      "https://studioordo.com/about",
    ]);
  });

  it("P2b: includes feed route when public feed content exists", async () => {
    loadPublicShellNavigationContextMock.mockResolvedValue({
      hasPublicFeedItems: true,
    });

    const entries = await sitemap();

    expect(entries.map((entry) => entry.url)).toEqual([
      "https://studioordo.com",
      "https://studioordo.com/feed",
      "https://studioordo.com/offers",
      "https://studioordo.com/about",
    ]);
  });

  it("N1: excludes redirect routes", async () => {
    const entries = await sitemap();
    for (const entry of entries) {
      expect(entry.url).not.toContain("/books/");
      expect(entry.url).not.toContain("/corpus/");
      expect(entry.url).not.toContain("/book/");
      expect(entry.url).not.toContain("/library");
      expect(entry.url).not.toContain("/journal");
      expect(entry.url).not.toContain("/blog");
    }
  });

  it("N2: excludes auth and API routes", async () => {
    const entries = await sitemap();
    for (const entry of entries) {
      expect(entry.url).not.toContain("/api/");
      expect(entry.url).not.toContain("/login");
      expect(entry.url).not.toContain("/register");
      expect(entry.url).not.toContain("/profile");
    }
  });

  it("E1: all entries have valid https URL format", async () => {
    const entries = await sitemap();
    for (const entry of entries) {
      expect(entry.url).toMatch(/^https:\/\//);
    }
  });

  it("E2: all entries have lastModified as Date", async () => {
    const entries = await sitemap();
    for (const entry of entries) {
      expect(entry.lastModified).toBeInstanceOf(Date);
    }
  });

  it("E3: homepage has priority 1.0", async () => {
    const entries = await sitemap();
    const home = entries.find((e) => e.url === "https://studioordo.com");
    expect(home?.priority).toBe(1.0);
  });

  it("E4: public route priorities match the route contract", async () => {
    const entries = await sitemap();
    const offers = entries.find((e) => e.url === "https://studioordo.com/offers");
    const about = entries.find((e) => e.url === "https://studioordo.com/about");

    expect(entries.find((e) => e.url === "https://studioordo.com/feed")).toBeUndefined();
    expect(offers?.priority).toBe(0.8);
    expect(about?.priority).toBe(0.6);
  });

  it("E4b: published feed route keeps the public feed priority", async () => {
    loadPublicShellNavigationContextMock.mockResolvedValue({
      hasPublicFeedItems: true,
    });

    const entries = await sitemap();
    const feed = entries.find((e) => e.url === "https://studioordo.com/feed");

    expect(feed?.priority).toBe(0.7);
  });
});

// ── §2 Robots tests (P4–P6, E5) ────────────────────────────────────

describe("robots.txt generation", () => {
  it("P4: allows public content routes", () => {
    const result = robots();
    expect(result.rules).toBeDefined();
    const rule = Array.isArray(result.rules) ? result.rules[0] : result.rules;
    expect(rule.allow).toContain("/");
    expect(rule.allow).toContain("/feed");
    expect(rule.allow).toContain("/offers");
    expect(rule.allow).toContain("/about");
    expect(rule.allow).not.toContain("/library");
  });

  it("P5: disallows API and auth routes", () => {
    const result = robots();
    const rule = Array.isArray(result.rules) ? result.rules[0] : result.rules;
    const disallowed = rule.disallow;
    expect(disallowed).toContain("/api/");
    expect(disallowed).toContain("/login");
    expect(disallowed).toContain("/register");
    expect(disallowed).toContain("/profile");
  });

  it("P6: includes sitemap URL with configured domain", () => {
    const result = robots();
    expect(result.sitemap).toBe("https://studioordo.com/sitemap.xml");
  });

  it("E5: uses configured domain for sitemap URL", () => {
    const result = robots();
    expect(result.sitemap).toContain("studioordo.com");
  });
});

// ── §3 Root layout metadata tests (P7–P9) ──────────────────────────

describe("root layout generateMetadata", () => {
  it("P7: returns OG tags", () => {
    const src = readSource("src/app/layout.tsx");
    expect(src).toContain("openGraph");
    expect(src).toMatch(/type:\s*["']website["']/);
    expect(src).toContain("siteName");
    expect(src).toContain("images");
  });

  it("P8: returns canonical URL", () => {
    const src = readSource("src/app/layout.tsx");
    expect(src).toContain("alternates");
    expect(src).toContain("canonical");
  });

  it("P9: sets metadataBase", () => {
    const src = readSource("src/app/layout.tsx");
    expect(src).toContain("metadataBase");
    expect(src).toMatch(/new URL/);
  });
});

// ── §4 Analytics and dead code tests (N3, E6–E8) ───────────────────

describe("analytics conditional rendering", () => {
  it("N3: Plausible script not injected when analytics config absent", () => {
    const src = readSource("src/app/layout.tsx");
    expect(src).toMatch(/analytics\?\.plausibleDomain/);
  });

  it("E8: Plausible script uses default src when plausibleSrc not configured", () => {
    const src = readSource("src/app/layout.tsx");
    expect(src).toContain("https://plausible.io/js/script.js");
  });

  it("E8b: root layout does not render next/script inside an explicit head element", () => {
    const src = readSource("src/app/layout.tsx");

    expect(src).toContain("id=\"theme-bootstrap\"");
    expect(src).not.toMatch(/<head>[\s\S]*?<Script/);
  });
});

describe("dead code removal", () => {
  it("E6: layout-metadata.ts dead code removed", () => {
    const exists = existsSync(join(process.cwd(), "src/app/layout-metadata.ts"));
    expect(exists).toBe(false);
  });
});

describe("analytics config type", () => {
  it("E7: InstanceIdentity includes analytics field", () => {
    const src = readSource("src/lib/config/defaults.ts");
    expect(src).toContain("analytics?");
    expect(src).toContain("plausibleDomain");
    expect(src).toContain("plausibleSrc");
  });
});

describe("analytics schema validation", () => {
  const VALID_IDENTITY = {
    name: "Test Brand",
    shortName: "TB",
    tagline: "Test tagline",
    description: "Test description",
    domain: "test.example.com",
    logoPath: "/logo.png",
    markText: "T",
  };

  it("E9: accepts valid analytics object", () => {
    const result = validateIdentity({
      ...VALID_IDENTITY,
      analytics: { plausibleDomain: "example.com" },
    });
    expect(Array.isArray(result)).toBe(false);
  });

  it("E10: rejects non-object analytics", () => {
    const result = validateIdentity({
      ...VALID_IDENTITY,
      analytics: "not-an-object",
    });
    expect(Array.isArray(result)).toBe(true);
    expect(result).toContain("identity.analytics: must be an object");
  });
});
