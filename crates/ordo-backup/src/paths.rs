use crate::command::DataBoundaryPayload;
use anyhow::{bail, Context, Result};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone)]
pub struct DataBoundary {
    pub data_dir: PathBuf,
    pub sqlite_path: PathBuf,
    pub blog_asset_root: PathBuf,
    pub user_file_root: PathBuf,
}

impl DataBoundary {
    pub fn from_payload(payload: &DataBoundaryPayload) -> Result<Self> {
        let data_dir = canonicalize_existing_dir(&payload.data_dir)?;
        let sqlite_path = normalize_inside(&data_dir, &payload.sqlite_path, "sqlitePath")?;
        let blog_asset_root =
            normalize_inside(&data_dir, &payload.blog_asset_root, "blogAssetRoot")?;
        let user_file_root = normalize_inside(&data_dir, &payload.user_file_root, "userFileRoot")?;
        Ok(Self {
            data_dir,
            sqlite_path,
            blog_asset_root,
            user_file_root,
        })
    }

    pub fn backups_dir(&self) -> PathBuf {
        self.data_dir.join("backups")
    }

    pub fn backup_staging_dir(&self, snapshot_id: &str) -> PathBuf {
        self.data_dir.join(".backup_staging").join(snapshot_id)
    }

    pub fn restore_staging_dir(&self, plan_id: &str) -> PathBuf {
        self.data_dir.join(".restore_staging").join(plan_id)
    }

    pub fn ensure_asset_roots(&self) -> Result<()> {
        fs::create_dir_all(&self.blog_asset_root)?;
        fs::create_dir_all(&self.user_file_root)?;
        Ok(())
    }
}

pub fn ensure_inside(parent: &Path, child: &Path, label: &str) -> Result<()> {
    let relative = child
        .strip_prefix(parent)
        .with_context(|| format!("{label} escapes data boundary: {}", child.display()))?;
    if relative
        .components()
        .any(|component| matches!(component, std::path::Component::ParentDir))
    {
        bail!("{label} escapes data boundary: {}", child.display());
    }
    Ok(())
}

fn canonicalize_existing_dir(value: &str) -> Result<PathBuf> {
    let path = PathBuf::from(value);
    fs::create_dir_all(&path)?;
    fs::canonicalize(&path)
        .with_context(|| format!("Failed to canonicalize data dir: {}", path.display()))
}

fn normalize_inside(data_dir: &Path, value: &str, label: &str) -> Result<PathBuf> {
    let path = PathBuf::from(value);
    let normalized = if path.exists() {
        fs::canonicalize(&path)?
    } else if path.is_absolute() {
        let parent = path.parent().unwrap_or(Path::new("/"));
        if parent.exists() {
            fs::canonicalize(parent)?.join(path.file_name().unwrap_or_default())
        } else {
            path
        }
    } else {
        data_dir.join(path)
    };
    ensure_inside(data_dir, &normalized, label)?;
    Ok(normalized)
}
