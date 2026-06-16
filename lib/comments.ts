import "server-only";
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

export const COMMENT_PAGE_SIZE = 25;

const NODE_SELECT = {
  id: true,
  userId: true,
  content: true,
  deletedAt: true,
  createdAt: true,
  parentId: true,
  user: { select: { nickname: true } },
  _count: { select: { commentLikes: true } },
} as const;

export type CommentPage = { items: CommentNode[]; total: number };

// 상위 댓글을 sort(기본 인기순) + skip/take로 페이지네이션. 각 상위의 대댓글은 시간순 동봉.
// total은 상위 댓글 전체 수("더보기" 노출 판단용).
export async function getFeedComments(
  feedId: string,
  opts: {
    sort?: CommentSort;
    skip?: number;
    take?: number;
    viewerUserId?: string;
  } = {},
): Promise<CommentPage> {
  const {
    sort = "popular",
    skip = 0,
    take = COMMENT_PAGE_SIZE,
    viewerUserId,
  } = opts;
  const orderBy =
    sort === "popular"
      ? [
          { commentLikes: { _count: "desc" as const } },
          { createdAt: "desc" as const },
        ]
      : [{ createdAt: "desc" as const }];

  const [total, topRows] = await Promise.all([
    prisma.comment.count({ where: { feedId, parentId: null } }),
    prisma.comment.findMany({
      where: { feedId, parentId: null },
      orderBy,
      skip,
      take,
      select: NODE_SELECT,
    }),
  ]);

  const topIds = topRows.map((t) => t.id);
  const replyRows = topIds.length
    ? await prisma.comment.findMany({
        where: { parentId: { in: topIds } },
        orderBy: { createdAt: "asc" },
        select: NODE_SELECT,
      })
    : [];

  const likedIds = viewerUserId
    ? new Set(
        (
          await prisma.commentLike.findMany({
            where: {
              userId: viewerUserId,
              commentId: { in: [...topIds, ...replyRows.map((r) => r.id)] },
            },
            select: { commentId: true },
          })
        ).map((r) => r.commentId),
      )
    : new Set<string>();

  const items = topRows.map((t) => ({
    ...toNode(t, likedIds),
    replies: [] as CommentNode[],
  }));
  const byId = new Map(items.map((n) => [n.id, n]));
  for (const r of replyRows) {
    byId
      .get(r.parentId!)
      ?.replies.push({ ...toNode(r, likedIds), replies: [] });
  }
  return { items, total };
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

export type UserCommentItem = {
  id: string;
  content: string;
  createdAt: string;
  feed: { slug: string; title: string };
};

// 프로필 "최근 댓글"용: 한 회원의 댓글(삭제 제외, 최신순) + 피드 제목/슬러그.
export async function getCommentsByUser(
  userId: string,
  take = 20,
): Promise<UserCommentItem[]> {
  const rows = await prisma.comment.findMany({
    where: { userId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      content: true,
      createdAt: true,
      feed: { select: { slug: true, title: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    content: r.content,
    createdAt: r.createdAt.toISOString(),
    feed: { slug: r.feed.slug, title: r.feed.title },
  }));
}
