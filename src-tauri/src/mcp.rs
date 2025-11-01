use std::{sync::Arc, thread};

use anyhow::{anyhow, Context, Result};
use modelcontextprotocol_server::{
  mcp_protocol::types::tool::{ToolCallResult, ToolContent},
  transport::StdioTransport,
  Server, ServerBuilder,
};
use serde::Deserialize;
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter};

use crate::{MemoryChangedPayload, MemoryStore, SaveMemoryPayload, MEMORIES_CHANGED_EVENT};

const SERVER_NAME: &str = "wikimem";

#[derive(Deserialize)]
struct CreateMemoryArgs {
  title: String,
  body: String,
}

#[derive(Deserialize)]
struct UpdateMemoryArgs {
  id: String,
  title: Option<String>,
  body: Option<String>,
}

#[derive(Deserialize)]
struct DeleteMemoryArgs {
  id: String,
}

#[derive(Deserialize)]
struct SearchMemoriesArgs {
  query: String,
}

pub(crate) fn spawn_mcp_stdio_server(app_handle: AppHandle) {
  let handle = app_handle.clone();

  #[allow(let_underscore_drop)]
  let _ = thread::Builder::new()
    .name("wikimem-mcp".into())
    .spawn(move || {
      let runtime = match tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
      {
        Ok(runtime) => runtime,
        Err(err) => {
          eprintln!("Failed to create Tokio runtime for MCP server: {err}");
          return;
        }
      };

      if let Err(err) = runtime.block_on(run_mcp_stdio_server(handle.clone())) {
        eprintln!("MCP stdio server exited with error: {err:?}");
      }
    });
}

async fn run_mcp_stdio_server(app_handle: AppHandle) -> Result<()> {
  build_mcp_stdio_server(&app_handle)?.run().await
}

fn build_mcp_stdio_server(app_handle: &AppHandle) -> Result<Server> {
  let store = Arc::new(
    MemoryStore::from_config(app_handle.config())
      .map_err(|err| anyhow!("Failed to initialise memory store: {err}"))?,
  );

  let app_handle = Arc::new(app_handle.clone());

  let mut builder = ServerBuilder::new(SERVER_NAME, env!("CARGO_PKG_VERSION"))
    .with_transport(StdioTransport::new());

  builder = register_list_tool(builder, &store);
  builder = register_create_tool(builder, &store, &app_handle);
  builder = register_update_tool(builder, &store, &app_handle);
  builder = register_delete_tool(builder, &store, &app_handle);
  builder = register_search_tool(builder, &store);

  builder.build()
}

fn register_list_tool(builder: ServerBuilder, store: &Arc<MemoryStore>) -> ServerBuilder {
  let store = Arc::clone(store);
  builder.with_tool(
    "list_memories",
    Some("Return the summaries of all stored memories ordered by recency."),
    json!({
      "type": "object",
      "properties": {},
      "additionalProperties": false
    }),
    move |_args: Value| {
      let summaries = store
        .list()
        .map_err(|err| anyhow!("Failed to list memories: {err}"))?;
      let as_json =
        serde_json::to_string(&summaries).context("Failed to serialise memory summaries")?;
      Ok(ToolCallResult {
        content: vec![ToolContent::Text { text: as_json }],
        is_error: None,
      })
    },
  )
}

fn register_create_tool(
  builder: ServerBuilder,
  store: &Arc<MemoryStore>,
  app_handle: &Arc<AppHandle>,
) -> ServerBuilder {
  let store = Arc::clone(store);
  let app_handle = Arc::clone(app_handle);
  builder.with_tool(
    "create_memory",
    Some("Create a new memory using the provided title and markdown body."),
    json!({
      "type": "object",
      "properties": {
        "title": {
          "type": "string",
          "description": "Title for the memory."
        },
        "body": {
          "type": "string",
          "description": "Markdown content for the memory."
        }
      },
      "required": ["title", "body"],
      "additionalProperties": false
    }),
    move |args: Value| {
      let params: CreateMemoryArgs =
        serde_json::from_value(args).context("Invalid arguments for create_memory")?;
      let detail = store
        .save(SaveMemoryPayload {
          id: None,
          title: params.title,
          body: params.body,
        })
        .map_err(|err| anyhow!("Failed to create memory: {err}"))?;
      let as_json = serde_json::to_string(&detail).context("Failed to serialise created memory")?;
      let _ = app_handle.emit(
        MEMORIES_CHANGED_EVENT,
        MemoryChangedPayload::saved(detail.id.clone()),
      );
      Ok(ToolCallResult {
        content: vec![ToolContent::Text { text: as_json }],
        is_error: None,
      })
    },
  )
}

fn register_update_tool(
  builder: ServerBuilder,
  store: &Arc<MemoryStore>,
  app_handle: &Arc<AppHandle>,
) -> ServerBuilder {
  let store = Arc::clone(store);
  let app_handle = Arc::clone(app_handle);
  builder.with_tool(
    "update_memory",
    Some("Update an existing memory by id, optionally changing the title and/or body."),
    json!({
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "description": "Identifier of the memory to update."
        },
        "title": {
          "type": "string",
          "description": "New title for the memory. Omit to keep the existing title."
        },
        "body": {
          "type": "string",
          "description": "New markdown body. Omit to keep the existing content."
        }
      },
      "required": ["id"],
      "additionalProperties": false
    }),
    move |args: Value| {
      let params: UpdateMemoryArgs =
        serde_json::from_value(args).context("Invalid arguments for update_memory")?;
      let existing = store
        .load(&params.id)
        .map_err(|err| anyhow!("Failed to load memory: {err}"))?;
      let replacement_title = params.title.unwrap_or(existing.title);
      let replacement_body = params.body.unwrap_or(existing.body);
      let detail = store
        .save(SaveMemoryPayload {
          id: Some(params.id),
          title: replacement_title,
          body: replacement_body,
        })
        .map_err(|err| anyhow!("Failed to update memory: {err}"))?;
      let as_json = serde_json::to_string(&detail).context("Failed to serialise updated memory")?;
      let _ = app_handle.emit(
        MEMORIES_CHANGED_EVENT,
        MemoryChangedPayload::saved(detail.id.clone()),
      );
      Ok(ToolCallResult {
        content: vec![ToolContent::Text { text: as_json }],
        is_error: None,
      })
    },
  )
}

fn register_delete_tool(
  builder: ServerBuilder,
  store: &Arc<MemoryStore>,
  app_handle: &Arc<AppHandle>,
) -> ServerBuilder {
  let store = Arc::clone(store);
  let app_handle = Arc::clone(app_handle);
  builder.with_tool(
    "delete_memory",
    Some("Delete a memory by id."),
    json!({
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "description": "Identifier of the memory to delete."
        }
      },
      "required": ["id"],
      "additionalProperties": false
    }),
    move |args: Value| {
      let params: DeleteMemoryArgs =
        serde_json::from_value(args).context("Invalid arguments for delete_memory")?;
      store
        .delete(&params.id)
        .map_err(|err| anyhow!("Failed to delete memory: {err}"))?;
      let _ = app_handle.emit(
        MEMORIES_CHANGED_EVENT,
        MemoryChangedPayload::deleted(params.id.clone()),
      );
      Ok(ToolCallResult {
        content: vec![ToolContent::Text {
          text: format!("Deleted memory {}", params.id),
        }],
        is_error: None,
      })
    },
  )
}

fn register_search_tool(builder: ServerBuilder, store: &Arc<MemoryStore>) -> ServerBuilder {
  let store = Arc::clone(store);
  builder.with_tool(
    "search_memories",
    Some("Search memories by keyword across titles and body content."),
    json!({
      "type": "object",
      "properties": {
        "query": {
          "type": "string",
          "description": "Search text to match against titles and content."
        }
      },
      "required": ["query"],
      "additionalProperties": false
    }),
    move |args: Value| {
      let params: SearchMemoriesArgs =
        serde_json::from_value(args).context("Invalid arguments for search_memories")?;
      let results = store
        .search(&params.query)
        .map_err(|err| anyhow!("Failed to search memories: {err}"))?;
      let as_json =
        serde_json::to_string(&results).context("Failed to serialise search results")?;
      Ok(ToolCallResult {
        content: vec![ToolContent::Text { text: as_json }],
        is_error: None,
      })
    },
  )
}
