import { cache } from "react";
import { prisma } from "@/lib/prisma";

// 목록: 공개된 글만, 최신순, 카드에 필요한 필드만
export async function getPublishedFeeds() {
  return prisma.feed.findMany({
    where: { published: true },
    orderBy: { createdAt: "desc" },
    select: {
      slug: true,
      title: true,
      summary: true,
      createdAt: true,
    },
  });
}

// 상세: 공개된 단일 글, 없으면 null
// cache로 감싸 같은 요청 내 중복 호출(generateMetadata + 페이지 본문)을 1회로 dedupe
export const getFeedBySlug = cache(async (slug: string) => {
  return prisma.feed.findFirst({
    where: { slug, published: true },
  });
});
