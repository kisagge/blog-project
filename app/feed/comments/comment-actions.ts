"use server";
import { revalidatePath } from "next/cache";
import { getCommentActor } from "@/lib/comment-actor";
import { getSession } from "@/lib/dal";
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

export type AddCommentResult = { error: string } | { comment: CommentNode };

function revalidate(slug: string) {
  revalidatePath(`/feed/${slug}`);
}

export async function addCommentAction(
  args: { feedId: string; slug: string; parentId?: string },
  _prev: AddCommentResult | undefined,
  formData: FormData,
): Promise<AddCommentResult | undefined> {
  const actor = await getCommentActor();
  if (!actor) return { error: "로그인이 필요합니다." };
  const content = String(formData.get("content") ?? "");
  const res = await addComment({
    feedId: args.feedId,
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
      slug: args.slug,
      fromUserId: actor.userId,
      fromNickname: actor.nickname,
      content,
    }).catch(swallow("notify:comment-reply"));
  } else {
    void notifyFeedComment({
      feedId: args.feedId,
      commentId: res.id,
      slug: args.slug,
      fromUserId: actor.userId,
      fromNickname: actor.nickname,
    }).catch(swallow("notify:feed-comment"));
  }
  // @멘션 알림(답글/최상위 무관) — 본문에 멘션된 승인 회원에게.
  // 저장본과 동일하게 trim한 본문으로 멘션 판정.
  void notifyCommentMention({
    content: content.trim(),
    commentId: res.id,
    slug: args.slug,
    fromUserId: actor.userId,
    fromNickname: actor.nickname,
  }).catch(swallow("notify:comment-mention"));
  revalidate(args.slug);
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
  publishComment(args.feedId, {
    kind: "created",
    parentId: args.parentId ?? null,
    node,
  });
  return { comment: node };
}

export async function loadMoreCommentsAction(
  feedId: string,
  sort: CommentSort,
  skip: number,
): Promise<CommentPage> {
  const actor = await getCommentActor();
  return getFeedComments(feedId, { sort, skip, viewerUserId: actor?.userId });
}

// SSE 재접속 재동기화용: 현재 로드량(loaded)만큼 처음부터 다시 조회해 트리 교체.
// 최소 한 페이지는 보장(끊긴 동안 첫 댓글이 생겼을 수도 있어 loaded=0이어도 조회).
export async function resyncCommentsAction(
  feedId: string,
  sort: CommentSort,
  loaded: number,
): Promise<CommentPage> {
  const actor = await getCommentActor();
  return getFeedComments(feedId, {
    sort,
    skip: 0,
    take: Math.max(loaded, COMMENT_PAGE_SIZE),
    viewerUserId: actor?.userId,
  });
}

// SSE 재접속 재동기화용: 좋아요 수+본인 누름 여부를 서버 truth로 재조회.
export async function getLikeSummaryAction(
  feedId: string,
): Promise<{ count: number; liked: boolean }> {
  const actor = await getCommentActor();
  return getLikeSummary(feedId, actor?.userId);
}

export async function deleteCommentAction(
  commentId: string,
  feedId: string,
  slug: string,
) {
  const actor = await getCommentActor();
  if (!actor) return;
  const session = await getSession();
  const res = await deleteComment(
    commentId,
    actor.userId,
    session?.role === "admin",
  );
  if (!res.ok) return; // 권한 없음 등 — 전파/리밸리데이트 생략
  revalidate(slug);
  publishComment(feedId, { kind: "deleted", id: commentId }); // 실시간 전파
}

export type EditCommentResult = { ok: true } | { error: string };

export async function editCommentAction(
  commentId: string,
  feedId: string,
  slug: string,
  content: string,
): Promise<EditCommentResult> {
  const actor = await getCommentActor();
  if (!actor) return { error: "로그인이 필요합니다." };
  const res = await editComment(commentId, actor.userId, content);
  if (!res.ok) return { error: res.error };
  revalidate(slug);
  publishComment(feedId, {
    kind: "edited",
    id: commentId,
    content: res.content,
  });
  return { ok: true };
}

export async function toggleLikeAction(feedId: string, slug: string) {
  const actor = await getCommentActor();
  if (!actor) return;
  const { count } = await toggleLike(feedId, actor.userId);
  revalidate(slug);
  // 실시간: 같은 글을 보는 다른 뷰어에게 새 좋아요 수 전파(본인 liked는 낙관 유지).
  publishFeedLike(feedId, count);
}

export async function toggleFeedReactionAction(
  feedId: string,
  slug: string,
  emoji: string,
) {
  const actor = await getCommentActor();
  if (!actor) return;
  if (!isReactionEmoji(emoji)) return;
  const { count } = await toggleFeedReaction(feedId, actor.userId, emoji);
  revalidate(slug);
  // 실시간: 같은 글을 보는 다른 뷰어에게 해당 이모지 새 카운트 전파(본인 reacted는 낙관 유지).
  publishFeedReaction(feedId, emoji, count);
}

// SSE 재접속 재동기화용: 글 리액션 요약(이모지별 수+본인 누름)을 서버 truth로 재조회.
export async function getFeedReactionSummaryAction(
  feedId: string,
): Promise<ReactionSummary[]> {
  const actor = await getCommentActor();
  return getFeedReactionSummary(feedId, actor?.userId);
}

export async function toggleCommentLikeAction(
  commentId: string,
  feedId: string,
  slug: string,
) {
  const actor = await getCommentActor();
  if (!actor) return;
  const { count } = await toggleCommentLike(commentId, actor.userId);
  revalidate(slug);
  // 실시간: 같은 글을 보는 다른 뷰어에게 새 좋아요 수 전파(본인 liked는 낙관 유지).
  publishComment(feedId, { kind: "likeCount", id: commentId, count });
}

export async function toggleCommentReactionAction(
  commentId: string,
  feedId: string,
  slug: string,
  emoji: string,
) {
  const actor = await getCommentActor();
  if (!actor) return;
  if (!isReactionEmoji(emoji)) return;
  const { count } = await toggleCommentReaction(commentId, actor.userId, emoji);
  revalidate(slug);
  // 실시간: 같은 글을 보는 다른 뷰어에게 해당 이모지 새 카운트 전파(본인 reacted는 낙관 유지).
  publishComment(feedId, { kind: "reaction", id: commentId, emoji, count });
}
