import Link from "next/link";
import { getAllFeeds } from "@/lib/feeds";
import { togglePublished } from "@/app/admin/actions";
import { DeleteFeedButton } from "@/app/admin/delete-feed-button";

export const metadata = { title: "글 목록 · 관리자" };

export default async function AdminFeedsPage() {
  const feeds = await getAllFeeds();

  return (
    <section>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">글 목록</h1>
        <Link
          href="/admin/new"
          className="bg-foreground text-background rounded-full px-4 py-1.5 text-sm font-medium"
        >
          새 글
        </Link>
      </div>
      {feeds.length === 0 ? (
        <p className="text-zinc-500">
          글이 없습니다.{" "}
          <Link href="/admin/new" className="underline">
            새 글 작성
          </Link>
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-black/[.06] dark:divide-white/[.1]">
          {feeds.map((feed) => (
            <li
              key={feed.id}
              className="flex items-center justify-between gap-3 py-3"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{feed.title}</p>
                <p className="truncate text-sm text-zinc-500">
                  /{feed.slug} · {feed.published ? "공개" : "비공개"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2 text-sm">
                <form action={togglePublished}>
                  <input type="hidden" name="id" value={feed.id} />
                  <button
                    type="submit"
                    className="rounded border border-black/15 px-2 py-1 dark:border-white/20"
                  >
                    {feed.published ? "비공개로" : "공개로"}
                  </button>
                </form>
                <Link
                  href={`/admin/${feed.id}/edit`}
                  className="rounded border border-black/15 px-2 py-1 dark:border-white/20"
                >
                  수정
                </Link>
                <DeleteFeedButton id={feed.id} title={feed.title} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
