import { randomUUID } from "node:crypto";

import type { Composition } from "@/core/entities/composition";
import type { FactoryAsset, QAFinding } from "@/core/entities/factory-asset";
import type { ProductBrief } from "@/core/entities/product-brief";
import type { AssetQAReport, QAReport } from "@/core/entities/qa-report";

import { QACheckRegistry } from "./qa-check-registry";
import { isAutoResolvableFinding } from "./qa-remediation";

export interface QAEvaluatorOptions {
  now?: () => string;
  idGenerator?: () => string;
}

export class QAEvaluator {
  constructor(
    private readonly registry: QACheckRegistry,
    private readonly options: QAEvaluatorOptions = {},
  ) {}

  async evaluateAssetReport(input: {
    brief: ProductBrief;
    workOrderId: string;
    assets: readonly FactoryAsset[];
  }): Promise<QAReport> {
    const assetReports: AssetQAReport[] = [];

    for (const asset of input.assets) {
      const findings = await this.runAssetChecks(input.brief, asset, input.assets);
      assetReports.push({
        assetId: asset.id,
        assetKind: asset.kind,
        findings,
        status: findings.some((finding) => finding.severity === "error") ? "failed" : "passed",
      });
    }

    return this.buildReport({
      workOrderId: input.workOrderId,
      brief: input.brief,
      assetReports,
      pageFindings: [],
      statusWhenFindingsExist: "needs_review",
    });
  }

  async evaluatePageReport(input: {
    brief: ProductBrief;
    workOrderId: string;
    composition: Composition;
    assets: readonly FactoryAsset[];
  }): Promise<QAReport> {
    const checks = this.registry.listPageChecks(input.brief.qaCriteria);
    const pageFindings = (
      await Promise.all(
        checks.map((check) => check.run({
          brief: input.brief,
          composition: input.composition,
          assets: input.assets,
        })),
      )
    ).flat();

    return this.buildReport({
      workOrderId: input.workOrderId,
      brief: input.brief,
      assetReports: [],
      pageFindings,
      statusWhenFindingsExist: "needs_review",
    });
  }

  buildResolutionReport(input: {
    brief: ProductBrief;
    workOrderId: string;
    assetReport: QAReport;
    pageReport: QAReport;
  }): QAReport {
    const assetFindings = input.assetReport.assetReports.flatMap((report) => report.findings);
    const allFindings = assetFindings.concat(input.pageReport.pageFindings);
    const failedCriteria = [...new Set(allFindings.map((finding) => finding.criterion))];
    const passedCriteria = input.brief.qaCriteria.filter((criterion) => !failedCriteria.includes(criterion));

    return {
      id: `qa_${this.id()}`,
      schemaVersion: 1,
      workOrderId: input.workOrderId,
      status: allFindings.some((finding) => finding.severity === "error") ? "needs_review" : "passed",
      totalFindings: allFindings.length,
      passedCriteria,
      failedCriteria,
      assetReports: input.assetReport.assetReports,
      pageFindings: input.pageReport.pageFindings,
      recommendedFixes: [...new Set(allFindings.flatMap((finding) => finding.suggestedFix ? [finding.suggestedFix] : []))],
      autoResolvableCount: allFindings.filter((finding) => isAutoResolvableFinding(finding)).length,
      requiresUserDecision: allFindings.some((finding) => finding.severity === "error"),
      createdAt: this.now(),
    };
  }

  private async runAssetChecks(
    brief: ProductBrief,
    asset: FactoryAsset,
    assets: readonly FactoryAsset[],
  ): Promise<readonly QAFinding[]> {
    const checks = this.registry.listAssetChecks(brief.qaCriteria, asset.kind);
    return (
      await Promise.all(
        checks.map((check) => check.run({
          brief,
          asset,
          siblingAssets: assets,
        })),
      )
    ).flat();
  }

  private buildReport(input: {
    workOrderId: string;
    brief: ProductBrief;
    assetReports: readonly AssetQAReport[];
    pageFindings: readonly QAFinding[];
    statusWhenFindingsExist: QAReport["status"];
  }): QAReport {
    const allFindings = input.assetReports.flatMap((report) => report.findings).concat(input.pageFindings);
    const failedCriteria = [...new Set(allFindings.map((finding) => finding.criterion))];

    return {
      id: `qa_${this.id()}`,
      schemaVersion: 1,
      workOrderId: input.workOrderId,
      status: allFindings.some((finding) => finding.severity === "error")
        ? "failed"
        : allFindings.length > 0
          ? input.statusWhenFindingsExist
          : "passed",
      totalFindings: allFindings.length,
      passedCriteria: input.brief.qaCriteria.filter((criterion) => !failedCriteria.includes(criterion)),
      failedCriteria,
      assetReports: [...input.assetReports],
      pageFindings: [...input.pageFindings],
      recommendedFixes: [...new Set(allFindings.flatMap((finding) => finding.suggestedFix ? [finding.suggestedFix] : []))],
      autoResolvableCount: allFindings.filter((finding) => isAutoResolvableFinding(finding)).length,
      requiresUserDecision: allFindings.some((finding) => finding.severity === "error"),
      createdAt: this.now(),
    };
  }

  private now(): string {
    return this.options.now?.() ?? new Date().toISOString();
  }

  private id(): string {
    return this.options.idGenerator?.() ?? randomUUID();
  }
}