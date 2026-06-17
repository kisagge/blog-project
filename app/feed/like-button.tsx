"use client";
import { useEffect, useRef, useState } from "react";
import LoginRequiredModal from "./login-required-modal";
import { useFeedEvent } from "./feed-events-context";
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

  // 실시간(SSE, 피드 연결 공유): 다른 뷰어의 좋아요로 바뀐 서버 truth로 카운트 갱신.
  // 본인 클릭은 낙관적 +/−1 후 커밋→자기 에코로 같은 값에 수렴(낙관==truth라 깜빡임 없음).
  // liked(하트)는 뷰어별이라 SSE로 바꾸지 않는다(낙관 유지).
  useFeedEvent((ev) => {
    if (ev.kind === "feedLike") setCount(ev.count);
  });

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
