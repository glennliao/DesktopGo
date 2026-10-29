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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_one_level_with_full_names_and_distinguishes_empty_from_missing() {
        let root =
            std::env::temp_dir().join(format!("desktopgo-directory-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(root.join("项目.v1").join("empty")).unwrap();
        std::fs::write(root.join("报价.xlsx"), b"unchanged").unwrap();
        let root_string = root.to_string_lossy();
        let entries = read(&root_string, "").unwrap();
        assert_eq!(entries.len(), 2);
        assert!(entries
            .iter()
            .any(|entry| entry.name == "项目.v1" && entry.can_enter));
        assert!(entries
            .iter()
            .any(|entry| entry.name == "报价.xlsx" && !entry.is_directory));
        assert!(read(&root_string, "项目.v1/empty").unwrap().is_empty());
        assert_eq!(read(&root_string, "missing").unwrap_err().code, "not_found");
        assert_eq!(
            read(&root_string, "报价.xlsx").unwrap_err().code,
            "not_directory"
        );
        assert_eq!(
            read(&root_string, "../outside").unwrap_err().code,
            "outside_root"
        );
        assert_eq!(
            read(&root_string, &root_string).unwrap_err().code,
            "outside_root"
        );
        assert_eq!(std::fs::read(root.join("报价.xlsx")).unwrap(), b"unchanged");
        std::fs::remove_dir_all(root).unwrap();
    }

    #[cfg(windows)]
    fn junction(path: &Path, target: &Path) {
        use std::os::windows::process::CommandExt;
        let result = std::process::Command::new("cmd")
            .args(["/C", "mklink", "/J"])
            .arg(path)
            .arg(target)
            .creation_flags(0x08000000)
            .output()
            .unwrap();
        assert!(
            result.status.success(),
            "{}",
            String::from_utf8_lossy(&result.stdout)
        );
    }

    #[test]
    #[cfg(windows)]
    fn directory_links_cannot_escape_root_or_reenter_an_ancestor() {
        let base =
            std::env::temp_dir().join(format!("desktopgo-directory-{}", uuid::Uuid::new_v4()));
        let root = base.join("root");
        std::fs::create_dir_all(root.join("inside")).unwrap();
        std::fs::create_dir_all(base.join("outside")).unwrap();
        junction(&root.join("external"), &base.join("outside"));
        junction(&root.join("loop"), &root);
        junction(&root.join("alias"), &root.join("inside"));
        std::fs::create_dir_all(base.join("gone")).unwrap();
        junction(&root.join("broken"), &base.join("gone"));
        std::fs::remove_dir(base.join("gone")).unwrap();
        let entries = read(&root.to_string_lossy(), "").unwrap();
        assert!(entries
            .iter()
            .any(|entry| entry.name == "alias" && entry.can_enter));
        assert!(entries
            .iter()
            .filter(|entry| entry.name == "external" || entry.name == "loop")
            .all(|entry| !entry.can_enter));
        assert!(entries
            .iter()
            .any(|entry| entry.name == "broken" && !entry.can_enter));
        assert_eq!(
            read(&root.to_string_lossy(), "external").unwrap_err().code,
            "outside_root"
        );
        assert_eq!(
            read(&root.to_string_lossy(), "loop").unwrap_err().code,
            "directory_cycle"
        );
        for name in ["external", "loop", "alias", "broken"] {
            std::fs::remove_dir(root.join(name)).unwrap();
        }
        std::fs::remove_dir_all(base).unwrap();
    }
}
