"use client";
import { useEffect, useState } from "react";
import {
  resolveTheme,
  THEME_ORDER,
  THEME_STORAGE_KEY,
  type ThemeChoice,
} from "@/lib/theme";

const LABEL: Record<ThemeChoice, string> = {
  light: "라이트",
  dark: "다크",
  system: "시스템",
};

function applyTheme(choice: ThemeChoice) {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.setAttribute(
    "data-theme",
    resolveTheme(choice, prefersDark),
  );
}

export default function ThemeToggle() {
  const [choice, setChoice] = useState<ThemeChoice>("system");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // localStorage는 클라이언트에서만 읽을 수 있어 마운트 후 1회 동기화한다.
    /* eslint-disable react-hooks/set-state-in-effect */
    const stored = localStorage.getItem(
      THEME_STORAGE_KEY,
    ) as ThemeChoice | null;
    if (stored && THEME_ORDER.includes(stored)) setChoice(stored);
    setMounted(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // system 선택 중엔 OS 테마 변경을 실시간 반영.
  useEffect(() => {
    if (choice !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [choice]);

  function cycle() {
    const next =
      THEME_ORDER[(THEME_ORDER.indexOf(choice) + 1) % THEME_ORDER.length];
    setChoice(next);
    localStorage.setItem(THEME_STORAGE_KEY, next);
    applyTheme(next);
  }

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={`테마: ${LABEL[choice]} (클릭하여 전환)`}
      title={`테마: ${LABEL[choice]}`}
      className="flex h-7 w-7 items-center justify-center rounded text-zinc-600 hover:bg-black/[.04] dark:text-zinc-400 dark:hover:bg-white/[.06]"
    >
      {/* 마운트 전엔 빈 자리(서버/클라이언트 불일치 방지) */}
      {mounted ? <Icon choice={choice} /> : <span className="block h-4 w-4" />}
    </button>
  );
}

function Icon({ choice }: { choice: ThemeChoice }) {
  const cls = "h-4 w-4";
  if (choice === "light") {
    return (
      <svg
        className={cls}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    );
  }
  if (choice === "dark") {
    return (
      <svg
        className={cls}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
      </svg>
    );
  }
  return (
    <svg
      className={cls}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2" y="4" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 18v3" />
    </svg>
  );
}
