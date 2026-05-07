use crate::artifact::BackupManifest;
use anyhow::{bail, Context, Result};
use std::fs::{self, File};
use std::io::{self, Write};
use std::path::Path;
use walkdir::WalkDir;
use zip::write::FileOptions;
use zip::ZipWriter;

pub struct ArchiveWriter;

impl ArchiveWriter {
    pub fn write_archive(input: WriteArchiveInput<'_>) -> Result<()> {
        let file = File::create(input.tmp_archive_path).with_context(|| {
            format!(
                "Failed to create archive: {}",
                input.tmp_archive_path.display()
            )
        })?;
        let mut zip = ZipWriter::new(file);
        let options =
            FileOptions::<()>::default().compression_method(zip::CompressionMethod::Deflated);

        zip.start_file("manifest.json", options)?;
        let manifest = serde_json::to_vec_pretty(input.manifest)?;
        zip.write_all(&manifest)?;

        add_file(
            &mut zip,
            input.sqlite_snapshot_path,
            "data/local.db",
            options,
        )?;
        add_root(&mut zip, input.blog_asset_root, "data/blog-assets", options)?;
        add_root(&mut zip, input.user_file_root, "data/user-files", options)?;
        zip.finish()?;
        Ok(())
    }
}

pub struct WriteArchiveInput<'a> {
    pub tmp_archive_path: &'a Path,
    pub manifest: &'a BackupManifest,
    pub sqlite_snapshot_path: &'a Path,
    pub blog_asset_root: &'a Path,
    pub user_file_root: &'a Path,
}

fn add_root<W: Write + io::Seek>(
    zip: &mut ZipWriter<W>,
    root: &Path,
    archive_root: &str,
    options: FileOptions<()>,
) -> Result<()> {
    zip.add_directory(archive_root, options)?;
    if !root.exists() {
        return Ok(());
    }
    for entry in WalkDir::new(root).min_depth(1).follow_links(false) {
        let entry = entry?;
        let path = entry.path();
        let metadata = fs::symlink_metadata(path)?;
        if metadata.file_type().is_symlink() {
            bail!("Refusing to archive symlink: {}", path.display());
        }
        let relative = path.strip_prefix(root)?;
        let archive_name = path_to_archive_name(archive_root, relative)?;
        if metadata.is_dir() {
            zip.add_directory(&archive_name, options)?;
        } else if metadata.is_file() {
            add_file(zip, path, &archive_name, options)?;
        }
    }
    Ok(())
}

fn add_file<W: Write + io::Seek>(
    zip: &mut ZipWriter<W>,
    path: &Path,
    archive_name: &str,
    options: FileOptions<()>,
) -> Result<()> {
    let metadata = fs::symlink_metadata(path)?;
    if metadata.file_type().is_symlink() {
        bail!("Refusing to archive symlink: {}", path.display());
    }
    let mut file = File::open(path)?;
    zip.start_file(archive_name, options)?;
    io::copy(&mut file, zip)?;
    Ok(())
}

fn path_to_archive_name(prefix: &str, relative: &Path) -> Result<String> {
    let mut parts = vec![prefix.to_string()];
    for component in relative.components() {
        match component {
            std::path::Component::Normal(value) => parts.push(value.to_string_lossy().to_string()),
            _ => bail!("Unsafe filesystem path for archive: {}", relative.display()),
        }
    }
    Ok(parts.join("/"))
}

pub fn is_empty_root(root: &Path) -> bool {
    if !root.exists() {
        return true;
    }
    match fs::read_dir(root) {
        Ok(mut entries) => entries.next().is_none(),
        Err(_) => true,
    }
}
