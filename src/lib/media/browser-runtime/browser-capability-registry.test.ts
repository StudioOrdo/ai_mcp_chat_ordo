import { describe, expect, it } from "vitest";

import {
  BROWSER_CAPABILITY_TOOL_NAMES,
  getBrowserCapabilityDescriptor,
  isBrowserCapabilityToolName,
  listBrowserCapabilityDescriptors,
} from "./browser-capability-registry";

describe("browser-capability-registry", () => {
  it("exposes the browser-managed media tool names including compose_media", () => {
    expect(BROWSER_CAPABILITY_TOOL_NAMES).toHaveLength(3);
    expect(new Set(BROWSER_CAPABILITY_TOOL_NAMES)).toEqual(new Set([
      "generate_chart",
      "generate_graph",
      "compose_media",
    ]));
  });

  it("returns stable browser capability descriptors for supported tools", () => {
    expect(getBrowserCapabilityDescriptor("generate_audio")).toBeNull();
    expect(getBrowserCapabilityDescriptor("generate_chart")).toMatchObject({
      capabilityId: "generate_chart",
      supportedAssetKinds: ["chart"],
    });
  });

  it("returns compose_media as wasm_worker with cross-origin isolation required", () => {
    const descriptor = getBrowserCapabilityDescriptor("compose_media");
    expect(descriptor).toMatchObject({
      capabilityId: "compose_media",
      runtimeKind: "wasm_worker",
      requiresCrossOriginIsolation: true,
      fallbackPolicy: "server",
      recoveryPolicy: "fallback_to_server",
      maxConcurrentExecutions: 1,
    });
  });

  it("keeps browser capability admission explicit", () => {
    expect(isBrowserCapabilityToolName("generate_graph")).toBe(true);
    expect(isBrowserCapabilityToolName("compose_media")).toBe(true);
    expect(isBrowserCapabilityToolName("generate_audio")).toBe(false);
    expect(isBrowserCapabilityToolName("search_corpus")).toBe(false);
    expect(listBrowserCapabilityDescriptors()).toHaveLength(3);
  });
});
