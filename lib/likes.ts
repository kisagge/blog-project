import "server-only";
import { prisma } from "@/lib/prisma";

// 좋아요 토글. 결과 liked 상태 반환.
export async function toggleLike(
  feedId: string,
  userId: string,
): Promise<boolean> {
  const existing = await prisma.like.findUnique({
    where: { feedId_userId: { feedId, userId } },
    select: { id: true },
  });
  if (existing) {
    await prisma.like.delete({ where: { id: existing.id } });
    return false;
  }
  await prisma.like.create({ data: { feedId, userId } });
  return true;
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
