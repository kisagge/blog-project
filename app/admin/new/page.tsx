import FeedForm from "@/app/admin/feed-form";
import { createFeed } from "@/app/admin/actions";

export default function NewFeedPage() {
  return (
    <section>
      <h1 className="mb-6 text-xl font-semibold tracking-tight">새 글</h1>
      <FeedForm action={createFeed} submitLabel="작성" />
    </section>
  );
}
