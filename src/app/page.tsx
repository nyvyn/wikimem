"use client";

import { invoke } from "@tauri-apps/api/core";
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
      <footer className="px-6 pb-8 text-xs text-slate-500 sm:px-12">
        Designed by Ron Lancaster
      </footer>

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
