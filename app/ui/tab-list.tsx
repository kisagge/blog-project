"use client";
import { useRef, type KeyboardEvent } from "react";

export type TabSpec<K extends string> = { key: K; label: string };

// 마크다운 편집기 공용 탭(작성 / 미리보기).
export const EDITOR_TABS: TabSpec<"write" | "preview">[] = [
  { key: "write", label: "작성" },
  { key: "preview", label: "미리보기" },
];

export const tabId = (prefix: string, key: string) => `${prefix}-tab-${key}`;
export const panelId = (prefix: string, key: string) =>
  `${prefix}-panel-${key}`;

const STYLES = {
  // 밑줄형(화면 안 섹션 전환)
  underline: {
    list: "flex flex-wrap gap-1 border-b border-black/[.08] dark:border-white/[.145]",
    tab: (on: boolean) =>
      `-mb-px border-b-2 px-3 py-2 text-sm ${
        on
          ? "border-foreground font-medium"
          : "border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
      }`,
  },
  // 알약형(편집기 작성/미리보기)
  pill: {
    list: "flex gap-1 text-xs",
    tab: (on: boolean) =>
      `rounded px-2 py-1 ${on ? "bg-black/[.06] font-medium dark:bg-white/[.1]" : "text-zinc-500"}`,
  },
};

// WAI-ARIA 탭 목록: 선택된 탭만 Tab 순서(roving tabindex), 좌우 방향키(끝에서 순환)·Home/End로 이동하며 선택.
// 패널은 호출부가 panelId(prefix, key)·aria-labelledby=tabId(prefix, key)로 그린다
// (편집기처럼 폼 값 보존을 위해 패널을 숨김으로만 토글해야 하는 경우가 있어서).
export default function TabList<K extends string>({
  label,
  prefix,
  tabs,
  active,
  onChange,
  variant = "underline",
}: {
  label: string;
  prefix: string;
  tabs: TabSpec<K>[];
  active: K;
  onChange: (key: K) => void;
  variant?: keyof typeof STYLES;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const index = Math.max(
    0,
    tabs.findIndex((t) => t.key === active),
  );
  const style = STYLES[variant];

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
    onChange(tabs[next].key);
    refs.current[next]?.focus();
  }

  return (
    <div role="tablist" aria-label={label} className={style.list}>
      {tabs.map((t, i) => {
        const selected = i === index;
        return (
          <button
            key={t.key}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={tabId(prefix, t.key)}
            aria-selected={selected}
            aria-controls={panelId(prefix, t.key)}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(t.key)}
            onKeyDown={onKeyDown}
            className={style.tab(selected)}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
