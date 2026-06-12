"use client";
import { useState } from "react";

export type TabItem = { id: string; label: string; content: React.ReactNode };

export default function Tabs({ tabs }: { tabs: TabItem[] }) {
  const [active, setActive] = useState(tabs[0]?.id);
  const current = tabs.find((t) => t.id === active) ?? tabs[0];
  return (
    <div>
      <div className="flex flex-wrap gap-1 border-b border-black/[.08] dark:border-white/[.145]">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActive(t.id)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${
              t.id === active
                ? "border-foreground font-medium"
                : "border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="mt-6 flex flex-col gap-10">{current?.content}</div>
    </div>
  );
}
