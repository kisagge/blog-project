import Link from "next/link";
import { getAdminFeedsPage } from "@/lib/feeds";
import { DeleteFeedButton } from "@/app/admin/delete-feed-button";
import FeedVisibilityControl from "@/app/admin/feed-visibility-control";
import Pager, { parsePage } from "@/app/admin/pager";
import { type Visibility } from "@/lib/visibility";

export const metadata = { title: "글 목록 · 관리자" };

export default async function AdminFeedsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const page = parsePage((await searchParams).page);
  const { items: feeds, total, pageSize } = await getAdminFeedsPage(page);

  return (
    <section>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">
          글 목록 ({total})
        </h1>
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
                <p className="truncate text-sm text-zinc-500">/{feed.slug}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2 text-sm">
                <FeedVisibilityControl
                  id={feed.id}
                  value={feed.visibility as Visibility}
                />
                <Link
                  href={`/admin/${feed.id}/preview`}
                  className="rounded border border-black/15 px-2 py-1 dark:border-white/20"
                >
                  미리보기
                </Link>
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
      <Pager
        page={page}
        total={total}
        pageSize={pageSize}
        basePath="/admin/feeds"
      />
    </section>
  );
}
