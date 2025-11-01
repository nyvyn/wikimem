"use client";

import dynamic from "next/dynamic";
import { useCallback, useState } from "react";

import type { MemoryWorkspaceProps } from "@/components/editor/memory-workspace";
import { McpInstructionsDialog } from "@/components/navigation/mcp-instructions-dialog";
import { MemoryResultsView } from "@/components/navigation/memory-results-view";
import { useMemoryResults } from "@/hooks/use-memory-results";
import type { MemorySummary } from "@/lib/types";

const MemoryWorkspace = dynamic<MemoryWorkspaceProps>(
  async () =>
    import("@/components/editor/memory-workspace").then(
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
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [activeMemory, setActiveMemory] = useState<
    MemorySummary | null | undefined
  >(undefined);
  const [refreshSignal, setRefreshSignal] = useState(0);
  const [mcpHelpOpen, setMcpHelpOpen] = useState(false);

  const resultsController = useMemoryResults({ refreshSignal });

  const openWorkspaceWith = useCallback((memory: MemorySummary | null) => {
    setActiveMemory(memory);
    setWorkspaceOpen(true);
  }, []);

  const closeWorkspace = useCallback(() => {
    setWorkspaceOpen(false);
    setActiveMemory(undefined);
  }, []);

  const handleMemoriesChanged = useCallback(() => {
    setRefreshSignal((value) => value + 1);
  }, []);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-slate-950 text-slate-100">
      <main className="mx-auto flex h-full w-full max-w-6xl flex-1 flex-col gap-8 overflow-hidden px-6 py-8 sm:py-12">
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

        <section className="flex flex-1 flex-col gap-4 overflow-hidden">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
              <h2 className="text-lg font-semibold text-white">
                {resultsController.inSearchMode
                  ? "Search results"
                  : "Recent memories"}
              </h2>
              <div className="relative w-full sm:w-72">
                <input
                  value={resultsController.searchQuery}
                  onChange={(event) =>
                    resultsController.setSearchQuery(event.target.value)
                  }
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
                triggerClassName="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-100 transition hover:border-white/30 hover:bg-white/10 whitespace-nowrap"
              />
            </div>
          </div>
          <MemoryResultsView
            controller={resultsController}
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
