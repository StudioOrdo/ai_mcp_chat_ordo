import {
  getBackupSelfService,
  getBackupSnapshotDataMapper,
  getBackupSystemCommandDataMapper,
  getFactoryRepository,
  getJobQueueRepository,
  getMaterializationRepository,
  getMediaWorkflowOrchestrator,
  getMediaWorkflowRepository,
  getOperationRepository,
  getRestorePlanDataMapper,
} from "@/adapters/RepositoryFactory";
import type {
  OperationActionExecutor,
} from "@/core/use-cases/operations/OperationActionDispatch";
import type { FactoryRepository } from "@/core/use-cases/FactoryRepository";
import {
  OperationActionDispatchService,
} from "@/core/use-cases/operations/OperationActionDispatch";
import { BACKUP_RESTORE_OPERATION_ACTION_TYPES } from "@/core/use-cases/operations/BackupRestoreOperationActions";
import { FACTORY_WORK_ORDER_OPERATION_ACTION_TYPES } from "@/core/use-cases/operations/FactoryWorkOrderOperationActions";
import { HELP_FLOW_OPERATION_ACTION_TYPES } from "@/core/use-cases/operations/HelpFlowOperationActions";
import { MEDIA_WORKFLOW_OPERATION_ACTION_TYPES } from "@/core/use-cases/operations/MediaWorkflowOperationActions";
import { ONBOARDING_FLOW_OPERATION_ACTION_TYPES } from "@/core/use-cases/operations/OnboardingFlowOperationActions";
import type { OperationRepository } from "@/core/use-cases/operations/OperationRepository";
import { BackupRestoreOperationExecutor } from "@/lib/appliance/backup/backup-restore-operation-executor";
import { BackupRestoreOperationReconciler } from "@/lib/appliance/backup/backup-restore-operation-reconciler";
import { CancelWorkOrderService } from "@/lib/factory/cancel-work-order-service";
import { FactoryWorkOrderOperationExecutor } from "@/lib/factory/factory-work-order-operation-executor";
import { FactoryWorkOrderOperationReconciler } from "@/lib/factory/factory-work-order-operation-reconciler";
import { createFactoryRevisionRoot } from "@/lib/factory/factory-revision-root";
import { RetryWorkOrderStageService } from "@/lib/factory/retry-work-order-stage-service";
import { MediaWorkflowOperationExecutor } from "@/lib/media/workflows/media-workflow-operation-executor";
import { MediaWorkflowOperationReconciler } from "@/lib/media/workflows/media-workflow-operation-reconciler";
import { HelpFlowOperationExecutor } from "@/lib/operations/help-flow-operation";
import { OnboardingFlowOperationExecutor } from "@/lib/operations/onboarding-flow-operation";

const diagnosticRunExecutor: OperationActionExecutor = {
  canExecute: (actionType) => actionType === "diagnostic.run",
  execute: async () => undefined,
};

function lazyActionExecutor(
  actionTypes: readonly string[],
  factory: () => OperationActionExecutor,
): OperationActionExecutor {
  let executor: OperationActionExecutor | null = null;
  const actionSet = new Set(actionTypes);

  return {
    canExecute: (actionType) => actionSet.has(actionType),
    execute: async (input) => {
      executor ??= factory();
      return executor.execute(input);
    },
  };
}

export interface OperationActionDispatchRootOptions {
  repository?: OperationRepository;
  factoryRepository?: FactoryRepository;
}

export function createBackupRestoreOperationReconciler(): BackupRestoreOperationReconciler {
  return new BackupRestoreOperationReconciler({
    operations: getOperationRepository(),
    commands: getBackupSystemCommandDataMapper(),
    snapshots: getBackupSnapshotDataMapper(),
    plans: getRestorePlanDataMapper(),
  });
}

export function createMediaWorkflowOperationReconciler(
  repository: OperationRepository = getOperationRepository(),
): MediaWorkflowOperationReconciler {
  return new MediaWorkflowOperationReconciler({
    operations: repository,
    workflows: getMediaWorkflowRepository(),
    jobs: getJobQueueRepository(),
  });
}

export function createFactoryWorkOrderOperationReconciler(
  repository: OperationRepository = getOperationRepository(),
): FactoryWorkOrderOperationReconciler {
  return new FactoryWorkOrderOperationReconciler({
    operations: repository,
    factory: getFactoryRepository(),
  });
}

export function createOperationActionDispatchService(
  options: OperationActionDispatchRootOptions = {},
): OperationActionDispatchService {
  const repository = options.repository ?? getOperationRepository();

  return new OperationActionDispatchService({
    repository,
    executors: [
      diagnosticRunExecutor,
      lazyActionExecutor(BACKUP_RESTORE_OPERATION_ACTION_TYPES, () => {
        const reconciler = new BackupRestoreOperationReconciler({
          operations: repository,
          commands: getBackupSystemCommandDataMapper(),
          snapshots: getBackupSnapshotDataMapper(),
          plans: getRestorePlanDataMapper(),
        });

        return new BackupRestoreOperationExecutor({
          backupSelfService: getBackupSelfService(),
          reconcile: async (operationId) => {
            if (operationId) {
              await reconciler.reconcileOperation(operationId);
            } else {
              await reconciler.reconcileRecent();
            }
          },
        });
      }),
      lazyActionExecutor(MEDIA_WORKFLOW_OPERATION_ACTION_TYPES, () => {
        const mediaReconciler = createMediaWorkflowOperationReconciler(repository);

        return new MediaWorkflowOperationExecutor({
          workflowRepository: getMediaWorkflowRepository(),
          jobRepository: getJobQueueRepository(),
          materializationRepository: getMaterializationRepository(),
          orchestrator: getMediaWorkflowOrchestrator(),
          reconcile: async (operationId, workflowId) => {
            if (workflowId) {
              await mediaReconciler.reconcileWorkflow(workflowId, operationId);
            } else if (operationId) {
              await mediaReconciler.reconcileOperation(operationId);
            } else {
              await mediaReconciler.reconcileRecent();
            }
          },
        });
      }),
      lazyActionExecutor(FACTORY_WORK_ORDER_OPERATION_ACTION_TYPES, () => {
        const factoryRepository = options.factoryRepository ?? getFactoryRepository();
        const factoryRevisionRoot = createFactoryRevisionRoot({ repository: factoryRepository });
        const factoryReconciler = new FactoryWorkOrderOperationReconciler({
          operations: repository,
          factory: factoryRepository,
        });
        const cancelWorkOrderService = new CancelWorkOrderService({
          repository: factoryRevisionRoot.repository,
        });
        const retryWorkOrderStageService = new RetryWorkOrderStageService({
          repository: factoryRevisionRoot.repository,
          resumeWorkOrderService: factoryRevisionRoot.resumeWorkOrderService,
        });

        return new FactoryWorkOrderOperationExecutor({
          repository: factoryRevisionRoot.repository,
          planner: factoryRevisionRoot.planner,
          orchestrator: factoryRevisionRoot.orchestrator,
          pauseWorkOrderService: factoryRevisionRoot.pauseWorkOrderService,
          assetRefinementService: factoryRevisionRoot.assetRefinementService,
          resumeWorkOrderService: factoryRevisionRoot.resumeWorkOrderService,
          cancelWorkOrderService,
          retryWorkOrderStageService,
          reconcile: async (operationId) => {
            await factoryReconciler.reconcileOperation(operationId);
          },
        });
      }),
      lazyActionExecutor(HELP_FLOW_OPERATION_ACTION_TYPES, () => new HelpFlowOperationExecutor()),
      lazyActionExecutor(ONBOARDING_FLOW_OPERATION_ACTION_TYPES, () => new OnboardingFlowOperationExecutor()),
    ],
  });
}
