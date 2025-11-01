# Wikimem

Wikimem is a Tauri-powered desktop app that offers memory for AI (e.g. Claude, Codex, etc.).

It exposes an MCP server for AI agents to read and write memories as Markdown,
which can then be viewed and edited in a wiki-style interface.

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

The desktop app also exposes an MCP server over stdio in the same process, so
any MCP-compatible agent can connect without launching a separate binary.

### Connect an LLM via MCP

If you're already running the Wikimem desktop app, point your LLM's MCP config
at the installed binary using stdio transport. For example, `claude_desktop_config.json`
might include:

```json
{
  "mcpServers": {
    "wikimem": {
      "transport": {
        "type": "stdio",
        "command": "/Applications/Wikimem.app/Contents/MacOS/Wikimem"
      }
    }
  }
}
```

Adjust the `command` path for your platform—e.g. `./src-tauri/target/debug/wikimem`
while developing, or `C:\\Users\\<you>\\AppData\\Local\\Programs\\Wikimem\\wikimem.exe`
on Windows. When the LLM launches, it will spawn Wikimem with MCP enabled and
stream the stdio connection to the app.

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
