"use client";

import dynamic from "next/dynamic";

const MemoryWorkspace = dynamic(
  async () =>
    import("@/components/MemoryWorkspace").then((mod) => mod.MemoryWorkspace),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center rounded-3xl border border-white/10 bg-slate-900 text-slate-400">
        Initializing workspace…
      </div>
    ),
  },
);

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-6 py-12">
        <section className="max-w-2xl space-y-3">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            wikimem
          </span>
          <h1 className="text-4xl font-semibold text-white sm:text-5xl">
            Wiki memories for human + AI teams
          </h1>
          <p className="text-base text-slate-300">
            Capture moments as Markdown slips, edit them with a Lexical editor,
            and let MCP-connected copilots keep the stack fresh. SlipStack panes
            keep every thread visible while the Tauri backend persists the
            archive locally.
          </p>
        </section>

        <section className="flex flex-1 min-h-[480px]">
          <MemoryWorkspace />
        </section>
      </main>
      <footer className="px-6 pb-8 text-xs text-slate-500 sm:px-12">
        Built with Next.js, Tauri, and SlipStack React.
      </footer>
    </div>
  );
}
