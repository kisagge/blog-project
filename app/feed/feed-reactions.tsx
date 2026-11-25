"use client";
import { useState } from "react";
import ReactionBar from "./reaction-bar";
import { useFeedEvent } from "./feed-events-context";
import {
  getFeedReactionSummaryAction,
  toggleFeedReactionAction,
} from "./comments/comment-actions";
import type { ReactionSummary } from "@/lib/reactions";

// 글(피드) 이모지 반응. 글 SSE 연결(FeedEventsProvider)을 공유해 다른 뷰어의 반응 수를 반영하고,
// 재접속 시 서버 truth로 재동기화(내 반응은 대기 중인 토글이 없을 때만 — ReactionBar가 판단).
export default function FeedReactions({
  feedId,
  slug,
  initialReactions,
  canParticipate,
}: {
  feedId: string;
  slug: string;
  initialReactions: ReactionSummary[];
  canParticipate: boolean;
}) {
  const [reactions, setReactions] = useState(initialReactions);
  const [resyncToken, setResyncToken] = useState(0);

  useFeedEvent((ev) => {
    if (ev.kind === "feedReaction") {
      setReactions((rs) => {
        const others = rs.filter((r) => r.emoji !== ev.emoji);
        const mine = rs.find((r) => r.emoji === ev.emoji);
        return [
          ...others,
          { emoji: ev.emoji, count: ev.count, reacted: mine?.reacted ?? false },
        ];
      });
      return;
    }
    if (ev.kind === "resync") {
      void getFeedReactionSummaryAction(feedId).then((rs) => {
        setReactions(rs);
        setResyncToken((t) => t + 1);
      });
    }
  });

  return (
    <ReactionBar
      reactions={reactions}
      commit={(emoji) => toggleFeedReactionAction(feedId, slug, emoji)}
      canParticipate={canParticipate}
      resyncToken={resyncToken}
    />
  );
}
