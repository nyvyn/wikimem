"use client";

import { CodeNode } from "@lexical/code";
import { LinkNode } from "@lexical/link";
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
import type { EditorState } from "lexical";
import { type JSX, useEffect, useMemo, useRef, useState } from "react";

import { loadMemory, saveMemory } from "./memory-api";
import type { MemoryDetail } from "./memory-types";
import { deriveTitleFromMarkdown } from "./memory-utils";

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
  memoryId?: string;
  updatePaneTitle: (paneId: string, title: string) => void;
  onPersist: (detail: MemoryDetail) => void;
}

export function MemoryEditorPane({
  paneId,
  memoryId,
  updatePaneTitle,
  onPersist,
}: MemoryEditorPaneProps): JSX.Element {
  const [currentMemoryId, setCurrentMemoryId] = useState<string | undefined>(
    memoryId,
  );
  const [initialMarkdown, setInitialMarkdown] = useState<string>(
    currentMemoryId ? "" : "# Untitled memory\n\n",
  );
  const [draftMarkdown, setDraftMarkdown] = useState<string>(
    currentMemoryId ? "" : "# Untitled memory\n\n",
  );
  const [loading, setLoading] = useState<boolean>(Boolean(memoryId));
  const [error, setError] = useState<string | null>(null);
  const derivedTitleRef = useRef<string>(
    deriveTitleFromMarkdown(initialMarkdown),
  );
  const pendingSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!memoryId) {
      return;
    }
    setLoading(true);
    loadMemory(memoryId)
      .then((detail) => {
        setCurrentMemoryId(detail.id);
        setInitialMarkdown(detail.body);
        setDraftMarkdown(detail.body);
        updatePaneTitle(paneId, detail.title);
        derivedTitleRef.current = detail.title;
        setError(null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [memoryId, paneId, updatePaneTitle]);

  const editorNamespace = useMemo(() => `memory-editor-${paneId}`, [paneId]);

  const isDirty = draftMarkdown !== initialMarkdown;
  const canSave = draftMarkdown.trim().length > 0;
  const shouldPersist = isDirty && canSave;

  useEffect(() => {
    return () => {
      if (pendingSaveRef.current) {
        clearTimeout(pendingSaveRef.current);
        pendingSaveRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!shouldPersist) {
      return;
    }
    if (pendingSaveRef.current) {
      clearTimeout(pendingSaveRef.current);
    }
    const snapshot = draftMarkdown;
    pendingSaveRef.current = setTimeout(async () => {
      try {
        const derivedTitle = deriveTitleFromMarkdown(snapshot);
        const detail = await saveMemory({
          id: currentMemoryId,
          title: derivedTitle,
          body: snapshot,
        });
        setCurrentMemoryId(detail.id);
        setInitialMarkdown(detail.body);
        setDraftMarkdown(detail.body);
        derivedTitleRef.current = detail.title;
        updatePaneTitle(paneId, detail.title);
        onPersist(detail);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        pendingSaveRef.current = null;
      }
    }, 1000);

    return () => {
      if (pendingSaveRef.current) {
        clearTimeout(pendingSaveRef.current);
        pendingSaveRef.current = null;
      }
    };
  }, [
    currentMemoryId,
    draftMarkdown,
    onPersist,
    paneId,
    shouldPersist,
    updatePaneTitle,
  ]);

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
            ],
            theme: lexicalTheme,
          }}
        >
          <MarkdownInitPlugin markdown={initialMarkdown} />
          <div className="flex h-full flex-col">
            <RichTextPlugin
              contentEditable={
                <ContentEditable className="flex-1 overflow-y-auto bg-white px-6 py-6 text-base text-slate-800 focus:outline-none" />
              }
              placeholder={
                <div className="pointer-events-none select-none px-6 py-6 text-sm text-slate-400">
                  Start with a <span className="font-semibold"># Title</span>,
                  followed by context, insight, and references. Everything is
                  saved automatically after you pause typing.
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
                  const computedTitle = deriveTitleFromMarkdown(markdown);
                  if (derivedTitleRef.current !== computedTitle) {
                    derivedTitleRef.current = computedTitle;
                    updatePaneTitle(paneId, computedTitle);
                  }
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
