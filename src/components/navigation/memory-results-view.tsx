"use client";

import type { JSX } from "react";
import type { MemoryResultsController } from "@/hooks/use-memory-results";
import type { MemorySummary } from "@/lib/types";
import { formatTimestamp } from "@/lib/utils";

interface MemoryResultsViewProps {
  controller: MemoryResultsController;
  onOpenMemory: (memory: MemorySummary) => void;
}

export function MemoryResultsView({
  controller,
  onOpenMemory,
}: MemoryResultsViewProps): JSX.Element {
  const {
    inSearchMode,
    searchLoading,
    searchError,
    searchResults,
    debouncedQuery,
    memoriesLoading,
    memoriesError,
    sortedMemories,
  } = controller;

  let content: JSX.Element;
  if (inSearchMode) {
    if (searchLoading) {
      content = (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-slate-400">
          Searching memories…
        </div>
      );
    } else if (searchError) {
      content = (
        <div className="rounded-3xl border border-rose-400/40 bg-rose-500/10 p-6 text-sm text-rose-200">
          {searchError}
        </div>
      );
    } else if (searchResults.length === 0) {
      content = (
        <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 p-6 text-sm text-slate-400">
          No matches found for &ldquo;{debouncedQuery.trim()}&rdquo;.
        </div>
      );
    } else {
      content = (
        <ul className="grid gap-3 sm:grid-cols-2">
          {searchResults.map((memory) => (
            <li key={memory.id}>
              <button
                type="button"
                onClick={() =>
                  onOpenMemory({
                    id: memory.id,
                    title: memory.title,
                    updatedAt: memory.updatedAt,
                  })
                }
                className="group flex w-full flex-col gap-2 rounded-3xl border border-white/10 bg-white/5 p-4 text-left transition hover:border-white/30 hover:bg-white/10"
              >
                <span className="text-base font-medium text-white group-hover:text-slate-100">
                  {memory.title}
                </span>
                <p className="text-xs text-slate-400">{memory.snippet}</p>
                <span className="text-xs text-slate-500">
                  Updated {formatTimestamp(memory.updatedAt)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      );
    }
  } else if (memoriesLoading) {
    content = (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-slate-400">
        Loading memories…
      </div>
    );
  } else if (memoriesError) {
    content = (
      <div className="rounded-3xl border border-rose-400/40 bg-rose-500/10 p-6 text-sm text-rose-200">
        {memoriesError}
      </div>
    );
  } else if (sortedMemories.length === 0) {
    content = (
      <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 p-6 text-sm text-slate-400">
        No memories yet. Capture a new one to start your wiki.
      </div>
    );
  } else {
    content = (
      <ul className="grid gap-3 sm:grid-cols-2">
        {sortedMemories.map((memory) => (
          <li key={memory.id}>
            <button
              type="button"
              onClick={() => onOpenMemory(memory)}
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
    );
  }

  return <div className="h-full w-full overflow-auto pb-4 pr-1">{content}</div>;
}
