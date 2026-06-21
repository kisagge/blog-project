import { getPublicTopFeeds } from "@/lib/feeds";
import { getViewerRole } from "@/lib/dal";
import { toFeedCard } from "@/app/feed/(list)/feed-card";
import FeedCardItem from "@/app/feed/(list)/feed-card-item";

export const metadata = {
  title: "인기 글",
  description: "조회수가 높은 글 모아보기",
  alternates: { canonical: "/feed/popular" },
};

// 런타임 DB 조회.
export const dynamic = "force-dynamic";

export default async function PopularPage() {
  const role = await getViewerRole();
  const feeds = await getPublicTopFeeds(role);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <h1 className="mb-8 text-2xl font-semibold tracking-tight">인기 글</h1>
      {feeds.length === 0 ? (
        <p className="text-zinc-500">아직 인기 글이 없습니다.</p>
      ) : (
        <ul className="flex flex-col gap-6">
          {feeds.map((f) => (
            <FeedCardItem
              key={f.slug}
              card={toFeedCard(f)}
              linkAuthors={role !== "anon"}
            />
          ))}
        </ul>
      )}
    </main>
  );
}
