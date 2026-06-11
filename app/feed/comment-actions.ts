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
  revalidate(args.slug);
  return {
    comment: {
      id: res.id,
      userId: actor.userId,
      nickname: actor.nickname,
      content: content.trim(),
      deleted: false,
      createdAt: new Date().toISOString(),
      likeCount: 0,
      liked: false,
      replies: [],
    },
  };
}

export async function loadMoreCommentsAction(
  feedId: string,
  sort: CommentSort,
  skip: number,
): Promise<CommentPage> {
  const actor = await getCommentActor();
  return getFeedComments(feedId, { sort, skip, viewerUserId: actor?.userId });
}

export async function deleteCommentAction(commentId: string, slug: string) {
  const actor = await getCommentActor();
  if (!actor) return;
  const session = await getSession();
  await deleteComment(commentId, actor.userId, session?.role === "admin");
  revalidate(slug);
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
