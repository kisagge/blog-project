"use client";
import { useId, useRef, useState, type KeyboardEvent } from "react";

export type TabItem = { id: string; label: string; content: React.ReactNode };

// 한 화면 안 내용 전환 탭(WAI-ARIA Tabs 패턴): 선택된 탭만 Tab 순서에 두고(roving tabindex)
// 좌우 방향키(끝에서 순환)·Home/End로 이동하면서 바로 선택.
export default function Tabs({
  tabs,
  label,
}: {
  tabs: TabItem[];
  label: string;
}) {
  const [active, setActive] = useState(tabs[0]?.id);
  const base = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const index = Math.max(
    0,
    tabs.findIndex((t) => t.id === active),
  );
  const current = tabs[index];

  function select(i: number) {
    setActive(tabs[i].id);
    refs.current[i]?.focus();
  }

  function onKeyDown(e: KeyboardEvent) {
    const last = tabs.length - 1;
    const next =
      e.key === "ArrowRight"
        ? index === last
          ? 0
          : index + 1
        : e.key === "ArrowLeft"
          ? index === 0
            ? last
            : index - 1
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? last
              : null;
    if (next === null) return;
    e.preventDefault();
    select(next);
  }

  const tabId = (id: string) => `${base}-tab-${id}`;
  const panelId = (id: string) => `${base}-panel-${id}`;

  return (
    <div>
      <div
        role="tablist"
        aria-label={label}
        className="flex flex-wrap gap-1 border-b border-black/[.08] dark:border-white/[.145]"
      >
        {tabs.map((t, i) => {
          const selected = i === index;
          return (
            <button
              key={t.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={tabId(t.id)}
              aria-selected={selected}
              aria-controls={panelId(t.id)}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(t.id)}
              onKeyDown={onKeyDown}
              className={`-mb-px border-b-2 px-3 py-2 text-sm ${
                selected
                  ? "border-foreground font-medium"
                  : "border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      {current && (
        <div
          role="tabpanel"
          id={panelId(current.id)}
          aria-labelledby={tabId(current.id)}
          tabIndex={0}
          className="mt-6 flex flex-col gap-10"
        >
          {current.content}
        </div>
      )}
    </div>
  );
}
