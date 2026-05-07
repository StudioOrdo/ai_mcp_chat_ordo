import { describe, expect, it } from "vitest";

import { redactSecretField } from "./provider-redaction";

describe("provider redaction", () => {
  it("does not expose raw secret values", () => {
    const redacted = redactSecretField({
      key: "ANTHROPIC_API_KEY",
      value: "sk-ant-secret-1234",
      source: "env",
      configured: true,
    });

    expect(redacted).toEqual({
      key: "ANTHROPIC_API_KEY",
      source: "env",
      configured: true,
      last4: "1234",
    });
    expect(JSON.stringify(redacted)).not.toContain("sk-ant-secret");
  });

  it("reports missing secrets without a diagnostic suffix", () => {
    expect(redactSecretField({
      key: "OPENAI_API_KEY",
      value: null,
      source: "missing",
      configured: false,
    })).toEqual({
      key: "OPENAI_API_KEY",
      source: "missing",
      configured: false,
      last4: null,
    });
  });
});
