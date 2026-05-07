use anyhow::{bail, Context, Result};
use rusqlite::Connection;
use std::path::Path;

pub fn snapshot_sqlite(source: &Path, destination: &Path) -> Result<()> {
    let src = Connection::open(source)
        .with_context(|| format!("Failed to open source database: {}", source.display()))?;
    let mut dest = Connection::open(destination)
        .with_context(|| format!("Failed to open staging database: {}", destination.display()))?;
    let backup = rusqlite::backup::Backup::new(&src, &mut dest)?;
    backup.step(-1)?;
    Ok(())
}

pub fn restore_sqlite(staged: &Path, live: &Path) -> Result<()> {
    let src = Connection::open(staged)
        .with_context(|| format!("Failed to open staged database: {}", staged.display()))?;
    let mut dest = Connection::open(live)
        .with_context(|| format!("Failed to open live database: {}", live.display()))?;
    let backup = rusqlite::backup::Backup::new(&src, &mut dest)?;
    backup.step(-1)?;
    Ok(())
}

pub fn restore_sqlite_into_connection(staged: &Path, live: &mut Connection) -> Result<()> {
    let src = Connection::open(staged)
        .with_context(|| format!("Failed to open staged database: {}", staged.display()))?;
    let backup = rusqlite::backup::Backup::new(&src, live)?;
    backup.step(-1)?;
    Ok(())
}

pub fn quick_check(path: &Path) -> Result<()> {
    let conn = Connection::open(path).with_context(|| {
        format!(
            "Failed to open database for integrity check: {}",
            path.display()
        )
    })?;
    let result: String = conn.query_row("PRAGMA quick_check", [], |row| row.get(0))?;
    if result != "ok" {
        bail!("SQLite quick_check failed: {result}");
    }
    Ok(())
}
