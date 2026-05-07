import {
  assertAdminRole,
  validateOperationCommandMetadata,
  validateRestoreRequestPayload,
} from "./backup-command-validation";
import { createBackupExecutorPayload } from "./backup-command-payload";
import type {
  BackupCommandRequester,
  BackupSnapshotRepository,
  OperationCommandMetadata,
  RestoreCommandRequest,
  SystemCommand,
  SystemCommandRepository,
} from "./types";

export class BackupCommandService {
  constructor(private readonly deps: SystemCommandRepository | {
    commands: SystemCommandRepository;
    snapshots: BackupSnapshotRepository;
    createPayload?: typeof createBackupExecutorPayload;
  }) {}

  async createManualBackupCommand(
    requester: BackupCommandRequester,
    operation: OperationCommandMetadata,
  ): Promise<SystemCommand> {
    assertAdminRole(requester.role);
    validateOperationCommandMetadata(operation, "backup_create", { required: true });
    const deps = this.getDeps();
    const snapshot = await deps.snapshots.createPending({
      kind: "manual",
      createdByUserId: requester.userId,
    });
    const payload = (deps.createPayload ?? createBackupExecutorPayload)({
      kind: "manual",
      snapshotId: snapshot.id,
      operation,
    });
    return deps.commands.enqueue({
      target: "rust_daemon",
      command: "backup.create",
      status: "pending",
      payload,
      requestedByUserId: requester.userId,
      requestedByRole: requester.role,
      requestedFrom: requester.requestedFrom,
    });
  }

  validateRestoreRequest(input: RestoreCommandRequest): void {
    validateRestoreRequestPayload(input);
  }

  private getDeps(): {
    commands: SystemCommandRepository;
    snapshots: BackupSnapshotRepository;
    createPayload?: typeof createBackupExecutorPayload;
  } {
    if ("enqueue" in this.deps) {
      throw new Error("BackupCommandService requires snapshots for Phase 04D backup commands.");
    }
    return this.deps;
  }
}
