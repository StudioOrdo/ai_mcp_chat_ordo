use anyhow::{bail, Result};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone)]
pub struct SystemCommand {
    pub id: String,
    pub command: CommandName,
    pub payload_json: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CommandName {
    BackupCreate,
    RestoreRequest,
}

impl CommandName {
    pub fn parse(value: &str) -> Result<Self> {
        match value {
            "backup.create" => Ok(Self::BackupCreate),
            "restore.request" => Ok(Self::RestoreRequest),
            _ => bail!("Unsupported system command: {value}"),
        }
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DataBoundaryPayload {
    pub data_dir: String,
    pub sqlite_path: String,
    pub blog_asset_root: String,
    pub user_file_root: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OperationCommandMetadata {
    pub operation_id: String,
    pub step_id: String,
    pub action_id: String,
    pub operation_kind: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupCreatePayload {
    pub kind: String,
    pub requested_at: String,
    pub snapshot_id: String,
    pub data_boundary: DataBoundaryPayload,
    pub app_version: String,
    pub source_runtime_profile_id: String,
    pub restore_plan_id: Option<String>,
    pub operation: Option<OperationCommandMetadata>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RestoreRequestPayload {
    pub restore_plan_id: String,
    pub snapshot_id: String,
    pub archive_path: String,
    pub expected_archive_hash: String,
    pub expected_archive_size_bytes: u64,
    pub manifest_schema_version: String,
    pub restore_plan_version: String,
    pub requested_at: String,
    pub data_boundary: DataBoundaryPayload,
    pub confirmation_ref: Option<String>,
    pub operation: Option<OperationCommandMetadata>,
}

pub fn parse_backup_payload(raw: &str) -> Result<BackupCreatePayload> {
    let payload: BackupCreatePayload = serde_json::from_str(raw)?;
    require_non_empty("kind", &payload.kind)?;
    require_non_empty("requestedAt", &payload.requested_at)?;
    require_non_empty("snapshotId", &payload.snapshot_id)?;
    require_non_empty("appVersion", &payload.app_version)?;
    require_non_empty("sourceRuntimeProfileId", &payload.source_runtime_profile_id)?;
    require_boundary(&payload.data_boundary)?;
    match payload.kind.as_str() {
        "manual" | "scheduled" => {}
        "pre_restore" => {
            if payload
                .restore_plan_id
                .as_deref()
                .unwrap_or("")
                .trim()
                .is_empty()
            {
                bail!("backup.create pre_restore payload requires restorePlanId");
            }
        }
        _ => bail!("Invalid backup kind: {}", payload.kind),
    }
    match payload.kind.as_str() {
        "manual" => require_operation(&payload.operation, Some("backup_create"), true)?,
        "pre_restore" => require_operation(&payload.operation, Some("restore_execute"), true)?,
        "scheduled" => require_operation(&payload.operation, Some("backup_create"), false)?,
        _ => {}
    }
    Ok(payload)
}

pub fn parse_restore_payload(raw: &str) -> Result<RestoreRequestPayload> {
    let payload: RestoreRequestPayload = serde_json::from_str(raw)?;
    require_non_empty("restorePlanId", &payload.restore_plan_id)?;
    require_non_empty("snapshotId", &payload.snapshot_id)?;
    require_non_empty("archivePath", &payload.archive_path)?;
    require_non_empty("expectedArchiveHash", &payload.expected_archive_hash)?;
    require_non_empty("manifestSchemaVersion", &payload.manifest_schema_version)?;
    require_non_empty("restorePlanVersion", &payload.restore_plan_version)?;
    require_non_empty("requestedAt", &payload.requested_at)?;
    if !payload.expected_archive_hash.starts_with("sha256:")
        || payload.expected_archive_hash.len() != 71
    {
        bail!("restore.request expectedArchiveHash must be a sha256 digest");
    }
    if payload.expected_archive_size_bytes == 0 {
        bail!("restore.request expectedArchiveSizeBytes must be positive");
    }
    require_boundary(&payload.data_boundary)?;
    require_operation(&payload.operation, Some("restore_execute"), true)?;
    Ok(payload)
}

fn require_operation(
    operation: &Option<OperationCommandMetadata>,
    expected_kind: Option<&str>,
    required: bool,
) -> Result<()> {
    let Some(metadata) = operation else {
        if required {
            bail!("operation metadata is required");
        }
        return Ok(());
    };

    require_non_empty("operation.operationId", &metadata.operation_id)?;
    require_non_empty("operation.stepId", &metadata.step_id)?;
    require_non_empty("operation.actionId", &metadata.action_id)?;
    match metadata.operation_kind.as_str() {
        "backup_create" | "restore_execute" => {}
        _ => bail!("operation.operationKind must be backup_create or restore_execute"),
    }
    if let Some(expected) = expected_kind {
        if metadata.operation_kind != expected {
            bail!("operation.operationKind must be {expected}");
        }
    }
    Ok(())
}

fn require_boundary(boundary: &DataBoundaryPayload) -> Result<()> {
    require_non_empty("dataBoundary.dataDir", &boundary.data_dir)?;
    require_non_empty("dataBoundary.sqlitePath", &boundary.sqlite_path)?;
    require_non_empty("dataBoundary.blogAssetRoot", &boundary.blog_asset_root)?;
    require_non_empty("dataBoundary.userFileRoot", &boundary.user_file_root)?;
    Ok(())
}

fn require_non_empty(label: &str, value: &str) -> Result<()> {
    if value.trim().is_empty() {
        bail!("{label} is required");
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn boundary_json() -> &'static str {
        r#""dataBoundary":{"dataDir":"/tmp/ordo/.data","sqlitePath":"/tmp/ordo/.data/local.db","blogAssetRoot":"/tmp/ordo/.data/blog-assets","userFileRoot":"/tmp/ordo/.data/user-files"}"#
    }

    #[test]
    fn parses_valid_backup_create() {
        let raw = format!(
            r#"{{"kind":"manual","requestedAt":"2026-05-02T12:00:00.000Z","snapshotId":"backup_1",{},"appVersion":"0.1.0","sourceRuntimeProfileId":"test","operation":{{"operationId":"op_1","stepId":"op_1:backup.create","actionId":"act_1","operationKind":"backup_create"}}}}"#,
            boundary_json()
        );
        let payload = parse_backup_payload(&raw).unwrap();
        assert_eq!(payload.snapshot_id, "backup_1");
        assert_eq!(payload.operation.unwrap().operation_id, "op_1");
    }

    #[test]
    fn parses_valid_restore_request() {
        let raw = format!(
            r#"{{"restorePlanId":"restore_1","snapshotId":"backup_1","archivePath":"/tmp/a.zip","expectedArchiveHash":"sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","expectedArchiveSizeBytes":10,"manifestSchemaVersion":"1","restorePlanVersion":"1","requestedAt":"2026-05-02T12:00:00.000Z",{},"operation":{{"operationId":"op_1","stepId":"op_1:restore.execute","actionId":"act_1","operationKind":"restore_execute"}}}}"#,
            boundary_json()
        );
        let payload = parse_restore_payload(&raw).unwrap();
        assert_eq!(payload.restore_plan_id, "restore_1");
        assert_eq!(payload.operation.unwrap().operation_kind, "restore_execute");
    }

    #[test]
    fn allows_scheduled_payload_without_operation_metadata() {
        let raw = format!(
            r#"{{"kind":"scheduled","requestedAt":"2026-05-02T12:00:00.000Z","snapshotId":"backup_1",{},"appVersion":"0.1.0","sourceRuntimeProfileId":"test"}}"#,
            boundary_json()
        );
        assert!(parse_backup_payload(&raw).unwrap().operation.is_none());
    }

    #[test]
    fn rejects_manual_payload_without_operation_metadata() {
        let raw = format!(
            r#"{{"kind":"manual","requestedAt":"2026-05-02T12:00:00.000Z","snapshotId":"backup_1",{},"appVersion":"0.1.0","sourceRuntimeProfileId":"test"}}"#,
            boundary_json()
        );
        assert!(parse_backup_payload(&raw).is_err());
    }

    #[test]
    fn rejects_malformed_operation_metadata() {
        let raw = format!(
            r#"{{"kind":"manual","requestedAt":"2026-05-02T12:00:00.000Z","snapshotId":"backup_1",{},"appVersion":"0.1.0","sourceRuntimeProfileId":"test","operation":{{"operationId":"","stepId":"step_1","actionId":"act_1","operationKind":"backup_create"}}}}"#,
            boundary_json()
        );
        assert!(parse_backup_payload(&raw).is_err());
    }

    #[test]
    fn rejects_missing_restore_integrity_fields() {
        let raw = format!(
            r#"{{"restorePlanId":"restore_1","snapshotId":"backup_1","archivePath":"/tmp/a.zip","expectedArchiveHash":"nope","expectedArchiveSizeBytes":10,"manifestSchemaVersion":"1","restorePlanVersion":"1","requestedAt":"2026-05-02T12:00:00.000Z",{}}}"#,
            boundary_json()
        );
        assert!(parse_restore_payload(&raw).is_err());
    }

    #[test]
    fn rejects_old_command_names() {
        assert!(CommandName::parse("backup").is_err());
        assert!(CommandName::parse("restore").is_err());
    }
}
