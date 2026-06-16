import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { SITE_ORIGIN } from "@/lib/share";

// DB를 조회하므로 요청 시 생성(빌드 타임 prerender 방지).
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // 비로그인도 볼 수 있는 전체공개 콘텐츠만 색인 대상(회원공개·비공개 제외).
  const [feeds, dfs] = await Promise.all([
    prisma.feed.findMany({
      where: { status: "published", visibility: "public", hiddenAt: null },
      select: { slug: true, updatedAt: true },
    }),
    prisma.dfCharacter.findMany({
      where: { visibility: "public" },
      select: { serverId: true, characterId: true, createdAt: true },
    }),
  ]);

  const now = new Date();
  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_ORIGIN, lastModified: now },
    { url: `${SITE_ORIGIN}/feed`, lastModified: now },
    { url: `${SITE_ORIGIN}/df`, lastModified: now },
  ];
  const feedPages: MetadataRoute.Sitemap = feeds.map((f) => ({
    url: `${SITE_ORIGIN}/feed/${f.slug}`,
    lastModified: f.updatedAt,
  }));
  const dfPages: MetadataRoute.Sitemap = dfs.map((d) => ({
    url: `${SITE_ORIGIN}/df/${d.serverId}/${d.characterId}`,
    lastModified: d.createdAt,
  }));

  return [...staticPages, ...feedPages, ...dfPages];
}
