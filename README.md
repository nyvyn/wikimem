# WikiMem

WikiMem is a desktop app that offers memory management for AI (e.g. Claude, Codex, etc.).

It exposes an MCP server for AI agents to read and write memories as Markdown,
which can then be viewed and edited in a wiki-style interface.

[![Video Title](https://img.youtube.com/vi/vlDHxGOe3to/0.jpg)](https://www.youtube.com/watch?v=vlDHxGOe3to)

## Vision

- **AI-accessible archive** – expose a full MCP server so copilots can add,
  mutate, or delete memories on demand.
- **Markdown on disk** – each memory persists as a Markdown document inside the
  OS-specific `app_data_dir` managed by Tauri.
- **SlipStack navigation** – explore threads of related memories using
  sliding/stacking panes, inspired by Andy Matuschak’s notes UI.
- **Lexical editor** – edit Markdown content with a modern block-based
  experience that syncs changes back to disk.

## Architecture Outline

```
┌─────────────┐       invokes        ┌────────────────────────────────┐
│ Next.js UI  │ ───────────────────▶ │ Tauri Commands (Rust backend)  │
│  SlipStack  │                      │  • list_memories               │
│  Lexical    │                      │  • load_memory                 │
│             │ ◀─────────────────── │  • save_memory                 │
└─────────────┘  emits updates       │  • delete_memory               │
                                     │  • search_memories             │
                                     │  • future: mcp_* handlers      │
                                     └─────────────┬──────────────────┘
                                                   │
                                       writes/reads│Markdown
                                                   ▼
                                    `app_data_dir/memories/*.md`
```

### Key pieces

- **Frontend**: Next.js (App Router) + SlipStack React panes. A Lexical editor
  renders the active memory and saves edits back to Markdown.
- **Backend**: Tauri commands operate on a lazily-created `memories`
  directory under `app_data_dir`. Commands are designed so the future MCP server
  can reuse the same file access layer.
- **Storage Format**: Markdown documents with optional YAML frontmatter for
  metadata. The first heading becomes the default display title.

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Run inside a Tauri window:
   ```bash
   npm run tauri dev
   ```
3. Add memories by using the **New Memory** action in the UI (coming online as
   part of the incremental build-out).

The desktop app also exposes an MCP server over HTTP in the same process, so
any MCP-compatible agent can connect without launching a separate binary.

### Connect an LLM via MCP

If you're already running the WikiMem desktop app, point your LLM's MCP config
at the local HTTP endpoint:

```json
{
  "mcpServers": {
    "wikimem": {
      "transport": {
        "type": "http",
        "url": "http://127.0.0.1:3926/mcp"
      }
    }
  }
}
```

Ensure the desktop app is running so the `/mcp` endpoint responds on
`http://127.0.0.1:3926`. If you're connecting from another device, replace the
host with the machine's LAN address. When the LLM launches, it will stream MCP
messages over the same HTTP connection.

Available MCP tools include:

- `list_memories`
- `load_memory`
- `save_memory`
- `delete_memory`
- `search_memories`

The protocol-level `ping` method is also supported. It emits a `pong` logging
notification so you can quickly verify connectivity.

### Directory Layout

- `src-tauri/` – Rust backend, Tauri commands, soon the MCP server.
- `src/` – Next.js App Router frontend, SlipStack demo, editor surfaces.
- `app_data_dir/memories/` – created automatically at runtime; holds Markdown
  files that describe each memory.

## Roadmap

- [x] Integrate SlipStack React UI scaffold.
- [x] Add Tauri command layer for memory CRUD operations.
- [x] Expose MCP server endpoints backed by the same storage layer.
- [x] Synchronize AI agent actions with SlipStack navigation state.
- [x] Build Lexical-powered Markdown editor surface tied to those commands.

Contributions and experiments are welcome—this project is evolving rapidly as
the notebook workflow takes shape.
