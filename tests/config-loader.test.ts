/**
 * Config loader tests — Sprint 0
 * Tests P1–P7, P18–P20, N1–N12, E1–E13 (45 tests)
 *
 * Uses real filesystem with temp directories for isolation.
 * No fs mocking — the loader reads from CONFIG_DIR.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  loadInstanceConfig,
  getInstanceIdentity,
  getInstancePrompts,
  getInstanceServices,
  getInstanceTools,
  resetConfigCache,
  ConfigValidationError,
} from "@/lib/config/instance";
import { DEFAULT_IDENTITY, DEFAULT_PROMPTS, DEFAULT_SERVICES, DEFAULT_TOOLS } from "@/lib/config/defaults";

let configDir: string;

beforeEach(() => {
  configDir = mkdtempSync(join(tmpdir(), "config-test-"));
  process.env.CONFIG_DIR = configDir;
  resetConfigCache();
});

afterEach(() => {
  rmSync(configDir, { recursive: true, force: true });
  delete process.env.CONFIG_DIR;
  resetConfigCache();
});

function writeConfig(filename: string, content: object) {
  writeFileSync(join(configDir, filename), JSON.stringify(content, null, 2));
}

function writeRaw(filename: string, content: string) {
  writeFileSync(join(configDir, filename), content);
}

// ── Full valid fixtures ─────────────────────────────────────────────

const VALID_IDENTITY = {
  name: "Acme Dental",
  shortName: "Acme",
  tagline: "AI for dentists",
  description: "Smart dental practice management powered by AI.",
  domain: "acmedental.com",
  logoPath: "/acme-logo.png",
  markText: "A",
};

const VALID_PROMPTS = {
  personality: "You are a friendly dental AI assistant.",
  firstMessage: {
    default: "Welcome to Acme Dental!",
    withReferral: "Welcome back! Referred by a friend?",
  },
  defaultSuggestions: ["Book appointment", "Check insurance"],
};

const VALID_SERVICES = {
  offerings: [
    { id: "cleaning", name: "Teeth Cleaning", description: "Professional cleaning", lane: "individual" as const },
    { id: "consult", name: "Consultation", description: "Initial consultation", lane: "both" as const },
    { id: "enterprise-plan", name: "Enterprise", description: "Multi-location plan", lane: "organization" as const },
  ],
  bookingEnabled: true,
};

const VALID_TOOLS = {
  enabled: ["calculator", "search_corpus"],
};

// ═══════════════════════════════════════════════════════════════════
// §5.1 — Positive tests
// ═══════════════════════════════════════════════════════════════════

describe("config loader — positive tests", () => {
  it("P1: loads identity.json and returns typed config", () => {
    writeConfig("identity.json", VALID_IDENTITY);
    const config = loadInstanceConfig();
    expect(config.identity.name).toBe("Acme Dental");
    expect(config.identity.shortName).toBe("Acme");
    expect(config.identity.tagline).toBe("AI for dentists");
    expect(config.identity.domain).toBe("acmedental.com");
    expect(config.identity.logoPath).toBe("/acme-logo.png");
    expect(config.identity.markPath).toBe(DEFAULT_IDENTITY.markPath);
    expect(config.identity.markText).toBe("A");
  });

  it("P2: loads prompts.json and returns typed config", () => {
    writeConfig("prompts.json", VALID_PROMPTS);
    const config = loadInstanceConfig();
    expect(config.prompts.personality).toBe("You are a friendly dental AI assistant.");
    expect(config.prompts.firstMessage?.default).toBe("Welcome to Acme Dental!");
    expect(config.prompts.firstMessage?.withReferral).toBe("Welcome back! Referred by a friend?");
    expect(config.prompts.defaultSuggestions).toEqual(["Book appointment", "Check insurance"]);
  });

  it("P3: loads services.json and returns typed offerings", () => {
    writeConfig("services.json", VALID_SERVICES);
    const config = loadInstanceConfig();
    expect(config.services.offerings).toHaveLength(3);
    expect(config.services.offerings[0]).toMatchObject({ id: "cleaning", name: "Teeth Cleaning", lane: "individual" });
    expect(config.services.offerings[1]).toMatchObject({ id: "consult", lane: "both" });
    expect(config.services.offerings[2]).toMatchObject({ id: "enterprise-plan", lane: "organization" });
    expect(config.services.bookingEnabled).toBe(true);
  });

  it("P4: loads tools.json with enabled list", () => {
    writeConfig("tools.json", VALID_TOOLS);
    const config = loadInstanceConfig();
    expect(config.tools.enabled).toEqual(["calculator", "search_corpus"]);
  });

  it("P5: falls back to hardcoded identity when no config file exists", () => {
    const id = getInstanceIdentity();
    expect(id.name).toBe("Studio Ordo");
    expect(id.shortName).toBe("Ordo");
    expect(id.tagline).toBe("All-in-One AI Operator System");
  });

  it("P6: falls back to hardcoded prompts when no config file exists", () => {
    const prompts = getInstancePrompts();
    expect(prompts.personality).toBeUndefined();
  });

  it("P7: falls back to all tools enabled when no tools.json exists", () => {
    const tools = getInstanceTools();
    expect(tools.enabled).toBeUndefined();
  });

  it("P18: config values cached after first load", () => {
    writeConfig("identity.json", VALID_IDENTITY);
    const first = getInstanceIdentity();
    const second = getInstanceIdentity();
    expect(first).toBe(second); // Same object reference
  });

  it("P19: partial identity.json merges with defaults", () => {
    writeConfig("identity.json", {
      name: "Acme",
      shortName: "AC",
      tagline: "Testing",
      description: "A test brand.",
      domain: "acme.test",
      logoPath: "/acme.png",
      markText: "A",
    });
    const id = getInstanceIdentity();
    expect(id.name).toBe("Acme");
    // Default-merged fields
    expect(id.copyright).toBe(DEFAULT_IDENTITY.copyright);
    expect(id.serviceChips).toEqual(DEFAULT_IDENTITY.serviceChips);
  });

  it("P20: services.json with empty offerings array", () => {
    writeConfig("services.json", { offerings: [], bookingEnabled: false });
    const svc = getInstanceServices();
    expect(svc.offerings).toEqual([]);
    expect(svc.bookingEnabled).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// §5.2 — Negative tests
// ═══════════════════════════════════════════════════════════════════

describe("config validation — negative tests", () => {
  it("N1: throws ConfigValidationError for malformed JSON", () => {
    writeRaw("identity.json", "{name: unquoted}");
    expect(() => loadInstanceConfig()).toThrow(ConfigValidationError);
    try {
      loadInstanceConfig();
    } catch (e) {
      expect((e as ConfigValidationError).file).toBe("identity.json");
    }
  });

  it("N2: throws ConfigValidationError when identity.name is empty", () => {
    writeConfig("identity.json", { ...VALID_IDENTITY, name: "" });
    try {
      loadInstanceConfig();
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ConfigValidationError);
      expect((e as ConfigValidationError).violations).toContainEqual(
        expect.stringContaining("identity.name: required non-empty string"),
      );
    }
  });

  it("N3: throws ConfigValidationError when identity.name exceeds max length", () => {
    writeConfig("identity.json", { ...VALID_IDENTITY, name: "A".repeat(101) });
    try {
      loadInstanceConfig();
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ConfigValidationError);
      expect((e as ConfigValidationError).violations).toContainEqual(
        expect.stringContaining("identity.name: max 100 characters"),
      );
    }
  });

  it("N4: throws ConfigValidationError when identity.domain has protocol prefix", () => {
    writeConfig("identity.json", { ...VALID_IDENTITY, domain: "https://example.com" });
    try {
      loadInstanceConfig();
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ConfigValidationError);
      expect((e as ConfigValidationError).violations).toContainEqual(
        expect.stringContaining("must not include protocol"),
      );
    }
  });

  it("N5: throws ConfigValidationError when identity.logoPath missing leading slash", () => {
    writeConfig("identity.json", { ...VALID_IDENTITY, logoPath: "logo.png" });
    try {
      loadInstanceConfig();
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ConfigValidationError);
      expect((e as ConfigValidationError).violations).toContainEqual(
        expect.stringContaining("must start with /"),
      );
    }
  });

  it("N5b: throws ConfigValidationError when identity.markPath missing leading slash", () => {
    writeConfig("identity.json", { ...VALID_IDENTITY, markPath: "mark.png" });
    try {
      loadInstanceConfig();
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ConfigValidationError);
      expect((e as ConfigValidationError).violations).toContainEqual(
        expect.stringContaining("identity.markPath: must start with /"),
      );
    }
  });

  it("N6: collects all validation errors before throwing", () => {
    writeConfig("identity.json", {
      name: "",
      shortName: "",
      tagline: "ok",
      description: "ok",
      domain: "ok.com",
      logoPath: "/ok.png",
      markText: "",
    });
    try {
      loadInstanceConfig();
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ConfigValidationError);
      expect((e as ConfigValidationError).violations.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("N7: throws ConfigValidationError for non-object JSON", () => {
    writeRaw("identity.json", '"just a string"');
    try {
      loadInstanceConfig();
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ConfigValidationError);
      expect((e as ConfigValidationError).violations).toContainEqual(
        expect.stringContaining("must be a JSON object"),
      );
    }
  });

  it("N8: throws ConfigValidationError when services.offerings[].lane is invalid", () => {
    writeConfig("services.json", {
      offerings: [
        { id: "svc-1", name: "Service", description: "Desc", lane: "enterprise" },
      ],
      bookingEnabled: true,
    });
    try {
      loadInstanceConfig();
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ConfigValidationError);
      expect((e as ConfigValidationError).violations).toContainEqual(
        expect.stringContaining("must be organization, individual, or both"),
      );
    }
  });

  it("N9: throws ConfigValidationError when services.offerings[].estimatedPrice is negative", () => {
    writeConfig("services.json", {
      offerings: [
        { id: "svc-1", name: "Service", description: "Desc", lane: "individual", estimatedPrice: -100 },
      ],
      bookingEnabled: true,
    });
    try {
      loadInstanceConfig();
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ConfigValidationError);
      expect((e as ConfigValidationError).violations).toContainEqual(
        expect.stringContaining("must be non-negative integer"),
      );
    }
  });

  it("N10: throws ConfigValidationError when services.bookingEnabled is missing", () => {
    writeConfig("services.json", {
      offerings: [],
    });
    try {
      loadInstanceConfig();
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ConfigValidationError);
      expect((e as ConfigValidationError).violations).toContainEqual(
        expect.stringContaining("services.bookingEnabled: required boolean"),
      );
    }
  });

  it("N11: throws ConfigValidationError when prompts.personality exceeds max length", () => {
    writeConfig("prompts.json", { personality: "x".repeat(5001) });
    try {
      loadInstanceConfig();
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ConfigValidationError);
      expect((e as ConfigValidationError).violations).toContainEqual(
        expect.stringContaining("5000"),
      );
    }
  });

  it("N12: throws ConfigValidationError when tools.enabled contains empty string", () => {
    writeConfig("tools.json", { enabled: ["calculator", "", "search_corpus"] });
    try {
      loadInstanceConfig();
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ConfigValidationError);
      expect((e as ConfigValidationError).violations).toContainEqual(
        expect.stringContaining("tools.enabled[1]: must be non-empty string"),
      );
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// §5.3 — Edge tests
// ═══════════════════════════════════════════════════════════════════

describe("config loader — edge tests", () => {
  it("E1: config directory does not exist", () => {
    // Point to non-existent path
    rmSync(configDir, { recursive: true });
    process.env.CONFIG_DIR = join(tmpdir(), "nonexistent-config-" + Date.now());

    const id = getInstanceIdentity();
    expect(id.name).toBe(DEFAULT_IDENTITY.name);
    expect(id.tagline).toBe(DEFAULT_IDENTITY.tagline);
  });

  it("E2: config directory exists but is empty", () => {
    // configDir exists but has no files
    const id = getInstanceIdentity();
    expect(id.name).toBe(DEFAULT_IDENTITY.name);
    const prompts = getInstancePrompts();
    expect(prompts).toEqual(DEFAULT_PROMPTS);
  });

  it("E3: identity.json exists but other files missing", () => {
    writeConfig("identity.json", VALID_IDENTITY);
    const config = loadInstanceConfig();
    expect(config.identity.name).toBe("Acme Dental");
    expect(config.prompts).toEqual(DEFAULT_PROMPTS);
    expect(config.services).toEqual(DEFAULT_SERVICES);
    expect(config.tools).toEqual(DEFAULT_TOOLS);
  });

  it("E4: CONFIG_DIR env var overrides default path", () => {
    const customDir = mkdtempSync(join(tmpdir(), "custom-config-"));
    process.env.CONFIG_DIR = customDir;
    resetConfigCache();
    writeFileSync(
      join(customDir, "identity.json"),
      JSON.stringify({ ...VALID_IDENTITY, name: "Custom Instance" }),
    );
    const id = getInstanceIdentity();
    expect(id.name).toBe("Custom Instance");
    rmSync(customDir, { recursive: true });
  });

  it("E5: config with Unicode brand name", () => {
    writeConfig("identity.json", { ...VALID_IDENTITY, name: "ストゥディオ・オルド" });
    const id = getInstanceIdentity();
    expect(id.name).toBe("ストゥディオ・オルド");
  });

  it("E6: config with maximum-length fields at boundary", () => {
    writeConfig("identity.json", { ...VALID_IDENTITY, name: "A".repeat(100) });
    const id = getInstanceIdentity();
    expect(id.name).toBe("A".repeat(100));
  });

  it("E7: tools.json with both enabled and disabled containing same tool", () => {
    writeConfig("tools.json", {
      enabled: ["calculator"],
      disabled: ["calculator"],
    });
    const tools = getInstanceTools();
    expect(tools.enabled).toContain("calculator");
    expect(tools.disabled).toContain("calculator");
    // The actual filtering in tool-composition-root applies disabled after enabled,
    // so calculator would be disabled. That logic is tested in integration tests.
  });

  it("E8: tools.json with unknown tool IDs", () => {
    writeConfig("tools.json", { enabled: ["future_tool_v2"] });
    const tools = getInstanceTools();
    expect(tools.enabled).toEqual(["future_tool_v2"]);
    // No error — silently stored, composition root ignores unknown names
  });

  it("E9: services.json with offerings[].id containing special characters", () => {
    writeConfig("services.json", {
      offerings: [
        { id: "my sprint!", name: "Bad Service", description: "Desc", lane: "individual" },
      ],
      bookingEnabled: true,
    });
    try {
      loadInstanceConfig();
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ConfigValidationError);
      expect((e as ConfigValidationError).violations).toContainEqual(
        expect.stringContaining("alphanumeric and hyphens only"),
      );
    }
  });

  it("E10: identity.json with extra unknown fields", () => {
    writeConfig("identity.json", { ...VALID_IDENTITY, unknownField: true, anotherExtra: 42 });
    const id = getInstanceIdentity();
    expect(id.name).toBe("Acme Dental");
    // Unknown fields ignored, known fields validated
  });

  it("E11: concurrent access to cached config", () => {
    writeConfig("identity.json", VALID_IDENTITY);
    // Multiple synchronous calls — all return same cached object
    const results = Array.from({ length: 10 }, () => getInstanceIdentity());
    for (const r of results) {
      expect(r).toBe(results[0]); // Same object reference
    }
  });

  it("E12: prompts.json with firstMessage but no personality", () => {
    writeConfig("prompts.json", { firstMessage: { default: "Hello!" } });
    const prompts = getInstancePrompts();
    expect(prompts.personality).toBeUndefined();
    expect(prompts.firstMessage?.default).toBe("Hello!");
  });

  it("E13: services.json with estimatedPrice at zero", () => {
    writeConfig("services.json", {
      offerings: [
        { id: "free-consult", name: "Free Consultation", description: "Complimentary", lane: "individual", estimatedPrice: 0 },
      ],
      bookingEnabled: true,
    });
    const svc = getInstanceServices();
    expect(svc.offerings[0].estimatedPrice).toBe(0);
  });
});
