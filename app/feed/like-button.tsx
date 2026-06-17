"use client";
import { useEffect, useRef, useState } from "react";
import LoginRequiredModal from "./login-required-modal";
import { toggleLikeAction } from "./comments/comment-actions";

export default function LikeButton({
  feedId,
  slug,
  initialCount,
  initialLiked,
  canParticipate,
}: {
  feedId: string;
  slug: string;
  initialCount: number;
  initialLiked: boolean;
  canParticipate: boolean;
}) {
  const [count, setCount] = useState(initialCount);
  const [liked, setLiked] = useState(initialLiked);
  const modal = useRef<HTMLDialogElement>(null);

  // 디바운스: 연타를 최종 상태 1요청으로 합침(toggle은 현재 상태를 뒤집음).
  const committed = useRef(initialLiked);
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
    const next = !liked;
    setLiked(next);
    setCount((c) => c + (next ? 1 : -1));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (next === committed.current) return; // 짝수 연타 → 호출 없음
      committed.current = next;
      void toggleLikeAction(feedId, slug);
    }, 500);
  }

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        aria-pressed={liked}
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm ${liked ? "border-red-300 text-red-600" : "border-black/15 text-zinc-600 dark:border-white/20 dark:text-zinc-300"}`}
      >
        <span aria-hidden>{liked ? "♥" : "♡"}</span>
        좋아요 {count}
      </button>
      <LoginRequiredModal ref={modal} />
    </>
  );
}
