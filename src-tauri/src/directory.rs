//! Read one level of an explicitly linked directory without importing or modifying it.
use serde::Serialize;
use std::collections::HashSet;
use std::path::{Component, Path, PathBuf};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirectoryEntry {
    name: String,
    path: String,
    relative_path: String,
    is_directory: bool,
    can_enter: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirectoryReadError {
    code: &'static str,
}

fn error(code: &'static str) -> DirectoryReadError {
    DirectoryReadError { code }
}

fn io_error(value: std::io::Error) -> DirectoryReadError {
    error(match value.kind() {
        std::io::ErrorKind::NotFound => "not_found",
        std::io::ErrorKind::PermissionDenied => "access_denied",
        _ => "io_error",
    })
}

fn resolve_directory(
    root: &Path,
    relative: &Path,
) -> Result<(PathBuf, PathBuf), DirectoryReadError> {
    if !root.is_absolute()
        || relative
            .components()
            .any(|part| !matches!(part, Component::Normal(_) | Component::CurDir))
    {
        return Err(error("outside_root"));
    }
    let root = root.canonicalize().map_err(io_error)?;
    let mut current = root.clone();
    let mut visited = HashSet::from([root.clone()]);
    for component in relative.components() {
        if component == Component::CurDir {
            continue;
        }
        current = current.join(component).canonicalize().map_err(io_error)?;
        if !current.starts_with(&root) {
            return Err(error("outside_root"));
        }
        if !visited.insert(current.clone()) {
            return Err(error("directory_cycle"));
        }
    }
    if !current.is_dir() {
        return Err(error("not_directory"));
    }
    Ok((root, current))
}

fn read_entry(
    entry: std::fs::DirEntry,
    root: &Path,
    current: &Path,
    relative: &Path,
    display_root: &Path,
) -> Result<Option<DirectoryEntry>, DirectoryReadError> {
    let name = entry.file_name().to_string_lossy().into_owned();
    if name.starts_with('.') || name.eq_ignore_ascii_case("desktop.ini") {
        return Ok(None);
    }
    let path = entry.path();
    // A dangling link or denied target must not make every sibling disappear.
    // DirEntry's own type remains available even when following its target fails.
    let own_type = entry.file_type().map_err(io_error)?;
    let is_directory =
        own_type.is_dir() || std::fs::metadata(&path).is_ok_and(|metadata| metadata.is_dir());
    let can_enter = if is_directory {
        path.canonicalize()
            .is_ok_and(|resolved| resolved.starts_with(root) && !current.starts_with(&resolved))
    } else {
        false
    };
    Ok(Some(DirectoryEntry {
        relative_path: relative
            .join(entry.file_name())
            .to_string_lossy()
            .into_owned(),
        name,
        path: display_root
            .join(relative)
            .join(entry.file_name())
            .to_string_lossy()
            .into_owned(),
        is_directory,
        can_enter,
    }))
}

pub fn read(
    root_path: &str,
    relative_path: &str,
) -> Result<Vec<DirectoryEntry>, DirectoryReadError> {
    let relative = Path::new(relative_path);
    let (root, current) = resolve_directory(Path::new(root_path), relative)?;
    std::fs::read_dir(&current)
        .map_err(io_error)?
        .map(|entry| {
            read_entry(
                entry.map_err(io_error)?,
                &root,
                &current,
                relative,
                Path::new(root_path),
            )
        })
        .filter_map(Result::transpose)
        .collect()
}

#[tauri::command]
pub async fn read_directory(
    root_path: String,
    relative_path: String,
) -> Result<Vec<DirectoryEntry>, DirectoryReadError> {
    tauri::async_runtime::spawn_blocking(move || read(&root_path, &relative_path))
        .await
        .map_err(|_| error("io_error"))?
}
