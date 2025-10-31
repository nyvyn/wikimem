import type { TextMatchTransformer, Transformer } from "@lexical/markdown";
import { TRANSFORMERS } from "@lexical/markdown";
import type { TextNode } from "lexical";

import { $createMemoryNode, $isMemoryNode, MemoryNode } from "./memory-node";
import type { MemorySummary } from "./memory-types";

function createMemoryLinkTransformer(
  resolveMemorySummary: (id: string) => MemorySummary | undefined,
): TextMatchTransformer {
  const importRegExp = /\[\[([^[\]]+?)]]/;
  return {
    dependencies: [MemoryNode],
    export: (node) => {
      if (!$isMemoryNode(node)) {
        return null;
      }
      return `[[${node.__memoryId}]]`;
    },
    importRegExp,
    regExp: /\[\[([^[\]]+?)]]$/,
    replace: (textNode: TextNode, match) => {
      const [, rawId] = match;
      const id = rawId.trim();
      if (!id) {
        return;
      }
      const summary =
        resolveMemorySummary(id) ?? createMemorySummaryFallback(id);
      const memoryNode = $createMemoryNode(summary, summary.title);
      textNode.replace(memoryNode);
      return memoryNode;
    },
    trigger: "]",
    type: "text-match",
  };
}

export function createMemoryMarkdownTransformers(
  resolveMemorySummary: (id: string) => MemorySummary | undefined,
): Transformer[] {
  const memoryLinkTransformer =
    createMemoryLinkTransformer(resolveMemorySummary);
  return [...TRANSFORMERS, memoryLinkTransformer];
}

function createMemorySummaryFallback(id: string): MemorySummary {
  const fallbackId = id.trim();
  return {
    id: fallbackId,
    title: fallbackId,
    updatedAt: Math.floor(Date.now() / 1000),
  };
}
