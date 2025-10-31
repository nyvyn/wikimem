import {
  $applyNodeReplacement,
  type DOMConversionMap,
  type DOMConversionOutput,
  type DOMExportOutput,
  type EditorConfig,
  type LexicalNode,
  type NodeKey,
  type SerializedTextNode,
  type Spread,
  TextNode,
} from "lexical";

import type { MemorySummary } from "./memory-types";

export type SerializedMemoryNode = Spread<
  {
    memoryId: string;
    memoryTitle: string;
  },
  SerializedTextNode
>;

function $convertMemoryElement(
  domNode: HTMLElement,
): DOMConversionOutput | null {
  const textContent = domNode.textContent;
  const memoryId = domNode.getAttribute("data-lexical-memory-id");
  const memoryTitle =
    domNode.getAttribute("data-lexical-memory-title") ?? textContent ?? "";
  if (memoryTitle) {
    const summary: MemorySummary = {
      id: memoryId ?? memoryTitle,
      title: memoryTitle,
      updatedAt: Math.floor(Date.now() / 1000),
    };
    const node = $createMemoryNode(summary, textContent ?? undefined);
    return { node };
  }

  return null;
}

const memoryStyle =
  "color: #2563eb; text-decoration: underline; cursor: pointer;";

export class MemoryNode extends TextNode {
  __memoryId: string;
  __memoryTitle: string;

  static getType(): string {
    return "memory";
  }

  static clone(node: MemoryNode): MemoryNode {
    return new MemoryNode(
      {
        id: node.__memoryId,
        title: node.__memoryTitle,
        updatedAt: Math.floor(Date.now() / 1000),
      },
      node.__text,
      node.__key,
    );
  }

  static importJSON(serializedNode: SerializedMemoryNode): MemoryNode {
    const summary: MemorySummary = {
      id: serializedNode.memoryId,
      title: serializedNode.memoryTitle,
      updatedAt: Math.floor(Date.now() / 1000),
    };
    return $createMemoryNode(summary).updateFromJSON(serializedNode);
  }

  constructor(memory: MemorySummary, text?: string, key?: NodeKey) {
    super(text ?? memory.title, key);
    this.__memoryId = memory.id;
    this.__memoryTitle = memory.title;
  }

  exportJSON(): SerializedMemoryNode {
    return {
      ...super.exportJSON(),
      memoryId: this.__memoryId,
      memoryTitle: this.__memoryTitle,
    };
  }

  createDOM(config: EditorConfig): HTMLElement {
    const dom = super.createDOM(config);
    dom.style.cssText = memoryStyle;
    dom.classList.add("memory-link");
    dom.spellcheck = false;
    dom.setAttribute("data-memory-link", "true");
    dom.setAttribute("data-memory-id", this.__memoryId);
    dom.setAttribute("data-memory-title", this.__memoryTitle);
    dom.setAttribute("tabindex", "0");
    dom.setAttribute("role", "link");
    dom.setAttribute("aria-label", `Open memory ${this.__memoryTitle}`);
    return dom;
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement("span");
    element.setAttribute("data-lexical-memory", "true");
    element.setAttribute("data-lexical-memory-id", this.__memoryId);
    element.setAttribute("data-lexical-memory-title", this.__memoryTitle);
    element.textContent = this.__text;
    return { element };
  }

  static importDOM(): DOMConversionMap | null {
    return {
      span: (domNode: HTMLElement) => {
        if (!domNode.hasAttribute("data-lexical-memory")) {
          return null;
        }
        return {
          conversion: $convertMemoryElement,
          priority: 1,
        };
      },
    };
  }

  isTextEntity(): true {
    return true;
  }

  canInsertTextBefore(): boolean {
    return false;
  }

  canInsertTextAfter(): boolean {
    return false;
  }

  getMemoryId(): string {
    return this.__memoryId;
  }

  getMemoryTitle(): string {
    return this.__memoryTitle;
  }
}

export function $createMemoryNode(
  memory: MemorySummary,
  textContent?: string,
): MemoryNode {
  const memoryNode = new MemoryNode(memory, textContent);
  memoryNode.setMode("segmented").toggleDirectionless();
  return $applyNodeReplacement(memoryNode);
}

export function $isMemoryNode(
  node: LexicalNode | null | undefined,
): node is MemoryNode {
  return node instanceof MemoryNode;
}
