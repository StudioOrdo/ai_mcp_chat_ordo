import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "../../..");

function read(relativePath: string): string {
  return readFileSync(path.join(ROOT, relativePath), "utf8");
}

describe("factory work-order operation architecture guardrails", () => {
  it("keeps direct factory deferred handlers out of user-facing catalog and routes", () => {
    const sources = [
      "src/core/capability-catalog/runtime-tool-binding.ts",
      "src/app/api/admin/factory/work-orders/[workOrderId]/revision/route.ts",
    ];

    for (const source of sources) {
      expect(read(source)).not.toMatch(/createProduceProductDeferredJobHandler|ProduceProductDeferredJobHandler/);
    }
  });

  it("keeps admin factory mutation routes on operation dispatch", () => {
    const source = read("src/app/api/admin/factory/work-orders/[workOrderId]/revision/route.ts");

    expect(source).toContain("createOperationActionDispatchService");
    expect(source).not.toMatch(/getAgentPlatformFacade\(\)\.reviseExecution|revisionControl\.(pauseWorkOrder|refineAsset|resumeWorkOrder)/);
  });

  it("does not project bespoke factory mutation next actions", () => {
    const source = read("src/core/platform/execution/ExecutionTimelineProjector.ts");

    expect(source).not.toContain('kind: "factory"');
  });

  it("excludes produce_product from prompt-visible direct tools", () => {
    const source = read("src/lib/chat/tool-capability-routing.ts");

    expect(source).toContain('"produce_product"');
  });
});
