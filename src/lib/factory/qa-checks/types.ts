import type { Composition } from "@/core/entities/composition";
import type { QACriterion } from "@/core/entities/factory-constants";
import type { FactoryAsset, QAFinding } from "@/core/entities/factory-asset";
import type { ProductBrief } from "@/core/entities/product-brief";

export interface AssetQACheckContext {
  brief: ProductBrief;
  asset: FactoryAsset;
  siblingAssets: readonly FactoryAsset[];
}

export interface PageQACheckContext {
  brief: ProductBrief;
  composition: Composition;
  assets: readonly FactoryAsset[];
}

export interface AssetQACheck {
  readonly criterion: QACriterion;
  readonly supportedAssetKinds: readonly FactoryAsset["kind"][];
  run(context: AssetQACheckContext): Promise<readonly QAFinding[]>;
}

export interface PageQACheck {
  readonly criterion: QACriterion;
  run(context: PageQACheckContext): Promise<readonly QAFinding[]>;
}