mod memory;

use memory::{delete_memory, list_memories, load_memory, save_memory};

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
