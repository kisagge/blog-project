"use server";
import { searchPublishedFeeds } from "@/lib/feeds";

// 클라이언트로 넘기는 직렬화 형태(Date → ISO 문자열)
export type FeedCard = {
  slug: string;
  title: string;
  summary: string | null;
  createdAt: string;
};

export type FeedPage = { items: FeedCard[]; hasMore: boolean };

export async function loadFeeds(q: string, skip: number): Promise<FeedPage> {
  const { items, hasMore } = await searchPublishedFeeds({ q, skip });
  return {
    items: items.map((f) => ({ ...f, createdAt: f.createdAt.toISOString() })),
    hasMore,
  };
}
