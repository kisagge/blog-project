import "server-only";
import { prisma } from "@/lib/prisma";

// 좋아요 토글. 결과 liked 상태 + 새 카운트 반환(실시간 브로드캐스트용).
export async function toggleLike(
  feedId: string,
  userId: string,
): Promise<{ liked: boolean; count: number }> {
  // 토글+카운트를 한 트랜잭션으로 — 동시 토글이 await 사이에 인터리빙돼 카운트가
  // 어긋난 채 SSE로 브로드캐스트되는 것을 방지(원자성).
  return prisma.$transaction(async (tx) => {
    const existing = await tx.like.findUnique({
      where: { feedId_userId: { feedId, userId } },
      select: { id: true },
    });
    if (existing) {
      await tx.like.delete({ where: { id: existing.id } });
    } else {
      await tx.like.create({ data: { feedId, userId } });
    }
    const count = await tx.like.count({ where: { feedId } });
    return { liked: !existing, count };
  });
}

export async function getLikeSummary(
  feedId: string,
  userId?: string,
): Promise<{ count: number; liked: boolean }> {
  const [count, mine] = await Promise.all([
    prisma.like.count({ where: { feedId } }),
    userId
      ? prisma.like.findUnique({
          where: { feedId_userId: { feedId, userId } },
          select: { id: true },
        })
      : null,
  ]);
  return { count, liked: !!mine };
}
