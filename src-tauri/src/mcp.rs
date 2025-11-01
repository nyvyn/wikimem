use std::{net::SocketAddr, sync::Arc, thread};

use anyhow::{anyhow, Context, Result};
use axum::Router;
use rmcp::schemars;
use rmcp::{
  handler::server::router::tool::ToolRouter,
  handler::server::wrapper::Parameters,
  handler::server::ServerHandler,
  model::{
    CallToolResult, LoggingLevel, LoggingMessageNotificationParam, ServerCapabilities, ServerInfo,
  },
  service::{RequestContext, RoleServer},
  tool, tool_handler, tool_router,
  transport::streamable_http_server::{
    session::local::LocalSessionManager,
    tower::{StreamableHttpServerConfig, StreamableHttpService},
  },
  ErrorData as McpError,
};
use schemars::JsonSchema;
use serde::Deserialize;
use serde_json::json;
use tauri::{AppHandle, Emitter};
use tokio::net::TcpListener;

use crate::{
  MemoryChangedPayload, MemoryDetail, MemorySearchResult, MemoryStore, MemorySummary,
  SaveMemoryPayload, MEMORIES_CHANGED_EVENT,
};

const MCP_HTTP_ADDR: &str = "127.0.0.1:3926";

#[derive(Clone)]
struct WikimemServer {
  store: Arc<MemoryStore>,
  app_handle: AppHandle,
  tool_router: ToolRouter<Self>,
}

impl WikimemServer {
  fn new(store: Arc<MemoryStore>, app_handle: AppHandle) -> Self {
    Self {
      store,
      app_handle,
      tool_router: Self::tool_router(),
    }
  }

  fn map_store_error(message: String) -> McpError {
    McpError::internal_error(message, None)
  }

  fn emit_change(&self, payload: MemoryChangedPayload) {
    if let Err(err) = self.app_handle.emit(MEMORIES_CHANGED_EVENT, payload) {
      eprintln!("Failed to emit memory change event: {err}");
    }
  }
}

#[tool_router]
impl WikimemServer {
  #[tool(description = "Return summaries of all stored memories ordered by recency.")]
  fn list_memories(&self) -> Result<CallToolResult, McpError> {
    let summaries: Vec<MemorySummary> = self.store.list().map_err(Self::map_store_error)?;
    Ok(CallToolResult::structured(json!({ "memories": summaries })))
  }

  #[tool(description = "Load a memory by id, returning the full markdown body.")]
  fn load_memory(
    &self,
    Parameters(args): Parameters<LoadMemoryArgs>,
  ) -> Result<CallToolResult, McpError> {
    let detail: MemoryDetail = self.store.load(&args.id).map_err(Self::map_store_error)?;
    Ok(CallToolResult::structured(json!(detail)))
  }

  #[tool(
    description = "Create or update a memory using the provided title and markdown body. Use wiki links like [[memory_id]] to reference other memories."
  )]
  async fn save_memory(
    &self,
    Parameters(args): Parameters<SaveMemoryArgs>,
  ) -> Result<CallToolResult, McpError> {
    let detail = self
      .store
      .save(SaveMemoryPayload {
        id: args.id.clone(),
        title: args.title,
        body: args.body,
      })
      .map_err(Self::map_store_error)?;

    self.emit_change(MemoryChangedPayload::saved(detail.id.clone()));

    Ok(CallToolResult::structured(json!(detail)))
  }

  #[tool(description = "Delete a memory by id.")]
  async fn delete_memory(
    &self,
    Parameters(args): Parameters<DeleteMemoryArgs>,
  ) -> Result<CallToolResult, McpError> {
    self.store.delete(&args.id).map_err(Self::map_store_error)?;

    self.emit_change(MemoryChangedPayload::deleted(args.id.clone()));

    Ok(CallToolResult::structured(json!({
      "status": "deleted",
      "id": args.id,
    })))
  }

  #[tool(description = "Search memories by keyword across titles and body content.")]
  fn search_memories(
    &self,
    Parameters(args): Parameters<SearchMemoriesArgs>,
  ) -> Result<CallToolResult, McpError> {
    let results: Vec<MemorySearchResult> = self
      .store
      .search(&args.query)
      .map_err(Self::map_store_error)?;
    Ok(CallToolResult::structured(json!({ "results": results })))
  }
}

#[tool_handler]
impl ServerHandler for WikimemServer {
  fn get_info(&self) -> ServerInfo {
    ServerInfo {
      instructions: Some(
        "Wikimem exposes memory CRUD tools (`list_memories`, `load_memory`, `save_memory`, `delete_memory`, `search_memories`) and responds to the MCP `ping` method. Use `save_memory` to write Markdown: linking to another memory can be done with wiki-style syntax like [[memory_id]].".into(),
      ),
      capabilities: ServerCapabilities::builder().enable_tools().build(),
      ..Default::default()
    }
  }

  fn ping(
    &self,
    context: RequestContext<RoleServer>,
  ) -> impl std::future::Future<Output = Result<(), McpError>> + Send + '_ {
    async move {
      if let Err(err) = context
        .peer
        .notify_logging_message(LoggingMessageNotificationParam {
          level: LoggingLevel::Info,
          logger: Some("wikimem".into()),
          data: json!({ "message": "pong" }),
        })
        .await
      {
        eprintln!("Failed to send MCP log notification: {err}");
      }
      Ok(())
    }
  }
}

#[derive(Deserialize, JsonSchema)]
struct LoadMemoryArgs {
  id: String,
}

#[derive(Deserialize, JsonSchema)]
struct SaveMemoryArgs {
  id: Option<String>,
  title: String,
  body: String,
}

#[derive(Deserialize, JsonSchema)]
struct DeleteMemoryArgs {
  id: String,
}

#[derive(Deserialize, JsonSchema)]
struct SearchMemoriesArgs {
  query: String,
}

pub(crate) fn spawn_mcp_http_server(app_handle: AppHandle) {
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

      if let Err(err) = runtime.block_on(run_mcp_http_server(app_handle)) {
        eprintln!("MCP HTTP server exited with error: {err:?}");
      }
    });
}

async fn run_mcp_http_server(app_handle: AppHandle) -> Result<()> {
  let addr: SocketAddr = MCP_HTTP_ADDR
    .parse()
    .context("Invalid MCP HTTP bind address")?;

  let store = Arc::new(
    MemoryStore::from_config(app_handle.config())
      .map_err(|err| anyhow!("Failed to initialise memory store: {err}"))?,
  );

  let server = WikimemServer::new(store, app_handle.clone());

  let service: StreamableHttpService<WikimemServer, LocalSessionManager> =
    StreamableHttpService::new(
      move || Ok(server.clone()),
      LocalSessionManager::default().into(),
      StreamableHttpServerConfig::default(),
    );

  let router = Router::new().nest_service("/mcp", service);

  let listener = TcpListener::bind(addr)
    .await
    .with_context(|| format!("Failed to bind MCP HTTP server to {addr}"))?;

  println!("MCP HTTP server listening on http://{addr}/mcp using rmcp streamable HTTP transport");

  axum::serve(listener, router)
    .await
    .context("MCP HTTP server stopped unexpectedly")?;

  Ok(())
}
