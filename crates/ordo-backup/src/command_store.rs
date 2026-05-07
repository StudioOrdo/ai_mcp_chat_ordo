use crate::command::{CommandName, SystemCommand};
use anyhow::{bail, Context, Result};
use rusqlite::{params, Connection, OptionalExtension};
use serde_json::json;
use std::time::Duration;

pub struct CommandStore {
    conn: Connection,
    lease_owner: String,
    lease_seconds: i64,
}

impl CommandStore {
    pub fn open(db_path: &str, lease_owner: String, lease_seconds: i64) -> Result<Self> {
        let conn = Connection::open(db_path)
            .with_context(|| format!("Failed to open SQLite database: {db_path}"))?;
        conn.busy_timeout(Duration::from_secs(5))?;
        let store = Self {
            conn,
            lease_owner,
            lease_seconds,
        };
        store.verify_schema()?;
        Ok(store)
    }

    pub fn from_connection(conn: Connection, lease_owner: String, lease_seconds: i64) -> Self {
        Self {
            conn,
            lease_owner,
            lease_seconds,
        }
    }

    pub fn connection(&self) -> &Connection {
        &self.conn
    }

    pub fn connection_mut(&mut self) -> &mut Connection {
        &mut self.conn
    }

    pub fn recover_expired_running(&self) -> Result<usize> {
        let changed = self.conn.execute(
            "UPDATE system_commands
             SET status = 'failed',
                 error_message = 'Executor lease expired before completion.',
                 updated_at = datetime('now')
             WHERE target = 'rust_daemon'
               AND status = 'running'
               AND lease_expires_at IS NOT NULL
               AND lease_expires_at < datetime('now')",
            [],
        )?;
        Ok(changed)
    }

    pub fn claim_next(&self) -> Result<Option<SystemCommand>> {
        let row: Option<(String, String, String)> = self
            .conn
            .query_row(
                "SELECT id, command, payload_json
                 FROM system_commands
                 WHERE target = 'rust_daemon' AND status = 'pending'
                 ORDER BY created_at ASC
                 LIMIT 1",
                [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .optional()?;

        let Some((id, command, payload_json)) = row else {
            return Ok(None);
        };

        let changed = self.conn.execute(
            "UPDATE system_commands
             SET status = 'running',
                 lease_owner = ?1,
                 lease_expires_at = datetime('now', ?2),
                 updated_at = datetime('now')
             WHERE id = ?3 AND status = 'pending'",
            params![
                self.lease_owner,
                format!("+{} seconds", self.lease_seconds),
                id
            ],
        )?;
        if changed == 0 {
            return Ok(None);
        }

        match CommandName::parse(&command) {
            Ok(parsed) => Ok(Some(SystemCommand {
                id,
                command: parsed,
                payload_json,
            })),
            Err(error) => {
                self.mark_failed(&id, &error.to_string(), None)?;
                Ok(None)
            }
        }
    }

    pub fn mark_succeeded(&self, id: &str, result_payload: serde_json::Value) -> Result<()> {
        self.conn.execute(
            "UPDATE system_commands
             SET status = 'succeeded',
                 result_payload = ?1,
                 error_message = NULL,
                 lease_owner = NULL,
                 lease_expires_at = NULL,
                 updated_at = datetime('now')
             WHERE id = ?2",
            params![result_payload.to_string(), id],
        )?;
        Ok(())
    }

    pub fn mark_failed(
        &self,
        id: &str,
        message: &str,
        result_payload: Option<serde_json::Value>,
    ) -> Result<()> {
        let compact = if message.len() > 1000 {
            &message[..1000]
        } else {
            message
        };
        self.conn.execute(
            "UPDATE system_commands
             SET status = 'failed',
                 error_message = ?1,
                 result_payload = ?2,
                 lease_owner = NULL,
                 lease_expires_at = NULL,
                 updated_at = datetime('now')
             WHERE id = ?3",
            params![
                compact,
                result_payload.unwrap_or_else(|| json!({})).to_string(),
                id
            ],
        )?;
        Ok(())
    }

    fn verify_schema(&self) -> Result<()> {
        for table in [
            "system_commands",
            "backup_snapshots",
            "restore_plans",
            "backup_restore_audit_events",
        ] {
            let exists: Option<String> = self
                .conn
                .query_row(
                    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?1",
                    [table],
                    |row| row.get(0),
                )
                .optional()?;
            if exists.is_none() {
                bail!("Required Node-owned table is missing: {table}");
            }
        }
        Ok(())
    }
}
