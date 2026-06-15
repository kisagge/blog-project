import Link from "next/link";
import { notFound } from "next/navigation";
import { getFeedById } from "@/lib/feeds";
import FeedArticle from "@/app/feed/feed-article";
import { VISIBILITY_LABELS, type Visibility } from "@/lib/visibility";

export const metadata = { title: "미리보기 · 관리자" };

export default async function FeedPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const feed = await getFeedById(id);
  if (!feed) notFound();

  return (
    <section>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-black/[.08] bg-black/[.02] p-3 text-sm dark:border-white/[.145] dark:bg-white/[.03]">
        <span>
          미리보기 ·{" "}
          <strong
            className={
              feed.visibility === "private"
                ? "text-amber-600"
                : "text-emerald-600"
            }
          >
            {VISIBILITY_LABELS[feed.visibility as Visibility]}
          </strong>
          {feed.visibility !== "private" && (
            <>
              {" "}
              ·{" "}
              <Link href={`/feed/${feed.slug}`} className="underline">
                공개 페이지
              </Link>
            </>
          )}
        </span>
        <span className="flex gap-3">
          <Link href={`/admin/${feed.id}/edit`} className="underline">
            수정
          </Link>
          <Link href="/admin/feeds" className="underline">
            글 목록
          </Link>
        </span>
      </div>
      <FeedArticle feed={feed} />
    </section>
  );
}
