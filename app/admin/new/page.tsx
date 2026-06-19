import FeedForm from "@/app/admin/feed-form";
import { createFeed } from "@/app/admin/actions";
import { listSeries } from "@/lib/series";

export default async function NewFeedPage() {
  const series = await listSeries();
  return (
    <section>
      <h1 className="mb-6 text-xl font-semibold tracking-tight">새 글</h1>
      <FeedForm
        action={createFeed}
        seriesOptions={series.map((s) => ({ id: s.id, title: s.title }))}
        submitLabel="작성"
      />
    </section>
  );
}
