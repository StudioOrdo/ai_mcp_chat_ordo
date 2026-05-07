use anyhow::{bail, Context, Result};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs::File;
use std::io::Read;
use std::path::{Component, Path};

pub const MANIFEST_SCHEMA_VERSION: &str = "1";
pub const RESTORE_PLAN_VERSION: &str = "1";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupManifest {
    pub schema_version: String,
    pub app_version: String,
    pub created_at: String,
    pub backup_id: String,
    pub kind: String,
    pub source_runtime_profile_id: String,
    pub source_data_root: String,
    pub sqlite: ManifestSqlite,
    pub roots: Vec<ManifestRoot>,
    pub exclusions: ManifestExclusions,
    pub archive: ManifestArchive,
    pub compatibility: ManifestCompatibility,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManifestSqlite {
    pub path_policy: String,
    pub relative_path: String,
    pub quick_integrity_check: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManifestRoot {
    pub name: String,
    pub relative_path: String,
    pub optional: bool,
    pub empty: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManifestExclusions {
    pub paths: Vec<String>,
    pub symlinks: String,
    pub runtime_logs: String,
    pub existing_backups: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManifestArchive {
    pub hash_algorithm: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManifestCompatibility {
    pub warnings: Vec<String>,
    pub requires_restore_plan_version: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ArchiveIntegrity {
    pub hash: String,
    pub size_bytes: u64,
}

pub fn hash_file(path: &Path) -> Result<ArchiveIntegrity> {
    let mut file = File::open(path)
        .with_context(|| format!("Failed to open archive for hashing: {}", path.display()))?;
    let mut hasher = Sha256::new();
    let mut size_bytes = 0_u64;
    let mut buffer = [0_u8; 64 * 1024];
    loop {
        let read = file.read(&mut buffer)?;
        if read == 0 {
            break;
        }
        size_bytes += u64::try_from(read)?;
        hasher.update(&buffer[..read]);
    }
    Ok(ArchiveIntegrity {
        hash: format!("sha256:{:x}", hasher.finalize()),
        size_bytes,
    })
}

pub fn validate_archive_entry_name(name: &str, is_symlink: bool) -> Result<String> {
    if name.trim().is_empty() {
        bail!("Backup archive entry name is required");
    }
    if is_symlink {
        bail!("Backup archive entry is a symlink: {name}");
    }
    if name.starts_with('/') || name.as_bytes().contains(&0) {
        bail!("Backup archive entry path is unsafe: {name}");
    }
    if name.len() > 2 && name.as_bytes()[1] == b':' {
        bail!("Backup archive entry path is unsafe: {name}");
    }
    let normalized = name.replace('\\', "/").trim_end_matches('/').to_string();
    let path = Path::new(&normalized);
    for component in path.components() {
        match component {
            Component::Normal(_) => {}
            _ => bail!("Backup archive entry path is unsafe: {name}"),
        }
    }
    if normalized == "manifest.json" || normalized == "data/local.db" {
        return Ok(normalized);
    }
    if normalized == "data/blog-assets" || normalized == "data/user-files" {
        return Ok(normalized);
    }
    if normalized.starts_with("data/blog-assets/") || normalized.starts_with("data/user-files/") {
        return Ok(normalized);
    }
    bail!("Backup archive entry path is outside the allowed layout: {name}");
}

pub fn validate_manifest(manifest: &BackupManifest, expected_backup_id: &str) -> Result<()> {
    if manifest.schema_version != MANIFEST_SCHEMA_VERSION {
        bail!(
            "Unsupported backup manifest schema version: {}",
            manifest.schema_version
        );
    }
    if manifest.backup_id != expected_backup_id {
        bail!("Backup manifest backupId does not match expected snapshot id");
    }
    if manifest.sqlite.relative_path != "data/local.db" {
        bail!("Backup manifest sqlite.relativePath must be data/local.db");
    }
    if manifest.sqlite.quick_integrity_check != "ok" {
        bail!("Backup manifest SQLite quick integrity check failed or was skipped");
    }
    if manifest.compatibility.requires_restore_plan_version != RESTORE_PLAN_VERSION {
        bail!("Backup manifest restore plan version is unsupported");
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_unsafe_archive_paths() {
        for name in [
            "../x",
            "/x",
            "C:\\x",
            "data/../x",
            "nope.txt",
            "data\\..\\x",
        ] {
            assert!(validate_archive_entry_name(name, false).is_err(), "{name}");
        }
        assert!(validate_archive_entry_name("data/blog-assets/a.png", false).is_ok());
        assert!(validate_archive_entry_name("data/user-files/a.txt", true).is_err());
    }
}
