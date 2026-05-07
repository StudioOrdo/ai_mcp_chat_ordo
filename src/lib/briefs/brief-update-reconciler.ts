import type { BriefReadModelDataMapper } from "@/adapters/BriefReadModelDataMapper";
import type { BriefUpdateRequestDataMapper } from "@/adapters/BriefUpdateRequestDataMapper";
import type {
  DurableBriefUpdateRequest,
  StoredBriefUpdateResult,
} from "@/core/entities/brief-execution";
import { assertValidBriefUpdateResult } from "@/core/entities/brief-execution";

export interface BriefUpdateReconcilerDeps {
  requests: BriefUpdateRequestDataMapper;
  briefs: BriefReadModelDataMapper;
  now?: () => string;
}

export class BriefUpdateReconciler {
  constructor(private readonly deps: BriefUpdateReconcilerDeps) {}

  async reconcile(request: DurableBriefUpdateRequest, result: StoredBriefUpdateResult): Promise<void> {
    assertValidBriefUpdateResult(result, request);

    if (result.status === "failed") {
      return;
    }
    if (!result.brief || !result.manifest) {
      throw new Error("Brief update result cannot reconcile without a staged brief and manifest.");
    }

    await this.deps.briefs.saveSectionBrief({
      brief: result.brief,
      manifest: result.manifest,
      ownerUserId: request.scope.ownerUserId,
      visibilityPolicy: request.visibilityPolicy,
      now: this.now(),
    });
    await this.deps.requests.markReconciled(request.requestId, { now: this.now() });
  }

  private now(): string {
    return this.deps.now?.() ?? new Date().toISOString();
  }
}
