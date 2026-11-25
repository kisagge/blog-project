"use client";
import ReactionBar from "../reaction-bar";
import { toggleCommentReactionAction } from "./comment-actions";
import type { ReactionSummary } from "@/lib/reactions";

// 댓글 이모지 반응. 실시간 카운트는 댓글 섹션이 SSE로 받아 initialReactions로 내려준다.
export default function CommentReactions({
  commentId,
  feedId,
  slug,
  initialReactions,
  canParticipate,
}: {
  commentId: string;
  feedId: string;
  slug: string;
  initialReactions: ReactionSummary[];
  canParticipate: boolean;
}) {
  return (
    <ReactionBar
      reactions={initialReactions}
      commit={(emoji) =>
        toggleCommentReactionAction(commentId, feedId, slug, emoji)
      }
      canParticipate={canParticipate}
    />
  );
}
