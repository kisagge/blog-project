import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTagBySlug } from "@/lib/tags";
import { getFeedsByTag } from "@/lib/feeds";
import { getViewerRole } from "@/lib/dal";
import { toFeedCard } from "@/app/feed/(list)/feed-card";
import FeedCardItem from "@/app/feed/(list)/feed-card-item";
import { buildTagJsonLd, jsonLdHtml } from "@/lib/structured-data";
import { absoluteUrl } from "@/lib/share";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  // Next는 [slug]를 URL 디코딩하지 않고 넘긴다(한글은 퍼센트 인코딩 상태) — getTagBySlug가
  // 내부에서 디코딩·NFC/NFD 정규화로 해소한다.
  const tag = await getTagBySlug(slug);
  if (!tag) return { title: "찾을 수 없음" };
  return {
    title: `#${tag.name}`,
    description: `‘${tag.name}’ 태그 글 모아보기`,
    alternates: { canonical: `/feed/tags/${encodeURIComponent(tag.slug)}` },
  };
}

export default async function TagPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tag = await getTagBySlug(slug);
  if (!tag) notFound();
  const role = await getViewerRole();
  const feeds = await getFeedsByTag(tag.slug, role);
  // 비공개 전용 태그(비어드민에 가시 글 0)는 존재 자체 은닉.
  if (feeds.length === 0 && role !== "admin") notFound();

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      {feeds.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLdHtml(
              buildTagJsonLd(
                tag,
                feeds.map((f) => ({
                  url: absoluteUrl(`/feed/${f.slug}`),
                  title: f.title,
                })),
              ),
            ),
          }}
        />
      )}
      <p className="mb-1 text-sm text-zinc-500">태그 · {feeds.length}편</p>
      <h1 className="mb-8 text-2xl font-semibold tracking-tight">
        #{tag.name}
      </h1>
      {feeds.length === 0 ? (
        <p className="text-zinc-500">아직 이 태그의 공개 글이 없습니다.</p>
      ) : (
        <ul className="flex flex-col gap-6">
          {feeds.map((f) => (
            <FeedCardItem
              key={f.slug}
              card={toFeedCard(f)}
              linkAuthors={role !== "anon"}
            />
          ))}
        </ul>
      )}
    </main>
  );
}
