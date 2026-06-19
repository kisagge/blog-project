import Link from "next/link";
import { notFound } from "next/navigation";
import FeedForm from "@/app/admin/feed-form";
import { updateFeed } from "@/app/admin/actions";
import { getFeedById } from "@/lib/feeds";
import { listSeries } from "@/lib/series";

export default async function EditFeedPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [feed, series] = await Promise.all([getFeedById(id), listSeries()]);
  if (!feed) notFound();

  const action = updateFeed.bind(null, feed.id);
  return (
    <section>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">글 수정</h1>
        <Link
          href={`/admin/${feed.id}/preview`}
          className="rounded border border-black/15 px-3 py-1.5 text-sm dark:border-white/20"
        >
          미리보기
        </Link>
      </div>
      <FeedForm
        action={action}
        seriesOptions={series.map((s) => ({ id: s.id, title: s.title }))}
        submitLabel="수정"
        defaultValues={{
          title: feed.title,
          slug: feed.slug,
          summary: feed.summary,
          content: feed.content,
          visibility: feed.visibility as "public" | "members" | "private",
          tags: feed.feedTags.map((ft) => ft.tag.name).join(", "),
          seriesId: feed.seriesId,
        }}
      />
    </section>
  );
}
