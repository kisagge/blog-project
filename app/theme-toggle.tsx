"use client";
import { useEffect, useState } from "react";
import {
  normalizeTheme,
  THEME_ORDER,
  THEME_STORAGE_KEY,
  DEFAULT_THEME,
  type ThemeChoice,
} from "@/lib/theme";

const LABEL: Record<ThemeChoice, string> = {
  brand: "대표",
  light: "라이트",
  dark: "다크",
};

function applyTheme(choice: ThemeChoice) {
  document.documentElement.setAttribute("data-theme", choice);
}

export default function ThemeToggle() {
  const [choice, setChoice] = useState<ThemeChoice>(DEFAULT_THEME);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // localStorage는 클라이언트에서만 읽을 수 있어 마운트 후 1회 동기화한다.
    // 하이드레이션 과정에서 <html data-theme>가 사라질 수 있으므로 여기서 재적용해
    // 선택값을 다시 확정한다(새로고침 시 테마가 풀리던 문제 방지).
    const current = normalizeTheme(localStorage.getItem(THEME_STORAGE_KEY));
    applyTheme(current);
    /* eslint-disable react-hooks/set-state-in-effect */
    setChoice(current);
    setMounted(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

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
  // brand: favicon을 닮은 라운드 사각형.
  return (
    <svg className={cls} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" />
    </svg>
  );
}
