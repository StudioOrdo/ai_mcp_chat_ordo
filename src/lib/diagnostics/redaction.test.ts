import { describe, expect, it } from "vitest";

import { redactDiagnostics } from "./redaction";

describe("redactDiagnostics", () => {
  it("removes secret-like fields recursively", () => {
    const result = redactDiagnostics({
      authorization: "Bearer abc123",
      nested: {
        apiKey: "key",
        safe: "keep",
        headers: {
          cookie: "sid=secret",
        },
      },
    });

    expect(result.value).toEqual({
      authorization: "[redacted]",
      nested: {
        apiKey: "[redacted]",
        safe: "keep",
        headers: {
          cookie: "[redacted]",
        },
      },
    });
    expect(result.fields).toEqual(["authorization", "nested.apiKey", "nested.headers.cookie"]);
  });

  it("redacts bearer tokens embedded in strings", () => {
    const result = redactDiagnostics({
      message: "request failed with Bearer abc.def.ghi",
    });

    expect(result.value).toEqual({
      message: "request failed with Bearer [redacted]",
    });
    expect(result.fields).toEqual(["message"]);
  });
});
