"use client";
import { useRef, useState, useTransition } from "react";
import LoginRequiredModal from "../login-required-modal";
import { toggleCommentLikeAction } from "./comment-actions";

export default function CommentLikeButton({
  commentId,
  slug,
  initialCount,
  initialLiked,
  canParticipate,
}: {
  commentId: string;
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
    start(() => toggleCommentLikeAction(commentId, slug));
  }

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
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
