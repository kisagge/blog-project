"use client";
import { useState } from "react";
import { useLoginPrompt } from "../login-prompt";
import { useOptimisticToggle } from "@/app/ui/use-optimistic-toggle";
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
  const promptLogin = useLoginPrompt();
  const [count, setCount] = useState(initialCount);
  // 서버 truth(initialCount)가 SSE로 바뀌면 렌더 중 count 동기화(effect-setState 회피).
  const [syncedCount, setSyncedCount] = useState(initialCount);
  if (initialCount !== syncedCount) {
    setSyncedCount(initialCount);
    setCount(initialCount);
  }
  const like = useOptimisticToggle(
    initialLiked,
    () => toggleCommentLikeAction(commentId, feedId, slug),
    (failed) => setCount((c) => c + (failed ? -1 : 1)),
  );

  function onClick() {
    if (!canParticipate) return promptLogin();
    const next = like.toggle();
    setCount((c) => c + (next ? 1 : -1));
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={like.on}
      className={`inline-flex items-center gap-1 ${like.on ? "text-red-600 dark:text-red-400" : "hover:text-zinc-800 dark:hover:text-zinc-200"}`}
    >
      <span aria-hidden>{like.on ? "♥" : "♡"}</span>
      {count > 0 && count}
    </button>
  );
}
