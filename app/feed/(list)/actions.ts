"use server";
import { searchPublishedFeeds } from "@/lib/feeds";
import { guardPublicAccess } from "@/lib/site-config";

// 클라이언트로 넘기는 직렬화 형태(Date → ISO 문자열)
export type FeedCard = {
  slug: string;
  title: string;
  summary: string | null;
  createdAt: string;
  viewCount: number;
};

export type FeedPage = { items: FeedCard[]; hasMore: boolean };

export async function loadFeeds(q: string, skip: number): Promise<FeedPage> {
  await guardPublicAccess(); // 점검 중 비어드민은 무한스크롤/검색 데이터도 차단(→ /maintenance)
  const { items, hasMore } = await searchPublishedFeeds({ q, skip });
  return {
    items: items.map((f) => ({ ...f, createdAt: f.createdAt.toISOString() })),
    hasMore,
  };
}
