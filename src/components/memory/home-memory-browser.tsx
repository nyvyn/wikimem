"use client";

import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { McpInstructionsDialog } from "./mcp-instructions-dialog";
import { MemoryResultsView } from "./memory-results-view";
import type { MemorySearchResult, MemorySummary } from "@/lib/types";
import { listMemories, searchMemories } from "@/lib/tauri-commands";

interface HomeMemoryBrowserProps {
  onOpenMemory: (memory: MemorySummary | null) => void;
  refreshSignal?: number;
}

export function HomeMemoryBrowser({
  onOpenMemory,
  refreshSignal = 0,
}: HomeMemoryBrowserProps): JSX.Element {
  const [recentMemories, setRecentMemories] = useState<MemorySummary[]>([]);
  const [memoriesLoading, setMemoriesLoading] = useState(true);
  const [memoriesError, setMemoriesError] = useState<string | null>(null);
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
      const summaries = await listMemories();
      setRecentMemories(summaries);
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
    fetchMemories().catch(() => {});
  }, [fetchMemories, refreshSignal]);

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

  const inSearchMode = debouncedQuery.trim().length > 0;

  return (
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
            onClick={() => onOpenMemory(null)}
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
        onOpenMemory={(memory) => onOpenMemory(memory)}
      />
    </section>
  );
}
