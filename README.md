# Wikimem – SlipStack Notebook For Memories

Wikimem is a Tauri-powered desktop app that curates an AI-managed notebook of
memories. Every memory lives as an individual Markdown file and can be created,
edited, or deleted through both the SlipStack React UI and an MCP (Model Context
Protocol) server.

The goal is to give AI agents a durable, wiki-style surface for storing
context—while keeping a fast, tactile editing experience for humans.

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
                                       │  • future: mcp_* handlers      │
                                       └──────────┬────────────────────┘
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

### Directory Layout

- `src-tauri/` – Rust backend, Tauri commands, soon the MCP server.
- `src/` – Next.js App Router frontend, SlipStack demo, editor surfaces.
- `app_data_dir/memories/` – created automatically at runtime; holds Markdown
  files that describe each memory.

## Roadmap

- [x] Integrate SlipStack React UI scaffold.
- [x] Add Tauri command layer for memory CRUD operations.
- [ ] Build Lexical-powered Markdown editor surface tied to those commands.
- [ ] Expose MCP server endpoints backed by the same storage layer.
- [ ] Synchronize AI agent actions with SlipStack navigation state.

Contributions and experiments are welcome—this project is evolving rapidly as
the notebook workflow takes shape.
