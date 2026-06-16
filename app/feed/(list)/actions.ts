"use server";
import { searchFeeds } from "@/lib/feeds";
import { guardPublicAccess } from "@/lib/site-config";
import { getViewerRole } from "@/lib/dal";
import { toFeedCard, type FeedCard } from "./feed-card";

export type { FeedCard };
export type FeedPage = { items: FeedCard[]; hasMore: boolean };

export async function loadFeeds(
  q: string,
  skip: number,
  author?: "admin" | "member",
): Promise<FeedPage> {
  await guardPublicAccess(); // 점검 중 비어드민은 무한스크롤/검색 데이터도 차단(→ /maintenance)
  const role = await getViewerRole();
  const { items, hasMore } = await searchFeeds({ q, skip, role, author });
  return { items: items.map(toFeedCard), hasMore };
}
