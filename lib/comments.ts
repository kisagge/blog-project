import { prisma } from "@/lib/prisma";
import { CommentSchema } from "@/lib/validation";

type AddInput = {
  feedId: string;
  userId: string;
  content: string;
  parentId?: string | null;
};
type AddResult = { ok: true; id: string } | { ok: false; error: string };

export async function addComment(input: AddInput): Promise<AddResult> {
  const parsed = CommentSchema.safeParse({ content: input.content });
  if (!parsed.success)
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "내용을 확인하세요.",
    };

  if (input.parentId) {
    const parent = await prisma.comment.findUnique({
      where: { id: input.parentId },
      select: { feedId: true, parentId: true },
    });
    if (!parent || parent.feedId !== input.feedId)
      return { ok: false, error: "원댓글을 찾을 수 없습니다." };
    if (parent.parentId)
      return { ok: false, error: "대댓글에는 답글을 달 수 없습니다." };
  }

  const c = await prisma.comment.create({
    data: {
      feedId: input.feedId,
      userId: input.userId,
      content: parsed.data.content,
      parentId: input.parentId ?? null,
    },
    select: { id: true },
  });
  return { ok: true, id: c.id };
}

export type CommentSort = "popular" | "newest";

export type CommentNode = {
  id: string;
  nickname: string;
  userId: string;
  content: string;
  deleted: boolean;
  createdAt: string;
  likeCount: number;
  liked: boolean;
  replies: CommentNode[];
};

function toNode(
  c: {
    id: string;
    userId: string;
    content: string;
    deletedAt: Date | null;
    createdAt: Date;
    user: { nickname: string };
    _count: { commentLikes: number };
  },
  likedIds: Set<string>,
): Omit<CommentNode, "replies"> {
  const deleted = c.deletedAt !== null;
  return {
    id: c.id,
    userId: c.userId,
    nickname: c.user.nickname,
    content: deleted ? "" : c.content,
    deleted,
    createdAt: c.createdAt.toISOString(),
    likeCount: c._count.commentLikes,
    liked: likedIds.has(c.id),
  };
}

// 댓글 트리. 상위 댓글은 sort(기본 인기순), 대댓글은 항상 시간순(정렬 영향 없음).
export async function getFeedComments(
  feedId: string,
  opts: { sort?: CommentSort; viewerUserId?: string } = {},
): Promise<CommentNode[]> {
  const sort = opts.sort ?? "popular";
  const rows = await prisma.comment.findMany({
    where: { feedId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      userId: true,
      content: true,
      deletedAt: true,
      createdAt: true,
      parentId: true,
      user: { select: { nickname: true } },
      _count: { select: { commentLikes: true } },
    },
  });
  const likedIds = opts.viewerUserId
    ? new Set(
        (
          await prisma.commentLike.findMany({
            where: { userId: opts.viewerUserId, comment: { feedId } },
            select: { commentId: true },
          })
        ).map((r) => r.commentId),
      )
    : new Set<string>();

  const tops = rows
    .filter((r) => r.parentId === null)
    .map((r) => ({ ...toNode(r, likedIds), replies: [] as CommentNode[] }));
  const byId = new Map(tops.map((t) => [t.id, t]));
  for (const r of rows) {
    if (r.parentId && byId.has(r.parentId))
      byId
        .get(r.parentId)!
        .replies.push({ ...toNode(r, likedIds), replies: [] });
  }
  // 대댓글은 시간순(rows가 asc라 push 순서 유지). 상위만 정렬.
  tops.sort((a, b) => {
    if (sort === "popular" && a.likeCount !== b.likeCount)
      return b.likeCount - a.likeCount;
    return a.createdAt < b.createdAt ? 1 : -1; // 동점/최신순: 최신 먼저
  });
  return tops;
}

type DelResult = { ok: true } | { ok: false; error: string };

export async function deleteComment(
  id: string,
  actorUserId: string,
  isAdmin = false,
): Promise<DelResult> {
  const c = await prisma.comment.findUnique({
    where: { id },
    select: { userId: true, _count: { select: { replies: true } } },
  });
  if (!c) return { ok: false, error: "댓글을 찾을 수 없습니다." };
  if (!isAdmin && c.userId !== actorUserId)
    return { ok: false, error: "삭제 권한이 없습니다." };
  if (c._count.replies > 0) {
    await prisma.comment.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  } else {
    await prisma.comment.delete({ where: { id } });
  }
  return { ok: true };
}
