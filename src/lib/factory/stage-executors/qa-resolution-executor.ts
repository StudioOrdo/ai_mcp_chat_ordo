import type { QAReport } from "@/core/entities/qa-report";

import { createFactoryQACheckRegistry } from "../factory-qa-root";
import { QACheckRegistry } from "../qa-check-registry";
import { QARemediator } from "../qa-remediation";
import { listAssets, requireCurrentComposition, requireQAReport, type StageExecutionContext, type StageExecutionResult, type StageExecutor } from "./types";

export class QAResolutionExecutor implements StageExecutor {
  readonly kind = "qa_resolution" as const;

  private readonly remediator: QARemediator;

  constructor(registry: QACheckRegistry = createFactoryQACheckRegistry()) {
    this.remediator = new QARemediator(registry);
  }

  async execute(context: StageExecutionContext): Promise<StageExecutionResult> {
    const assetReport = requireQAReport(context, "qa_asset");
    const pageReport = requireQAReport(context, "qa_page");
    let remediation: Awaited<ReturnType<QARemediator["remediate"]>> | null = null;

    try {
      remediation = await this.remediator.remediate({
        brief: context.brief,
        workOrderId: context.workOrder.id,
        assets: listAssets(context),
        composition: requireCurrentComposition(context),
      });
    } catch (error) {
      if (!(error instanceof Error) || error.message !== "Required composition output was not found.") {
        throw error;
      }
    }

    const report: QAReport = remediation?.finalReport ?? {
      id: `qa_resolution_${context.workOrder.id}`,
      schemaVersion: 1,
      workOrderId: context.workOrder.id,
      status: [...assetReport.assetReports.flatMap((item) => item.findings), ...pageReport.pageFindings].some(
        (finding) => finding.severity === "error",
      )
        ? "needs_review"
        : "passed",
      totalFindings: assetReport.totalFindings + pageReport.totalFindings,
      passedCriteria: [...new Set([...assetReport.passedCriteria, ...pageReport.passedCriteria])].filter(
        (criterion) => !assetReport.failedCriteria.includes(criterion) && !pageReport.failedCriteria.includes(criterion),
      ),
      failedCriteria: [...new Set([...assetReport.failedCriteria, ...pageReport.failedCriteria])],
      assetReports: assetReport.assetReports,
      pageFindings: pageReport.pageFindings,
      recommendedFixes: [...new Set([...assetReport.recommendedFixes, ...pageReport.recommendedFixes])],
      autoResolvableCount: assetReport.autoResolvableCount + pageReport.autoResolvableCount,
      requiresUserDecision: assetReport.requiresUserDecision || pageReport.requiresUserDecision,
      createdAt: new Date().toISOString(),
    };

    return {
      entityKind: "qa_report",
      entity: report,
      supersedesEntityId: pageReport.id,
      supplementalOutputs: remediation?.supplementalOutputs,
    };
  }
}
