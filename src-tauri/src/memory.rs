use serde::{Deserialize, Serialize};
use std::{
  ffi::OsStr,
  fs::{self, File},
  io::{Read, Write},
  path::{Path, PathBuf},
  time::{SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Emitter, Manager};

const MEMORIES_DIR: &str = "memories";
pub const MEMORIES_CHANGED_EVENT: &str = "wikimem://memories-changed";

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

#[derive(Debug, Serialize)]
pub struct MemorySearchResult {
  pub id: String,
  pub title: String,
  pub snippet: String,
  pub updated_at: i64,
}

#[derive(Debug, Serialize, Clone)]
pub struct MemoryChangedPayload {
  pub action: &'static str,
  pub id: Option<String>,
}

impl MemoryChangedPayload {
  pub fn saved(id: String) -> Self {
    Self {
      action: "saved",
      id: Some(id),
    }
  }

  pub fn deleted(id: String) -> Self {
    Self {
      action: "deleted",
      id: Some(id),
    }
  }
}

#[derive(Clone)]
pub struct MemoryStore {
  base_dir: PathBuf,
}

impl MemoryStore {
  pub fn new(base_dir: PathBuf) -> Result<Self, String> {
    fs::create_dir_all(&base_dir).map_err(to_string)?;
    Ok(Self { base_dir })
  }

  pub fn from_app(app: &AppHandle) -> Result<Self, String> {
    let dir = app
      .path()
      .app_data_dir()
      .map_err(to_string)?
      .join(MEMORIES_DIR);
    Self::new(dir)
  }

  pub fn from_config(config: &tauri::Config) -> Result<Self, String> {
    let base = dirs::data_dir().ok_or_else(|| "App data directory not available".to_string())?;
    let dir = base.join(&config.identifier).join(MEMORIES_DIR);
    Self::new(dir)
  }

  pub fn list(&self) -> Result<Vec<MemorySummary>, String> {
    let mut summaries = Vec::new();
    for entry in fs::read_dir(&self.base_dir).map_err(to_string)? {
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

  pub fn load(&self, id: &str) -> Result<MemoryDetail, String> {
    let path = self.file(id);
    let body = fs::read_to_string(&path).map_err(to_string)?;
    let title = extract_title(&body);
    let updated_at = file_updated_at(&path);
    Ok(MemoryDetail {
      id: id.to_string(),
      title,
      body,
      updated_at,
    })
  }

  pub fn save(&self, payload: SaveMemoryPayload) -> Result<MemoryDetail, String> {
    let SaveMemoryPayload { id, title, body } = payload;
    let trimmed_title = title.trim();
    let resolved_title = if trimmed_title.is_empty() {
      "Untitled memory".to_string()
    } else {
      trimmed_title.to_string()
    };

    let id = id.unwrap_or_else(|| self.generate_timestamp_id());
    let path = self.file(&id);

    let body_content = if body.trim().is_empty() {
      format!("# {resolved_title}\n\n")
    } else {
      body
    };

    let mut file = File::create(&path).map_err(to_string)?;
    file
      .write_all(body_content.as_bytes())
      .map_err(to_string)?;
    file.flush().map_err(to_string)?;

    let updated_at = file_updated_at(&path);
    Ok(MemoryDetail {
      id,
      title: extract_title(&body_content),
      body: body_content,
      updated_at,
    })
  }

  pub fn delete(&self, id: &str) -> Result<(), String> {
    let path = self.file(id);
    if path.exists() {
      fs::remove_file(path).map_err(to_string)?;
    }
    Ok(())
  }

  pub fn search(&self, query: &str) -> Result<Vec<MemorySearchResult>, String> {
    let trimmed = query.trim();
    if trimmed.is_empty() {
      return Ok(Vec::new());
    }

    let needle = trimmed.to_lowercase();
    let mut matches = Vec::new();

    for entry in fs::read_dir(&self.base_dir).map_err(to_string)? {
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

      let title_match = title.to_lowercase().contains(&needle);
      let body_match = !title_match && body.to_lowercase().contains(&needle);

      if !(title_match || body_match) {
        continue;
      }

      let snippet = if title_match {
        ellipsize(&title)
      } else {
        extract_snippet(&body, &needle)
      };

      matches.push(MemorySearchResult {
        id,
        title,
        snippet,
        updated_at,
      });
    }

    matches.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    Ok(matches)
  }

  fn file(&self, id: &str) -> PathBuf {
    self.base_dir.join(format!("{id}.md"))
  }

  fn generate_timestamp_id(&self) -> String {
    let now = SystemTime::now()
      .duration_since(UNIX_EPOCH)
      .map(|d| d.as_millis())
      .unwrap_or(0);
    let base = now.to_string();
    if !self.file(&base).exists() {
      return base;
    }

    let mut counter = 1;
    loop {
      let candidate = format!("{base}-{counter}");
      if !self.file(&candidate).exists() {
        return candidate;
      }
      counter += 1;
    }
  }
}

#[tauri::command]
pub(crate) fn list_memories(app: AppHandle) -> Result<Vec<MemorySummary>, String> {
  MemoryStore::from_app(&app)?.list()
}

#[tauri::command]
pub(crate) fn load_memory(app: AppHandle, id: String) -> Result<MemoryDetail, String> {
  MemoryStore::from_app(&app)?.load(&id)
}

#[tauri::command]
pub(crate) fn save_memory(
  app: AppHandle,
  payload: SaveMemoryPayload,
) -> Result<MemoryDetail, String> {
  let detail = MemoryStore::from_app(&app)?.save(payload)?;
  let _ = app.emit(
    MEMORIES_CHANGED_EVENT,
    MemoryChangedPayload::saved(detail.id.clone()),
  );
  Ok(detail)
}

#[tauri::command]
pub(crate) fn delete_memory(app: AppHandle, id: String) -> Result<(), String> {
  MemoryStore::from_app(&app)?.delete(&id)?;
  let _ = app.emit(
    MEMORIES_CHANGED_EVENT,
    MemoryChangedPayload::deleted(id.clone()),
  );
  Ok(())
}

#[tauri::command]
pub(crate) fn search_memories(app: AppHandle, query: String) -> Result<Vec<MemorySearchResult>, String> {
  MemoryStore::from_app(&app)?.search(&query)
}

fn to_string<E: std::fmt::Display>(err: E) -> String {
  err.to_string()
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

fn extract_snippet(body: &str, needle_lower: &str) -> String {
  for line in body.lines() {
    if line.to_lowercase().contains(needle_lower) {
      return ellipsize(line);
    }
  }
  ellipsize(body)
}

fn ellipsize(text: &str) -> String {
  let cleaned = text.trim().replace('\n', " ");
  const MAX_LEN: usize = 160;
  if cleaned.chars().count() <= MAX_LEN {
    cleaned
  } else {
    cleaned
      .chars()
      .take(MAX_LEN)
      .collect::<String>()
      .trim_end()
      .to_string()
      + "…"
  }
}
