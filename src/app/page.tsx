"use client";

import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { MemorySummary } from "@/components/memory-types";
import type { MemoryWorkspaceProps } from "@/components/memory-workspace";

interface MemorySummaryDto {
  id: string;
  title: string;
  updated_at: number;
}

const MemoryWorkspace = dynamic<MemoryWorkspaceProps>(
  async () =>
    import("@/components/memory-workspace").then((mod) => mod.MemoryWorkspace),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center rounded-3xl border border-white/10 bg-slate-900 text-slate-400">
        Initializing workspace…
      </div>
    ),
  },
);

function formatTimestamp(seconds: number): string {
  return new Date(seconds * 1000).toLocaleString();
}

export default function Home() {
  const [recentMemories, setRecentMemories] = useState<MemorySummary[]>([]);
  const [memoriesLoading, setMemoriesLoading] = useState(true);
  const [memoriesError, setMemoriesError] = useState<string | null>(null);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [activeMemory, setActiveMemory] = useState<MemorySummary | null>(null);
  const [mcpHelpOpen, setMcpHelpOpen] = useState(false);

  const fetchMemories = useCallback(async () => {
    setMemoriesLoading(true);
    try {
      const data = await invoke<MemorySummaryDto[]>("list_memories");
      setRecentMemories(
        data.map((dto) => ({
          id: dto.id,
          title: dto.title,
          updatedAt: dto.updated_at,
        })),
      );
      setMemoriesError(null);
    } catch (error) {
      setMemoriesError(error instanceof Error ? error.message : String(error));
    } finally {
      setMemoriesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMemories().catch(() => {});
  }, [fetchMemories]);

  useEffect(() => {
    let unlisten: UnlistenFn | null = null;

    listen("wikimem://memories-changed", () => {
      fetchMemories().catch(() => {});
    })
      .then((fn) => {
        unlisten = fn;
      })
      .catch(() => {});

    return () => {
      unlisten?.();
    };
  }, [fetchMemories]);

  const sortedMemories = useMemo(
    () => [...recentMemories].sort((a, b) => b.updatedAt - a.updatedAt),
    [recentMemories],
  );

  const openWorkspaceWith = useCallback((memory: MemorySummary | null) => {
    setActiveMemory(memory);
    setWorkspaceOpen(true);
  }, []);

  const closeWorkspace = useCallback(() => {
    setWorkspaceOpen(false);
    setActiveMemory(null);
  }, []);

  const handleMemoriesChanged = useCallback(() => {
    fetchMemories().catch(() => {});
  }, [fetchMemories]);

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-6 py-12">
        <section className="max-w-2xl space-y-3">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            wikimem
          </span>
          <h1 className="text-4xl font-semibold text-white sm:text-5xl">
            Wiki memory for AI and you
          </h1>
          <p className="text-base text-slate-300">
            Provides an MCP interface for LLMs to search and store memories.
            Memories are stored as markdown, which can be viewed and edited.
          </p>
        </section>

        <section className="flex flex-col gap-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-white">
              Recent memories
            </h2>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => openWorkspaceWith(null)}
                className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:border-white/40 hover:bg-white/20"
              >
                New memory
              </button>
              <button
                type="button"
                onClick={() => fetchMemories().catch(() => {})}
                className="rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-white/30 hover:bg-white/10"
                disabled={memoriesLoading}
              >
                Refresh
              </button>
              <button
                type="button"
                onClick={() => setMcpHelpOpen(true)}
                className="rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-white/30 hover:bg-white/10"
              >
                MCP instructions
              </button>
            </div>
          </div>
          {memoriesLoading ? (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-slate-400">
              Loading memories…
            </div>
          ) : memoriesError ? (
            <div className="rounded-3xl border border-rose-400/40 bg-rose-500/10 p-6 text-sm text-rose-200">
              {memoriesError}
            </div>
          ) : sortedMemories.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 p-6 text-sm text-slate-400">
              No memories yet. Capture a new one to start your wiki.
            </div>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {sortedMemories.map((memory) => (
                <li key={memory.id}>
                  <button
                    type="button"
                    onClick={() => openWorkspaceWith(memory)}
                    className="group flex w-full flex-col gap-2 rounded-3xl border border-white/10 bg-white/5 p-4 text-left transition hover:border-white/30 hover:bg-white/10"
                  >
                    <span className="text-base font-medium text-white group-hover:text-slate-100">
                      {memory.title}
                    </span>
                    <span className="text-xs text-slate-400">
                      Updated {formatTimestamp(memory.updatedAt)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
      <footer className="px-6 pb-8 text-right text-xs text-slate-500 sm:px-12">
        Designed by Ron Lancaster
      </footer>

      {mcpHelpOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/80 px-4 py-6">
          <div className="max-w-xl rounded-3xl border border-white/10 bg-slate-900/95 p-6 text-left shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-4">
              <h3 className="text-lg font-semibold text-white">
                Connect to Wikimem via MCP
              </h3>
              <button
                type="button"
                onClick={() => setMcpHelpOpen(false)}
                className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-slate-200 transition hover:border-white/30 hover:bg-white/10"
              >
                Close
              </button>
            </div>
            <p className="mb-4 text-sm text-slate-300">
              Wikimem exposes a Model Context Protocol (MCP) server over STDIO.
              Launching the desktop app from a terminal makes the stream
              available so MCP-aware tools can connect.
            </p>
            <ol className="mb-4 list-decimal space-y-2 pl-5 text-sm text-slate-200">
              <li>
                Build or run the app once so the binary is available:
                <code className="ml-2 rounded bg-slate-800 px-2 py-1 text-xs">
                  npm run tauri dev
                </code>
              </li>
              <li>
                In another terminal, start an MCP client pointing at the binary.
                For example, using the MCP CLI from this project root:
                <pre className="mt-2 rounded-2xl border border-white/10 bg-slate-950/80 p-3 text-xs text-slate-100">
{`npx @modelcontextprotocol/cli@latest connect stdio \\
  --command "./src-tauri/target/debug/wikimem"`}
                </pre>
                Adjust the path for release builds or your OS (e.g.{" "}
                <code className="rounded bg-slate-800 px-2 py-1 text-xs">
                  wikimem.app/Contents/MacOS/wikimem
                </code>{" "}
                on macOS).
              </li>
              <li>
                The client now has access to the <code>list_memories</code>,{" "}
                <code>create_memory</code>, <code>update_memory</code>, and{" "}
                <code>delete_memory</code> tools. Changes sync with the UI
                instantly.
              </li>
            </ol>
            <p className="text-xs text-slate-400">
              Tip: leave the terminal session open while agents are connected so
              STDIO stays attached.
            </p>
          </div>
        </div>
      ) : null}

      {workspaceOpen ? (
        <div className="fixed inset-0 z-50 bg-slate-950">
          <button
            type="button"
            onClick={closeWorkspace}
            className="absolute right-4 top-4 z-10 rounded-full border border-slate-400 bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-white"
          >
            Home
          </button>
          <div className="h-full w-full">
            <MemoryWorkspace
              key={activeMemory?.id ?? "new"}
              initialMemory={activeMemory ?? undefined}
              onMemoriesChanged={handleMemoriesChanged}
              variant="full"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
