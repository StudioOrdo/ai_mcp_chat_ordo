use anyhow::Result;
use rusqlite::{params, Connection};
use serde_json::json;
use uuid::Uuid;

pub fn append_event(
    conn: &Connection,
    operation_id: &str,
    operation_kind: &str,
    event_type: &str,
    metadata: serde_json::Value,
) -> Result<()> {
    conn.execute(
        "INSERT INTO backup_restore_audit_events (
            id, operation_id, operation_kind, event_type, actor_user_id,
            actor_role, metadata_json, created_at
         ) VALUES (?1, ?2, ?3, ?4, NULL, NULL, ?5, datetime('now'))",
        params![
            format!("audit_{}", Uuid::new_v4()),
            operation_id,
            operation_kind,
            event_type,
            metadata.to_string(),
        ],
    )?;
    Ok(())
}

pub fn failure_metadata(message: &str) -> serde_json::Value {
    json!({ "error": message.chars().take(1000).collect::<String>() })
}
