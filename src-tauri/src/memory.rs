use serde::{Deserialize, Serialize};
use std::{
  ffi::OsStr,
  fs::{self, File},
  io::{Read, Write},
  path::{Path, PathBuf},
  time::{SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Manager};

const MEMORIES_DIR: &str = "memories";

#[derive(Debug, Serialize)]
pub(crate) struct MemorySummary {
  pub id: String,
  pub title: String,
  pub updated_at: i64,
}

#[derive(Debug, Serialize)]
pub(crate) struct MemoryDetail {
  pub id: String,
  pub title: String,
  pub body: String,
  pub updated_at: i64,
}

#[derive(Debug, Deserialize)]
pub(crate) struct SaveMemoryPayload {
  pub id: Option<String>,
  pub title: String,
  pub body: String,
}

#[tauri::command]
pub(crate) fn list_memories(app: AppHandle) -> Result<Vec<MemorySummary>, String> {
  let dir = ensure_memories_dir(&app)?;
  let mut summaries = Vec::new();
  for entry in fs::read_dir(&dir).map_err(to_string)? {
    let entry = entry.map_err(to_string)?;
    let path = entry.path();
    if path.extension() != Some(OsStr::new("md")) {
      continue;
    }
    let id = path
      .file_stem()
      .and_then(|s| s.to_str())
      .unwrap_or_default()
      .to_string();
    let mut file = File::open(&path).map_err(to_string)?;
    let mut body = String::new();
    file.read_to_string(&mut body).map_err(to_string)?;
    let title = extract_title(&body);
    let updated_at = file_updated_at(&path);
    summaries.push(MemorySummary {
      id,
      title,
      updated_at,
    });
  }
  summaries.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
  Ok(summaries)
}

#[tauri::command]
pub(crate) fn load_memory(app: AppHandle, id: String) -> Result<MemoryDetail, String> {
  let dir = ensure_memories_dir(&app)?;
  let path = memories_file(&dir, &id);
  let body = fs::read_to_string(&path).map_err(to_string)?;
  let title = extract_title(&body);
  let updated_at = file_updated_at(&path);
  Ok(MemoryDetail {
    id,
    title,
    body,
    updated_at,
  })
}

#[tauri::command]
pub(crate) fn save_memory(
  app: AppHandle,
  payload: SaveMemoryPayload,
) -> Result<MemoryDetail, String> {
  let dir = ensure_memories_dir(&app)?;
  let SaveMemoryPayload { id, title, body } = payload;
  let trimmed_title = title.trim();
  let resolved_title = if trimmed_title.is_empty() {
    "Untitled memory".to_string()
  } else {
    trimmed_title.to_string()
  };

  let id = id.unwrap_or_else(|| generate_timestamp_id(&dir));

  let path = memories_file(&dir, &id);

  let body_content = if body.trim().is_empty() {
    format!("# {resolved_title}\n\n")
  } else {
    body
  };

  let mut file = File::create(&path).map_err(to_string)?;
  file.write_all(body_content.as_bytes()).map_err(to_string)?;
  file.flush().map_err(to_string)?;

  let updated_at = file_updated_at(&path);
  Ok(MemoryDetail {
    id,
    title: extract_title(&body_content),
    body: body_content,
    updated_at,
  })
}

#[tauri::command]
pub(crate) fn delete_memory(app: AppHandle, id: String) -> Result<(), String> {
  let dir = ensure_memories_dir(&app)?;
  let path = memories_file(&dir, &id);
  if path.exists() {
    fs::remove_file(path).map_err(to_string)?;
  }
  Ok(())
}

fn ensure_memories_dir(app: &AppHandle) -> Result<PathBuf, String> {
  let dir = app
    .path()
    .app_data_dir()
    .map_err(to_string)?
    .join(MEMORIES_DIR);
  fs::create_dir_all(&dir).map_err(to_string)?;
  Ok(dir)
}

fn to_string<E: std::fmt::Display>(err: E) -> String {
  err.to_string()
}

fn memories_file(dir: &Path, id: &str) -> PathBuf {
  dir.join(format!("{id}.md"))
}

fn generate_timestamp_id(dir: &Path) -> String {
  let now = SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map(|d| d.as_millis())
    .unwrap_or(0);
  let base = now.to_string();
  if !memories_file(dir, &base).exists() {
    return base;
  }

  let mut counter = 1;
  loop {
    let candidate = format!("{base}-{counter}");
    if !memories_file(dir, &candidate).exists() {
      return candidate;
    }
    counter += 1;
  }
}

fn file_updated_at(path: &Path) -> i64 {
  path
    .metadata()
    .and_then(|meta| meta.modified())
    .unwrap_or_else(|_| SystemTime::now())
    .duration_since(UNIX_EPOCH)
    .map(|d| d.as_secs() as i64)
    .unwrap_or_default()
}

fn extract_title(body: &str) -> String {
  for line in body.lines() {
    let trimmed = line.trim();
    if trimmed.is_empty() {
      continue;
    }
    if let Some(rest) = trimmed.strip_prefix("# ") {
      return rest.trim().to_string();
    }
    return trimmed.to_string();
  }
  "Untitled memory".to_string()
}
