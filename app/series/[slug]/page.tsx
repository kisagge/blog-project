import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSeriesBySlug, getSeriesPosts } from "@/lib/series";
import { getViewerRole } from "@/lib/dal";
import { toFeedCard } from "@/app/feed/(list)/feed-card";
import FeedCardItem from "@/app/feed/(list)/feed-card-item";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const series = await getSeriesBySlug(slug);
  if (!series) return { title: "찾을 수 없음" };
  return {
    title: series.title,
    description: series.description ?? `${series.title} 연재`,
    alternates: { canonical: `/series/${series.slug}` },
  };
}

export default async function SeriesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const role = await getViewerRole();
  const series = await getSeriesBySlug(slug);
  if (!series) notFound();
  const posts = await getSeriesPosts(series.id, role);
  // 비공개 전용 시리즈(비어드민에 가시 글 0)는 존재 자체 은닉.
  if (posts.length === 0 && role !== "admin") notFound();

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <header className="mb-8">
        <p className="text-sm text-zinc-500">시리즈 · {posts.length}편</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          {series.title}
        </h1>
        {series.description && (
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            {series.description}
          </p>
        )}
      </header>
      {posts.length === 0 ? (
        <p className="text-zinc-500">아직 공개된 글이 없습니다.</p>
      ) : (
        <ol className="flex flex-col gap-6">
          {posts.map((f) => (
            <FeedCardItem
              key={f.slug}
              card={toFeedCard(f)}
              linkAuthors={role !== "anon"}
            />
          ))}
        </ol>
      )}
    </main>
  );
}
