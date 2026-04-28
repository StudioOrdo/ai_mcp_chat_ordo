import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/observability/runtime-audit-log", () => ({
  appendRuntimeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

import {
  createNativeProcessExecutionTargetAdapter,
  createRemoteServiceExecutionTargetAdapter,
} from "./external-target-adapters";

describe("external-target-adapters", () => {
  it("invokes native_process targets through the configured runner", async () => {
    const runProcess = vi.fn(async () => JSON.stringify({ ok: true, route: "native_process" }));
    const adapter = createNativeProcessExecutionTargetAdapter({ runProcess });

    const result = await adapter.invoke({
      capability: {} as never,
      input: { query: "latest referral guidance" },
      context: {
        userId: "admin-1",
        role: "ADMIN",
        conversationId: "conv-1",
      },
      plan: {} as never,
      target: {
        kind: "native_process",
        capabilityName: "admin_web_search",
        label: "Native admin web search",
        sourceFacet: "target_override",
        readiness: "active",
        processId: "native-admin-search",
        command: process.execPath,
        args: ["-e", "process.exit(0)"],
      },
    });

    expect(runProcess).toHaveBeenCalledWith(
      expect.objectContaining({ processId: "native-admin-search" }),
      {
        query: "latest referral guidance",
        __executionContext: {
          userId: "admin-1",
          role: "ADMIN",
          conversationId: "conv-1",
        },
      },
      30_000,
    );
    expect(result).toEqual({ ok: true, route: "native_process" });
  });

  it("posts remote_service targets as JSON without execution metadata by default", async () => {
    const fetchImpl = vi.fn(async () => new Response(
      JSON.stringify({ ok: true, route: "remote_service" }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    )) as typeof fetch;
    const adapter = createRemoteServiceExecutionTargetAdapter({ fetchImpl });

    const result = await adapter.invoke({
      capability: {} as never,
      input: { query: "latest referral guidance" },
      context: {
        userId: "admin-1",
        role: "ADMIN",
        conversationId: "conv-1",
      },
      plan: {} as never,
      target: {
        kind: "remote_service",
        capabilityName: "admin_web_search",
        label: "Remote admin web search",
        sourceFacet: "target_override",
        readiness: "active",
        serviceId: "remote-admin-search",
        endpoint: "https://example.test/admin-web-search",
        method: "POST",
        headers: { authorization: "Bearer token" },
        bridgeExecutionContext: false,
      },
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://example.test/admin-web-search",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "content-type": "application/json",
          authorization: "Bearer token",
        }),
        body: JSON.stringify({ query: "latest referral guidance" }),
      }),
    );
    expect(result).toEqual({ ok: true, route: "remote_service" });
  });

  it("can opt remote_service targets into execution metadata bridging", async () => {
    const fetchImpl = vi.fn(async () => new Response(
      JSON.stringify({ ok: true, route: "remote_service" }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    )) as typeof fetch;
    const adapter = createRemoteServiceExecutionTargetAdapter({ fetchImpl });

    await adapter.invoke({
      capability: {} as never,
      input: { query: "latest referral guidance" },
      context: {
        userId: "admin-1",
        role: "ADMIN",
        conversationId: "conv-1",
      },
      plan: {} as never,
      target: {
        kind: "remote_service",
        capabilityName: "admin_web_search",
        label: "Remote admin web search",
        sourceFacet: "target_override",
        readiness: "active",
        serviceId: "remote-admin-search",
        endpoint: "https://example.test/admin-web-search",
        method: "POST",
        bridgeExecutionContext: true,
      },
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://example.test/admin-web-search",
      expect.objectContaining({
        body: JSON.stringify({
          query: "latest referral guidance",
          __executionContext: {
            userId: "admin-1",
            role: "ADMIN",
            conversationId: "conv-1",
          },
        }),
      }),
    );
  });

  it("raises remote_service failures with service context", async () => {
    const fetchImpl = vi.fn(async () => new Response("upstream unavailable", { status: 503 })) as typeof fetch;
    const adapter = createRemoteServiceExecutionTargetAdapter({ fetchImpl });

    await expect(adapter.invoke({
      capability: {} as never,
      input: { query: "latest referral guidance" },
      context: {
        userId: "admin-1",
        role: "ADMIN",
        conversationId: "conv-1",
      },
      plan: {} as never,
      target: {
        kind: "remote_service",
        capabilityName: "admin_web_search",
        label: "Remote admin web search",
        sourceFacet: "target_override",
        readiness: "active",
        serviceId: "remote-admin-search",
        endpoint: "https://example.test/admin-web-search",
        method: "POST",
        bridgeExecutionContext: false,
      },
    })).rejects.toThrow('Remote service target "remote-admin-search" responded with 503: upstream unavailable');
  });
});