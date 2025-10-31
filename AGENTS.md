# Repository Guidelines

## Project Structure & Module Organization
- `src/` houses the Next.js front end. Key folders: `app/` (routing, layout, fonts), `components/` (Lexical editor, memory workspace, UI utilities), and `styles/` (global Tailwind layer).
- `src-tauri/` contains the Rust backend: `src/memory.rs` manages file-based persistence in `memories/`. `tauri.conf.json` governs bundling.
- `public/` stores static assets (icons, favicons). Build artifacts land in `dist/` for the desktop bundle.

## Build, Test, and Development Commands
- `npm run dev` — launches Next.js with Turbopack for rapid iteration; pairs well with `npm run tauri:dev` when testing the desktop shell.
- `npm run build` — generates optimized web output; prerequisite for desktop packaging.
- `npm run start` — serves the prebuilt web bundle.
- `npm run lint` — runs Biome against `src/`; fails on formatting or lint issues.
- `npm run tauri:dev` — compiles the Rust backend and opens the Tauri window with live reload.

## Coding Style & Naming Conventions
- TypeScript/React: prefer functional components, hooks, and named exports. CamelCase for components, camelCase for functions/variables.
- Rust: follow `cargo fmt` defaults (4-space indent, snake_case functions).
- Formatting: lint via `npm run lint`; keep imports sorted and strings double-quoted to match Biome output.
- UI: leverage Tailwind utility classes; shared styles belong in `src/styles/globals.css`.

## Testing Guidelines
- No automated test suite exists yet. When adding tests, colocate them beside the code (`*.test.tsx` / `*.test.rs`) and document any new commands.
- Manually exercise both `npm run dev` and `npm run tauri:dev` when touching editor or persistence logic.

## Commit & Pull Request Guidelines
- Use present-tense, descriptive commit subjects (e.g., `Add memory markdown transformers`).
- Reference related issues in commit bodies or PR descriptions.
- PRs should include: summary of changes, testing notes (commands run), screenshots/GIFs for UI tweaks, and mention of backward compatibility or migrations.

## Security & Configuration Tips
- Secrets-free: configuration lives in `tauri.conf.json` and environment variables injected at build time; never commit real tokens.
- Tauri writes memories to the OS app data directory (`memories/`). Verify permissions when testing on new platforms.
