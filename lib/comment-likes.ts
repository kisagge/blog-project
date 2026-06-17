import "server-only";
import { prisma } from "@/lib/prisma";

// 댓글 좋아요 토글. 결과 liked 상태 + 새 카운트 반환(실시간 브로드캐스트용).
export async function toggleCommentLike(
  commentId: string,
  userId: string,
): Promise<{ liked: boolean; count: number }> {
  const existing = await prisma.commentLike.findUnique({
    where: { commentId_userId: { commentId, userId } },
    select: { id: true },
  });
  if (existing) {
    await prisma.commentLike.delete({ where: { id: existing.id } });
  } else {
    await prisma.commentLike.create({ data: { commentId, userId } });
  }
  const count = await prisma.commentLike.count({ where: { commentId } });
  return { liked: !existing, count };
}
