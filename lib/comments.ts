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
  authorRole: "member" | "admin"; // 회원 작성자만 프로필 링크 노출용
  content: string;
  deleted: boolean;
  hidden: boolean; // 신고로 가려짐(모더레이션). content는 비움.
  edited: boolean; // 작성자가 수정함("(수정됨)" 표시).
  createdAt: string;
  likeCount: number;
  liked: boolean;
  replies: CommentNode[];
};

// 실시간(SSE) 댓글 이벤트 — 서버 액션이 publish, 클라이언트가 트리에 병합.
export type CommentEvent =
  | { kind: "created"; parentId: string | null; node: CommentNode }
  | { kind: "edited"; id: string; content: string }
  | { kind: "likeCount"; id: string; count: number }
  | { kind: "deleted"; id: string };

function toNode(
  c: {
    id: string;
    userId: string;
    content: string;
    deletedAt: Date | null;
    hiddenAt: Date | null;
    editedAt: Date | null;
    createdAt: Date;
    user: { nickname: string; role: string };
    _count: { commentLikes: number };
  },
  likedIds: Set<string>,
): Omit<CommentNode, "replies"> {
  const deleted = c.deletedAt !== null;
  const hidden = c.hiddenAt !== null;
  return {
    id: c.id,
    userId: c.userId,
    nickname: c.user.nickname,
    authorRole: c.user.role === "admin" ? "admin" : "member",
    content: deleted || hidden ? "" : c.content,
    deleted,
    hidden,
    edited: c.editedAt !== null,
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
  hiddenAt: true,
  editedAt: true,
  createdAt: true,
  parentId: true,
  user: { select: { nickname: true, role: true } },
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
          // 소프트 삭제된 댓글("삭제된 댓글")은 과거 좋아요로 상위에 뜨지 않도록
          // 미삭제(null)를 먼저, 삭제(timestamp)를 하단으로.
          { deletedAt: { sort: "asc" as const, nulls: "first" as const } },
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

type EditResult = { ok: true; content: string } | { ok: false; error: string };

// 작성자 본인이 살아있는(미삭제·미숨김) 댓글 본문을 수정. editedAt 기록("(수정됨)" 표시).
export async function editComment(
  id: string,
  actorUserId: string,
  content: string,
): Promise<EditResult> {
  const parsed = CommentSchema.safeParse({ content });
  if (!parsed.success)
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "내용을 확인하세요.",
    };
  const c = await prisma.comment.findUnique({
    where: { id },
    select: { userId: true, deletedAt: true, hiddenAt: true },
  });
  if (!c) return { ok: false, error: "댓글을 찾을 수 없습니다." };
  if (c.deletedAt || c.hiddenAt)
    return { ok: false, error: "수정할 수 없는 댓글입니다." };
  if (c.userId !== actorUserId)
    return { ok: false, error: "수정 권한이 없습니다." };
  await prisma.comment.update({
    where: { id },
    data: { content: parsed.data.content, editedAt: new Date() },
  });
  return { ok: true, content: parsed.data.content };
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
    // 피드가 게시·비공개아님일 때만(비공개/초안 피드 제목·slug 노출 방지).
    where: {
      userId,
      deletedAt: null,
      hiddenAt: null,
      feed: { status: "published", visibility: { not: "private" } },
    },
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
