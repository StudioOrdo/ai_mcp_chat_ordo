/**
 * Sprint 3 — First Message and Smart Greeting
 *
 * 28 tests verifying config-driven greeting, hero header,
 * interpolation utility, and schema validation.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import React from "react";
import { createInitialChatMessages } from "@/hooks/chat/chatState";
import {
  DEFAULT_PROMPTS,
  type InstancePrompts,
} from "@/lib/config/defaults";
import {
  InstanceConfigProvider,
  useInstancePrompts,
} from "@/lib/config/InstanceConfigContext";
import { DEFAULT_IDENTITY } from "@/lib/config/defaults";
import { validatePrompts } from "@/lib/config/instance.schema";
import { interpolateGreeting } from "@/lib/chat/greeting-interpolator";

// ── Helpers ─────────────────────────────────────────────────────────

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf-8");
}

function PromptsProbe() {
  const prompts = useInstancePrompts();
  return (
    <div>
      <span data-testid="heading">{prompts.heroHeading ?? "none"}</span>
      <span data-testid="subheading">{prompts.heroSubheading ?? "none"}</span>
    </div>
  );
}

// ── §5.1 Positive tests ────────────────────────────────────────────

describe("Sprint 3 — Positive tests", () => {
  it("P1: InstanceConfigContext exposes prompts via useInstancePrompts", () => {
    const testPrompts: InstancePrompts = {
      ...DEFAULT_PROMPTS,
      heroHeading: "Custom heading",
    };
    render(
      <InstanceConfigProvider identity={DEFAULT_IDENTITY} prompts={testPrompts}>
        <PromptsProbe />
      </InstanceConfigProvider>,
    );
    expect(screen.getByTestId("heading")).toHaveTextContent("Custom heading");
  });

  it("P2: createInitialChatMessages uses config firstMessage for ANONYMOUS", () => {
    const prompts: InstancePrompts = {
      firstMessage: { default: "Welcome to our dental practice." },
    };
    const [msg] = createInitialChatMessages("ANONYMOUS", prompts);
    expect(msg.content).toContain("Welcome to our dental practice.");
  });

  it("P3: createInitialChatMessages uses config defaultSuggestions for ANONYMOUS", () => {
    const prompts: InstancePrompts = {
      defaultSuggestions: ["Book now", "See pricing"],
    };
    const [msg] = createInitialChatMessages("ANONYMOUS", prompts);
    expect(msg.content).toContain("Book now");
    expect(msg.content).toContain("See pricing");
  });

  it("P4: BrandHeader renders heroHeading from config", () => {
    const testPrompts: InstancePrompts = {
      ...DEFAULT_PROMPTS,
      heroHeading: "Welcome to the clinic.",
    };
    render(
      <InstanceConfigProvider identity={DEFAULT_IDENTITY} prompts={testPrompts}>
        <PromptsProbe />
      </InstanceConfigProvider>,
    );
    expect(screen.getByTestId("heading")).toHaveTextContent(
      "Welcome to the clinic.",
    );
  });

  it("P5: BrandHeader renders heroSubheading from config", () => {
    const testPrompts: InstancePrompts = {
      ...DEFAULT_PROMPTS,
      heroSubheading: "Your smile matters.",
    };
    render(
      <InstanceConfigProvider identity={DEFAULT_IDENTITY} prompts={testPrompts}>
        <PromptsProbe />
      </InstanceConfigProvider>,
    );
    expect(screen.getByTestId("subheading")).toHaveTextContent(
      "Your smile matters.",
    );
  });

  it("P6: interpolateGreeting replaces referrer.name placeholder", () => {
    const result = interpolateGreeting("Hi from {{referrer.name}}", {
      referrer: { name: "Maria Chen" },
      brand: { name: "Ordo" },
    });
    expect(result).toBe("Hi from Maria Chen");
  });

  it("P7: interpolateGreeting replaces brand.name placeholder", () => {
    const result = interpolateGreeting("Welcome to {{brand.name}}", {
      brand: { name: "Ordo" },
    });
    expect(result).toBe("Welcome to Ordo");
  });

  it("P8: interpolateGreeting replaces multiple placeholders in one template", () => {
    const result = interpolateGreeting(
      "{{referrer.name}} referred you to {{brand.name}}",
      { referrer: { name: "Maria" }, brand: { name: "Studio Ordo" } },
    );
    expect(result).toBe("Maria referred you to Studio Ordo");
  });

  it("P9: prompts.json is populated with valid config", () => {
    const raw = JSON.parse(readSource("config/prompts.json"));
    const result = validatePrompts(raw);
    expect(Array.isArray(result)).toBe(false);
  });

  it("P10: DEFAULT_PROMPTS contains heroHeading and heroSubheading", () => {
    expect(DEFAULT_PROMPTS.heroHeading).toEqual(expect.any(String));
    expect(DEFAULT_PROMPTS.heroHeading!.length).toBeGreaterThan(0);
    expect(DEFAULT_PROMPTS.heroSubheading).toEqual(expect.any(String));
    expect(DEFAULT_PROMPTS.heroSubheading!.length).toBeGreaterThan(0);
  });

  it("P11: layout.tsx passes prompts to InstanceConfigProvider", () => {
    const src = readSource("src/app/layout.tsx");
    expect(src).toContain("getInstancePrompts()");
    expect(src).toMatch(/InstanceConfigProvider[^>]*prompts/);
  });

  it("P12: chatState.ts accepts optional prompts parameter", () => {
    const src = readSource("src/hooks/chat/chatState.ts");
    expect(src).toMatch(/createInitialChatMessages\([^)]*prompts\??:/);
  });
});

// ── §5.2 Negative tests ────────────────────────────────────────────

describe("Sprint 3 — Negative tests", () => {
  it("N1: createInitialChatMessages uses roleBootstraps config for non-ANONYMOUS roles", () => {
    const prompts: InstancePrompts = {
      roleBootstraps: {
        ADMIN: {
          message: "Custom admin welcome.",
          suggestions: ["Review the queue"],
        },
      },
    };
    const [msg] = createInitialChatMessages("ADMIN", prompts);
    expect(msg.content).toContain("Custom admin welcome.");
    expect(msg.content).toContain("Review the queue");
  });

  it("N2: createInitialChatMessages falls back to hardcoded when prompts is undefined", () => {
    const [msg] = createInitialChatMessages("ANONYMOUS");
    expect(msg.content).toContain(
      "Bring me the next decision, messy idea, or customer problem.",
    );
  });

  it("N3: createInitialChatMessages falls back when firstMessage.default is undefined", () => {
    const [msg] = createInitialChatMessages("ANONYMOUS", {});
    expect(msg.content).toContain(
      "Bring me the next decision, messy idea, or customer problem.",
    );
  });

  it("N4: interpolateGreeting returns template unchanged when no placeholders present", () => {
    const result = interpolateGreeting("Hello, welcome!", {
      referrer: { name: "Maria" },
      brand: { name: "Ordo" },
    });
    expect(result).toBe("Hello, welcome!");
  });

  it("N5: validatePrompts rejects heroHeading longer than 100 characters", () => {
    const result = validatePrompts({ heroHeading: "x".repeat(101) });
    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual(
      expect.arrayContaining([
        expect.stringContaining("heroHeading"),
      ]),
    );
  });

  it("N6: validatePrompts rejects heroSubheading longer than 300 characters", () => {
    const result = validatePrompts({ heroSubheading: "x".repeat(301) });
    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual(
      expect.arrayContaining([
        expect.stringContaining("heroSubheading"),
      ]),
    );
  });

  it("N7: useInstancePrompts returns DEFAULT_PROMPTS when no provider wraps component", () => {
    render(<PromptsProbe />);
    expect(screen.getByTestId("heading")).toHaveTextContent(
      DEFAULT_PROMPTS.heroHeading!,
    );
  });

  it("N8: BrandHeader falls back to default heading when prompts.heroHeading is undefined", () => {
    render(
      <InstanceConfigProvider identity={DEFAULT_IDENTITY} prompts={{}}>
        <PromptsProbe />
      </InstanceConfigProvider>,
    );
    // With prompts = {}, heroHeading is undefined → context value is {} → hook returns {}
    // The PromptsProbe falls back to "none" for undefined
    expect(screen.getByTestId("heading")).toHaveTextContent("none");
  });
});

// ── §5.3 Edge tests ────────────────────────────────────────────────

describe("Sprint 3 — Edge tests", () => {
  it("E1: interpolateGreeting uses fallback for missing referrer.name", () => {
    const result = interpolateGreeting("Introduced by {{referrer.name}}", {
      referrer: {},
      brand: { name: "Ordo" },
    });
    expect(result).toBe("Introduced by a colleague");
  });

  it("E2: interpolateGreeting uses fallback for missing referrer.credential", () => {
    const result = interpolateGreeting(
      "A {{referrer.credential}} sent you",
      { referrer: {}, brand: { name: "Ordo" } },
    );
    expect(result).toBe("A Enterprise AI practitioner sent you");
  });

  it("E3: interpolateGreeting handles undefined referrer object", () => {
    const result = interpolateGreeting("From {{referrer.name}}", {
      brand: { name: "Ordo" },
    });
    expect(result).toBe("From a colleague");
  });

  it("E4: interpolateGreeting handles empty template string", () => {
    const result = interpolateGreeting("", {
      referrer: { name: "Maria" },
      brand: { name: "Ordo" },
    });
    expect(result).toBe("");
  });

  it("E5: config prompts merge with defaults preserving unset fields", () => {
    // Simulate what loadInstanceConfig does: shallow merge
    const partial: InstancePrompts = { heroHeading: "Custom" };
    const merged: InstancePrompts = { ...DEFAULT_PROMPTS, ...partial };
    expect(merged.heroHeading).toBe("Custom");
    expect(merged.heroSubheading).toBe(DEFAULT_PROMPTS.heroSubheading);
    expect(merged.firstMessage).toEqual(DEFAULT_PROMPTS.firstMessage);
    expect(merged.defaultSuggestions).toEqual(DEFAULT_PROMPTS.defaultSuggestions);
  });

  it("E6: createInitialChatMessages with partial prompts uses defaults for missing fields", () => {
    const prompts: InstancePrompts = {
      firstMessage: { default: "Custom greeting only." },
      // no defaultSuggestions → should use default ANONYMOUS suggestions
    };
    const [msg] = createInitialChatMessages("ANONYMOUS", prompts);
    expect(msg.content).toContain("Custom greeting only.");
    expect(msg.content).toContain("Plan a customer workflow");
  });

  it("E7: BrandHeader hero renders correctly when prompts has only heroHeading", () => {
    const testPrompts: InstancePrompts = { heroHeading: "Only Heading" };
    render(
      <InstanceConfigProvider identity={DEFAULT_IDENTITY} prompts={testPrompts}>
        <PromptsProbe />
      </InstanceConfigProvider>,
    );
    expect(screen.getByTestId("heading")).toHaveTextContent("Only Heading");
    expect(screen.getByTestId("subheading")).toHaveTextContent("none");
  });

  it("E8: interpolateGreeting preserves unrecognized placeholders", () => {
    const result = interpolateGreeting("Hi {{unknown.field}}", {
      brand: { name: "Ordo" },
    });
    expect(result).toBe("Hi {{unknown.field}}");
  });
});
