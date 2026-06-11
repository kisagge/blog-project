"use server";
import { revalidatePath } from "next/cache";
import { getCommentActor } from "@/lib/comment-actor";
import { getSession } from "@/lib/dal";
import { addComment, deleteComment } from "@/lib/comments";
import { toggleLike } from "@/lib/likes";
import { toggleCommentLike } from "@/lib/comment-likes";

export type ActionState = { error?: string } | undefined;

function revalidate(slug: string) {
  revalidatePath(`/feed/${slug}`);
}

export async function addCommentAction(
  args: { feedId: string; slug: string; parentId?: string },
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await getCommentActor();
  if (!actor) return { error: "로그인이 필요합니다." };
  const res = await addComment({
    feedId: args.feedId,
    userId: actor.userId,
    content: String(formData.get("content") ?? ""),
    parentId: args.parentId ?? null,
  });
  if (!res.ok) return { error: res.error };
  revalidate(args.slug);
  return undefined;
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
