use crate::artifact::{validate_archive_entry_name, BackupManifest};
use anyhow::{bail, Context, Result};
use std::fs::{self, File};
use std::io;
use std::path::Path;
use zip::ZipArchive;

pub struct ArchiveReader;

impl ArchiveReader {
    pub fn read_manifest(archive_path: &Path) -> Result<BackupManifest> {
        let file = File::open(archive_path)?;
        let mut archive = ZipArchive::new(file)?;
        let mut manifest = archive
            .by_name("manifest.json")
            .context("Backup archive is missing manifest.json")?;
        let parsed: BackupManifest = serde_json::from_reader(&mut manifest)?;
        Ok(parsed)
    }

    pub fn extract_to_staging(archive_path: &Path, staging_dir: &Path) -> Result<()> {
        let file = File::open(archive_path)?;
        let mut archive = ZipArchive::new(file)?;
        for i in 0..archive.len() {
            let mut entry = archive.by_index(i)?;
            let mode = entry.unix_mode().unwrap_or(0);
            let is_symlink = mode & 0o170000 == 0o120000;
            let normalized = validate_archive_entry_name(entry.name(), is_symlink)?;
            let out_path = staging_dir.join(&normalized);
            if !out_path.starts_with(staging_dir) {
                bail!("Archive entry escaped staging dir: {}", entry.name());
            }
            if entry.is_dir() {
                fs::create_dir_all(&out_path)?;
                continue;
            }
            if let Some(parent) = out_path.parent() {
                fs::create_dir_all(parent)?;
            }
            let mut out = File::create(&out_path)?;
            io::copy(&mut entry, &mut out)?;
        }
        Ok(())
    }
}
