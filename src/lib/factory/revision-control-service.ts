import type { ProductBrief } from "@/core/entities/product-brief";

import {
  AssetRefinementService,
  type AssetRefinementRequest,
  type AssetRefinementResult,
} from "./asset-refinement-service";
import {
  PauseWorkOrderService,
  type PauseWorkOrderRequest,
  type PauseWorkOrderResult,
} from "./pause-work-order-service";
import { ResumeWorkOrderService } from "./resume-work-order-service";

export interface RevisionControlServiceOptions {
  assetRefinementService: AssetRefinementService;
  pauseWorkOrderService: PauseWorkOrderService;
  resumeWorkOrderService: ResumeWorkOrderService;
}

export class FactoryRevisionControlService {
  constructor(private readonly options: RevisionControlServiceOptions) {}

  refineAsset(request: AssetRefinementRequest): Promise<AssetRefinementResult> {
    return this.options.assetRefinementService.refine(request);
  }

  pauseWorkOrder(request: PauseWorkOrderRequest): Promise<PauseWorkOrderResult> {
    return this.options.pauseWorkOrderService.requestPause(request);
  }

  resumeWorkOrder(input: {
    workOrderId: string;
    brief: ProductBrief;
    requestedStageKey?: string;
  }) {
    return this.options.resumeWorkOrderService.resume(input);
  }
}