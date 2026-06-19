"use client";
import { useEffect, useState } from "react";

// 스크롤이 임계를 넘으면 우하단에 등장, 클릭 시 최상단으로. 안 보일 땐 렌더 안 함(포커스 제외).
const THRESHOLD = 600;

export default function BackToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > THRESHOLD);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  function toTop() {
    // JS smooth는 전역 CSS scroll-behavior override가 적용되지 않으므로 직접 분기.
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  }

  return (
    <button
      type="button"
      onClick={toTop}
      aria-label="맨 위로"
      title="맨 위로"
      className="bg-foreground text-background fixed right-6 bottom-6 z-40 flex h-10 w-10 items-center justify-center rounded-full shadow-lg transition-opacity hover:opacity-90"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M12 19V5" />
        <path d="M5 12l7-7 7 7" />
      </svg>
    </button>
  );
}
