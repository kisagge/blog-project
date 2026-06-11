import { prisma } from "@/lib/prisma";

// 댓글 좋아요 토글. 결과 liked 상태 반환.
export async function toggleCommentLike(
  commentId: string,
  userId: string,
): Promise<boolean> {
  const existing = await prisma.commentLike.findUnique({
    where: { commentId_userId: { commentId, userId } },
    select: { id: true },
  });
  if (existing) {
    await prisma.commentLike.delete({ where: { id: existing.id } });
    return false;
  }
  await prisma.commentLike.create({ data: { commentId, userId } });
  return true;
}
