"use server";
import { revalidatePath } from "next/cache";
import { getCommentActor } from "@/lib/comment-actor";
import { getSession } from "@/lib/dal";
import {
  addComment,
  deleteComment,
  getFeedComments,
  type CommentNode,
  type CommentPage,
  type CommentSort,
} from "@/lib/comments";
import { toggleLike } from "@/lib/likes";
import { toggleCommentLike } from "@/lib/comment-likes";
import { notifyCommentReply, notifyFeedComment } from "@/lib/notifications";
import { publishComment } from "@/lib/events";

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
    }).catch(() => {});
  } else {
    void notifyFeedComment({
      feedId: args.feedId,
      commentId: res.id,
      slug: args.slug,
      fromUserId: actor.userId,
      fromNickname: actor.nickname,
    }).catch(() => {});
  }
  revalidate(args.slug);
  const node: CommentNode = {
    id: res.id,
    userId: actor.userId,
    nickname: actor.nickname,
    authorRole: actor.role,
    content: content.trim(),
    deleted: false,
    hidden: false,
    createdAt: new Date().toISOString(),
    likeCount: 0,
    liked: false,
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

export async function toggleLikeAction(feedId: string, slug: string) {
  const actor = await getCommentActor();
  if (!actor) return;
  await toggleLike(feedId, actor.userId);
  revalidate(slug);
}

export async function toggleCommentLikeAction(commentId: string, slug: string) {
  const actor = await getCommentActor();
  if (!actor) return;
  await toggleCommentLike(commentId, actor.userId);
  revalidate(slug);
}
