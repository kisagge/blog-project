import { notFound } from "next/navigation";
import { getFeedBySlug } from "@/lib/feeds";
import FeedArticle from "@/app/feed/feed-article";
import FeedEngagement from "@/app/feed/feed-engagement";
import ViewTracker from "@/app/view-tracker";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const feed = await getFeedBySlug(slug);
  if (!feed) return { title: "찾을 수 없음" };
  const description = feed.summary?.trim() || undefined;
  return {
    title: feed.title,
    description,
    openGraph: {
      type: "article",
      title: feed.title,
      description,
    },
  };
}

export default async function FeedDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sort?: string }>;
}) {
  const { slug } = await params;
  const feed = await getFeedBySlug(slug);
  if (!feed) notFound();

  const sort = (await searchParams).sort === "newest" ? "newest" : "popular";

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <ViewTracker type="feed" id={feed.id} />
      <FeedArticle feed={feed} />
      <FeedEngagement feedId={feed.id} slug={feed.slug} sort={sort} />
    </main>
  );
}
