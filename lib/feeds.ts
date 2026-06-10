import { cache } from "react";
import { prisma } from "@/lib/prisma";

export const FEED_PAGE_SIZE = 10;

// 목록: 공개된 글만, 최신순, 카드 필드만. 검색어(q)가 있으면 제목/내용/요약을 부분일치 필터.
// take+1로 한 건 더 조회해 다음 페이지 존재 여부(hasMore)를 추가 쿼리 없이 판단한다.
export async function searchPublishedFeeds({
  q = "",
  skip = 0,
  take = FEED_PAGE_SIZE,
}: {
  q?: string;
  skip?: number;
  take?: number;
}) {
  const term = q.trim();
  const rows = await prisma.feed.findMany({
    where: {
      published: true,
      ...(term && {
        OR: [
          { title: { contains: term } },
          { content: { contains: term } },
          { summary: { contains: term } },
        ],
      }),
    },
    orderBy: { createdAt: "desc" },
    select: { slug: true, title: true, summary: true, createdAt: true },
    skip,
    take: take + 1,
  });
  const hasMore = rows.length > take;
  return { items: hasMore ? rows.slice(0, take) : rows, hasMore };
}

// 상세: 공개된 단일 글, 없으면 null
// cache로 감싸 같은 요청 내 중복 호출(generateMetadata + 페이지 본문)을 1회로 dedupe
export const getFeedBySlug = cache(async (slug: string) => {
  return prisma.feed.findFirst({
    where: { slug, published: true },
  });
});

// 관리자용: 초안 포함 전체, 최신순
export async function getAllFeeds() {
  return prisma.feed.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      slug: true,
      title: true,
      published: true,
      createdAt: true,
    },
  });
}

// 관리자용: 공개 여부 무관 단건(id)
export async function getFeedById(id: string) {
  return prisma.feed.findUnique({ where: { id } });
}
