use ordo_backup::artifact::hash_file;
use ordo_backup::daemon::run_once;
use ordo_backup::{artifact, command_store::CommandStore};
use rusqlite::{params, Connection};
use serde_json::json;
use std::fs::{self, File};
use std::io::Write;
use tempfile::tempdir;
use zip::write::FileOptions;
use zip::ZipWriter;

fn create_schema(conn: &Connection) {
    conn.execute_batch(
        "
        CREATE TABLE system_commands (
          id TEXT PRIMARY KEY,
          target TEXT NOT NULL,
          command TEXT NOT NULL,
          status TEXT NOT NULL,
          payload_json TEXT NOT NULL DEFAULT '{}',
          result_payload TEXT DEFAULT NULL,
          error_message TEXT DEFAULT NULL,
          requested_by_user_id TEXT DEFAULT NULL,
          requested_by_role TEXT DEFAULT NULL,
          requested_from TEXT NOT NULL DEFAULT 'system',
          lease_owner TEXT DEFAULT NULL,
          lease_expires_at TEXT DEFAULT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE backup_snapshots (
          id TEXT PRIMARY KEY,
          kind TEXT NOT NULL,
          status TEXT NOT NULL,
          archive_path TEXT DEFAULT NULL,
          archive_hash TEXT DEFAULT NULL,
          archive_size_bytes INTEGER DEFAULT NULL,
          manifest_schema_version TEXT DEFAULT NULL,
          app_version TEXT DEFAULT NULL,
          created_by_user_id TEXT DEFAULT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          validated_at TEXT DEFAULT NULL,
          failure_message TEXT DEFAULT NULL
        );
        CREATE TABLE restore_plans (
          id TEXT PRIMARY KEY,
          snapshot_id TEXT NOT NULL,
          status TEXT NOT NULL,
          archive_path TEXT NOT NULL,
          archive_hash TEXT NOT NULL,
          archive_size_bytes INTEGER NOT NULL,
          manifest_schema_version TEXT NOT NULL,
          app_version TEXT NOT NULL,
          restore_plan_version TEXT NOT NULL,
          impact_json TEXT NOT NULL DEFAULT '{}',
          validation_warnings_json TEXT NOT NULL DEFAULT '[]',
          confirmation_phrase TEXT NOT NULL,
          pre_restore_backup_command_id TEXT DEFAULT NULL,
          pre_restore_backup_snapshot_id TEXT DEFAULT NULL,
          restore_command_id TEXT DEFAULT NULL,
          confirmed_by_user_id TEXT DEFAULT NULL,
          confirmed_at TEXT DEFAULT NULL,
          failure_message TEXT DEFAULT NULL,
          created_by_user_id TEXT DEFAULT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE backup_restore_audit_events (
          id TEXT PRIMARY KEY,
          operation_id TEXT NOT NULL,
          operation_kind TEXT NOT NULL,
          event_type TEXT NOT NULL,
          actor_user_id TEXT DEFAULT NULL,
          actor_role TEXT DEFAULT NULL,
          metadata_json TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        ",
    )
    .unwrap();
}

fn backup_payload(
    data_dir: &str,
    snapshot_id: &str,
    kind: &str,
    restore_plan_id: Option<&str>,
) -> serde_json::Value {
    let mut payload = json!({
        "kind": kind,
        "requestedAt": "2026-05-02T12:00:00.000Z",
        "snapshotId": snapshot_id,
        "dataBoundary": {
            "dataDir": data_dir,
            "sqlitePath": format!("{data_dir}/local.db"),
            "blogAssetRoot": format!("{data_dir}/blog-assets"),
            "userFileRoot": format!("{data_dir}/user-files")
        },
        "appVersion": "0.1.0",
        "sourceRuntimeProfileId": "test"
    });
    if kind == "manual" {
        payload["operation"] = json!({
            "operationId": "op_backup",
            "stepId": "op_backup:backup.create",
            "actionId": "act_backup",
            "operationKind": "backup_create"
        });
    }
    if kind == "pre_restore" {
        payload["operation"] = json!({
            "operationId": "op_restore",
            "stepId": "op_restore:restore.safety_backup",
            "actionId": "act_safety",
            "operationKind": "restore_execute"
        });
    }
    if let Some(plan_id) = restore_plan_id {
        payload["restorePlanId"] = json!(plan_id);
    }
    payload
}

fn insert_backup_command(conn: &Connection, id: &str, payload: serde_json::Value) {
    conn.execute(
        "INSERT INTO system_commands (id, target, command, status, payload_json, requested_by_role, requested_from)
         VALUES (?1, 'rust_daemon', 'backup.create', 'pending', ?2, 'ADMIN', 'test')",
        params![id, payload.to_string()],
    )
    .unwrap();
}

fn create_db(path: &str, value: &str) {
    fs::create_dir_all(std::path::Path::new(path).parent().unwrap()).unwrap();
    let conn = Connection::open(path).unwrap();
    conn.execute("CREATE TABLE items (value TEXT)", []).unwrap();
    conn.execute("INSERT INTO items (value) VALUES (?1)", [value])
        .unwrap();
}

#[test]
fn backup_creates_manifest_archive_and_updates_command_and_snapshot() {
    let dir = tempdir().unwrap();
    let data_dir = dir.path().join(".data");
    fs::create_dir_all(data_dir.join("blog-assets")).unwrap();
    fs::create_dir_all(data_dir.join("user-files")).unwrap();
    create_db(data_dir.join("local.db").to_str().unwrap(), "before");
    fs::write(data_dir.join("blog-assets/post.txt"), "post").unwrap();
    let conn = Connection::open(data_dir.join("local.db")).unwrap();
    create_schema(&conn);
    conn.execute(
        "INSERT INTO backup_snapshots (id, kind, status) VALUES ('backup_1', 'manual', 'pending')",
        [],
    )
    .unwrap();
    insert_backup_command(
        &conn,
        "cmd_1",
        backup_payload(data_dir.to_str().unwrap(), "backup_1", "manual", None),
    );
    drop(conn);

    let mut store = CommandStore::open(
        data_dir.join("local.db").to_str().unwrap(),
        "test".to_string(),
        60,
    )
    .unwrap();
    assert!(run_once(&mut store).unwrap());

    let status: String = store
        .connection()
        .query_row(
            "SELECT status FROM system_commands WHERE id = 'cmd_1'",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(status, "succeeded");
    let (snapshot_status, archive_path, archive_hash): (String, String, String) = store
        .connection()
        .query_row(
            "SELECT status, archive_path, archive_hash FROM backup_snapshots WHERE id = 'backup_1'",
            [],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .unwrap();
    assert_eq!(snapshot_status, "succeeded");
    let result_payload: String = store
        .connection()
        .query_row(
            "SELECT result_payload FROM system_commands WHERE id = 'cmd_1'",
            [],
            |row| row.get(0),
        )
        .unwrap();
    let result: serde_json::Value = serde_json::from_str(&result_payload).unwrap();
    assert_eq!(result["schemaVersion"], "1");
    assert_eq!(result["commandId"], "cmd_1");
    assert_eq!(result["operation"]["operationId"], "op_backup");
    assert_eq!(result["status"], "succeeded");
    assert_eq!(result["artifacts"][0]["kind"], "backup_archive");
    assert!(archive_hash.starts_with("sha256:"));
    let file = File::open(archive_path).unwrap();
    let mut archive = zip::ZipArchive::new(file).unwrap();
    assert!(archive.by_name("manifest.json").is_ok());
    assert!(archive.by_name("data/local.db").is_ok());
    assert!(archive.by_name("data/blog-assets/post.txt").is_ok());
}

#[test]
fn pre_restore_backup_links_snapshot_to_restore_plan() {
    let dir = tempdir().unwrap();
    let data_dir = dir.path().join(".data");
    fs::create_dir_all(&data_dir).unwrap();
    create_db(data_dir.join("local.db").to_str().unwrap(), "before");
    let conn = Connection::open(data_dir.join("local.db")).unwrap();
    create_schema(&conn);
    conn.execute("INSERT INTO backup_snapshots (id, kind, status) VALUES ('backup_pre', 'pre_restore', 'pending')", []).unwrap();
    conn.execute(
        "INSERT INTO restore_plans (id, snapshot_id, status, archive_path, archive_hash, archive_size_bytes, manifest_schema_version, app_version, restore_plan_version, confirmation_phrase)
         VALUES ('restore_1', 'backup_source', 'confirmed', '/tmp/source.zip', 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 1, '1', '0.1.0', '1', 'RESTORE restore_1')",
        [],
    ).unwrap();
    insert_backup_command(
        &conn,
        "cmd_pre",
        backup_payload(
            data_dir.to_str().unwrap(),
            "backup_pre",
            "pre_restore",
            Some("restore_1"),
        ),
    );
    drop(conn);

    let mut store = CommandStore::open(
        data_dir.join("local.db").to_str().unwrap(),
        "test".to_string(),
        60,
    )
    .unwrap();
    assert!(run_once(&mut store).unwrap());
    let linked: String = store
        .connection()
        .query_row(
            "SELECT pre_restore_backup_snapshot_id FROM restore_plans WHERE id = 'restore_1'",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(linked, "backup_pre");
}

#[test]
fn restore_rejects_hash_mismatch_before_live_mutation() {
    let (dir, archive_path, _hash, size) = create_restore_fixture();
    let data_dir = dir.path().join(".data");
    create_db(data_dir.join("local.db").to_str().unwrap(), "live");
    let conn = Connection::open(data_dir.join("local.db")).unwrap();
    create_schema(&conn);
    insert_restore_records(
        &conn,
        data_dir.to_str().unwrap(),
        archive_path.to_str().unwrap(),
        "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        size,
    );
    drop(conn);
    let mut store = CommandStore::open(
        data_dir.join("local.db").to_str().unwrap(),
        "test".to_string(),
        60,
    )
    .unwrap();
    assert!(run_once(&mut store).is_err());
    let live: String = store
        .connection()
        .query_row("SELECT value FROM items", [], |row| row.get(0))
        .unwrap();
    assert_eq!(live, "live");
    let plan_status: String = store
        .connection()
        .query_row(
            "SELECT status FROM restore_plans WHERE id = 'restore_1'",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(plan_status, "failed");
}

#[test]
fn restore_replays_sqlite_and_assets_from_valid_archive() {
    let (dir, archive_path, hash, size) = create_restore_fixture();
    let data_dir = dir.path().join(".data");
    create_db(data_dir.join("local.db").to_str().unwrap(), "live");
    fs::create_dir_all(data_dir.join("blog-assets")).unwrap();
    fs::write(data_dir.join("blog-assets/old.txt"), "old").unwrap();
    let conn = Connection::open(data_dir.join("local.db")).unwrap();
    create_schema(&conn);
    insert_restore_records(
        &conn,
        data_dir.to_str().unwrap(),
        archive_path.to_str().unwrap(),
        &hash,
        size,
    );
    drop(conn);

    let mut store = CommandStore::open(
        data_dir.join("local.db").to_str().unwrap(),
        "test".to_string(),
        60,
    )
    .unwrap();
    assert!(run_once(&mut store).unwrap());
    let restored: String = store
        .connection()
        .query_row("SELECT value FROM items", [], |row| row.get(0))
        .unwrap();
    assert_eq!(restored, "restored");
    assert_eq!(
        fs::read_to_string(data_dir.join("blog-assets/new.txt")).unwrap(),
        "new"
    );
    assert!(!data_dir.join("blog-assets/old.txt").exists());
    let command_status: String = store
        .connection()
        .query_row(
            "SELECT status FROM system_commands WHERE id = 'cmd_restore'",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(command_status, "succeeded");
    let plan_status: String = store
        .connection()
        .query_row(
            "SELECT status FROM restore_plans WHERE id = 'restore_1'",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(plan_status, "succeeded");
    let snapshot_status: String = store
        .connection()
        .query_row(
            "SELECT status FROM backup_snapshots WHERE id = 'backup_restore'",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(snapshot_status, "succeeded");
    let result_payload: String = store
        .connection()
        .query_row(
            "SELECT result_payload FROM system_commands WHERE id = 'cmd_restore'",
            [],
            |row| row.get(0),
        )
        .unwrap();
    let result: serde_json::Value = serde_json::from_str(&result_payload).unwrap();
    assert_eq!(result["schemaVersion"], "1");
    assert_eq!(result["commandId"], "cmd_restore");
    assert_eq!(result["operation"]["operationId"], "op_restore");
    assert_eq!(result["status"], "succeeded");
    assert_eq!(result["artifacts"][0]["kind"], "restore_execution");
}

#[test]
fn backup_failure_marks_command_and_snapshot_failed() {
    let dir = tempdir().unwrap();
    let data_dir = dir.path().join(".data");
    fs::create_dir_all(data_dir.join("blog-assets")).unwrap();
    fs::create_dir_all(data_dir.join("user-files")).unwrap();
    create_db(data_dir.join("local.db").to_str().unwrap(), "before");
    #[cfg(unix)]
    std::os::unix::fs::symlink("target", data_dir.join("blog-assets/link")).unwrap();

    let conn = Connection::open(data_dir.join("local.db")).unwrap();
    create_schema(&conn);
    conn.execute("INSERT INTO backup_snapshots (id, kind, status) VALUES ('backup_bad', 'manual', 'pending')", []).unwrap();
    insert_backup_command(
        &conn,
        "cmd_bad",
        backup_payload(data_dir.to_str().unwrap(), "backup_bad", "manual", None),
    );
    drop(conn);

    let mut store = CommandStore::open(
        data_dir.join("local.db").to_str().unwrap(),
        "test".to_string(),
        60,
    )
    .unwrap();
    assert!(run_once(&mut store).is_err());
    let (command_status, snapshot_status): (String, String) = store.connection()
        .query_row(
            "SELECT c.status, s.status FROM system_commands c, backup_snapshots s WHERE c.id = 'cmd_bad' AND s.id = 'backup_bad'",
            [],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .unwrap();
    assert_eq!(command_status, "failed");
    assert_eq!(snapshot_status, "failed");
    let result_payload: String = store
        .connection()
        .query_row(
            "SELECT result_payload FROM system_commands WHERE id = 'cmd_bad'",
            [],
            |row| row.get(0),
        )
        .unwrap();
    let result: serde_json::Value = serde_json::from_str(&result_payload).unwrap();
    assert_eq!(result["schemaVersion"], "1");
    assert_eq!(result["status"], "failed");
    assert_eq!(result["error"]["code"], "BACKUP_EXECUTOR_FAILED");
}

#[test]
fn restore_rejects_unsafe_archive_entry_before_live_mutation() {
    let dir = tempdir().unwrap();
    let data_dir = dir.path().join(".data");
    create_db(data_dir.join("local.db").to_str().unwrap(), "live");
    let archive_path = dir.path().join("unsafe.zip");
    write_restore_archive(
        &archive_path,
        "backup_restore",
        &[
            ("data/local.db", b"not sqlite".as_slice()),
            ("../escape.txt", b"escape".as_slice()),
        ],
    );
    let integrity = hash_file(&archive_path).unwrap();

    let conn = Connection::open(data_dir.join("local.db")).unwrap();
    create_schema(&conn);
    insert_restore_records(
        &conn,
        data_dir.to_str().unwrap(),
        archive_path.to_str().unwrap(),
        &integrity.hash,
        integrity.size_bytes,
    );
    drop(conn);

    let mut store = CommandStore::open(
        data_dir.join("local.db").to_str().unwrap(),
        "test".to_string(),
        60,
    )
    .unwrap();
    assert!(run_once(&mut store).is_err());
    let live: String = store
        .connection()
        .query_row("SELECT value FROM items", [], |row| row.get(0))
        .unwrap();
    assert_eq!(live, "live");
}

#[test]
fn restore_rejects_missing_sqlite_before_live_mutation() {
    let dir = tempdir().unwrap();
    let data_dir = dir.path().join(".data");
    create_db(data_dir.join("local.db").to_str().unwrap(), "live");
    let archive_path = dir.path().join("missing-db.zip");
    write_restore_archive(
        &archive_path,
        "backup_restore",
        &[("data/blog-assets/new.txt", b"new".as_slice())],
    );
    let integrity = hash_file(&archive_path).unwrap();

    let conn = Connection::open(data_dir.join("local.db")).unwrap();
    create_schema(&conn);
    insert_restore_records(
        &conn,
        data_dir.to_str().unwrap(),
        archive_path.to_str().unwrap(),
        &integrity.hash,
        integrity.size_bytes,
    );
    drop(conn);

    let mut store = CommandStore::open(
        data_dir.join("local.db").to_str().unwrap(),
        "test".to_string(),
        60,
    )
    .unwrap();
    assert!(run_once(&mut store).is_err());
    let live: String = store
        .connection()
        .query_row("SELECT value FROM items", [], |row| row.get(0))
        .unwrap();
    assert_eq!(live, "live");
}

#[test]
fn restore_rejects_data_boundary_escape_before_live_mutation() {
    let (dir, archive_path, hash, size) = create_restore_fixture();
    let data_dir = dir.path().join(".data");
    create_db(data_dir.join("local.db").to_str().unwrap(), "live");
    let conn = Connection::open(data_dir.join("local.db")).unwrap();
    create_schema(&conn);
    insert_restore_records(
        &conn,
        data_dir.to_str().unwrap(),
        archive_path.to_str().unwrap(),
        &hash,
        size,
    );
    conn.execute(
        "UPDATE system_commands
         SET payload_json = json_set(payload_json, '$.dataBoundary.blogAssetRoot', ?1)
         WHERE id = 'cmd_restore'",
        [dir.path()
            .join("escaped-blog-assets")
            .to_string_lossy()
            .to_string()],
    )
    .unwrap();
    drop(conn);

    let mut store = CommandStore::open(
        data_dir.join("local.db").to_str().unwrap(),
        "test".to_string(),
        60,
    )
    .unwrap();
    assert!(run_once(&mut store).is_err());
    let live: String = store
        .connection()
        .query_row("SELECT value FROM items", [], |row| row.get(0))
        .unwrap();
    assert_eq!(live, "live");
}

#[test]
fn stale_running_command_recovery_marks_expired_work_failed() {
    let dir = tempdir().unwrap();
    let db_path = dir.path().join("local.db");
    let conn = Connection::open(&db_path).unwrap();
    create_schema(&conn);
    conn.execute(
        "INSERT INTO system_commands (id, target, command, status, payload_json, requested_by_role, requested_from, lease_expires_at)
         VALUES ('cmd_stale', 'rust_daemon', 'backup.create', 'running', '{}', 'ADMIN', 'test', datetime('now', '-10 seconds'))",
        [],
    )
    .unwrap();
    drop(conn);

    let store = CommandStore::open(db_path.to_str().unwrap(), "test".to_string(), 60).unwrap();
    assert_eq!(store.recover_expired_running().unwrap(), 1);
    let status: String = store
        .connection()
        .query_row(
            "SELECT status FROM system_commands WHERE id = 'cmd_stale'",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(status, "failed");
}

fn create_restore_fixture() -> (tempfile::TempDir, std::path::PathBuf, String, u64) {
    let dir = tempdir().unwrap();
    let source = dir.path().join("source");
    fs::create_dir_all(source.join("data/blog-assets")).unwrap();
    fs::create_dir_all(source.join("data/user-files")).unwrap();
    create_db(source.join("data/local.db").to_str().unwrap(), "restored");
    let source_conn = Connection::open(source.join("data/local.db")).unwrap();
    create_schema(&source_conn);
    drop(source_conn);
    fs::write(source.join("data/blog-assets/new.txt"), "new").unwrap();
    let archive_path = dir.path().join("restore.zip");
    let file = File::create(&archive_path).unwrap();
    let mut zip = ZipWriter::new(file);
    let options = FileOptions::<()>::default().compression_method(zip::CompressionMethod::Deflated);
    let manifest = artifact::BackupManifest {
        schema_version: "1".to_string(),
        app_version: "0.1.0".to_string(),
        created_at: "2026-05-02T12:00:00.000Z".to_string(),
        backup_id: "backup_restore".to_string(),
        kind: "manual".to_string(),
        source_runtime_profile_id: "test".to_string(),
        source_data_root: "/source/.data".to_string(),
        sqlite: artifact::ManifestSqlite {
            path_policy: "sqlite_backup_api_snapshot".to_string(),
            relative_path: "data/local.db".to_string(),
            quick_integrity_check: "ok".to_string(),
        },
        roots: vec![],
        exclusions: artifact::ManifestExclusions {
            paths: vec![],
            symlinks: "rejected".to_string(),
            runtime_logs: "excluded".to_string(),
            existing_backups: "excluded".to_string(),
        },
        archive: artifact::ManifestArchive {
            hash_algorithm: "sha256".to_string(),
        },
        compatibility: artifact::ManifestCompatibility {
            warnings: vec![],
            requires_restore_plan_version: "1".to_string(),
        },
    };
    zip.start_file("manifest.json", options).unwrap();
    zip.write_all(serde_json::to_vec(&manifest).unwrap().as_slice())
        .unwrap();
    zip.start_file("data/local.db", options).unwrap();
    zip.write_all(fs::read(source.join("data/local.db")).unwrap().as_slice())
        .unwrap();
    zip.add_directory("data/blog-assets", options).unwrap();
    zip.start_file("data/blog-assets/new.txt", options).unwrap();
    zip.write_all(b"new").unwrap();
    zip.add_directory("data/user-files", options).unwrap();
    zip.finish().unwrap();
    let integrity = hash_file(&archive_path).unwrap();
    (dir, archive_path, integrity.hash, integrity.size_bytes)
}

fn write_restore_archive(
    archive_path: &std::path::Path,
    backup_id: &str,
    entries: &[(&str, &[u8])],
) {
    let file = File::create(archive_path).unwrap();
    let mut zip = ZipWriter::new(file);
    let options = FileOptions::<()>::default().compression_method(zip::CompressionMethod::Deflated);
    let manifest = artifact::BackupManifest {
        schema_version: "1".to_string(),
        app_version: "0.1.0".to_string(),
        created_at: "2026-05-02T12:00:00.000Z".to_string(),
        backup_id: backup_id.to_string(),
        kind: "manual".to_string(),
        source_runtime_profile_id: "test".to_string(),
        source_data_root: "/source/.data".to_string(),
        sqlite: artifact::ManifestSqlite {
            path_policy: "sqlite_backup_api_snapshot".to_string(),
            relative_path: "data/local.db".to_string(),
            quick_integrity_check: "ok".to_string(),
        },
        roots: vec![],
        exclusions: artifact::ManifestExclusions {
            paths: vec![],
            symlinks: "rejected".to_string(),
            runtime_logs: "excluded".to_string(),
            existing_backups: "excluded".to_string(),
        },
        archive: artifact::ManifestArchive {
            hash_algorithm: "sha256".to_string(),
        },
        compatibility: artifact::ManifestCompatibility {
            warnings: vec![],
            requires_restore_plan_version: "1".to_string(),
        },
    };
    zip.start_file("manifest.json", options).unwrap();
    zip.write_all(serde_json::to_vec(&manifest).unwrap().as_slice())
        .unwrap();
    for (name, bytes) in entries {
        zip.start_file(*name, options).unwrap();
        zip.write_all(bytes).unwrap();
    }
    zip.finish().unwrap();
}

fn insert_restore_records(
    conn: &Connection,
    data_dir: &str,
    archive_path: &str,
    hash: &str,
    size: u64,
) {
    conn.execute(
        "INSERT INTO backup_snapshots (id, kind, status, archive_path, archive_hash, archive_size_bytes, manifest_schema_version, app_version)
         VALUES ('backup_restore', 'manual', 'succeeded', ?1, ?2, ?3, '1', '0.1.0')",
        params![archive_path, hash, i64::try_from(size).unwrap()],
    ).unwrap();
    conn.execute(
        "INSERT INTO restore_plans (id, snapshot_id, status, archive_path, archive_hash, archive_size_bytes, manifest_schema_version, app_version, restore_plan_version, confirmation_phrase, restore_command_id)
         VALUES ('restore_1', 'backup_restore', 'running', ?1, ?2, ?3, '1', '0.1.0', '1', 'RESTORE restore_1', 'cmd_restore')",
        params![archive_path, hash, i64::try_from(size).unwrap()],
    ).unwrap();
    let payload = json!({
        "restorePlanId": "restore_1",
        "snapshotId": "backup_restore",
        "archivePath": archive_path,
        "expectedArchiveHash": hash,
        "expectedArchiveSizeBytes": size,
        "manifestSchemaVersion": "1",
        "restorePlanVersion": "1",
        "requestedAt": "2026-05-02T12:00:00.000Z",
        "dataBoundary": {
            "dataDir": data_dir,
            "sqlitePath": format!("{data_dir}/local.db"),
            "blogAssetRoot": format!("{data_dir}/blog-assets"),
            "userFileRoot": format!("{data_dir}/user-files")
        },
        "operation": {
            "operationId": "op_restore",
            "stepId": "op_restore:restore.execute",
            "actionId": "act_execute",
            "operationKind": "restore_execute"
        }
    });
    conn.execute(
        "INSERT INTO system_commands (id, target, command, status, payload_json, requested_by_role, requested_from)
         VALUES ('cmd_restore', 'rust_daemon', 'restore.request', 'pending', ?1, 'ADMIN', 'test')",
        [payload.to_string()],
    ).unwrap();
}
