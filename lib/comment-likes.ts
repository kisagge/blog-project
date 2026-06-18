import "server-only";
import { prisma } from "@/lib/prisma";

// 댓글 좋아요 토글. 결과 liked 상태 + 새 카운트 반환(실시간 브로드캐스트용).
export async function toggleCommentLike(
  commentId: string,
  userId: string,
): Promise<{ liked: boolean; count: number }> {
  // 토글+카운트를 한 트랜잭션으로 — 동시 토글 인터리빙으로 카운트가 어긋나는 것 방지(원자성).
  return prisma.$transaction(async (tx) => {
    const existing = await tx.commentLike.findUnique({
      where: { commentId_userId: { commentId, userId } },
      select: { id: true },
    });
    if (existing) {
      await tx.commentLike.delete({ where: { id: existing.id } });
    } else {
      await tx.commentLike.create({ data: { commentId, userId } });
    }
    const count = await tx.commentLike.count({ where: { commentId } });
    return { liked: !existing, count };
  });
}
