import Link from "next/link";
import { getAdminFeedsPage } from "@/lib/feeds";
import { DeleteFeedButton } from "@/app/admin/delete-feed-button";
import FeedVisibilityControl from "@/app/admin/feed-visibility-control";
import Pager, { parsePage } from "@/app/admin/pager";
import { publishNowAction } from "@/app/admin/actions";
import { type Visibility } from "@/lib/visibility";
import { kstDateTime } from "@/lib/kst";

export const metadata = { title: "글 목록 · 관리자" };

export default async function AdminFeedsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const page = parsePage(sp.page);
  const q = (sp.q ?? "").trim();
  const {
    items: feeds,
    total,
    pageSize,
  } = await getAdminFeedsPage(page, undefined, q);

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
      <form
        role="search"
        method="get"
        action="/admin/feeds"
        className="mb-6 flex items-center gap-2"
      >
        <label htmlFor="feed-q" className="sr-only">
          글 검색
        </label>
        <input
          id="feed-q"
          name="q"
          type="search"
          defaultValue={q}
          placeholder="제목·슬러그 검색"
          aria-label="글 검색"
          className="min-w-0 flex-1 rounded-lg border border-black/15 bg-transparent px-4 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
        />
        <button
          type="submit"
          className="rounded-lg border border-black/15 px-4 py-2 text-sm font-medium hover:bg-black/[.03] dark:border-white/20 dark:hover:bg-white/[.05]"
        >
          검색
        </button>
        {q && (
          <Link
            href="/admin/feeds"
            className="rounded-lg px-3 py-2 text-sm text-zinc-500 underline"
          >
            전체
          </Link>
        )}
      </form>
      {feeds.length === 0 ? (
        <p className="text-zinc-500">
          {q ? (
            <>‘{q}’ 검색 결과가 없습니다.</>
          ) : (
            <>
              글이 없습니다.{" "}
              <Link href="/admin/new" className="underline">
                새 글 작성
              </Link>
            </>
          )}
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
                {feed.status === "draft" && feed.scheduledAt && (
                  <p className="mt-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                    🕒 예약: {kstDateTime(feed.scheduledAt)}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2 text-sm">
                {feed.status === "draft" && feed.scheduledAt && (
                  <form action={publishNowAction}>
                    <input type="hidden" name="id" value={feed.id} />
                    <button
                      type="submit"
                      className="rounded border border-amber-400 px-2 py-1 text-amber-700 dark:border-amber-400/50 dark:text-amber-300"
                    >
                      지금 게시
                    </button>
                  </form>
                )}
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
        query={q ? `q=${encodeURIComponent(q)}` : ""}
      />
    </section>
  );
}
