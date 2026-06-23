import "server-only";
import { prisma } from "@/lib/prisma";
import {
  REACTION_EMOJIS,
  isReactionEmoji,
  type ReactionSummary,
} from "@/lib/reactions";

// 글(피드) 리액션 토글. 결과 reacted 상태 + 해당 이모지의 새 카운트 반환(실시간 브로드캐스트용).
// 좋아요 토글과 동형 — emoji 차원만 추가. 세트 외 이모지는 거부.
export async function toggleFeedReaction(
  feedId: string,
  userId: string,
  emoji: string,
): Promise<{ reacted: boolean; count: number }> {
  if (!isReactionEmoji(emoji)) throw new Error("허용되지 않은 이모지입니다.");
  // 토글+카운트를 한 트랜잭션으로 — 동시 토글 인터리빙으로 카운트가 어긋나는 것 방지(원자성).
  return prisma.$transaction(async (tx) => {
    const existing = await tx.feedReaction.findUnique({
      where: { feedId_userId_emoji: { feedId, userId, emoji } },
      select: { id: true },
    });
    if (existing) {
      await tx.feedReaction.delete({ where: { id: existing.id } });
    } else {
      await tx.feedReaction.create({ data: { feedId, userId, emoji } });
    }
    const count = await tx.feedReaction.count({ where: { feedId, emoji } });
    return { reacted: !existing, count };
  });
}

// 한 글의 리액션 요약: [{emoji,count,reacted}] (고정 세트 순서, count>0만).
// 글 좋아요 getLikeSummary와 동형 — emoji별 집계 + 내 반응 플래그.
export async function getFeedReactionSummary(
  feedId: string,
  viewerUserId?: string,
): Promise<ReactionSummary[]> {
  const [grouped, mine] = await Promise.all([
    prisma.feedReaction.groupBy({
      by: ["emoji"],
      where: { feedId },
      _count: { _all: true },
    }),
    viewerUserId
      ? prisma.feedReaction.findMany({
          where: { feedId, userId: viewerUserId },
          select: { emoji: true },
        })
      : Promise.resolve([] as { emoji: string }[]),
  ]);

  const counts = new Map(grouped.map((g) => [g.emoji, g._count._all]));
  const mineSet = new Set(mine.map((r) => r.emoji));

  const summaries: ReactionSummary[] = [];
  for (const emoji of REACTION_EMOJIS) {
    const count = counts.get(emoji) ?? 0;
    if (count > 0)
      summaries.push({ emoji, count, reacted: mineSet.has(emoji) });
  }
  return summaries;
}
