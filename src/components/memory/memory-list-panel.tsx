"use client";

import type { JSX } from "react";
import type { MemorySummary } from "@/lib/types";
import { formatTimestamp } from "../../lib/utils";

interface MemoryListPanelProps {
  loading: boolean;
  error: string | null;
  recentMemories: MemorySummary[];
  onSelect: (summary: MemorySummary) => void;
  onCreate: () => void;
  creating?: boolean;
  className?: string;
}

const baseCardClass =
  "inline-flex items-center justify-center rounded-full border px-4 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-50";
const primaryButtonClass = `${baseCardClass} border-blue-600 bg-blue-600 text-white hover:bg-blue-500`;

export function MemoryListPanel({
  loading,
  error,
  recentMemories,
  onSelect,
  onCreate,
  creating = false,
  className,
}: MemoryListPanelProps): JSX.Element {
  return (
    <div className={className}>
      <div className="mb-4 flex items-center">
        <button
          type="button"
          onClick={onCreate}
          className={primaryButtonClass}
          disabled={creating}
        >
          {creating ? "Creating…" : "New memory"}
        </button>
      </div>

      <section className="flex-1 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50/70">
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            Loading memories…
          </div>
        ) : error ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-sm text-rose-600">
            <p>Something went wrong while loading memories.</p>
            <p className="text-xs text-rose-400">{error}</p>
          </div>
        ) : recentMemories.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-sm text-slate-500">
            <p>No memories yet.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-200 text-sm">
            {recentMemories.map((memory) => (
              <li key={memory.id}>
                <button
                  type="button"
                  onClick={() => onSelect(memory)}
                  className="flex w-full flex-col items-start gap-1 px-4 py-3 text-left transition hover:bg-white"
                >
                  <span className="text-base font-medium text-slate-900">
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
    </div>
  );
}
