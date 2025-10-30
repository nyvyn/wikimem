// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
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
pub struct MemorySummary {
  pub id: String,
  pub title: String,
  pub updated_at: i64,
}

#[derive(Debug, Serialize)]
pub struct MemoryDetail {
  pub id: String,
  pub title: String,
  pub body: String,
  pub updated_at: i64,
}

#[derive(Debug, Deserialize)]
pub struct SaveMemoryPayload {
  pub id: Option<String>,
  pub title: String,
  pub body: String,
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

fn slugify(input: &str) -> String {
  let mut slug = String::new();
  let mut last_dash = false;
  for ch in input.chars() {
    if ch.is_ascii_alphanumeric() {
      slug.push(ch.to_ascii_lowercase());
      last_dash = false;
    } else if !last_dash {
      slug.push('-');
      last_dash = true;
    }
  }
  let trimmed = slug.trim_matches('-').to_string();
  if trimmed.is_empty() {
    "memory".to_string()
  } else {
    trimmed
  }
}

fn uniquify_slug(dir: &Path, base: &str) -> String {
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

#[tauri::command]
pub fn list_memories(app: AppHandle) -> Result<Vec<MemorySummary>, String> {
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
pub fn load_memory(app: AppHandle, id: String) -> Result<MemoryDetail, String> {
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
pub fn save_memory(
  app: AppHandle,
  payload: SaveMemoryPayload,
) -> Result<MemoryDetail, String> {
  let dir = ensure_memories_dir(&app)?;
  let trimmed_title = payload.title.trim();
  let title = if trimmed_title.is_empty() {
    "Untitled memory"
  } else {
    trimmed_title
  };

  let id = if let Some(existing) = payload.id {
    existing
  } else {
    let base = slugify(title);
    if memories_file(&dir, &base).exists() {
      uniquify_slug(&dir, &base)
    } else {
      base
    }
  };

  let path = memories_file(&dir, &id);

  let body = if payload.body.trim().is_empty() {
    format!("# {title}\n\n")
  } else {
    payload.body
  };

  let mut file = File::create(&path).map_err(to_string)?;
  file.write_all(body.as_bytes()).map_err(to_string)?;
  file.flush().map_err(to_string)?;

  let updated_at = file_updated_at(&path);
  Ok(MemoryDetail {
    id,
    title: extract_title(&body),
    body,
    updated_at,
  })
}

#[tauri::command]
pub fn delete_memory(app: AppHandle, id: String) -> Result<(), String> {
  let dir = ensure_memories_dir(&app)?;
  let path = memories_file(&dir, &id);
  if path.exists() {
    fs::remove_file(path).map_err(to_string)?;
  }
  Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_opener::init())
    .invoke_handler(tauri::generate_handler![
      list_memories,
      load_memory,
      save_memory,
      delete_memory
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
