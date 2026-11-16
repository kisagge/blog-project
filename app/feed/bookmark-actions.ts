"use server";
import { revalidatePath } from "next/cache";
import { getCommentActor } from "@/lib/comment-actor";
import { getReadableFeed } from "@/lib/feed-access";
import { toggleBookmark } from "@/lib/bookmarks";

// 북마크 토글. **회원 전용 기능**(저장 목록 /account/saved도 회원 전용)이라 admin 액터는 제외.
// 공개 카운트·실시간 없음 — 개인 저장이라 SSE publish 없음.
// 읽을 수 없는 글(비공개·숨김·임시저장)은 저장 불가 — 저장 목록에 제목이 노출되는 것을 막는다.
export async function toggleBookmarkAction(feedId: string, _slug: string) {
  const actor = await getCommentActor();
  if (actor?.role !== "member") return;
  const feed = await getReadableFeed(feedId, actor.role);
  if (!feed) return;
  await toggleBookmark(feed.id, actor.userId);
  revalidatePath(`/feed/${feed.slug}`);
  revalidatePath("/account/saved");
}
