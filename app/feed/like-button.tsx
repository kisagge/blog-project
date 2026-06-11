"use client";
import { useRef, useState, useTransition } from "react";
import LoginRequiredModal from "./login-required-modal";
import { toggleLikeAction } from "./comment-actions";

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
  const [pending, start] = useTransition();
  const modal = useRef<HTMLDialogElement>(null);

  function onClick() {
    if (!canParticipate) {
      modal.current?.showModal();
      return;
    }
    setLiked((v) => !v);
    setCount((c) => c + (liked ? -1 : 1));
    start(() => toggleLikeAction(feedId, slug));
  }

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
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
