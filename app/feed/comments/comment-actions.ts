"use server";
import { LOGIN_REQUIRED } from "@/lib/form-state";
import { revalidatePath } from "next/cache";
import { getCommentActor } from "@/lib/comment-actor";
import { getSession, getViewerRole } from "@/lib/dal";
import {
  getReadableFeed,
  getReadableCommentFeed,
  findCommentFeed,
} from "@/lib/feed-access";
import { allowAction, TOO_MANY_REQUESTS } from "@/lib/rate-limit";
import {
  addComment,
  deleteComment,
  editComment,
  getFeedComments,
  COMMENT_PAGE_SIZE,
  type CommentNode,
  type CommentPage,
  type CommentSort,
} from "@/lib/comments";
import { toggleLike, getLikeSummary } from "@/lib/likes";
import { toggleCommentLike } from "@/lib/comment-likes";
import { toggleCommentReaction } from "@/lib/comment-reactions";
import {
  toggleFeedReaction,
  getFeedReactionSummary,
} from "@/lib/feed-reactions";
import { isReactionEmoji, type ReactionSummary } from "@/lib/reactions";
import {
  notifyCommentReply,
  notifyFeedComment,
  notifyCommentMention,
} from "@/lib/notifications";
import { swallow } from "@/lib/log";
import {
  publishComment,
  publishFeedLike,
  publishFeedReaction,
} from "@/lib/events";

// 서버 액션 인자는 클라이언트가 임의로 보낼 수 있다 → 모든 액션이 글 상세와 같은 접근 게이트
// (lib/feed-access)를 통과한 뒤 **DB의 feedId·slug**만 사용한다. 클라이언트의 feedId·slug 인자는
// 호출 호환을 위해 시그니처에 남겨두지만 대상 판별·알림 링크·전파에는 쓰지 않는다.

export type AddCommentResult = { error: string } | { comment: CommentNode };

const NOT_FOUND = "글을 찾을 수 없습니다.";
const EMPTY_PAGE: CommentPage = { items: [], total: 0 };
const MAX_RESYNC = 200; // 재동기화 1회 최대 상위 댓글 수(대량 조회 남용 방지)

function revalidate(slug: string) {
  revalidatePath(`/feed/${slug}`);
}

const normSort = (s: unknown): CommentSort =>
  s === "newest" ? "newest" : "popular";

function nonNegInt(n: unknown): number {
  const v = Math.floor(Number(n));
  return Number.isFinite(v) && v > 0 ? v : 0;
}

export async function addCommentAction(
  args: { feedId: string; slug: string; parentId?: string },
  _prev: AddCommentResult | undefined,
  formData: FormData,
): Promise<AddCommentResult | undefined> {
  const actor = await getCommentActor();
  if (!actor) return { error: LOGIN_REQUIRED };
  const feed = await getReadableFeed(args.feedId, actor.role);
  if (!feed) return { error: NOT_FOUND };
  if (!allowAction("comment", actor.userId))
    return { error: TOO_MANY_REQUESTS };
  const content = String(formData.get("content") ?? "");
  const res = await addComment({
    feedId: feed.id,
    userId: actor.userId,
    content,
    parentId: args.parentId ?? null,
  });
  if (!res.ok) return { error: res.error };
  // 알림(fire-and-forget): 답글 → 원댓글 작성자, 최상위 댓글 → 관리자(글 주인).
  if (args.parentId) {
    void notifyCommentReply({
      parentId: args.parentId,
      commentId: res.id,
      slug: feed.slug,
      fromUserId: actor.userId,
      fromNickname: actor.nickname,
      content,
    }).catch(swallow("notify:comment-reply"));
  } else {
    void notifyFeedComment({
      feedId: feed.id,
      commentId: res.id,
      slug: feed.slug,
      fromUserId: actor.userId,
      fromNickname: actor.nickname,
    }).catch(swallow("notify:feed-comment"));
  }
  // @멘션 알림(답글/최상위 무관) — 본문에 멘션된 승인 회원에게.
  // 저장본과 동일하게 trim한 본문으로 멘션 판정.
  void notifyCommentMention({
    content: content.trim(),
    commentId: res.id,
    slug: feed.slug,
    fromUserId: actor.userId,
    fromNickname: actor.nickname,
  }).catch(swallow("notify:comment-mention"));
  revalidate(feed.slug);
  const node: CommentNode = {
    id: res.id,
    userId: actor.userId,
    nickname: actor.nickname,
    authorRole: actor.role,
    content: content.trim(),
    deleted: false,
    hidden: false,
    edited: false,
    createdAt: new Date().toISOString(),
    likeCount: 0,
    liked: false,
    reactions: [],
    replies: [],
  };
  // 실시간(SSE): 같은 글을 보는 다른 뷰어에게 새 댓글 전파(본인은 dedup으로 흡수).
  // liked:false·likeCount:0은 갓 생성된 댓글이라 모든 뷰어에 정확.
  publishComment(feed.id, {
    kind: "created",
    parentId: args.parentId ?? null,
    node,
  });
  return { comment: node };
}

// 읽기 액션 공용: 비로그인도 호출하므로 액터가 없으면 세션 기준 뷰어 권한으로 게이트.
async function readContext(feedId: string) {
  const actor = await getCommentActor();
  const feed = await getReadableFeed(
    feedId,
    actor?.role ?? (await getViewerRole()),
  );
  return { actor, feed };
}

export async function loadMoreCommentsAction(
  feedId: string,
  sort: CommentSort,
  skip: number,
): Promise<CommentPage> {
  const { actor, feed } = await readContext(feedId);
  if (!feed) return EMPTY_PAGE;
  return getFeedComments(feed.id, {
    sort: normSort(sort),
    skip: nonNegInt(skip),
    viewerUserId: actor?.userId,
  });
}

// SSE 재접속 재동기화용: 현재 로드량(loaded)만큼 처음부터 다시 조회해 트리 교체.
// 최소 한 페이지는 보장(끊긴 동안 첫 댓글이 생겼을 수도 있어 loaded=0이어도 조회).
export async function resyncCommentsAction(
  feedId: string,
  sort: CommentSort,
  loaded: number,
): Promise<CommentPage> {
  const { actor, feed } = await readContext(feedId);
  if (!feed) return EMPTY_PAGE;
  return getFeedComments(feed.id, {
    sort: normSort(sort),
    skip: 0,
    take: Math.min(Math.max(nonNegInt(loaded), COMMENT_PAGE_SIZE), MAX_RESYNC),
    viewerUserId: actor?.userId,
  });
}

// SSE 재접속 재동기화용: 좋아요 수+본인 누름 여부를 서버 truth로 재조회.
export async function getLikeSummaryAction(
  feedId: string,
): Promise<{ count: number; liked: boolean }> {
  const { actor, feed } = await readContext(feedId);
  if (!feed) return { count: 0, liked: false };
  return getLikeSummary(feed.id, actor?.userId);
}

// 본인 댓글 삭제는 글이 나중에 숨김·비공개가 돼도 허용(권한은 deleteComment가 작성자·관리자로 판정).
// 전파·리밸리데이트 대상만 댓글이 실제로 속한 글로.
export async function deleteCommentAction(
  commentId: string,
  _feedId: string,
  _slug: string,
) {
  const actor = await getCommentActor();
  if (!actor) return;
  const feed = await findCommentFeed(commentId);
  if (!feed) return;
  const session = await getSession();
  const res = await deleteComment(
    commentId,
    actor.userId,
    session?.role === "admin",
  );
  if (!res.ok) return; // 권한 없음 등 — 전파/리밸리데이트 생략
  revalidate(feed.slug);
  publishComment(feed.id, { kind: "deleted", id: commentId }); // 실시간 전파
}

type EditCommentResult = { ok: true } | { error: string };

export async function editCommentAction(
  commentId: string,
  _feedId: string,
  _slug: string,
  content: string,
): Promise<EditCommentResult> {
  const actor = await getCommentActor();
  if (!actor) return { error: LOGIN_REQUIRED };
  const feed = await getReadableCommentFeed(commentId, actor.role);
  if (!feed) return { error: NOT_FOUND };
  const res = await editComment(commentId, actor.userId, content);
  if (!res.ok) return { error: res.error };
  revalidate(feed.slug);
  publishComment(feed.id, {
    kind: "edited",
    id: commentId,
    content: res.content,
  });
  return { ok: true };
}

export async function toggleLikeAction(feedId: string, _slug: string) {
  const actor = await getCommentActor();
  if (!actor) return;
  const feed = await getReadableFeed(feedId, actor.role);
  if (!feed) return;
  const { count } = await toggleLike(feed.id, actor.userId);
  revalidate(feed.slug);
  // 실시간: 같은 글을 보는 다른 뷰어에게 새 좋아요 수 전파(본인 liked는 낙관 유지).
  publishFeedLike(feed.id, count);
}

export async function toggleFeedReactionAction(
  feedId: string,
  _slug: string,
  emoji: string,
) {
  const actor = await getCommentActor();
  if (!actor) return;
  if (!isReactionEmoji(emoji)) return;
  const feed = await getReadableFeed(feedId, actor.role);
  if (!feed) return;
  const { count } = await toggleFeedReaction(feed.id, actor.userId, emoji);
  revalidate(feed.slug);
  // 실시간: 같은 글을 보는 다른 뷰어에게 해당 이모지 새 카운트 전파(본인 reacted는 낙관 유지).
  publishFeedReaction(feed.id, emoji, count);
}

// SSE 재접속 재동기화용: 글 리액션 요약(이모지별 수+본인 누름)을 서버 truth로 재조회.
export async function getFeedReactionSummaryAction(
  feedId: string,
): Promise<ReactionSummary[]> {
  const { actor, feed } = await readContext(feedId);
  if (!feed) return [];
  return getFeedReactionSummary(feed.id, actor?.userId);
}

export async function toggleCommentLikeAction(
  commentId: string,
  _feedId: string,
  _slug: string,
) {
  const actor = await getCommentActor();
  if (!actor) return;
  const feed = await getReadableCommentFeed(commentId, actor.role);
  if (!feed) return;
  const { count } = await toggleCommentLike(commentId, actor.userId);
  revalidate(feed.slug);
  // 실시간: 같은 글을 보는 다른 뷰어에게 새 좋아요 수 전파(본인 liked는 낙관 유지).
  publishComment(feed.id, { kind: "likeCount", id: commentId, count });
}

export async function toggleCommentReactionAction(
  commentId: string,
  _feedId: string,
  _slug: string,
  emoji: string,
) {
  const actor = await getCommentActor();
  if (!actor) return;
  if (!isReactionEmoji(emoji)) return;
  const feed = await getReadableCommentFeed(commentId, actor.role);
  if (!feed) return;
  const { count } = await toggleCommentReaction(commentId, actor.userId, emoji);
  revalidate(feed.slug);
  // 실시간: 같은 글을 보는 다른 뷰어에게 해당 이모지 새 카운트 전파(본인 reacted는 낙관 유지).
  publishComment(feed.id, { kind: "reaction", id: commentId, emoji, count });
}
