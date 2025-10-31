"use client";

import { type JSX, useCallback, useEffect, useMemo, useState } from "react";
import { SlipStackContainer, type SlipStackPaneData } from "slipstack-react";
import { listMemories } from "./memory-api";
import { MemoryEditorPane } from "./memory-editor-pane";
import { MemoryListPanel } from "./memory-list-panel";
import type { MemoryDetail, MemorySummary } from "./memory-types";

interface MemoryPaneConfig {
  paneId: string;
  memoryId?: string;
  title: string;
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
  const [summaries, setSummaries] = useState<MemorySummary[]>([]);
  const [summariesLoading, setSummariesLoading] = useState(true);
  const [summariesError, setSummariesError] = useState<string | null>(null);
  const [memoryPanes, setMemoryPanes] = useState<MemoryPaneConfig[]>([]);

  const refreshSummaries = useCallback(async () => {
    setSummariesLoading(true);
    try {
      const data = await listMemories();
      setSummaries(data);
      setSummariesError(null);
    } catch (error) {
      setSummariesError(error instanceof Error ? error.message : String(error));
    } finally {
      setSummariesLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSummaries().catch(() => {});
  }, [refreshSummaries]);

  const updatePaneTitle = useCallback((paneId: string, title: string) => {
    setMemoryPanes((prev) =>
      prev.map((pane) =>
        pane.paneId === paneId
          ? {
              ...pane,
              title,
            }
          : pane,
      ),
    );
  }, []);

  const promotePane = useCallback((paneId: string, detail: MemoryDetail) => {
    setMemoryPanes((prev) => {
      const filtered = prev.filter(
        (pane) =>
          pane.paneId !== paneId && pane.paneId !== memoryPaneId(detail.id),
      );
      return [
        ...filtered,
        {
          paneId: memoryPaneId(detail.id),
          memoryId: detail.id,
          title: detail.title,
        },
      ];
    });
  }, []);

  const openExistingMemory = useCallback((summary: MemorySummary) => {
    setMemoryPanes((prev) => {
      const filtered = prev.filter(
        (pane) => pane.paneId !== memoryPaneId(summary.id),
      );
      return [
        ...filtered,
        {
          paneId: memoryPaneId(summary.id),
          memoryId: summary.id,
          title: summary.title,
        },
      ];
    });
  }, []);

  const openNewMemory = useCallback(() => {
    const paneId = `memory-new-${Date.now()}`;
    setMemoryPanes((prev) => [
      ...prev,
      {
        paneId,
        memoryId: undefined,
        title: "Untitled memory",
      },
    ]);
  }, []);

  useEffect(() => {
    if (initialMemory === undefined) {
      return;
    }
    if (initialMemory === null) {
      openNewMemory();
      return;
    }
    openExistingMemory(initialMemory);
  }, [initialMemory, openExistingMemory, openNewMemory]);

  const overviewPane = useMemo<SlipStackPaneData>(
    () => ({
      id: "memories-overview",
      title: "Memories",
      element: (
        <MemoryListPanel
          className={listPaneClass}
          loading={summariesLoading}
          error={summariesError}
          summaries={summaries}
          onSelect={openExistingMemory}
          onCreate={openNewMemory}
          onRefresh={refreshSummaries}
        />
      ),
    }),
    [
      openExistingMemory,
      openNewMemory,
      refreshSummaries,
      summaries,
      summariesError,
      summariesLoading,
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
          updatePaneTitle={updatePaneTitle}
          onPersist={(detail) => {
            promotePane(pane.paneId, detail);
            refreshSummaries()
              .then(() => {
                onMemoriesChanged?.();
              })
              .catch(() => {});
          }}
          summaries={summaries}
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
    promotePane,
    refreshSummaries,
    summaries,
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
