import "server-only";
import { prisma } from "@/lib/prisma";
import {
  checkAccess,
  listableVisibilities,
  type ViewerRole,
  type Visibility,
} from "@/lib/visibility";

// 목록 질의의 "볼 수 있는 글" 조건(Prisma where 조각). canReadFeed(아래)는 단건 판정, 이건 목록용 —
// 두 기준을 한 파일에 둔다. 관리자도 목록에선 게시·미숨김 글만(초안·숨김 검토는 관리자 화면에서).
// 작성자 범위: 관리자 글(블로그 본편, authorId null) / 회원 글(커뮤니티) / 미지정 = 전체.
export function authorScopeWhere(author?: "admin" | "member") {
  if (author === "admin") return { authorId: null };
  if (author === "member") return { authorId: { not: null } };
  return {};
}

export function visibleFeedWhere(role: ViewerRole) {
  return {
    status: "published",
    hiddenAt: null,
    visibility: { in: listableVisibilities(role) },
  } as const;
}

type GateFields = {
  visibility: string;
  status: string;
  hiddenAt: Date | null;
};

// 글 상세와 같은 기준으로 이 뷰어가 글(그리고 그 댓글·반응)에 접근할 수 있는지.
// 관리자는 전부, 그 외엔 게시·미숨김·공개 범위 통과 글만. 임시저장은 상세에서도 본문만
// 보여주고 댓글·반응이 없으므로 작성자 본인이라도 여기선 거부한다.
export function canReadFeed(feed: GateFields, role: ViewerRole): boolean {
  if (role === "admin") return true;
  return (
    feed.status === "published" &&
    !feed.hiddenAt &&
    checkAccess(feed.visibility as Visibility, role) === "ok"
  );
}

export type ReadableFeed = { id: string; slug: string };

const GATE_SELECT = {
  id: true,
  slug: true,
  visibility: true,
  status: true,
  hiddenAt: true,
} as const;

// 클라이언트가 보낸 feedId를 믿지 않고 접근 가능한 글만 돌려준다(서버 액션 인자는 임의 값일 수 있음).
// slug도 DB 값을 쓰게 해 알림 링크·리밸리데이트 경로를 클라이언트가 정하지 못하게 한다.
export async function getReadableFeed(
  feedId: string,
  role: ViewerRole,
): Promise<ReadableFeed | null> {
  if (typeof feedId !== "string" || !feedId) return null;
  const feed = await prisma.feed.findUnique({
    where: { id: feedId },
    select: GATE_SELECT,
  });
  return feed && canReadFeed(feed, role)
    ? { id: feed.id, slug: feed.slug }
    : null;
}

// 댓글이 속한 글 기준 게이트 — 댓글 단위 액션(좋아요·리액션·수정)용.
export async function getReadableCommentFeed(
  commentId: string,
  role: ViewerRole,
): Promise<ReadableFeed | null> {
  const feed = await commentFeedRow(commentId);
  return feed && canReadFeed(feed, role)
    ? { id: feed.id, slug: feed.slug }
    : null;
}

// 댓글이 실제로 속한 글(접근 판정 없음). 본인 댓글 삭제처럼 글 상태와 무관하게 허용하되
// 실시간 전파·리밸리데이트 대상은 DB 값으로 정해야 하는 경우용.
export async function findCommentFeed(
  commentId: string,
): Promise<ReadableFeed | null> {
  const feed = await commentFeedRow(commentId);
  return feed ? { id: feed.id, slug: feed.slug } : null;
}

async function commentFeedRow(commentId: string) {
  if (typeof commentId !== "string" || !commentId) return null;
  const c = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { feed: { select: GATE_SELECT } },
  });
  return c?.feed ?? null;
}
