"use server";
import { getSession } from "@/lib/dal";
import { listSavedFeeds } from "@/lib/bookmarks";
import { toFeedCard, type FeedCard } from "@/app/feed/(list)/feed-card";

export type SavedPage = { items: FeedCard[]; hasMore: boolean };

// 저장 목록 다음 페이지(더보기). 비회원은 빈 결과.
export async function loadSavedFeeds(skip: number): Promise<SavedPage> {
  const session = await getSession();
  if (session?.role !== "member") return { items: [], hasMore: false };
  const { items, hasMore } = await listSavedFeeds(session.userId, { skip });
  return { items: items.map(toFeedCard), hasMore };
}
