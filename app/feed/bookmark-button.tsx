"use client";
import { useEffect, useRef, useState } from "react";
import LoginRequiredModal from "./login-required-modal";
import { toggleBookmarkAction } from "./bookmark-actions";

// 글 저장(북마크) 토글 버튼. 좋아요 버튼과 동형이되 개인용이라 공개 카운트·실시간(SSE) 없음.
export default function BookmarkButton({
  feedId,
  slug,
  initialBookmarked,
  canParticipate,
}: {
  feedId: string;
  slug: string;
  initialBookmarked: boolean;
  canParticipate: boolean;
}) {
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const modal = useRef<HTMLDialogElement>(null);

  // 디바운스: 연타를 최종 상태 1요청으로 합침(toggle은 현재 상태를 뒤집음).
  const committed = useRef(initialBookmarked);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function onClick() {
    if (!canParticipate) {
      modal.current?.showModal();
      return;
    }
    const next = !bookmarked;
    setBookmarked(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (next === committed.current) return; // 짝수 연타 → 호출 없음
      committed.current = next;
      void toggleBookmarkAction(feedId, slug);
    }, 500);
  }

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        aria-pressed={bookmarked}
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm ${bookmarked ? "border-amber-300 text-amber-600" : "border-black/15 text-zinc-600 dark:border-white/20 dark:text-zinc-300"}`}
      >
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill={bookmarked ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        >
          <path d="M6 4h12a1 1 0 0 1 1 1v15l-7-4-7 4V5a1 1 0 0 1 1-1z" />
        </svg>
        {bookmarked ? "저장됨" : "저장"}
      </button>
      <LoginRequiredModal ref={modal} />
    </>
  );
}
