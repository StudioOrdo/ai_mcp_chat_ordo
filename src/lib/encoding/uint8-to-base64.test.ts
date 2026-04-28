import { describe, expect, it } from "vitest";

import {
  UINT8_TO_BASE64_CHUNK_SIZE,
  uint8ArrayToBase64,
} from "./uint8-to-base64";

function buildBytes(length: number): Uint8Array {
  return Uint8Array.from({ length }, (_, index) => index % 251);
}

describe("uint8ArrayToBase64", () => {
  it("returns an empty string for empty input", () => {
    expect(uint8ArrayToBase64(new Uint8Array())).toBe("");
  });

  it("matches Buffer base64 output for small input", () => {
    const bytes = Uint8Array.from([0, 1, 2, 253, 254, 255]);

    expect(uint8ArrayToBase64(bytes)).toBe(Buffer.from(bytes).toString("base64"));
  });

  it("matches Buffer base64 output for a 1 MB buffer", () => {
    const bytes = buildBytes(1_024 * 1_024);

    expect(uint8ArrayToBase64(bytes)).toBe(Buffer.from(bytes).toString("base64"));
  });

  it("handles a 10 MB buffer without throwing and preserves output", () => {
    const bytes = buildBytes(10 * 1_024 * 1_024);

    expect(() => uint8ArrayToBase64(bytes)).not.toThrow();
    expect(uint8ArrayToBase64(bytes)).toBe(Buffer.from(bytes).toString("base64"));
  });

  it("handles an exact chunk boundary correctly", () => {
    const bytes = buildBytes(UINT8_TO_BASE64_CHUNK_SIZE);

    expect(uint8ArrayToBase64(bytes)).toBe(Buffer.from(bytes).toString("base64"));
  });
});