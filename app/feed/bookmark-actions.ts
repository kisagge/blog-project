"use server";
import { revalidatePath } from "next/cache";
import { getCommentActor } from "@/lib/comment-actor";
import { toggleBookmark } from "@/lib/bookmarks";

// 북마크 토글. **회원 전용 기능**(저장 목록 /account/saved도 회원 전용)이라 admin 액터는 제외.
// 공개 카운트·실시간 없음 — 개인 저장이라 SSE publish 없음.
export async function toggleBookmarkAction(feedId: string, slug: string) {
  const actor = await getCommentActor();
  if (actor?.role !== "member") return;
  await toggleBookmark(feedId, actor.userId);
  revalidatePath(`/feed/${slug}`);
  revalidatePath("/account/saved");
}
