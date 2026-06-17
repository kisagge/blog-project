"use client";
import { useEffect, useRef, useState } from "react";
import LoginRequiredModal from "../login-required-modal";
import { toggleCommentLikeAction } from "./comment-actions";

export default function CommentLikeButton({
  commentId,
  feedId,
  slug,
  initialCount,
  initialLiked,
  canParticipate,
}: {
  commentId: string;
  feedId: string;
  slug: string;
  initialCount: number;
  initialLiked: boolean;
  canParticipate: boolean;
}) {
  const [count, setCount] = useState(initialCount);
  const [liked, setLiked] = useState(initialLiked);
  const modal = useRef<HTMLDialogElement>(null);
  // 서버 truth(initialCount)가 SSE로 바뀌면 렌더 중 count 동기화(effect-setState 회피).
  const [syncedCount, setSyncedCount] = useState(initialCount);
  if (initialCount !== syncedCount) {
    setSyncedCount(initialCount);
    setCount(initialCount);
  }

  // 디바운스: 연타를 최종 상태 1요청으로 합침. committed=서버에 반영된 내 like 상태.
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
      // toggle은 현재 내 상태를 뒤집음 → committed와 다를 때 1회 호출이면 desired에 도달.
      void toggleCommentLikeAction(commentId, feedId, slug);
    }, 500);
  }

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        aria-pressed={liked}
        className={`inline-flex items-center gap-1 ${liked ? "text-red-600" : "hover:text-zinc-800 dark:hover:text-zinc-200"}`}
      >
        <span aria-hidden>{liked ? "♥" : "♡"}</span>
        {count > 0 && count}
      </button>
      <LoginRequiredModal ref={modal} />
    </>
  );
}
