import { searchFeeds } from "@/lib/feeds";
import { getViewerRole } from "@/lib/dal";
import FeedList from "./feed-list";
import { toFeedCard } from "./feed-card";

export const metadata = {
  title: "피드",
  description: "BY Playground에 남긴 글 목록",
};

// 런타임에 DB를 조회한다(빌드 타임 prerender 시 DB가 없으므로 동적 렌더).
export const dynamic = "force-dynamic";

export default async function FeedListPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tag?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q ?? "";
  const tag = sp.tag || undefined;
  const role = await getViewerRole();
  const { items, hasMore } = await searchFeeds({
    q,
    role,
    author: "admin",
    tag,
  });

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <h1 className="mb-8 text-2xl font-semibold tracking-tight">피드</h1>
      <FeedList
        key={tag ?? ""}
        initialItems={items.map(toFeedCard)}
        initialHasMore={hasMore}
        initialQuery={q}
        author="admin"
        initialTag={tag}
      />
    </main>
  );
}
