import { getSeriesBySlug, getSeriesPosts } from "@/lib/series";
import { SITE_ORIGIN } from "@/lib/share";
import { renderRssFeed } from "@/lib/rss";

// 시리즈별 RSS 2.0 피드. 공개 글만(피드 리더는 비로그인 → anon 범위), 시리즈 순서대로.
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const series = await getSeriesBySlug(slug);
  if (!series) return new Response("Not found", { status: 404 });

  // 글 RSS와 동일한 public 필터(anon). 공개 글 0개 시리즈는 존재 자체 은닉(시리즈 페이지와 일관).
  const posts = await getSeriesPosts(series.id, "anon");
  if (posts.length === 0) return new Response("Not found", { status: 404 });

  const xml = renderRssFeed({
    title: `${series.title} · BY Playground`,
    link: `${SITE_ORIGIN}/series/${series.slug}`,
    description: series.description ?? `${series.title} 연재`,
    selfUrl: `${SITE_ORIGIN}/series/${series.slug}/rss.xml`,
    items: posts.map((p) => ({
      title: p.title,
      url: `${SITE_ORIGIN}/feed/${p.slug}`,
      pubDate: p.createdAt,
      description: p.summary ?? undefined,
    })),
  });

  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
