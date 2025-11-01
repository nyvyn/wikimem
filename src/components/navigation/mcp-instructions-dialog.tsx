"use client";

import type { JSX } from "react";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface McpInstructionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggerClassName?: string;
}

export function McpInstructionsDialog({
  open,
  onOpenChange,
  triggerClassName,
}: McpInstructionsDialogProps): JSX.Element {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <button type="button" className={triggerClassName}>
          MCP instructions
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-xl border border-white/10 bg-slate-900 p-6 text-left text-slate-100">
        <DialogHeader className="flex flex-col gap-2 text-left">
          <DialogTitle className="text-lg font-semibold text-white">
            Connect to Wikimem via MCP
          </DialogTitle>
          <DialogClose />
        </DialogHeader>
        <DialogDescription className="text-sm text-slate-200">
          Wikimem exposes a Model Context Protocol (MCP) server over STDIO. Add
          the app as a stdio endpoint to your LLM so agents can read and write
          memories.
        </DialogDescription>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-200">
          <li>
            Add Wikimem to your LLM&apos;s MCP configuration using stdio
            transport. For example:
            <pre className="mt-2 rounded-2xl border border-white/10 bg-slate-950/80 p-3 text-xs text-slate-100">
              {`{
  "mcpServers": {
    "wikimem": {
      "transport": {
        "type": "stdio",
        "command": "/Applications/Wikimem.app/Contents/MacOS/Wikimem"
      }
    }
  }
}`}
            </pre>
            Point the `command` at your installed binary, such as
            <code className="ml-2 rounded bg-slate-800 px-2 py-1 text-xs">
              ./src-tauri/target/debug/wikimem
            </code>
            during development or the packaged app on Windows/macOS.
          </li>
          <li>
            Restart or reload the LLM. Once connected it can call
            <code> list_memories</code>, <code>create_memory</code>,
            <code> update_memory</code>, <code>delete_memory</code>, and
            <code> search_memories</code>. Changes sync with the UI instantly.
          </li>
        </ol>
        <p className="text-xs text-slate-400">
          Tip: leave the terminal session open while agents stay connected so
          STDIO remains attached.
        </p>
      </DialogContent>
    </Dialog>
  );
}
