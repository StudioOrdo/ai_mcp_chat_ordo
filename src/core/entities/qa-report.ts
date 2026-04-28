import type { FactoryAssetKind, QACriterion } from "./factory-constants";
import type { QAFinding } from "./factory-asset";
import { hasBlockingQAFindings } from "./factory-asset";
import { hasDuplicateStrings, isValidTimestamp, pushError } from "./factory-validation";

export interface AssetQAReport {
  assetId: string;
  assetKind: FactoryAssetKind;
  findings: readonly QAFinding[];
  status: "passed" | "failed";
}

export interface QAReport {
  id: string;
  schemaVersion: 1;
  workOrderId: string;
  status: "passed" | "failed" | "needs_review";
  totalFindings: number;
  passedCriteria: readonly QACriterion[];
  failedCriteria: readonly QACriterion[];
  assetReports: readonly AssetQAReport[];
  pageFindings: readonly QAFinding[];
  recommendedFixes: readonly string[];
  autoResolvableCount: number;
  requiresUserDecision: boolean;
  createdAt: string;
}

export function listQAReportValidationErrors(report: QAReport): string[] {
  const errors: string[] = [];
  const assetFindingCount = report.assetReports.reduce((count, assetReport) => count + assetReport.findings.length, 0);
  const totalFindings = assetFindingCount + report.pageFindings.length;
  const blockingFindingCount = report.assetReports.reduce(
    (count, assetReport) => count + assetReport.findings.filter((finding) => finding.severity === "error").length,
    0,
  ) + report.pageFindings.filter((finding) => finding.severity === "error").length;

  pushError(errors, report.schemaVersion !== 1, "QAReport.schemaVersion must be 1.");
  pushError(errors, !isValidTimestamp(report.createdAt), "QAReport.createdAt must be a valid timestamp.");
  pushError(errors, report.totalFindings !== totalFindings, "QAReport.totalFindings must equal the number of asset and page findings.");
  pushError(errors, hasDuplicateStrings(report.passedCriteria), "QAReport.passedCriteria cannot contain duplicates.");
  pushError(errors, hasDuplicateStrings(report.failedCriteria), "QAReport.failedCriteria cannot contain duplicates.");
  pushError(
    errors,
    report.passedCriteria.some((criterion) => report.failedCriteria.includes(criterion)),
    "QAReport.passedCriteria and failedCriteria cannot overlap.",
  );
  pushError(
    errors,
    !report.requiresUserDecision && blockingFindingCount > report.autoResolvableCount,
    "QAReport.requiresUserDecision must be true when blocking findings exceed the auto-resolvable count.",
  );

  for (const assetReport of report.assetReports) {
    pushError(
      errors,
      assetReport.status === "passed" && hasBlockingQAFindings(assetReport.findings),
      `AssetQAReport ${assetReport.assetId} cannot be passed when it contains error-severity findings.`,
    );
  }

  return errors;
}