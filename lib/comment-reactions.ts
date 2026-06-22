import "server-only";
import { prisma } from "@/lib/prisma";
import {
  REACTION_EMOJIS,
  isReactionEmoji,
  type ReactionSummary,
} from "@/lib/reactions";

// 댓글 리액션 토글. 결과 reacted 상태 + 해당 이모지의 새 카운트 반환(실시간 브로드캐스트용).
// 좋아요 토글과 동형 — emoji 차원만 추가. 세트 외 이모지는 거부.
export async function toggleCommentReaction(
  commentId: string,
  userId: string,
  emoji: string,
): Promise<{ reacted: boolean; count: number }> {
  if (!isReactionEmoji(emoji)) throw new Error("허용되지 않은 이모지입니다.");
  // 토글+카운트를 한 트랜잭션으로 — 동시 토글 인터리빙으로 카운트가 어긋나는 것 방지(원자성).
  return prisma.$transaction(async (tx) => {
    const existing = await tx.commentReaction.findUnique({
      where: { commentId_userId_emoji: { commentId, userId, emoji } },
      select: { id: true },
    });
    if (existing) {
      await tx.commentReaction.delete({ where: { id: existing.id } });
    } else {
      await tx.commentReaction.create({ data: { commentId, userId, emoji } });
    }
    const count = await tx.commentReaction.count({
      where: { commentId, emoji },
    });
    return { reacted: !existing, count };
  });
}

// 여러 댓글의 리액션 요약: commentId → [{emoji,count,reacted}] (세트 순서, count>0만).
// getFeedComments에서 좋아요 likedIds와 동형으로 1회 집계.
export async function getReactionSummaries(
  commentIds: string[],
  viewerUserId?: string,
): Promise<Map<string, ReactionSummary[]>> {
  const result = new Map<string, ReactionSummary[]>();
  if (commentIds.length === 0) return result;

  const [grouped, mine] = await Promise.all([
    prisma.commentReaction.groupBy({
      by: ["commentId", "emoji"],
      where: { commentId: { in: commentIds } },
      _count: { _all: true },
    }),
    viewerUserId
      ? prisma.commentReaction.findMany({
          where: { userId: viewerUserId, commentId: { in: commentIds } },
          select: { commentId: true, emoji: true },
        })
      : Promise.resolve([] as { commentId: string; emoji: string }[]),
  ]);

  // commentId → emoji → count
  const counts = new Map<string, Map<string, number>>();
  for (const g of grouped) {
    let m = counts.get(g.commentId);
    if (!m) counts.set(g.commentId, (m = new Map()));
    m.set(g.emoji, g._count._all);
  }
  // commentId → Set(emoji) 내가 누른 것
  const reacted = new Map<string, Set<string>>();
  for (const r of mine) {
    let s = reacted.get(r.commentId);
    if (!s) reacted.set(r.commentId, (s = new Set()));
    s.add(r.emoji);
  }

  for (const [commentId, emojiCounts] of counts) {
    const mineSet = reacted.get(commentId);
    const summaries: ReactionSummary[] = [];
    // 고정 세트 순서로, count>0인 이모지만.
    for (const emoji of REACTION_EMOJIS) {
      const count = emojiCounts.get(emoji) ?? 0;
      if (count > 0)
        summaries.push({ emoji, count, reacted: mineSet?.has(emoji) ?? false });
    }
    if (summaries.length > 0) result.set(commentId, summaries);
  }
  return result;
}
