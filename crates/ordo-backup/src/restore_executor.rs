use crate::archive_reader::ArchiveReader;
use crate::artifact::{
    hash_file, validate_manifest, MANIFEST_SCHEMA_VERSION, RESTORE_PLAN_VERSION,
};
use crate::audit::{append_event, failure_metadata};
use crate::command::RestoreRequestPayload;
use crate::command_store::CommandStore;
use crate::native_contract::{
    metric_string, metric_u64, NativeCommandArtifact, NativeCommandResult,
};
use crate::paths::DataBoundary;
use crate::sqlite_snapshot::{quick_check, restore_sqlite_into_connection};
use anyhow::{bail, Context, Result};
use rusqlite::{params, OptionalExtension};
use serde_json::json;
use std::collections::BTreeMap;
use std::fs;
use std::path::Path;
use std::time::Instant;
use walkdir::WalkDir;

pub fn execute_restore(
    store: &mut CommandStore,
    command_id: &str,
    payload: &RestoreRequestPayload,
) -> Result<()> {
    let started = Instant::now();
    let result = execute_restore_inner(store, command_id, payload, started);
    if let Err(error) = &result {
        let message = error.to_string();
        let _ = mark_plan_failed(store, &payload.restore_plan_id, &message);
        let _ = append_event(
            store.connection(),
            &payload.restore_plan_id,
            "restore",
            "restore_executor_failed",
            failure_metadata(&message),
        );
        store.mark_failed(
            command_id,
            &message,
            Some(
                NativeCommandResult::failed(
                    command_id,
                    payload.operation.as_ref(),
                    "Restore executor failed.",
                    "RESTORE_EXECUTOR_FAILED",
                    &message,
                    json!({
                        "restorePlanId": payload.restore_plan_id,
                        "snapshotId": payload.snapshot_id,
                    }),
                    restore_metrics(started, payload.expected_archive_size_bytes, 0, 0, &[]),
                )
                .to_value(),
            ),
        )?;
    }
    result
}

fn execute_restore_inner(
    store: &mut CommandStore,
    command_id: &str,
    payload: &RestoreRequestPayload,
    started: Instant,
) -> Result<()> {
    let boundary = DataBoundary::from_payload(&payload.data_boundary)?;
    let plan = read_plan(store, &payload.restore_plan_id)?;
    if plan.status != "running" {
        bail!("Restore plan must be running before executor restore");
    }
    if plan.restore_command_id.as_deref() != Some(command_id) {
        bail!("Restore plan restore_command_id does not match command");
    }
    if plan.snapshot_id != payload.snapshot_id
        || plan.archive_path != payload.archive_path
        || plan.archive_hash != payload.expected_archive_hash
        || u64::try_from(plan.archive_size_bytes)? != payload.expected_archive_size_bytes
        || plan.manifest_schema_version != payload.manifest_schema_version
        || plan.restore_plan_version != payload.restore_plan_version
    {
        bail!("Restore command payload does not match restore plan metadata");
    }
    if payload.manifest_schema_version != MANIFEST_SCHEMA_VERSION
        || payload.restore_plan_version != RESTORE_PLAN_VERSION
    {
        bail!("Restore command schema or plan version is unsupported");
    }
    let snapshot = read_snapshot(store, &payload.snapshot_id)?;
    if snapshot.archive_path != payload.archive_path
        || snapshot.archive_hash != payload.expected_archive_hash
        || u64::try_from(snapshot.archive_size_bytes)? != payload.expected_archive_size_bytes
        || snapshot.manifest_schema_version != payload.manifest_schema_version
    {
        bail!("Restore command payload does not match backup snapshot metadata");
    }

    let archive_path = Path::new(&payload.archive_path);
    let integrity = hash_file(archive_path)?;
    if integrity.hash != payload.expected_archive_hash
        || integrity.size_bytes != payload.expected_archive_size_bytes
    {
        bail!("Backup archive integrity mismatch");
    }
    let manifest = ArchiveReader::read_manifest(archive_path)?;
    validate_manifest(&manifest, &payload.snapshot_id)?;

    append_event(
        store.connection(),
        &payload.restore_plan_id,
        "restore",
        "restore_executor_started",
        json!({ "commandId": command_id }),
    )?;

    let staging = boundary.restore_staging_dir(&payload.restore_plan_id);
    if staging.exists() {
        fs::remove_dir_all(&staging)?;
    }
    fs::create_dir_all(&staging)?;
    ArchiveReader::extract_to_staging(archive_path, &staging)?;
    let extracted_file_count = count_files(&staging)?;
    let staged_db = staging.join("data").join("local.db");
    if !staged_db.exists() {
        bail!("Restore archive is missing data/local.db");
    }
    quick_check(&staged_db)?;

    let staged_blog = staging.join("data").join("blog-assets");
    let staged_user = staging.join("data").join("user-files");
    validate_staged_root(&staged_blog)?;
    validate_staged_root(&staged_user)?;

    restore_sqlite_into_connection(&staged_db, store.connection_mut())?;
    replace_root(&staged_blog, &boundary.blog_asset_root)?;
    replace_root(&staged_user, &boundary.user_file_root)?;

    reconcile_restored_metadata(store, command_id, payload, &plan)?;

    store.connection().execute(
        "UPDATE restore_plans
         SET status = 'succeeded',
             failure_message = NULL,
             updated_at = datetime('now')
         WHERE id = ?1",
        params![payload.restore_plan_id],
    )?;
    append_event(
        store.connection(),
        &payload.restore_plan_id,
        "restore",
        "restore_executor_succeeded",
        json!({
            "commandId": command_id,
            "snapshotId": payload.snapshot_id,
        }),
    )?;
    store.mark_succeeded(
        command_id,
        NativeCommandResult::succeeded(
            command_id,
            payload.operation.as_ref(),
            "Restore executor completed.",
            vec![NativeCommandArtifact {
                kind: "restore_execution".to_string(),
                uri: format!("restore-plan:{}", payload.restore_plan_id),
                label: format!("Restore plan {}", payload.restore_plan_id),
                metadata: json!({
                    "restorePlanId": payload.restore_plan_id,
                    "snapshotId": payload.snapshot_id,
                    "archiveHash": payload.expected_archive_hash,
                    "archiveSizeBytes": payload.expected_archive_size_bytes,
                    "manifestSchemaVersion": payload.manifest_schema_version,
                    "restorePlanVersion": payload.restore_plan_version,
                    "targetPathsTouched": [
                        boundary.sqlite_path.to_string_lossy(),
                        boundary.blog_asset_root.to_string_lossy(),
                        boundary.user_file_root.to_string_lossy(),
                    ],
                }),
            }],
            restore_metrics(
                started,
                payload.expected_archive_size_bytes,
                payload.expected_archive_size_bytes,
                extracted_file_count,
                &[
                    boundary.sqlite_path.to_string_lossy().to_string(),
                    boundary.blog_asset_root.to_string_lossy().to_string(),
                    boundary.user_file_root.to_string_lossy().to_string(),
                ],
            ),
        )
        .to_value(),
    )?;
    fs::remove_dir_all(&staging).ok();
    Ok(())
}

fn restore_metrics(
    started: Instant,
    bytes_read: u64,
    bytes_written: u64,
    file_count: u64,
    target_paths_touched: &[String],
) -> BTreeMap<String, serde_json::Value> {
    let mut metrics = BTreeMap::new();
    metrics.insert(
        "elapsedMs".to_string(),
        metric_u64(started.elapsed().as_millis() as u64),
    );
    metrics.insert("bytesRead".to_string(), metric_u64(bytes_read));
    metrics.insert("bytesWritten".to_string(), metric_u64(bytes_written));
    metrics.insert("fileCount".to_string(), metric_u64(file_count));
    if !target_paths_touched.is_empty() {
        metrics.insert(
            "targetPathsTouched".to_string(),
            metric_string(target_paths_touched.join(",")),
        );
    }
    metrics
}

fn count_files(root: &Path) -> Result<u64> {
    if !root.exists() {
        return Ok(0);
    }
    let mut count = 0;
    for entry in WalkDir::new(root).follow_links(false) {
        let entry = entry?;
        if entry.file_type().is_file() {
            count += 1;
        }
    }
    Ok(count)
}

fn validate_staged_root(path: &Path) -> Result<()> {
    if !path.exists() {
        fs::create_dir_all(path)?;
    }
    if !path.is_dir() {
        bail!("Staged asset root is not a directory: {}", path.display());
    }
    Ok(())
}

fn replace_root(staged: &Path, live: &Path) -> Result<()> {
    let parent = live.parent().context("Live asset root has no parent")?;
    fs::create_dir_all(parent)?;
    let old = live.with_extension("restore_old");
    if old.exists() {
        fs::remove_dir_all(&old)?;
    }
    if live.exists() {
        fs::rename(live, &old)?;
    }
    fs::rename(staged, live)?;
    if old.exists() {
        fs::remove_dir_all(old)?;
    }
    Ok(())
}

fn mark_plan_failed(store: &CommandStore, plan_id: &str, message: &str) -> Result<()> {
    store.connection().execute(
        "UPDATE restore_plans
         SET status = 'failed',
             failure_message = ?1,
             updated_at = datetime('now')
         WHERE id = ?2 AND status != 'succeeded'",
        params![message.chars().take(1000).collect::<String>(), plan_id],
    )?;
    Ok(())
}

struct PlanRow {
    snapshot_id: String,
    status: String,
    archive_path: String,
    archive_hash: String,
    archive_size_bytes: i64,
    manifest_schema_version: String,
    app_version: String,
    restore_plan_version: String,
    restore_command_id: Option<String>,
}

struct SnapshotRow {
    archive_path: String,
    archive_hash: String,
    archive_size_bytes: i64,
    manifest_schema_version: String,
}

fn read_plan(store: &CommandStore, id: &str) -> Result<PlanRow> {
    store
        .connection()
        .query_row(
            "SELECT snapshot_id, status, archive_path, archive_hash, archive_size_bytes,
                    manifest_schema_version, app_version, restore_plan_version, restore_command_id
             FROM restore_plans WHERE id = ?1",
            [id],
            |row| {
                Ok(PlanRow {
                    snapshot_id: row.get(0)?,
                    status: row.get(1)?,
                    archive_path: row.get(2)?,
                    archive_hash: row.get(3)?,
                    archive_size_bytes: row.get(4)?,
                    manifest_schema_version: row.get(5)?,
                    app_version: row.get(6)?,
                    restore_plan_version: row.get(7)?,
                    restore_command_id: row.get(8)?,
                })
            },
        )
        .optional()?
        .context("Restore plan not found")
}

fn reconcile_restored_metadata(
    store: &mut CommandStore,
    command_id: &str,
    payload: &RestoreRequestPayload,
    plan: &PlanRow,
) -> Result<()> {
    store.connection().execute(
        "INSERT INTO backup_snapshots (
            id, kind, status, archive_path, archive_hash, archive_size_bytes,
            manifest_schema_version, app_version, created_at, validated_at, failure_message
         ) VALUES (?1, 'manual', 'succeeded', ?2, ?3, ?4, ?5, ?6, datetime('now'), datetime('now'), NULL)
         ON CONFLICT(id) DO UPDATE SET
            status = 'succeeded',
            archive_path = excluded.archive_path,
            archive_hash = excluded.archive_hash,
            archive_size_bytes = excluded.archive_size_bytes,
            manifest_schema_version = excluded.manifest_schema_version,
            app_version = excluded.app_version,
            validated_at = excluded.validated_at,
            failure_message = NULL",
        params![
            payload.snapshot_id,
            payload.archive_path,
            payload.expected_archive_hash,
            i64::try_from(payload.expected_archive_size_bytes)?,
            payload.manifest_schema_version,
            plan.app_version,
        ],
    )?;

    store.connection().execute(
        "INSERT INTO system_commands (
            id, target, command, status, payload_json, requested_by_role,
            requested_from, lease_owner, lease_expires_at, created_at, updated_at
         ) VALUES (?1, 'rust_daemon', 'restore.request', 'running', ?2, 'ADMIN', 'restore_reconcile', NULL, NULL, datetime('now'), datetime('now'))
         ON CONFLICT(id) DO UPDATE SET
            target = 'rust_daemon',
            command = 'restore.request',
            status = 'running',
            payload_json = excluded.payload_json,
            error_message = NULL,
            updated_at = datetime('now')",
        params![command_id, serde_json::to_string(payload)?],
    )?;

    store.connection().execute(
        "INSERT INTO restore_plans (
            id, snapshot_id, status, archive_path, archive_hash, archive_size_bytes,
            manifest_schema_version, app_version, restore_plan_version, impact_json,
            validation_warnings_json, confirmation_phrase, restore_command_id,
            confirmed_at, failure_message, created_at, updated_at
         ) VALUES (?1, ?2, 'running', ?3, ?4, ?5, ?6, ?7, ?8, '{}', '[]', ?9, ?10, datetime('now'), NULL, datetime('now'), datetime('now'))
         ON CONFLICT(id) DO UPDATE SET
            snapshot_id = excluded.snapshot_id,
            status = 'running',
            archive_path = excluded.archive_path,
            archive_hash = excluded.archive_hash,
            archive_size_bytes = excluded.archive_size_bytes,
            manifest_schema_version = excluded.manifest_schema_version,
            app_version = excluded.app_version,
            restore_plan_version = excluded.restore_plan_version,
            restore_command_id = excluded.restore_command_id,
            failure_message = NULL,
            updated_at = datetime('now')",
        params![
            payload.restore_plan_id,
            payload.snapshot_id,
            payload.archive_path,
            payload.expected_archive_hash,
            i64::try_from(payload.expected_archive_size_bytes)?,
            payload.manifest_schema_version,
            plan.app_version,
            payload.restore_plan_version,
            format!("RESTORE {}", payload.restore_plan_id),
            command_id,
        ],
    )?;

    Ok(())
}

fn read_snapshot(store: &CommandStore, id: &str) -> Result<SnapshotRow> {
    store
        .connection()
        .query_row(
            "SELECT archive_path, archive_hash, archive_size_bytes, manifest_schema_version
             FROM backup_snapshots WHERE id = ?1",
            [id],
            |row| {
                Ok(SnapshotRow {
                    archive_path: row.get(0)?,
                    archive_hash: row.get(1)?,
                    archive_size_bytes: row.get(2)?,
                    manifest_schema_version: row.get(3)?,
                })
            },
        )
        .optional()?
        .context("Backup snapshot not found")
}
