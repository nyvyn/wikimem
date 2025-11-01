"use client";

import { CodeNode } from "@lexical/code";
import { LinkNode } from "@lexical/link";
import { ListItemNode, ListNode } from "@lexical/list";
import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
  type Transformer,
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
import { $createParagraphNode, $getRoot, type EditorState } from "lexical";
import {
  type JSX,
  type KeyboardEvent,
  type MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { loadMemory, saveMemory } from "../../lib/tauri-commands";
import type { MemoryDetail, MemorySummary } from "../../lib/types";
import { deriveTitleFromMarkdown } from "../../lib/utils";
import { MemoryLinkPlugin } from "./memory-link-plugin";
import { createMemoryMarkdownTransformers } from "./memory-markdown";
import { MemoryNode } from "./memory-node";

const editorPaneClass = "flex h-full flex-col bg-white text-slate-900";

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

export interface MemoryEditorPaneProps {
  paneId: string;
  memoryId: string;
  initialDetail?: MemoryDetail;
  updatePaneTitle: (memoryId: string, title: string) => void;
  onPersist: (detail: MemoryDetail) => void;
  recentMemories: MemorySummary[];
  onOpenMemory: (memory: MemorySummary) => void;
}

export function MemoryEditorPane({
  paneId,
  memoryId,
  initialDetail,
  updatePaneTitle,
  onPersist,
  recentMemories,
  onOpenMemory,
}: MemoryEditorPaneProps): JSX.Element {
  const [currentMemoryId, setCurrentMemoryId] = useState(memoryId);
  const [initialMarkdown, setInitialMarkdown] = useState<string>(
    initialDetail?.body ?? "",
  );
  const [loading, setLoading] = useState<boolean>(!initialDetail);
  const [error, setError] = useState<string | null>(null);
  const derivedTitleRef = useRef<string>(
    initialDetail?.title ?? deriveTitleFromMarkdown(initialDetail?.body ?? ""),
  );

  useEffect(() => {
    setCurrentMemoryId(memoryId);
    if (initialDetail && initialDetail.id === memoryId) {
      setInitialMarkdown(initialDetail.body);
      derivedTitleRef.current = initialDetail.title;
      updatePaneTitle(memoryId, initialDetail.title);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    loadMemory(memoryId)
      .then((detail) => {
        setCurrentMemoryId(detail.id);
        setInitialMarkdown(detail.body);
        derivedTitleRef.current = detail.title;
        updatePaneTitle(memoryId, detail.title);
        setError(null);
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        if (message.toLowerCase().includes("no such file or directory")) {
          const defaultMarkdown = `# ${memoryId}\n\n`;
          setInitialMarkdown(defaultMarkdown);
          derivedTitleRef.current = deriveTitleFromMarkdown(defaultMarkdown);
          updatePaneTitle(memoryId, derivedTitleRef.current);
          setError(null);
          return;
        }
        setError(message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [initialDetail, memoryId, updatePaneTitle]);

  const editorNamespace = useMemo(() => `memory-editor-${paneId}`, [paneId]);

  const resolveMemorySummary = useCallback(
    (id: string) => {
      const trimmedId = id.trim();
      if (!trimmedId) {
        return undefined;
      }
      if (trimmedId === currentMemoryId) {
        return {
          id: currentMemoryId,
          title: derivedTitleRef.current ?? "Untitled memory",
          updatedAt: Math.floor(Date.now() / 1000),
        } satisfies MemorySummary;
      }
      return recentMemories.find((summary) => summary.id === trimmedId);
    },
    [currentMemoryId, recentMemories],
  );

  const openMemoryFromElement = useCallback(
    (element: HTMLElement) => {
      const rawId = element.dataset.memoryId;
      if (!rawId) {
        return;
      }
      const id = rawId.trim();
      if (!id) {
        return;
      }
      const title = element.dataset.memoryTitle ?? "Untitled memory";
      const fallback: MemorySummary = {
        id,
        title,
        updatedAt: Math.floor(Date.now() / 1000),
      };
      const existing = resolveMemorySummary(id);
      onOpenMemory(existing ?? fallback);
    },
    [onOpenMemory, resolveMemorySummary],
  );

  const handleMemoryLinkClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement | null;
      const memoryElement =
        target?.closest<HTMLElement>("[data-memory-link]") ?? null;
      if (!memoryElement) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      openMemoryFromElement(memoryElement);
    },
    [openMemoryFromElement],
  );

  const handleMemoryLinkKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (!target || !target.hasAttribute("data-memory-link")) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      openMemoryFromElement(target);
    },
    [openMemoryFromElement],
  );

  const markdownTransformers = useMemo(
    () => createMemoryMarkdownTransformers(resolveMemorySummary),
    [resolveMemorySummary],
  );

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-500">
        Loading memory…
      </div>
    );
  }

  return (
    <div className={editorPaneClass}>
      <section className="flex-1 overflow-hidden">
        <LexicalComposer
          initialConfig={{
            namespace: editorNamespace,
            onError(error: Error) {
              throw error;
            },
            nodes: [
              HeadingNode,
              QuoteNode,
              ListNode,
              ListItemNode,
              CodeNode,
              LinkNode,
              MemoryNode,
            ],
            theme: lexicalTheme,
          }}
        >
          <MarkdownInitPlugin
            markdown={initialMarkdown}
            transformers={markdownTransformers}
          />
          <div className="flex h-full flex-col">
            <RichTextPlugin
              contentEditable={
                <div className="flex-1 overflow-y-auto" role="presentation">
                  <ContentEditable
                    className="h-full w-full bg-white px-6 py-6 text-base text-slate-800 focus:outline-none"
                    onClick={handleMemoryLinkClick}
                    onKeyDown={handleMemoryLinkKeyDown}
                  />
                </div>
              }
              placeholder={
                <div className="pointer-events-none select-none px-6 py-6 text-sm text-slate-400">
                  Start with a <span className="font-semibold"># Title</span>,
                  capture context and insight, and link related memories with{" "}
                  <code className="rounded bg-slate-200 px-1 py-0.5 text-xs text-slate-700">
                    [[memory-id]]
                  </code>
                  . Everything is saved automatically after you pause typing.
                </div>
              }
              ErrorBoundary={LexicalErrorBoundary}
            />
            <HistoryPlugin />
            <MarkdownShortcutPlugin transformers={markdownTransformers} />
            <MemoryLinkPlugin onMemorySelected={onOpenMemory} />
            <OnChangePlugin
              onChange={(editorState: EditorState) => {
                editorState.read(() => {
                  const markdown =
                    $convertToMarkdownString(markdownTransformers);

                  const computedTitle = deriveTitleFromMarkdown(markdown);
                  if (derivedTitleRef.current !== computedTitle) {
                    derivedTitleRef.current = computedTitle;
                    updatePaneTitle(currentMemoryId, computedTitle);
                  }

                  saveMemory({
                    id: currentMemoryId,
                    title: computedTitle,
                    body: markdown,
                  }).then((detail) => {
                    setCurrentMemoryId(detail.id);
                    onPersist(detail);
                  });
                });
              }}
            />
          </div>
        </LexicalComposer>
      </section>

      {error ? (
        <div className="px-6 py-3 text-xs text-rose-600">{error}</div>
      ) : null}
    </div>
  );
}

function MarkdownInitPlugin({
  markdown,
  transformers,
}: {
  markdown: string;
  transformers: Transformer[];
}): null {
  const [editor] = useLexicalComposerContext();
  const initializedRef = useRef(false);
  const lastMarkdownRef = useRef<string | null>(null);
  useEffect(() => {
    if (initializedRef.current && lastMarkdownRef.current === markdown) {
      return;
    }
    editor.update(() => {
      if (!markdown) {
        const root = $getRoot();
        root.clear();
        const paragraph = $createParagraphNode();
        root.append(paragraph);
        paragraph.select();
      } else {
        $convertFromMarkdownString(markdown, transformers);
      }
    });
    initializedRef.current = true;
    lastMarkdownRef.current = markdown;
  }, [editor, markdown, transformers]);
  return null;
}
