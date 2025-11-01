"use client";

import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { McpInstructionsDialog } from "@/components/memory/mcp-instructions-dialog";
import { MemoryResultsView } from "@/components/memory/memory-results-view";
import type { MemoryWorkspaceProps } from "@/components/memory/memory-workspace";
import { searchMemories } from "@/lib/tauri-commands";
import type { MemorySearchResult, MemorySummary } from "@/lib/types";

interface MemorySummaryDto {
  id: string;
  title: string;
  updated_at: number;
}

const MemoryWorkspace = dynamic<MemoryWorkspaceProps>(
  async () =>
    import("@/components/memory/memory-workspace").then(
      (mod) => mod.MemoryWorkspace,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center rounded-3xl border border-white/10 bg-slate-900 text-slate-400">
        Initializing workspace…
      </div>
    ),
  },
);

export default function Home() {
  const [recentMemories, setRecentMemories] = useState<MemorySummary[]>([]);
  const [memoriesLoading, setMemoriesLoading] = useState(true);
  const [memoriesError, setMemoriesError] = useState<string | null>(null);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [activeMemory, setActiveMemory] = useState<
    MemorySummary | null | undefined
  >(undefined);
  const [mcpHelpOpen, setMcpHelpOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MemorySearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const activeSearchRef = useRef<string | null>(null);

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
    const handle = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 250);
    return () => {
      clearTimeout(handle);
    };
  }, [searchQuery]);

  const runSearch = useCallback((rawQuery: string) => {
    const trimmed = rawQuery.trim();
    if (trimmed.length === 0) {
      activeSearchRef.current = null;
      setSearchResults([]);
      setSearchError(null);
      setSearchLoading(false);
      return;
    }

    activeSearchRef.current = trimmed;
    setSearchLoading(true);
    searchMemories(trimmed)
      .then((results) => {
        if (activeSearchRef.current !== trimmed) {
          return;
        }
        setSearchResults(results);
        setSearchError(null);
      })
      .catch((error) => {
        if (activeSearchRef.current !== trimmed) {
          return;
        }
        setSearchError(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        if (activeSearchRef.current === trimmed) {
          setSearchLoading(false);
        }
      });
  }, []);

  useEffect(() => {
    runSearch(debouncedQuery);
  }, [debouncedQuery, runSearch]);

  useEffect(() => {
    let unlisten: UnlistenFn | null = null;

    listen("wikimem://memories-changed", () => {
      fetchMemories().catch(() => {});
      if (activeSearchRef.current) {
        runSearch(activeSearchRef.current);
      }
    })
      .then((fn) => {
        unlisten = fn;
      })
      .catch(() => {});

    return () => {
      unlisten?.();
    };
  }, [fetchMemories, runSearch]);

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
    setActiveMemory(undefined);
  }, []);

  const handleMemoriesChanged = useCallback(() => {
    fetchMemories().catch(() => {});
  }, [fetchMemories]);

  const inSearchMode = debouncedQuery.trim().length > 0;

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
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
              <h2 className="text-lg font-semibold text-white">
                {inSearchMode ? "Search results" : "Recent memories"}
              </h2>
              <div className="relative w-full sm:w-72">
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search memories…"
                  className="w-full rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-white/40 focus:outline-none focus:ring-0"
                  aria-label="Search memories"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 sm:flex-nowrap sm:gap-3">
              <button
                type="button"
                onClick={() => openWorkspaceWith(null)}
                className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:border-white/40 hover:bg-white/20 whitespace-nowrap"
              >
                New memory
              </button>
              <McpInstructionsDialog
                open={mcpHelpOpen}
                onOpenChange={setMcpHelpOpen}
                triggerClassName="rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-white/30 hover:bg-white/10 whitespace-nowrap"
              />
            </div>
          </div>
          <MemoryResultsView
            inSearchMode={inSearchMode}
            searchLoading={searchLoading}
            searchError={searchError}
            searchResults={searchResults}
            debouncedQuery={debouncedQuery}
            memoriesLoading={memoriesLoading}
            memoriesError={memoriesError}
            sortedMemories={sortedMemories}
            onOpenMemory={(memory) => openWorkspaceWith(memory)}
          />
        </section>
      </main>
      <footer className="px-6 pb-8 text-right text-xs text-slate-500 sm:px-12">
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
              initialMemory={
                activeMemory === undefined ? undefined : activeMemory
              }
              onMemoriesChanged={handleMemoriesChanged}
              variant="full"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
