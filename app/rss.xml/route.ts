import { prisma } from "@/lib/prisma";
import { SITE_DESCRIPTION, SITE_NAME, SITE_ORIGIN } from "@/lib/share";
import { renderRssFeed, rssCache, rssResponse } from "@/lib/rss";
import { markdownToFeedHtml } from "@/lib/rss-content";
import { getPublicEnabled, maintenanceResponse } from "@/lib/site-config";
import { postedAt } from "@/lib/feed-dates";
import { visibleFeedWhere } from "@/lib/feed-access";
import { FEED_LATEST_ORDER } from "@/lib/feeds";

// 전체공개 글 RSS 2.0 피드(본문 전문 포함). 요청 시 생성(빌드 타임 DB 접근 방지).
export const dynamic = "force-dynamic";

export async function GET() {
  // 점검 모드는 캐시보다 먼저(점검 중엔 캐시된 피드도 내보내지 않음).
  if (!(await getPublicEnabled())) return maintenanceResponse();
  return rssResponse((await rssCache.getOrSet("site", buildSiteRss))!);
}

async function buildSiteRss(): Promise<string> {
  const feeds = await prisma.feed.findMany({
    // 신고로 가려진 글 제외(모더레이션 일관성).
    where: visibleFeedWhere("anon"),
    // 게시일순(예약 발행 글이 작성일로 과거에 묻히지 않게). 게시 글 publishedAt은 트리거로 보장.
    orderBy: FEED_LATEST_ORDER,
    take: 20,
    select: {
      slug: true,
      title: true,
      summary: true,
      content: true,
      createdAt: true,
      publishedAt: true,
    },
  });

  return renderRssFeed({
    title: SITE_NAME,
    link: SITE_ORIGIN,
    description: SITE_DESCRIPTION,
    selfUrl: `${SITE_ORIGIN}/rss.xml`,
    items: await Promise.all(
      feeds.map(async (f) => ({
        title: f.title,
        url: `${SITE_ORIGIN}/feed/${f.slug}`,
        pubDate: postedAt(f),
        description: f.summary ?? undefined,
        contentHtml: await markdownToFeedHtml(f.content, SITE_ORIGIN),
      })),
    ),
  });
}
