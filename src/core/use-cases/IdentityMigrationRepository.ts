import type { IdentityMigrationEvent } from "../entities/identity-migration";

export interface IdentityMigrationReader {
  findById(id: string): Promise<IdentityMigrationEvent | null>;
  findLatestForSourceIdentity(sourceUserId: string): Promise<IdentityMigrationEvent | null>;
  findLatestForTargetIdentity(targetUserId: string): Promise<IdentityMigrationEvent | null>;
}

export interface IdentityMigrationWriter {
  record(event: IdentityMigrationEvent): Promise<IdentityMigrationEvent>;
  update(event: IdentityMigrationEvent): Promise<IdentityMigrationEvent>;
}

export interface IdentityMigrationRepository extends IdentityMigrationReader, IdentityMigrationWriter {}
