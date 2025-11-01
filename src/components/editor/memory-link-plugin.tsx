import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  LexicalTypeaheadMenuPlugin,
  MenuOption,
  type MenuTextMatch,
} from "@lexical/react/LexicalTypeaheadMenuPlugin";
import type { TextNode } from "lexical";
import type { JSX } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { $createMemoryNode } from "@/components/editor/memory-node";
import { searchMemories } from "@/lib/tauri-commands";
import type { MemorySearchResult, MemorySummary } from "@/lib/types";

const PUNCTUATION =
  "\\.,\\+\\*\\?\\$\\@\\|#{}\\(\\)\\^\\-\\[\\]\\\\/!%'\"~=<>_:;";

const PUNC = PUNCTUATION;

const TRIGGER_CHARACTER = "[";
const TRIGGER_SEQUENCE = "\\[\\[";

// Chars we expect to see in a mention (non-space, non-punctuation).
const VALID_CHARS = `[^${TRIGGER_CHARACTER}${PUNC}\\s]`;

// Non-standard series of chars. Each series must be preceded and followed by
// a valid char.
const VALID_JOINS =
  "(?:" +
  "\\.[ |$]|" + // E.g. "r. " in "Mr. Smith"
  " |" + // E.g. " " in "Josh Duck"
  "[" +
  PUNC +
  "]|" + // E.g. "-' in "Salier-Hellendag"
  ")";

const LENGTH_LIMIT = 75;

const memoryLinkRegex = new RegExp(
  "(^|\\s|\\()(" +
    TRIGGER_SEQUENCE +
    "((?:" +
    VALID_CHARS +
    VALID_JOINS +
    "){0," +
    LENGTH_LIMIT +
    "})" +
    ")$",
);

// 50 is the longest alias length limit.
const ALIAS_LENGTH_LIMIT = 50;

// Regex used to match alias.
const memoryLinkRegexAliasRegex = new RegExp(
  "(^|\\s|\\()(" +
    TRIGGER_SEQUENCE +
    "((?:" +
    VALID_CHARS +
    "){0," +
    ALIAS_LENGTH_LIMIT +
    "})" +
    ")$",
);

// At most, 5 suggestions are shown in the popup.
const SUGGESTION_LIST_LENGTH_LIMIT = 5;

const memorySearchCache = new Map<string, MemorySearchResult[] | null>();

function useMemoryLookupService(titleQuery: string | null) {
  const [results, setResults] = useState<MemorySearchResult[]>([]);

  useEffect(() => {
    const trimmed = titleQuery?.trim() ?? "";

    if (!trimmed) {
      setResults([]);
      return;
    }

    const cachedResults = memorySearchCache.get(trimmed);

    if (cachedResults === null) {
      return;
    } else if (cachedResults !== undefined) {
      setResults(cachedResults);
      return;
    }

    memorySearchCache.set(trimmed, null);
    setResults([]);
    let isActive = true;

    searchMemories(trimmed)
      .then((newResults) => {
        if (!isActive) {
          return;
        }
        memorySearchCache.set(trimmed, newResults);
        setResults(newResults);
      })
      .catch(() => {
        if (!isActive) {
          return;
        }
        memorySearchCache.set(trimmed, []);
        setResults([]);
      });

    return () => {
      isActive = false;
    };
  }, [titleQuery]);

  return results;
}

function checkForMemoryLinkMatch(
  text: string,
  minMatchLength: number,
): MenuTextMatch | null {
  let match = memoryLinkRegex.exec(text);

  if (match === null) {
    match = memoryLinkRegexAliasRegex.exec(text);
  }
  if (match !== null) {
    const maybeLeadingWhitespace = match[1];

    const matchingString = match[3];
    if (matchingString.length >= minMatchLength) {
      return {
        leadOffset: match.index + maybeLeadingWhitespace.length,
        matchingString,
        replaceableString: match[2],
      };
    }
  }
  return null;
}

function getPossibleQueryMatch(text: string): MenuTextMatch | null {
  return checkForMemoryLinkMatch(text, 0);
}

class MemoryTypeaheadOption extends MenuOption {
  memory: MemorySearchResult;

  constructor(memory: MemorySearchResult) {
    super(memory.id);
    this.memory = memory;
  }
}

function MemoryTypeaheadMenuItem({
  index,
  isSelected,
  onClick,
  onKeyDown,
  onMouseEnter,
  option,
}: {
  index: number;
  isSelected: boolean;
  onClick: () => void;
  onKeyDown: () => void;
  onMouseEnter: () => void;
  option: MemoryTypeaheadOption;
}) {
  let className =
    "flex w-full items-start gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 focus:bg-slate-100 focus:outline-none";
  if (isSelected) {
    className += " bg-slate-100";
  }
  return (
    <button
      tabIndex={-1}
      className={className}
      ref={option.setRefElement}
      role="option"
      type="button"
      aria-selected={isSelected}
      id={`typeahead-item-${index}`}
      onMouseEnter={onMouseEnter}
      onClick={onClick}
      onKeyDown={onKeyDown}
    >
      <span className="flex-1">
        <span className="block truncate font-medium text-slate-900">
          {option.memory.title}
        </span>
        {option.memory.snippet ? (
          <span className="block truncate text-xs text-slate-400">
            {option.memory.snippet}
          </span>
        ) : null}
      </span>
    </button>
  );
}

export interface MemoryLinkPluginProps {
  onMemorySelected?: (memory: MemorySummary) => void;
}

export function MemoryLinkPlugin({
  onMemorySelected,
}: MemoryLinkPluginProps): JSX.Element | null {
  const [editor] = useLexicalComposerContext();

  const [queryString, setQueryString] = useState<string | null>(null);

  const results = useMemoryLookupService(queryString);

  const options = useMemo(
    () =>
      results
        .slice(0, SUGGESTION_LIST_LENGTH_LIMIT)
        .map((result) => new MemoryTypeaheadOption(result)),
    [results],
  );

  const onSelectOption = useCallback(
    (
      selectedOption: MemoryTypeaheadOption,
      nodeToReplace: TextNode | null,
      closeMenu: () => void,
    ) => {
      const memory = selectedOption.memory;
      const summary: MemorySummary = {
        id: memory.id,
        title: memory.title,
        updatedAt: memory.updatedAt,
      };
      editor.update(() => {
        const memoryNode = $createMemoryNode(summary, summary.title);
        if (nodeToReplace) {
          nodeToReplace.replace(memoryNode);
        }
        memoryNode.select();
        closeMenu();
      });
      onMemorySelected?.(summary);
    },
    [editor, onMemorySelected],
  );

  const checkForMemoryMatch = useCallback(
    (text: string) => getPossibleQueryMatch(text),
    [],
  );

  return (
    <LexicalTypeaheadMenuPlugin<MemoryTypeaheadOption>
      onQueryChange={setQueryString}
      onSelectOption={onSelectOption}
      triggerFn={checkForMemoryMatch}
      options={options}
      menuRenderFn={(
        anchorElementRef,
        { selectedIndex, selectOptionAndCleanUp, setHighlightedIndex },
      ) =>
        anchorElementRef.current && results.length
          ? createPortal(
              <div className="relative z-50 min-w-48 overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg ring-1 ring-black/5">
                <ul className="flex max-h-60 flex-col overflow-auto py-1">
                  {options.map((option, i: number) => (
                    <li key={option.key}>
                      <MemoryTypeaheadMenuItem
                        index={i}
                        isSelected={selectedIndex === i}
                        onClick={() => {
                          setHighlightedIndex(i);
                          selectOptionAndCleanUp(option);
                        }}
                        onKeyDown={() => {
                          setHighlightedIndex(i);
                          selectOptionAndCleanUp(option);
                        }}
                        onMouseEnter={() => {
                          setHighlightedIndex(i);
                        }}
                        option={option}
                      />
                    </li>
                  ))}
                </ul>
              </div>,
              anchorElementRef.current,
            )
          : null
      }
    />
  );
}
