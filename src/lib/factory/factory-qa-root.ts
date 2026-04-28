import { QACheckRegistry } from "./qa-check-registry";
import { AssetAccessibilityCheck } from "./qa-checks/asset-accessibility-check";
import { AssetPerformanceCheck } from "./qa-checks/asset-performance-check";
import { ChartAccuracyCheck } from "./qa-checks/chart-accuracy-check";
import { CompositionBrandCheck } from "./qa-checks/composition-brand-check";
import { CompositionCompletenessCheck } from "./qa-checks/composition-completeness-check";
import { CompositionPerformanceCheck } from "./qa-checks/composition-performance-check";
import { CompositionToneCheck } from "./qa-checks/composition-tone-check";
import { CompositionUniquenessCheck } from "./qa-checks/composition-uniqueness-check";

export function createFactoryQACheckRegistry(): QACheckRegistry {
  const registry = new QACheckRegistry();

  registry.registerAssetCheck(new AssetAccessibilityCheck());
  registry.registerAssetCheck(new AssetPerformanceCheck());
  registry.registerAssetCheck(new ChartAccuracyCheck());

  registry.registerPageCheck(new CompositionCompletenessCheck());
  registry.registerPageCheck(new CompositionPerformanceCheck());
  registry.registerPageCheck(new CompositionToneCheck());
  registry.registerPageCheck(new CompositionBrandCheck());
  registry.registerPageCheck(new CompositionUniquenessCheck());

  return registry;
}