mod mcp;
pub mod memory;
pub use memory::{
  MemoryChangedPayload, MemoryDetail, MemorySearchResult, MemoryStore, MemorySummary,
  SaveMemoryPayload, MEMORIES_CHANGED_EVENT,
};

use memory::{delete_memory, list_memories, load_memory, save_memory, search_memories};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_opener::init())
    .setup(|app| {
      mcp::spawn_mcp_stdio_server(app.handle().clone());
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      list_memories,
      load_memory,
      save_memory,
      delete_memory,
      search_memories
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
