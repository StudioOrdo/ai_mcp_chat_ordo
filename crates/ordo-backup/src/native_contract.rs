use crate::command::OperationCommandMetadata;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::BTreeMap;

pub const NATIVE_COMMAND_SCHEMA_VERSION: &str = "1";

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct NativeOperationRef {
    pub operation_id: String,
    pub step_id: String,
    pub action_id: String,
    pub operation_kind: String,
}

impl From<&OperationCommandMetadata> for NativeOperationRef {
    fn from(value: &OperationCommandMetadata) -> Self {
        Self {
            operation_id: value.operation_id.clone(),
            step_id: value.step_id.clone(),
            action_id: value.action_id.clone(),
            operation_kind: value.operation_kind.clone(),
        }
    }
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct NativeCommandArtifact {
    pub kind: String,
    pub uri: String,
    pub label: String,
    pub metadata: Value,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct NativeCommandError {
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<Value>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct NativeCommandResult {
    pub schema_version: String,
    pub command_id: String,
    pub operation: Option<NativeOperationRef>,
    pub status: String,
    pub summary: String,
    pub artifacts: Vec<NativeCommandArtifact>,
    pub metrics: BTreeMap<String, Value>,
    pub error: Option<NativeCommandError>,
}

impl NativeCommandResult {
    pub fn succeeded(
        command_id: &str,
        operation: Option<&OperationCommandMetadata>,
        summary: impl Into<String>,
        artifacts: Vec<NativeCommandArtifact>,
        metrics: BTreeMap<String, Value>,
    ) -> Self {
        Self {
            schema_version: NATIVE_COMMAND_SCHEMA_VERSION.to_string(),
            command_id: command_id.to_string(),
            operation: operation.map(NativeOperationRef::from),
            status: "succeeded".to_string(),
            summary: summary.into(),
            artifacts,
            metrics,
            error: None,
        }
    }

    pub fn failed(
        command_id: &str,
        operation: Option<&OperationCommandMetadata>,
        summary: impl Into<String>,
        code: impl Into<String>,
        message: impl Into<String>,
        details: Value,
        metrics: BTreeMap<String, Value>,
    ) -> Self {
        Self {
            schema_version: NATIVE_COMMAND_SCHEMA_VERSION.to_string(),
            command_id: command_id.to_string(),
            operation: operation.map(NativeOperationRef::from),
            status: "failed".to_string(),
            summary: summary.into(),
            artifacts: vec![],
            metrics,
            error: Some(NativeCommandError {
                code: code.into(),
                message: message.into(),
                details: Some(details),
            }),
        }
    }

    pub fn to_value(&self) -> Value {
        serde_json::to_value(self).unwrap_or_else(|_| json!({}))
    }
}

pub fn metric_string(value: impl Into<String>) -> Value {
    Value::String(value.into())
}

pub fn metric_u64(value: u64) -> Value {
    Value::Number(value.into())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn operation() -> OperationCommandMetadata {
        OperationCommandMetadata {
            operation_id: "op_1".to_string(),
            step_id: "op_1:backup.create".to_string(),
            action_id: "act_1".to_string(),
            operation_kind: "backup_create".to_string(),
        }
    }

    #[test]
    fn serializes_native_command_result_contract() {
        let mut metrics = BTreeMap::new();
        metrics.insert("bytesWritten".to_string(), metric_u64(42));
        let result = NativeCommandResult::succeeded(
            "syscmd_1",
            Some(&operation()),
            "Backup completed.",
            vec![NativeCommandArtifact {
                kind: "backup_archive".to_string(),
                uri: "backup-snapshot:backup_1".to_string(),
                label: "Backup snapshot backup_1".to_string(),
                metadata: json!({ "snapshotId": "backup_1" }),
            }],
            metrics,
        );
        let serialized = result.to_value();
        assert_eq!(serialized["schemaVersion"], "1");
        assert_eq!(serialized["commandId"], "syscmd_1");
        assert_eq!(serialized["operation"]["operationId"], "op_1");
        assert_eq!(serialized["metrics"]["bytesWritten"], 42);
    }

    #[test]
    fn serializes_native_failure_contract() {
        let result = NativeCommandResult::failed(
            "syscmd_1",
            Some(&operation()),
            "Backup failed.",
            "BACKUP_EXECUTOR_FAILED",
            "disk full",
            json!({ "phase": "archive" }),
            BTreeMap::new(),
        );
        let serialized = result.to_value();
        assert_eq!(serialized["status"], "failed");
        assert_eq!(serialized["error"]["code"], "BACKUP_EXECUTOR_FAILED");
    }
}
