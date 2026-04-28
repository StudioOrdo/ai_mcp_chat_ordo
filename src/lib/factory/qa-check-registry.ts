import type { QACriterion } from "@/core/entities/factory-constants";
import type { FactoryAsset } from "@/core/entities/factory-asset";

import type { AssetQACheck, PageQACheck } from "./qa-checks/types";

export class QACheckRegistry {
  private readonly assetChecks: AssetQACheck[] = [];
  private readonly pageChecks: PageQACheck[] = [];

  registerAssetCheck(check: AssetQACheck): void {
    this.assetChecks.push(check);
  }

  registerPageCheck(check: PageQACheck): void {
    this.pageChecks.push(check);
  }

  listAssetChecks(criteria: readonly QACriterion[], assetKind: FactoryAsset["kind"]): AssetQACheck[] {
    return this.assetChecks.filter(
      (check) => criteria.includes(check.criterion) && check.supportedAssetKinds.includes(assetKind),
    );
  }

  listPageChecks(criteria: readonly QACriterion[]): PageQACheck[] {
    return this.pageChecks.filter((check) => criteria.includes(check.criterion));
  }

  listMissingCriteria(
    criteria: readonly QACriterion[],
    assetKinds: readonly FactoryAsset["kind"][],
  ): QACriterion[] {
    const supported = new Set<QACriterion>();

    for (const kind of assetKinds) {
      for (const check of this.assetChecks) {
        if (check.supportedAssetKinds.includes(kind)) {
          supported.add(check.criterion);
        }
      }
    }

    for (const check of this.pageChecks) {
      supported.add(check.criterion);
    }

    return criteria.filter((criterion) => !supported.has(criterion));
  }
}