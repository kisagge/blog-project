import { searchFeeds } from "@/lib/feeds";
import { getViewerRole } from "@/lib/dal";
import FeedList from "./feed-list";
import { toFeedCard } from "./feed-card";
import { guardPublicAccess } from "@/lib/site-config";

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
  // 레이아웃 가드는 페이지 렌더를 막지 못한다(레이아웃·페이지 병렬 렌더 — 리다이렉트 응답에 본문이 실림) → 페이지에서도 가드.
  await guardPublicAccess();
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
        linkAuthors={role !== "anon"}
      />
    </main>
  );
}
