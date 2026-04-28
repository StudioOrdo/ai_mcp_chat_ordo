import { randomUUID } from "node:crypto";

import type { QAReport } from "@/core/entities/qa-report";

import { QAEvaluator } from "../qa-evaluator";
import { createFactoryQACheckRegistry } from "../factory-qa-root";
import { QACheckRegistry } from "../qa-check-registry";
import { listAssets, requireCurrentComposition, type StageExecutionContext, type StageExecutionResult, type StageExecutor } from "./types";

export class QAExecutor implements StageExecutor {
  readonly kind = "qa" as const;

  private readonly evaluator: QAEvaluator;

  constructor(registry: QACheckRegistry = createFactoryQACheckRegistry()) {
    this.evaluator = new QAEvaluator(registry);
  }

  async execute(context: StageExecutionContext): Promise<StageExecutionResult> {
    if (context.stage.config?.kind !== "qa") {
      throw new Error(`Stage ${context.stage.key} is missing qa config.`);
    }

    const assets = listAssets(context);
    const report: QAReport = context.stage.config.scope === "asset"
      ? await this.evaluator.evaluateAssetReport({
          brief: context.brief,
          workOrderId: context.workOrder.id,
          assets,
        })
      : await this.evaluator.evaluatePageReport({
          brief: context.brief,
          workOrderId: context.workOrder.id,
          composition: requireCurrentComposition(context),
          assets,
        });

    return {
      entityKind: "qa_report",
      entity: report,
    };
  }
}
