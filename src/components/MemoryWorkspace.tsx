"use client";

import { CodeNode } from "@lexical/code";
import { ListItemNode, ListNode } from "@lexical/list";
import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
  TRANSFORMERS,
} from "@lexical/markdown";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { invoke } from "@tauri-apps/api/core";
import type { EditorState } from "lexical";
import { type JSX, useCallback, useEffect, useMemo, useState } from "react";
import { SlipStackContainer, type SlipStackPaneData } from "slipstack-react";

interface MemorySummaryDto {
  id: string;
  title: string;
  updated_at: number;
}

interface MemoryDetailDto extends MemorySummaryDto {
  body: string;
}

interface MemorySummary {
  id: string;
  title: string;
  updatedAt: number;
}

interface MemoryDetail extends MemorySummary {
  body: string;
}

interface MemoryPaneConfig {
  paneId: string;
  memoryId?: string;
  title: string;
}

const paneShellClass =
  "flex h-full flex-col gap-4 bg-white text-slate-900 p-6 overflow-hidden";

const buttonBaseClass =
  "inline-flex items-center justify-center rounded-full border px-4 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-50";

const primaryButtonClass = `${buttonBaseClass} border-blue-600 bg-blue-600 text-white hover:bg-blue-500`;

const secondaryButtonClass = `${buttonBaseClass} border-slate-200 bg-white hover:border-slate-400`;

const dangerButtonClass = `${buttonBaseClass} border-transparent bg-rose-600 text-white hover:bg-rose-500`;

function toSummary(dto: MemorySummaryDto): MemorySummary {
  return {
    id: dto.id,
    title: dto.title,
    updatedAt: dto.updated_at,
  };
}

function toDetail(dto: MemoryDetailDto): MemoryDetail {
  return {
    id: dto.id,
    title: dto.title,
    updatedAt: dto.updated_at,
    body: dto.body,
  };
}

async function listMemories(): Promise<MemorySummary[]> {
  const dto = await invoke<MemorySummaryDto[]>("list_memories");
  return dto.map(toSummary);
}

async function loadMemory(id: string): Promise<MemoryDetail> {
  const dto = await invoke<MemoryDetailDto>("load_memory", { id });
  return toDetail(dto);
}

async function saveMemory(payload: {
  id?: string;
  title: string;
  body: string;
}): Promise<MemoryDetail> {
  const dto = await invoke<MemoryDetailDto>("save_memory", {
    id: payload.id,
    title: payload.title,
    body: payload.body,
  });
  return toDetail(dto);
}

async function deleteMemory(id: string): Promise<void> {
  await invoke("delete_memory", { id });
}

function formatTimestamp(seconds: number): string {
  const date = new Date(seconds * 1000);
  return date.toLocaleString();
}

const lexicalTheme = {
  paragraph: "mb-2 text-base leading-relaxed text-slate-800",
  heading: {
    h1: "text-2xl font-semibold text-slate-900 mb-3",
    h2: "text-xl font-semibold text-slate-900 mb-2",
    h3: "text-lg font-semibold text-slate-900 mb-2",
  },
  list: {
    ul: "list-disc pl-6 mb-2 text-slate-800",
    ol: "list-decimal pl-6 mb-2 text-slate-800",
    listitem: "mb-1",
  },
  quote:
    "border-l-4 border-slate-300 pl-3 italic text-slate-700 mb-2 text-base",
  code: "block rounded-md bg-slate-900 text-slate-100 text-sm font-mono px-3 py-2 whitespace-pre-wrap",
};

const memoryPaneId = (id: string) => `memory-${id}`;

export function MemoryWorkspace(): JSX.Element {
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

  const closePane = useCallback((paneId: string) => {
    setMemoryPanes((prev) => prev.filter((pane) => pane.paneId !== paneId));
  }, []);

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
        title: "New memory",
      },
    ]);
  }, []);

  const overviewPane = useMemo<SlipStackPaneData>(
    () => ({
      id: "memories-overview",
      title: "Memories",
      element: (
        <MemoryListPane
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
          initialTitle={pane.title}
          onTitlePreview={(title) => updatePaneTitle(pane.paneId, title)}
          onClose={() => closePane(pane.paneId)}
          onSaved={(detail) => {
            promotePane(pane.paneId, detail);
            refreshSummaries().catch(() => {});
          }}
          onDeleted={() => {
            closePane(pane.paneId);
            refreshSummaries().catch(() => {});
          }}
        />
      ),
    }));
    return [overviewPane, ...memoryPaneData];
  }, [
    closePane,
    memoryPanes,
    overviewPane,
    promotePane,
    refreshSummaries,
    updatePaneTitle,
  ]);

  return (
    <div className="flex h-full w-full overflow-hidden rounded-3xl border border-white/10 bg-white/95 text-slate-900 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.65)] backdrop-blur">
      <SlipStackContainer paneData={paneData} paneWidth={440} />
    </div>
  );
}

interface MemoryListPaneProps {
  loading: boolean;
  error: string | null;
  summaries: MemorySummary[];
  onSelect: (summary: MemorySummary) => void;
  onCreate: () => void;
  onRefresh: () => void;
}

function MemoryListPane({
  loading,
  error,
  summaries,
  onSelect,
  onCreate,
  onRefresh,
}: MemoryListPaneProps): JSX.Element {
  return (
    <div className={paneShellClass}>
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
          Memory graph
        </p>
        <h2 className="text-2xl font-semibold text-slate-900">All memories</h2>
        <p className="text-sm text-slate-500">
          Each memory is a Markdown document saved in the app data directory.
          Select one to slide it into view, or create a new slip to capture a
          moment.
        </p>
      </header>

      <div className="flex items-center gap-3">
        <button type="button" onClick={onCreate} className={primaryButtonClass}>
          New memory
        </button>
        <button
          type="button"
          onClick={onRefresh}
          className={secondaryButtonClass}
        >
          Refresh
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
        ) : summaries.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-sm text-slate-500">
            <p>No memories yet.</p>
            <p className="text-xs text-slate-400">
              Create one to seed the SlipStack.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-200 text-sm">
            {summaries.map((memory) => (
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

interface MemoryEditorPaneProps {
  paneId: string;
  memoryId?: string;
  initialTitle: string;
  onTitlePreview: (title: string) => void;
  onClose: () => void;
  onSaved: (detail: MemoryDetail) => void;
  onDeleted: () => void;
}

function MemoryEditorPane({
  paneId,
  memoryId,
  initialTitle,
  onTitlePreview,
  onClose,
  onSaved,
  onDeleted,
}: MemoryEditorPaneProps): JSX.Element {
  const [currentMemoryId, setCurrentMemoryId] = useState<string | undefined>(
    memoryId,
  );
  const [title, setTitle] = useState(initialTitle);
  const [initialTitleState, setInitialTitleState] = useState(initialTitle);
  const [initialMarkdown, setInitialMarkdown] = useState<string>(
    currentMemoryId ? "" : `# ${initialTitle}\n\n`,
  );
  const [draftMarkdown, setDraftMarkdown] = useState<string>(
    currentMemoryId ? "" : `# ${initialTitle}\n\n`,
  );
  const [loading, setLoading] = useState<boolean>(Boolean(memoryId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!memoryId) {
      return;
    }
    setLoading(true);
    loadMemory(memoryId)
      .then((detail) => {
        setCurrentMemoryId(detail.id);
        setTitle(detail.title);
        setInitialTitleState(detail.title);
        setInitialMarkdown(detail.body);
        setDraftMarkdown(detail.body);
        onTitlePreview(detail.title);
        setError(null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [memoryId, onTitlePreview]);

  const editorNamespace = useMemo(() => `memory-editor-${paneId}`, [paneId]);

  const isDirty =
    draftMarkdown !== initialMarkdown || title.trim() !== initialTitleState;

  const canSave = title.trim().length > 0;

  const handleSave = useCallback(async () => {
    if (!canSave || saving) {
      return;
    }
    setSaving(true);
    try {
      const detail = await saveMemory({
        id: currentMemoryId,
        title,
        body: draftMarkdown,
      });
      setCurrentMemoryId(detail.id);
      setInitialTitleState(detail.title);
      setInitialMarkdown(detail.body);
      setDraftMarkdown(detail.body);
      setError(null);
      onTitlePreview(detail.title);
      onSaved(detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }, [
    canSave,
    currentMemoryId,
    draftMarkdown,
    onSaved,
    onTitlePreview,
    saving,
    title,
  ]);

  const handleDelete = useCallback(async () => {
    if (!currentMemoryId) {
      onClose();
      return;
    }
    setSaving(true);
    try {
      await deleteMemory(currentMemoryId);
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }, [currentMemoryId, onClose, onDeleted]);

  const handleTitleChange = useCallback(
    (value: string) => {
      setTitle(value);
      onTitlePreview(value.trim().length === 0 ? "Untitled memory" : value);
    },
    [onTitlePreview],
  );

  if (loading) {
    return (
      <div className={`${paneShellClass} items-center justify-center`}>
        <p className="text-sm text-slate-500">Loading memory…</p>
      </div>
    );
  }

  return (
    <div className={paneShellClass}>
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
          {currentMemoryId ? "Editing memory" : "New memory"}
        </p>
        <input
          value={title}
          onChange={(event) => handleTitleChange(event.target.value)}
          placeholder="Give this memory a title"
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-lg font-medium text-slate-900 shadow-inner focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
        {currentMemoryId && (
          <p className="text-xs text-slate-400">
            File stored as {currentMemoryId}.md
          </p>
        )}
      </header>

      <section className="flex-1 overflow-hidden rounded-xl border border-slate-200">
        <LexicalComposer
          initialConfig={{
            namespace: editorNamespace,
            onError(error: Error) {
              throw error;
            },
            nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode, CodeNode],
            theme: lexicalTheme,
          }}
        >
          <MarkdownInitPlugin markdown={initialMarkdown} />
          <div className="flex h-full flex-col">
            <RichTextPlugin
              contentEditable={
                <ContentEditable className="min-h-[320px] flex-1 overflow-y-auto bg-white px-4 py-3 text-base text-slate-800 focus:outline-none" />
              }
              placeholder={
                <div className="pointer-events-none select-none px-4 py-3 text-sm text-slate-400">
                  Start capturing the story…
                </div>
              }
              ErrorBoundary={LexicalErrorBoundary}
            />
            <HistoryPlugin />
            <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
            <OnChangePlugin
              onChange={(editorState: EditorState) => {
                editorState.read(() => {
                  const markdown = $convertToMarkdownString(TRANSFORMERS);
                  setDraftMarkdown(markdown);
                });
              }}
            />
          </div>
        </LexicalComposer>
      </section>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-600">
          {error}
        </div>
      ) : null}

      <footer className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave || saving || !isDirty}
            className={primaryButtonClass}
          >
            {currentMemoryId ? "Save changes" : "Create memory"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className={secondaryButtonClass}
          >
            Close
          </button>
        </div>
        <button
          type="button"
          onClick={handleDelete}
          disabled={saving}
          className={dangerButtonClass}
        >
          {currentMemoryId ? "Delete" : "Discard"}
        </button>
      </footer>
    </div>
  );
}

function MarkdownInitPlugin({ markdown }: { markdown: string }): null {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    if (!markdown) {
      editor.update(() => {
        $convertFromMarkdownString("# Untitled memory\n\n", TRANSFORMERS);
      });
      return;
    }
    editor.update(() => {
      $convertFromMarkdownString(markdown, TRANSFORMERS);
    });
  }, [editor, markdown]);
  return null;
}
