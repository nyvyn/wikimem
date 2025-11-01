"use client";

import { useCallback, useEffect, useState } from "react";

import { listMemories } from "@/lib/tauri-commands";
import type { MemorySummary } from "@/lib/types";

interface UseRecentMemoriesOptions {
  refreshSignal?: number;
}

interface RecentMemoriesState {
  recentMemories: MemorySummary[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useRecentMemories(
  options: UseRecentMemoriesOptions = {},
): RecentMemoriesState {
  const { refreshSignal = 0 } = options;
  const [recentMemories, setRecentMemories] = useState<MemorySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listMemories();
      setRecentMemories(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);

  useEffect(() => {
    if (refreshSignal > 0) {
      refresh().catch(() => {});
    }
  }, [refresh, refreshSignal]);

  return {
    recentMemories,
    loading,
    error,
    refresh,
  };
}
