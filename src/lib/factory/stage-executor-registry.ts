import type { StageKind } from "@/core/entities/factory-constants";

import type { StageExecutor } from "./stage-executors/types";

export class StageExecutorRegistry {
  private readonly executorsByKind = new Map<StageKind, StageExecutor>();

  constructor(executors: readonly StageExecutor[]) {
    for (const executor of executors) {
      if (this.executorsByKind.has(executor.kind)) {
        throw new Error(`Duplicate stage executor registration for kind ${executor.kind}.`);
      }
      this.executorsByKind.set(executor.kind, executor);
    }
  }

  get(kind: StageKind): StageExecutor | undefined {
    return this.executorsByKind.get(kind);
  }

  require(kind: StageKind): StageExecutor {
    const executor = this.get(kind);
    if (!executor) {
      throw new Error(`No stage executor registered for kind ${kind}.`);
    }
    return executor;
  }
}
