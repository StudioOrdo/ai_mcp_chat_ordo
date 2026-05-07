import { describe, expect, it } from "vitest";
import {
  aggregateApplianceHealthStatus,
  getApplianceHealthReport,
  summarizeApplianceHealth,
} from "./health-facade";
import { createProbeResult, type ApplianceHealthProbe } from "./health-types";

const checkedAt = "2026-05-02T00:00:00.000Z";

function probe(params: {
  component: Parameters<typeof createProbeResult>[0]["component"];
  status: Parameters<typeof createProbeResult>[0]["status"];
  impact: Parameters<typeof createProbeResult>[0]["impact"];
  warnings?: string[];
}): ApplianceHealthProbe {
  return {
    component: params.component,
    run: () => createProbeResult({
      component: params.component,
      status: params.status,
      impact: params.impact,
      checkedAt,
      summary: `${params.component} ${params.status}`,
      warnings: params.warnings,
    }),
  };
}

describe("appliance health facade aggregation", () => {
  it("aggregates all healthy probes to healthy", async () => {
    const report = await getApplianceHealthReport({
      generatedAt: checkedAt,
      probes: [
        probe({ component: "runtime", status: "healthy", impact: "required" }),
        probe({ component: "data", status: "healthy", impact: "required" }),
        probe({ component: "sqlite", status: "healthy", impact: "required" }),
        probe({ component: "resources", status: "healthy", impact: "required" }),
        probe({ component: "provider", status: "healthy", impact: "required" }),
        probe({ component: "media_worker", status: "disabled", impact: "optional" }),
        probe({ component: "backup_restore", status: "unknown", impact: "informational" }),
      ],
    });

    expect(report.status).toBe("healthy");
    expect(report.summary).toMatchObject({
      healthy: 5,
      disabled: 1,
      unknown: 1,
    });
  });

  it("maps required blocked components to blocked", () => {
    expect(aggregateApplianceHealthStatus([
      createProbeResult({
        component: "resources",
        status: "blocked",
        impact: "required",
        checkedAt,
        summary: "resources blocked",
      }),
    ])).toBe("blocked");
  });

  it("maps actionable optional degradation to degraded", () => {
    expect(aggregateApplianceHealthStatus([
      createProbeResult({
        component: "runtime",
        status: "healthy",
        impact: "required",
        checkedAt,
        summary: "runtime healthy",
      }),
      createProbeResult({
        component: "media_worker",
        status: "degraded",
        impact: "optional",
        checkedAt,
        summary: "media degraded",
      }),
    ])).toBe("degraded");
  });

  it("does not degrade for informational unknown components", () => {
    expect(aggregateApplianceHealthStatus([
      createProbeResult({
        component: "runtime",
        status: "healthy",
        impact: "required",
        checkedAt,
        summary: "runtime healthy",
      }),
      createProbeResult({
        component: "backup_restore",
        status: "unknown",
        impact: "informational",
        checkedAt,
        summary: "not implemented",
      }),
    ])).toBe("healthy");
  });

  it("summarizes component statuses and preserves warnings", async () => {
    const components = [
      createProbeResult({
        component: "runtime",
        status: "degraded",
        impact: "required",
        checkedAt,
        summary: "runtime warning",
        warnings: ["runtime warning"],
      }),
      createProbeResult({
        component: "search",
        status: "unknown",
        impact: "optional",
        checkedAt,
        summary: "search unknown",
      }),
    ];

    expect(summarizeApplianceHealth(components)).toMatchObject({
      degraded: 1,
      unknown: 1,
    });

    const report = await getApplianceHealthReport({
      generatedAt: checkedAt,
      probes: components.map((component) => ({
        component: component.component,
        run: () => component,
      })),
    });

    expect(report.warnings).toContain("runtime warning");
  });

  it("turns probe timeouts into component degradation without blocking the report", async () => {
    const report = await getApplianceHealthReport({
      generatedAt: checkedAt,
      timeoutMs: 1,
      probes: [
        probe({ component: "runtime", status: "healthy", impact: "required" }),
        {
          component: "media_worker",
          run: () => new Promise((resolve) => {
            setTimeout(() => {
              resolve(createProbeResult({
                component: "media_worker",
                status: "healthy",
                impact: "optional",
                checkedAt,
                summary: "too late",
              }));
            }, 50);
          }),
        },
        {
          component: "backup_restore",
          run: () => new Promise((resolve) => {
            setTimeout(() => {
              resolve(createProbeResult({
                component: "backup_restore",
                status: "healthy",
                impact: "informational",
                checkedAt,
                summary: "too late",
              }));
            }, 50);
          }),
        },
      ],
    });

    expect(report.components).toEqual(expect.arrayContaining([
      expect.objectContaining({
        component: "media_worker",
        status: "degraded",
        remediation: "Inspect subsystem responsiveness and health probe dependencies.",
      }),
      expect.objectContaining({
        component: "backup_restore",
        status: "unknown",
        impact: "informational",
      }),
    ]));
    expect(report.status).toBe("degraded");
    expect(report.warnings).toContain("media_worker health probe exceeded 1ms.");
  });
});
