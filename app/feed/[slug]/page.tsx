import { notFound } from "next/navigation";
import { getFeedBySlug } from "@/lib/feeds";
import FeedArticle from "@/app/feed/feed-article";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const feed = await getFeedBySlug(slug);
  return {
    title: feed ? `${feed.title} · BY Playground` : "Not found · BY Playground",
  };
}

export default async function FeedDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const feed = await getFeedBySlug(slug);
  if (!feed) notFound();

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <FeedArticle feed={feed} />
    </main>
  );
}
