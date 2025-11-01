"use client";

import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { listMemories, searchMemories } from "@/lib/tauri-commands";
import type { MemorySearchResult, MemorySummary } from "@/lib/types";

interface UseMemoryResultsOptions {
  refreshSignal?: number;
}

export interface MemoryResultsController {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  debouncedQuery: string;
  inSearchMode: boolean;
  searchLoading: boolean;
  searchError: string | null;
  searchResults: MemorySearchResult[];
  memoriesLoading: boolean;
  memoriesError: string | null;
  sortedMemories: MemorySummary[];
}

export function useMemoryResults(
  options: UseMemoryResultsOptions = {},
): MemoryResultsController {
  const { refreshSignal = 0 } = options;
  const [recentMemories, setRecentMemories] = useState<MemorySummary[]>([]);
  const [memoriesLoading, setMemoriesLoading] = useState(true);
  const [memoriesError, setMemoriesError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MemorySearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const activeSearchRef = useRef<string | null>(null);

  const fetchMemories = useCallback(async () => {
    setMemoriesLoading(true);
    try {
      const data = await listMemories();
      setRecentMemories(data);
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
    if (refreshSignal > 0) {
      fetchMemories().catch(() => {});
    }
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

  const sortedMemories = useMemo(() => {
    return [...recentMemories]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 10);
  }, [recentMemories]);

  return {
    searchQuery,
    setSearchQuery,
    debouncedQuery,
    inSearchMode: debouncedQuery.trim().length > 0,
    searchLoading,
    searchError,
    searchResults,
    memoriesLoading,
    memoriesError,
    sortedMemories,
  };
}
