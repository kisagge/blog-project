"use server";
import { searchFeeds } from "@/lib/feeds";
import { guardPublicAccess } from "@/lib/site-config";
import { getViewerRole } from "@/lib/dal";
import type { Visibility } from "@/lib/visibility";

// 클라이언트로 넘기는 직렬화 형태(Date → ISO 문자열)
export type FeedCard = {
  slug: string;
  title: string;
  summary: string | null;
  createdAt: string;
  viewCount: number;
  visibility: Visibility;
};

export type FeedPage = { items: FeedCard[]; hasMore: boolean };

export async function loadFeeds(q: string, skip: number): Promise<FeedPage> {
  await guardPublicAccess(); // 점검 중 비어드민은 무한스크롤/검색 데이터도 차단(→ /maintenance)
  const role = await getViewerRole();
  const { items, hasMore } = await searchFeeds({ q, skip, role });
  return {
    items: items.map((f) => ({
      ...f,
      visibility: f.visibility as Visibility,
      createdAt: f.createdAt.toISOString(),
    })),
    hasMore,
  };
}
