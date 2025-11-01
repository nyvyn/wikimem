"use client";

import { $convertToMarkdownString, type Transformer } from "@lexical/markdown";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useEffect, useRef } from "react";

interface AutoSavePluginProps {
  transformers: Transformer[];
  initialMarkdown: string;
  onContentChange: (markdown: string) => void;
  debounceMs?: number;
}

export function AutoSavePlugin({
  transformers,
  initialMarkdown,
  onContentChange,
  debounceMs = 300,
}: AutoSavePluginProps): null {
  const [editor] = useLexicalComposerContext();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedMarkdownRef = useRef(initialMarkdown);
  const pendingMarkdownRef = useRef<string | null>(null);

  useEffect(() => {
    lastSavedMarkdownRef.current = initialMarkdown;
  }, [initialMarkdown]);

  useEffect(() => {
    const flush = () => {
      const markdown = pendingMarkdownRef.current;
      if (!markdown || markdown === lastSavedMarkdownRef.current) {
        return;
      }
      pendingMarkdownRef.current = null;
      lastSavedMarkdownRef.current = markdown;
      onContentChange(markdown);
    };

    const unregister = editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        pendingMarkdownRef.current = $convertToMarkdownString(transformers);
      });

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      timerRef.current = setTimeout(flush, debounceMs);
    });

    const visibilityHandler = () => {
      if (document.visibilityState === "hidden") {
        flush();
      }
    };

    const beforeUnloadHandler = () => {
      flush();
    };

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", visibilityHandler);
    }
    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", beforeUnloadHandler);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      unregister();
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", visibilityHandler);
      }
      if (typeof window !== "undefined") {
        window.removeEventListener("beforeunload", beforeUnloadHandler);
      }
      flush();
    };
  }, [debounceMs, editor, onContentChange, transformers]);

  return null;
}
