"use client";
import { useState } from "react";
import { useLoginPrompt } from "./login-prompt";
import { useFeedEvent } from "./feed-events-context";
import { useOptimisticToggle } from "@/app/ui/use-optimistic-toggle";
import {
  getLikeSummaryAction,
  toggleLikeAction,
} from "./comments/comment-actions";

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
  const promptLogin = useLoginPrompt();
  const [count, setCount] = useState(initialCount);
  const like = useOptimisticToggle(
    initialLiked,
    () => toggleLikeAction(feedId, slug),
    (failed) => setCount((c) => c + (failed ? -1 : 1)), // 실패 → 카운트 되돌림
  );

  // 실시간(SSE, 피드 연결 공유): 다른 뷰어의 좋아요로 바뀐 서버 truth로 카운트 갱신.
  // 본인 클릭은 낙관적 +/−1 후 커밋→자기 에코로 같은 값에 수렴(낙관==truth라 깜빡임 없음).
  // liked(하트)는 뷰어별이라 SSE로 바꾸지 않는다(낙관 유지).
  // 재접속: 끊긴 동안의 변화를 서버 truth로 재동기화. 단 토글 대기 중이면 건너뜀 —
  // 그 상태는 사용자 의도가 소유하고, 커밋+자기 에코(feedLike)로 카운트가 수렴한다.
  useFeedEvent((ev) => {
    if (ev.kind === "feedLike") return setCount(ev.count);
    if (ev.kind === "resync" && !like.pending()) {
      void getLikeSummaryAction(feedId).then((s) => {
        setCount(s.count);
        like.reset(s.liked);
      });
    }
  });

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
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm ${like.on ? "border-red-300 text-red-600 dark:text-red-400" : "border-black/15 text-zinc-600 dark:border-white/20 dark:text-zinc-300"}`}
    >
      <span aria-hidden>{like.on ? "♥" : "♡"}</span>
      좋아요 {count}
    </button>
  );
}
