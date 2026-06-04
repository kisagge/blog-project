import Link from "next/link";
import { getPublishedFeeds } from "@/lib/feeds";

export const metadata = { title: "Feed · BY Playground" };

// 런타임에 DB를 조회한다(빌드 타임 prerender 시 DB가 없으므로 동적 렌더).
export const dynamic = "force-dynamic";

export default async function FeedListPage() {
  const feeds = await getPublishedFeeds();

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <h1 className="mb-8 text-2xl font-semibold tracking-tight">Feed</h1>

      {feeds.length === 0 ? (
        <p className="text-zinc-500">아직 공개된 글이 없습니다.</p>
      ) : (
        <ul className="flex flex-col gap-6">
          {feeds.map((feed) => (
            <li key={feed.slug} className="border-b border-black/[.06] pb-6 dark:border-white/[.1]">
              <Link href={`/feed/${feed.slug}`} className="group block">
                <h2 className="text-xl font-medium tracking-tight group-hover:underline">
                  {feed.title}
                </h2>
                {feed.summary && (
                  <p className="mt-1 text-zinc-600 dark:text-zinc-400">{feed.summary}</p>
                )}
                <time dateTime={feed.createdAt.toISOString()} className="mt-2 block text-sm text-zinc-500">
                  {feed.createdAt.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })}
                </time>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
