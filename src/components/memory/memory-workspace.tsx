"use client";

import {
  type JSX,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { SlipStackContainer, type SlipStackPaneData } from "slipstack-react";

import { saveMemory } from "@/lib/tauri-commands";
import type { MemoryDetail, MemorySummary } from "@/lib/types";
import { MemoryEditorPane } from "./memory-editor-pane";
import { MemoryListPanel } from "./memory-list-panel";
import { useRecentMemories } from "./use-recent-memories";

interface MemoryPaneConfig {
  paneId: string;
  memoryId: string;
  title: string;
  initialDetail?: MemoryDetail;
}

const listPaneClass =
  "flex h-full flex-col gap-4 bg-white text-slate-900 p-6 overflow-hidden";
const memoryPaneId = (id: string) => `memory-${id}`;

export interface MemoryWorkspaceProps {
  initialMemory?: MemorySummary | null;
  onMemoriesChanged?: () => void;
  variant?: "card" | "full";
}

export function MemoryWorkspace(props: MemoryWorkspaceProps = {}): JSX.Element {
  const { initialMemory, onMemoriesChanged, variant = "card" } = props;
  const [creatingMemory, setCreatingMemory] = useState(false);
  const [memoryPanes, setMemoryPanes] = useState<MemoryPaneConfig[]>([]);

  const {
    recentMemories,
    loading: recentMemoriesLoading,
    error: recentMemoriesError,
    refresh: refreshRecentMemories,
  } = useRecentMemories();

  const updatePaneTitle = useCallback((memoryId: string, title: string) => {
    setMemoryPanes((prev) =>
      prev.map((pane) =>
        pane.memoryId === memoryId
          ? {
              ...pane,
              title,
            }
          : pane,
      ),
    );
  }, []);

  const openMemory = useCallback(
    (summary: MemorySummary, detail?: MemoryDetail) => {
      setMemoryPanes((prev) => {
        const filtered = prev.filter((pane) => pane.memoryId !== summary.id);
        return [
          ...filtered,
          {
            paneId: memoryPaneId(summary.id),
            memoryId: summary.id,
            title: summary.title,
            initialDetail: detail,
          },
        ];
      });
    },
    [],
  );

  const openExistingMemory = useCallback(
    (summary: MemorySummary) => {
      openMemory(summary);
    },
    [openMemory],
  );

  const createAndOpenMemory = useCallback(async () => {
    if (creatingMemory) {
      return;
    }
    setCreatingMemory(true);
    try {
      const detail = await saveMemory({
        title: "Untitled memory",
        body: "",
      });
      const summary: MemorySummary = {
        id: detail.id,
        title: detail.title,
        updatedAt: detail.updatedAt,
      };
      openMemory(summary, detail);
      await refreshRecentMemories();
      onMemoriesChanged?.();
    } catch (error) {
      setRecentMemoriesError(
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setCreatingMemory(false);
    }
  }, [creatingMemory, onMemoriesChanged, openMemory, refreshRecentMemories]);

  const appliedInitialMemoryRef = useRef<MemorySummary | null | undefined>(
    undefined,
  );

  useEffect(() => {
    if (initialMemory === undefined) {
      appliedInitialMemoryRef.current = undefined;
      return;
    }
    if (appliedInitialMemoryRef.current === initialMemory) {
      return;
    }
    appliedInitialMemoryRef.current = initialMemory;
    if (initialMemory === null) {
      void createAndOpenMemory();
      return;
    }
    openMemory(initialMemory);
  }, [createAndOpenMemory, initialMemory, openMemory]);

  const overviewPane = useMemo<SlipStackPaneData>(
    () => ({
      id: "memories-overview",
      title: "Recent memories",
      element: (
        <MemoryListPanel
          className={listPaneClass}
          loading={recentMemoriesLoading}
          error={recentMemoriesError}
          recentMemories={recentMemories}
          onSelect={openExistingMemory}
          onCreate={() => {
            void createAndOpenMemory();
          }}
          creating={creatingMemory}
        />
      ),
    }),
    [
      createAndOpenMemory,
      creatingMemory,
      openExistingMemory,
      recentMemories,
      recentMemoriesError,
      recentMemoriesLoading,
    ],
  );

  const paneData = useMemo<SlipStackPaneData[]>(() => {
    const memoryPaneData = memoryPanes.map<SlipStackPaneData>((pane) => ({
      id: pane.paneId,
      title: pane.title,
      element: (
        <MemoryEditorPane
          key={pane.paneId}
          paneId={pane.paneId}
          memoryId={pane.memoryId}
          initialDetail={pane.initialDetail}
          updatePaneTitle={updatePaneTitle}
          onPersist={(detail) => {
            setMemoryPanes((prev) =>
              prev.map((existing) =>
                existing.memoryId === detail.id
                  ? {
                      ...existing,
                      title: detail.title,
                      initialDetail: detail,
                    }
                  : existing,
              ),
            );
            refreshRecentMemories()
              .then(() => {
                onMemoriesChanged?.();
              })
              .catch(() => {});
          }}
          recentMemories={recentMemories}
          onOpenMemory={openExistingMemory}
        />
      ),
    }));
    if (variant === "full") {
      return memoryPaneData;
    }
    return [overviewPane, ...memoryPaneData];
  }, [
    memoryPanes,
    onMemoriesChanged,
    openExistingMemory,
    overviewPane,
    refreshRecentMemories,
    recentMemories,
    updatePaneTitle,
    variant,
  ]);

  const workspaceClass =
    variant === "full"
      ? "flex h-full w-full overflow-hidden bg-white text-slate-900"
      : "flex h-full w-full overflow-hidden rounded-3xl border border-white/10 bg-white/95 text-slate-900 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.65)] backdrop-blur";

  return (
    <div className={workspaceClass}>
      <SlipStackContainer paneData={paneData} paneWidth={680} />
    </div>
  );
}
