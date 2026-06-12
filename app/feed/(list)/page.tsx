import { searchPublishedFeeds } from "@/lib/feeds";
import FeedList from "./feed-list";

export const metadata = { title: "피드 · BY Playground" };

// 런타임에 DB를 조회한다(빌드 타임 prerender 시 DB가 없으므로 동적 렌더).
export const dynamic = "force-dynamic";

export default async function FeedListPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const q = (await searchParams).q ?? "";
  const { items, hasMore } = await searchPublishedFeeds({ q });

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <h1 className="mb-8 text-2xl font-semibold tracking-tight">피드</h1>
      <FeedList
        initialItems={items.map((f) => ({
          ...f,
          createdAt: f.createdAt.toISOString(),
        }))}
        initialHasMore={hasMore}
        initialQuery={q}
      />
    </main>
  );
}
