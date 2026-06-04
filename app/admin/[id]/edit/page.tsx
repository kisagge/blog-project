import { notFound } from "next/navigation";
import FeedForm from "@/app/admin/feed-form";
import { updateFeed } from "@/app/admin/actions";
import { getFeedById } from "@/lib/feeds";

export default async function EditFeedPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const feed = await getFeedById(id);
  if (!feed) notFound();

  const action = updateFeed.bind(null, feed.id);
  return (
    <section>
      <h1 className="mb-6 text-xl font-semibold tracking-tight">글 수정</h1>
      <FeedForm
        action={action}
        submitLabel="수정"
        defaultValues={{
          title: feed.title,
          slug: feed.slug,
          summary: feed.summary,
          content: feed.content,
          published: feed.published,
        }}
      />
    </section>
  );
}
