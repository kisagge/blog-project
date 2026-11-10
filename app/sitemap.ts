import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { SITE_ORIGIN } from "@/lib/share";
import { getPublicTagSlugs } from "@/lib/tags";
import { feedLastModified } from "@/lib/feed-dates";
import { readAboutRaw } from "@/lib/site-config";

// DB를 조회하므로 요청 시 생성(빌드 타임 prerender 방지).
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // 비로그인도 볼 수 있는 전체공개 콘텐츠만 색인 대상(회원공개·비공개 제외).
  const [feeds, dfs, publicSeries, tagSlugs, about] = await Promise.all([
    prisma.feed.findMany({
      where: { status: "published", visibility: "public", hiddenAt: null },
      // updatedAt은 조회수 증가에도 갱신되므로 본문 기준 시각(feedLastModified)을 쓴다.
      select: {
        slug: true,
        createdAt: true,
        publishedAt: true,
        editedAt: true,
      },
    }),
    prisma.dfCharacter.findMany({
      where: { visibility: "public" },
      select: { serverId: true, characterId: true, createdAt: true },
    }),
    // 전체공개 글이 1개 이상인 시리즈만.
    prisma.series.findMany({
      where: {
        feeds: {
          some: {
            status: "published",
            visibility: "public",
            hiddenAt: null,
          },
        },
      },
      select: { slug: true, updatedAt: true },
    }),
    getPublicTagSlugs(),
    readAboutRaw(),
  ]);

  const now = new Date();
  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_ORIGIN, lastModified: now },
    { url: `${SITE_ORIGIN}/feed`, lastModified: now },
    { url: `${SITE_ORIGIN}/feed/popular`, lastModified: now },
    { url: `${SITE_ORIGIN}/feed/tags`, lastModified: now },
    { url: `${SITE_ORIGIN}/archive`, lastModified: now },
    // 소개는 본문이 있을 때만(없으면 404라 색인 제외).
    ...(about.updatedAt
      ? [{ url: `${SITE_ORIGIN}/about`, lastModified: about.updatedAt }]
      : []),
    { url: `${SITE_ORIGIN}/series`, lastModified: now },
    { url: `${SITE_ORIGIN}/df`, lastModified: now },
  ];
  const feedPages: MetadataRoute.Sitemap = feeds.map((f) => ({
    url: `${SITE_ORIGIN}/feed/${f.slug}`,
    lastModified: feedLastModified(f),
  }));
  const dfPages: MetadataRoute.Sitemap = dfs.map((d) => ({
    url: `${SITE_ORIGIN}/df/${d.serverId}/${d.characterId}`,
    lastModified: d.createdAt,
  }));
  const seriesPages: MetadataRoute.Sitemap = publicSeries.map((s) => ({
    url: `${SITE_ORIGIN}/series/${s.slug}`,
    lastModified: s.updatedAt,
  }));
  const tagPages: MetadataRoute.Sitemap = tagSlugs.map((slug) => ({
    url: `${SITE_ORIGIN}/feed/tags/${encodeURIComponent(slug)}`,
    lastModified: now,
  }));

  return [
    ...staticPages,
    ...feedPages,
    ...dfPages,
    ...seriesPages,
    ...tagPages,
  ];
}
