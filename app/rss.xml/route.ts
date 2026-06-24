import { prisma } from "@/lib/prisma";
import { SITE_ORIGIN } from "@/lib/share";
import { renderRssFeed } from "@/lib/rss";

// 전체공개 글 RSS 2.0 피드. 요청 시 생성(빌드 타임 DB 접근 방지).
export const dynamic = "force-dynamic";

export async function GET() {
  const feeds = await prisma.feed.findMany({
    // 신고로 가려진 글 제외(모더레이션 일관성).
    where: { status: "published", visibility: "public", hiddenAt: null },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { slug: true, title: true, summary: true, createdAt: true },
  });

  const xml = renderRssFeed({
    title: "BY Playground",
    link: SITE_ORIGIN,
    description: "생각과 기록을 남기는 개인 공간",
    selfUrl: `${SITE_ORIGIN}/rss.xml`,
    items: feeds.map((f) => ({
      title: f.title,
      url: `${SITE_ORIGIN}/feed/${f.slug}`,
      pubDate: f.createdAt,
      description: f.summary ?? undefined,
    })),
  });

  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
