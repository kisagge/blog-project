import { getSeriesBySlug, getSeriesPosts } from "@/lib/series";
import { SITE_ORIGIN } from "@/lib/share";
import { prisma } from "@/lib/prisma";
import { renderRssFeed } from "@/lib/rss";
import { markdownToFeedHtml } from "@/lib/rss-content";

// 시리즈별 RSS 2.0 피드(본문 전문 포함). 공개 글만(피드 리더는 비로그인 → anon 범위), 시리즈 순서대로.
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

  // 목록 select엔 본문이 없어 이미 가시성 필터를 통과한 id로만 본문을 1쿼리 조회.
  const bodies = new Map(
    (
      await prisma.feed.findMany({
        where: { id: { in: posts.map((p) => p.id) } },
        select: { id: true, content: true },
      })
    ).map((b) => [b.id, b.content]),
  );

  const xml = renderRssFeed({
    title: `${series.title} · BY Playground`,
    link: `${SITE_ORIGIN}/series/${series.slug}`,
    description: series.description ?? `${series.title} 연재`,
    selfUrl: `${SITE_ORIGIN}/series/${series.slug}/rss.xml`,
    items: await Promise.all(
      posts.map(async (p) => ({
        title: p.title,
        url: `${SITE_ORIGIN}/feed/${p.slug}`,
        pubDate: p.createdAt,
        description: p.summary ?? undefined,
        contentHtml: await markdownToFeedHtml(
          bodies.get(p.id) ?? "",
          SITE_ORIGIN,
        ),
      })),
    ),
  });

  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
