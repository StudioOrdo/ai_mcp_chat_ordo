/**
 * Sprint 1 — Font Reduction and CSS Cleanup
 * 22 tests: P1–P12 (positive), N1–N6 (negative), E1–E4 (edge)
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { resetConfigCache, loadInstanceConfig, getInstanceIdentity } from "@/lib/config/instance";
import { ConfigValidationError } from "@/lib/config/instance";
import { DEFAULT_IDENTITY } from "@/lib/config/defaults";

// ── Helpers ─────────────────────────────────────────────────────────

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf-8");
}

const VALID_IDENTITY = {
  name: "Test Brand",
  shortName: "TB",
  tagline: "Testing fonts",
  description: "A test identity for font validation.",
  domain: "testbrand.com",
  logoPath: "/test-logo.png",
  markText: "T",
};

// ═══════════════════════════════════════════════════════════════════
// §5.1 — Positive tests (P1–P12)
// ═══════════════════════════════════════════════════════════════════

describe("font reduction — layout", () => {
  const layout = readSource("src/app/layout.tsx");

  it("P1: layout delegates font variables to CSS", () => {
    expect(layout).toContain('body className="antialiased"');
    expect(layout).not.toMatch(/--font-ibm-plex-sans/);
    expect(layout).not.toMatch(/--font-ibm-plex-mono/);
    expect(layout).not.toMatch(/--font-fraunces/);
    expect(layout).not.toMatch(/--font-geist-sans/);
    expect(layout).not.toMatch(/--font-geist-mono/);
    expect(layout).not.toMatch(/--font-archivo/);
    expect(layout).not.toMatch(/--font-league-spartan/);
    expect(layout).not.toMatch(/--font-space-mono/);
  });

  it("P2: layout no longer imports font families directly", () => {
    expect(layout).not.toContain("IBM_Plex_Sans");
    expect(layout).not.toContain("IBM_Plex_Mono");
    expect(layout).not.toContain("Fraunces");
    expect(layout).not.toContain("Geist_Mono");
    expect(layout).not.toContain("Archivo");
    expect(layout).not.toContain("League_Spartan");
    expect(layout).not.toContain("Space_Mono");
    // Geist (not Geist_Mono) — must not appear as a standalone import
    expect(layout).not.toMatch(/\bGeist\b(?!_)/);
  });
});

describe("font reduction — CSS variables", () => {
  const css = readSource("src/app/globals.css");

  it("P6: CSS defines --font-body variable in :root", () => {
    expect(css).toMatch(/--font-body:\s*var\(--font-ibm-plex-sans/);
  });

  it("P7: CSS defines --font-display variable in :root", () => {
    expect(css).toMatch(/--font-display:\s*var\(--font-fraunces/);
  });

  it("P8: CSS defines --font-mono variable in :root", () => {
    expect(css).toMatch(/--font-mono:\s*var\(--font-ibm-plex-mono/);
  });

  it("P9: CSS --font-base aliases --font-body", () => {
    expect(css).toMatch(/--font-base:\s*var\(--font-body\)/);
  });

  it("P10: CSS --font-label aliases --font-body", () => {
    expect(css).toMatch(/--font-label:\s*var\(--font-body\)/);
  });

  it("P11: @theme inline --font-sans references --font-body", () => {
    expect(css).toMatch(/--font-sans:\s*var\(--font-body\)/);
  });

  it("P12: @theme inline --font-mono references --font-mono", () => {
    expect(css).toMatch(/--font-mono:\s*var\(--font-mono\)/);
  });
});

describe("font reduction — config defaults", () => {
  it("P5: DEFAULT_IDENTITY includes fonts with correct defaults", () => {
    expect(DEFAULT_IDENTITY.fonts).toEqual({
      body: "IBM Plex Sans",
      display: "Fraunces",
      mono: "IBM Plex Mono",
    });
  });
});

describe("font reduction — config validation", () => {
  let configDir: string;

  beforeEach(() => {
    configDir = mkdtempSync(join(tmpdir(), "font-test-"));
    process.env.CONFIG_DIR = configDir;
    resetConfigCache();
  });

  afterEach(() => {
    rmSync(configDir, { recursive: true });
    delete process.env.CONFIG_DIR;
    resetConfigCache();
  });

  function writeConfig(filename: string, content: object) {
    writeFileSync(join(configDir, filename), JSON.stringify(content, null, 2));
  }

  it("P3: identity config with fonts field validates successfully", () => {
    writeConfig("identity.json", {
      ...VALID_IDENTITY,
      fonts: { body: "Custom Sans", display: "Custom Serif", mono: "Custom Mono" },
    });
    const config = loadInstanceConfig();
    expect(config.identity.fonts).toEqual({
      body: "Custom Sans",
      display: "Custom Serif",
      mono: "Custom Mono",
    });
  });

  it("P4: identity config without fonts field uses defaults", () => {
    writeConfig("identity.json", VALID_IDENTITY);
    const id = getInstanceIdentity();
    expect(id.fonts).toEqual({
      body: "IBM Plex Sans",
      display: "Fraunces",
      mono: "IBM Plex Mono",
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // §5.2 — Negative tests (N1–N6)
  // ═══════════════════════════════════════════════════════════════════

  it("N1: throws when fonts.body is empty string", () => {
    writeConfig("identity.json", {
      ...VALID_IDENTITY,
      fonts: { body: "", display: "Serif", mono: "Mono" },
    });
    expect(() => loadInstanceConfig()).toThrow(ConfigValidationError);
    try {
      loadInstanceConfig();
    } catch (e) {
      expect((e as ConfigValidationError).violations).toContain(
        "identity.fonts.body: required non-empty string",
      );
    }
  });

  it("N2: throws when fonts is partial (missing mono)", () => {
    writeConfig("identity.json", {
      ...VALID_IDENTITY,
      fonts: { body: "Sans", display: "Serif" },
    });
    expect(() => loadInstanceConfig()).toThrow(ConfigValidationError);
    try {
      loadInstanceConfig();
    } catch (e) {
      expect((e as ConfigValidationError).violations).toContain(
        "identity.fonts.mono: required non-empty string",
      );
    }
  });

  it("N3: throws when fonts.display exceeds max length", () => {
    writeConfig("identity.json", {
      ...VALID_IDENTITY,
      fonts: { body: "Sans", display: "A".repeat(101), mono: "Mono" },
    });
    expect(() => loadInstanceConfig()).toThrow(ConfigValidationError);
    try {
      loadInstanceConfig();
    } catch (e) {
      expect((e as ConfigValidationError).violations).toContain(
        "identity.fonts.display: max 100 characters",
      );
    }
  });

  it("N4: throws when fonts is not an object", () => {
    writeConfig("identity.json", {
      ...VALID_IDENTITY,
      fonts: "IBM Plex Sans",
    });
    expect(() => loadInstanceConfig()).toThrow(ConfigValidationError);
    try {
      loadInstanceConfig();
    } catch (e) {
      expect((e as ConfigValidationError).violations).toContain(
        "identity.fonts: must be an object with body, display, and mono",
      );
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  // §5.3 — Edge tests (E1–E4)
  // ═══════════════════════════════════════════════════════════════════

  it("E1: fonts field at boundary: 100-character font name", () => {
    const longName = "A".repeat(100);
    writeConfig("identity.json", {
      ...VALID_IDENTITY,
      fonts: { body: longName, display: "Serif", mono: "Mono" },
    });
    const config = loadInstanceConfig();
    expect(config.identity.fonts!.body).toBe(longName);
  });

  it("E2: fonts field with Unicode characters", () => {
    writeConfig("identity.json", {
      ...VALID_IDENTITY,
      fonts: { body: "Noto Sans JP", display: "しっぽり明朝", mono: "Source Code Pro" },
    });
    const config = loadInstanceConfig();
    expect(config.identity.fonts).toEqual({
      body: "Noto Sans JP",
      display: "しっぽり明朝",
      mono: "Source Code Pro",
    });
  });

  it("E3: identity.json with fonts and all other fields", () => {
    writeConfig("identity.json", {
      ...VALID_IDENTITY,
      copyright: "© 2026 Test",
      accentColor: "#ff0000",
      serviceChips: ["Chip1", "Chip2"],
      fonts: { body: "Inter", display: "Playfair", mono: "JetBrains Mono" },
    });
    const config = loadInstanceConfig();
    expect(config.identity.fonts).toEqual({
      body: "Inter",
      display: "Playfair",
      mono: "JetBrains Mono",
    });
    expect(config.identity.name).toBe("Test Brand");
    expect(config.identity.copyright).toBe("© 2026 Test");
    expect(config.identity.serviceChips).toEqual(["Chip1", "Chip2"]);
  });
});

describe("font reduction — CSS static analysis", () => {
  const css = readSource("src/app/globals.css");

  it("N5: removed fonts do not appear in globals.css", () => {
    expect(css).not.toContain("--font-geist-sans");
    expect(css).not.toContain("--font-geist-mono");
    expect(css).not.toContain("--font-archivo");
    expect(css).not.toContain("--font-league-spartan");
    expect(css).not.toContain("--font-space-mono");
  });

  it("N6: no theme class overrides --font-base", () => {
    // Extract theme class blocks and verify none contain --font-base:
    const themeBlockPattern = /\.theme-(bauhaus|swiss|skeuomorphic|fluid)\s*\{[^}]*\}/g;
    let match;
    while ((match = themeBlockPattern.exec(css)) !== null) {
      expect(match[0]).not.toContain("--font-base:");
    }
  });

  it("E4: --font-base resolves through alias chain", () => {
    // Verify the CSS chain: --font-base -> --font-body -> --font-ibm-plex-sans
    expect(css).toMatch(/--font-body:\s*var\(--font-ibm-plex-sans/);
    expect(css).toMatch(/--font-base:\s*var\(--font-body\)/);
  });
});
