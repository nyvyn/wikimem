"use client";

import type { JSX } from "react";

import type { MemorySearchResult, MemorySummary } from "@/lib/types";
import { formatTimestamp } from "@/lib/utils";

interface MemoryResultsViewProps {
  inSearchMode: boolean;
  searchLoading: boolean;
  searchError: string | null;
  searchResults: MemorySearchResult[];
  debouncedQuery: string;
  memoriesLoading: boolean;
  memoriesError: string | null;
  sortedMemories: MemorySummary[];
  onOpenMemory: (memory: MemorySummary) => void;
}

export function MemoryResultsView({
  inSearchMode,
  searchLoading,
  searchError,
  searchResults,
  debouncedQuery,
  memoriesLoading,
  memoriesError,
  sortedMemories,
  onOpenMemory,
}: MemoryResultsViewProps): JSX.Element {
  if (inSearchMode) {
    if (searchLoading) {
      return (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-slate-400">
          Searching memories…
        </div>
      );
    }
    if (searchError) {
      return (
        <div className="rounded-3xl border border-rose-400/40 bg-rose-500/10 p-6 text-sm text-rose-200">
          {searchError}
        </div>
      );
    }
    if (searchResults.length === 0) {
      return (
        <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 p-6 text-sm text-slate-400">
          No matches found for &ldquo;{debouncedQuery.trim()}&rdquo;.
        </div>
      );
    }

    return (
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

  if (memoriesLoading) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-slate-400">
        Loading memories…
      </div>
    );
  }
  if (memoriesError) {
    return (
      <div className="rounded-3xl border border-rose-400/40 bg-rose-500/10 p-6 text-sm text-rose-200">
        {memoriesError}
      </div>
    );
  }
  if (sortedMemories.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 p-6 text-sm text-slate-400">
        No memories yet. Capture a new one to start your wiki.
      </div>
    );
  }

  return (
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
