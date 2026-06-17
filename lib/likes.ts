import "server-only";
import { prisma } from "@/lib/prisma";

// 좋아요 토글. 결과 liked 상태 + 새 카운트 반환(실시간 브로드캐스트용).
export async function toggleLike(
  feedId: string,
  userId: string,
): Promise<{ liked: boolean; count: number }> {
  const existing = await prisma.like.findUnique({
    where: { feedId_userId: { feedId, userId } },
    select: { id: true },
  });
  if (existing) {
    await prisma.like.delete({ where: { id: existing.id } });
  } else {
    await prisma.like.create({ data: { feedId, userId } });
  }
  const count = await prisma.like.count({ where: { feedId } });
  return { liked: !existing, count };
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
