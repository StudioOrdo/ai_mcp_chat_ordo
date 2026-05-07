use crate::archive_writer::{is_empty_root, ArchiveWriter, WriteArchiveInput};
use crate::artifact::{
    hash_file, BackupManifest, ManifestArchive, ManifestCompatibility, ManifestExclusions,
    ManifestRoot, ManifestSqlite, MANIFEST_SCHEMA_VERSION, RESTORE_PLAN_VERSION,
};
use crate::audit::{append_event, failure_metadata};
use crate::command::BackupCreatePayload;
use crate::command_store::CommandStore;
use crate::native_contract::{
    metric_string, metric_u64, NativeCommandArtifact, NativeCommandResult,
};
use crate::paths::DataBoundary;
use crate::sqlite_snapshot::{quick_check, snapshot_sqlite};
use anyhow::{Context, Result};
use chrono::Utc;
use rusqlite::params;
use serde_json::json;
use std::collections::BTreeMap;
use std::fs;
use std::path::Path;
use std::time::Instant;
use walkdir::WalkDir;

pub fn execute_backup(
    store: &CommandStore,
    command_id: &str,
    payload: &BackupCreatePayload,
) -> Result<()> {
    let started = Instant::now();
    let result = execute_backup_inner(store, command_id, payload, started);
    if let Err(error) = &result {
        let message = error.to_string();
        let _ = mark_snapshot_failed(store, &payload.snapshot_id, &message);
        let _ = append_event(
            store.connection(),
            &payload.snapshot_id,
            "backup",
            "backup_executor_failed",
            failure_metadata(&message),
        );
        store.mark_failed(
            command_id,
            &message,
            Some(
                NativeCommandResult::failed(
                    command_id,
                    payload.operation.as_ref(),
                    "Backup executor failed.",
                    "BACKUP_EXECUTOR_FAILED",
                    &message,
                    json!({
                        "snapshotId": payload.snapshot_id,
                        "kind": payload.kind,
                        "restorePlanId": payload.restore_plan_id,
                    }),
                    backup_metrics(started, 0, 0, 0, None, None),
                )
                .to_value(),
            ),
        )?;
    }
    result
}

fn execute_backup_inner(
    store: &CommandStore,
    command_id: &str,
    payload: &BackupCreatePayload,
    started: Instant,
) -> Result<()> {
    let boundary = DataBoundary::from_payload(&payload.data_boundary)?;
    boundary.ensure_asset_roots()?;
    let staging = boundary.backup_staging_dir(&payload.snapshot_id);
    if staging.exists() {
        fs::remove_dir_all(&staging)?;
    }
    fs::create_dir_all(&staging)?;
    fs::create_dir_all(boundary.backups_dir())?;
    append_event(
        store.connection(),
        &payload.snapshot_id,
        "backup",
        "backup_executor_started",
        json!({ "commandId": command_id }),
    )?;

    let staged_db = staging.join("local.db");
    snapshot_sqlite(&boundary.sqlite_path, &staged_db)?;
    quick_check(&staged_db)?;

    let archive_path = boundary
        .backups_dir()
        .join(format!("snapshot_{}.zip", payload.snapshot_id));
    let tmp_archive_path = archive_path.with_extension("zip.tmp");
    if tmp_archive_path.exists() {
        fs::remove_file(&tmp_archive_path)?;
    }
    let manifest = BackupManifest {
        schema_version: MANIFEST_SCHEMA_VERSION.to_string(),
        app_version: payload.app_version.clone(),
        created_at: Utc::now().to_rfc3339(),
        backup_id: payload.snapshot_id.clone(),
        kind: payload.kind.clone(),
        source_runtime_profile_id: payload.source_runtime_profile_id.clone(),
        source_data_root: boundary.data_dir.to_string_lossy().to_string(),
        sqlite: ManifestSqlite {
            path_policy: "sqlite_backup_api_snapshot".to_string(),
            relative_path: "data/local.db".to_string(),
            quick_integrity_check: "ok".to_string(),
        },
        roots: vec![
            ManifestRoot {
                name: "local.db".to_string(),
                relative_path: "data/local.db".to_string(),
                optional: false,
                empty: false,
            },
            ManifestRoot {
                name: "blog-assets".to_string(),
                relative_path: "data/blog-assets/".to_string(),
                optional: true,
                empty: is_empty_root(&boundary.blog_asset_root),
            },
            ManifestRoot {
                name: "user-files".to_string(),
                relative_path: "data/user-files/".to_string(),
                optional: true,
                empty: is_empty_root(&boundary.user_file_root),
            },
        ],
        exclusions: ManifestExclusions {
            paths: vec![
                ".server.lock".to_string(),
                ".backup_staging".to_string(),
                ".restore_staging".to_string(),
                "backups".to_string(),
            ],
            symlinks: "rejected".to_string(),
            runtime_logs: "excluded".to_string(),
            existing_backups: "excluded".to_string(),
        },
        archive: ManifestArchive {
            hash_algorithm: "sha256".to_string(),
        },
        compatibility: ManifestCompatibility {
            warnings: vec![
                "Provider keys and environment variables are not part of the backup artifact."
                    .to_string(),
            ],
            requires_restore_plan_version: RESTORE_PLAN_VERSION.to_string(),
        },
    };

    ArchiveWriter::write_archive(WriteArchiveInput {
        tmp_archive_path: &tmp_archive_path,
        manifest: &manifest,
        sqlite_snapshot_path: &staged_db,
        blog_asset_root: &boundary.blog_asset_root,
        user_file_root: &boundary.user_file_root,
    })?;
    fs::rename(&tmp_archive_path, &archive_path)
        .with_context(|| format!("Failed to finalize archive {}", archive_path.display()))?;
    let integrity = hash_file(&archive_path)?;
    let file_count =
        2 + count_files(&boundary.blog_asset_root)? + count_files(&boundary.user_file_root)?;
    let bytes_read = file_size(&staged_db)?
        + count_bytes(&boundary.blog_asset_root)?
        + count_bytes(&boundary.user_file_root)?;

    store.connection().execute(
        "UPDATE backup_snapshots
         SET status = 'succeeded',
             archive_path = ?1,
             archive_hash = ?2,
             archive_size_bytes = ?3,
             manifest_schema_version = ?4,
             app_version = ?5,
             validated_at = datetime('now'),
             failure_message = NULL
         WHERE id = ?6",
        params![
            archive_path.to_string_lossy(),
            integrity.hash,
            i64::try_from(integrity.size_bytes)?,
            MANIFEST_SCHEMA_VERSION,
            payload.app_version,
            payload.snapshot_id,
        ],
    )?;

    if payload.kind == "pre_restore" {
        if let Some(plan_id) = &payload.restore_plan_id {
            store.connection().execute(
                "UPDATE restore_plans
                 SET pre_restore_backup_snapshot_id = ?1,
                     updated_at = datetime('now')
                 WHERE id = ?2",
                params![payload.snapshot_id, plan_id],
            )?;
        }
    }

    append_event(
        store.connection(),
        &payload.snapshot_id,
        "backup",
        "backup_executor_succeeded",
        json!({
            "commandId": command_id,
            "archivePath": archive_path.to_string_lossy(),
            "archiveHash": integrity.hash,
            "archiveSizeBytes": integrity.size_bytes,
        }),
    )?;
    store.mark_succeeded(
        command_id,
        NativeCommandResult::succeeded(
            command_id,
            payload.operation.as_ref(),
            "Backup executor completed.",
            vec![NativeCommandArtifact {
                kind: "backup_archive".to_string(),
                uri: format!("backup-snapshot:{}", payload.snapshot_id),
                label: format!("Backup snapshot {}", payload.snapshot_id),
                metadata: json!({
                    "snapshotId": payload.snapshot_id,
                    "archivePath": archive_path.to_string_lossy(),
                    "archiveHash": integrity.hash,
                    "archiveSizeBytes": integrity.size_bytes,
                    "manifestSchemaVersion": MANIFEST_SCHEMA_VERSION,
                    "appVersion": payload.app_version,
                    "kind": payload.kind,
                    "restorePlanId": payload.restore_plan_id,
                }),
            }],
            backup_metrics(
                started,
                bytes_read,
                integrity.size_bytes,
                file_count,
                Some(&integrity.hash),
                Some(integrity.size_bytes),
            ),
        )
        .to_value(),
    )?;
    fs::remove_dir_all(&staging).ok();
    Ok(())
}

fn backup_metrics(
    started: Instant,
    bytes_read: u64,
    bytes_written: u64,
    file_count: u64,
    archive_hash: Option<&str>,
    archive_size_bytes: Option<u64>,
) -> BTreeMap<String, serde_json::Value> {
    let mut metrics = BTreeMap::new();
    metrics.insert(
        "elapsedMs".to_string(),
        metric_u64(started.elapsed().as_millis() as u64),
    );
    metrics.insert("bytesRead".to_string(), metric_u64(bytes_read));
    metrics.insert("bytesWritten".to_string(), metric_u64(bytes_written));
    metrics.insert("fileCount".to_string(), metric_u64(file_count));
    if let Some(hash) = archive_hash {
        metrics.insert("archiveHash".to_string(), metric_string(hash));
    }
    if let Some(size) = archive_size_bytes {
        metrics.insert("archiveSizeBytes".to_string(), metric_u64(size));
    }
    metrics
}

fn file_size(path: &Path) -> Result<u64> {
    Ok(fs::metadata(path)?.len())
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

fn count_bytes(root: &Path) -> Result<u64> {
    if !root.exists() {
        return Ok(0);
    }
    let mut total = 0;
    for entry in WalkDir::new(root).follow_links(false) {
        let entry = entry?;
        if entry.file_type().is_file() {
            total += entry.metadata()?.len();
        }
    }
    Ok(total)
}

fn mark_snapshot_failed(store: &CommandStore, snapshot_id: &str, message: &str) -> Result<()> {
    store.connection().execute(
        "UPDATE backup_snapshots
         SET status = 'failed',
             failure_message = ?1,
             validated_at = NULL
         WHERE id = ?2",
        params![message.chars().take(1000).collect::<String>(), snapshot_id],
    )?;
    Ok(())
}
