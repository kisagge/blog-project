import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { listableVisibilities, type ViewerRole } from "@/lib/visibility";

export const FEED_PAGE_SIZE = 10;

// 목록: 뷰어 권한으로 볼 수 있는 글(anon=전체공개, 회원/관리자=전체공개+회원공개), 최신순.
// 비공개(초안)는 공개 목록에 노출 안 함. 검색어(q)가 있으면 제목/내용/요약 부분일치.
// take+1로 한 건 더 조회해 다음 페이지 존재 여부(hasMore)를 추가 쿼리 없이 판단한다.
export async function searchFeeds({
  q = "",
  skip = 0,
  take = FEED_PAGE_SIZE,
  role,
  author,
  tag,
}: {
  q?: string;
  skip?: number;
  take?: number;
  role: ViewerRole;
  author?: "admin" | "member"; // 관리자 글(authorId null) vs 회원 글(authorId 있음)
  tag?: string; // 태그 slug 필터
}) {
  const term = q.trim();
  const rows = await prisma.feed.findMany({
    where: {
      status: "published", // 임시저장(draft)은 공개 목록에서 제외
      hiddenAt: null, // 신고로 가려진 글 제외
      visibility: { in: listableVisibilities(role) },
      ...(author === "admin"
        ? { authorId: null }
        : author === "member"
          ? { authorId: { not: null } }
          : {}),
      ...(tag && { feedTags: { some: { tag: { slug: tag } } } }),
      ...(term && {
        OR: [
          { title: { contains: term } },
          { content: { contains: term } },
          { summary: { contains: term } },
        ],
      }),
    },
    orderBy: { createdAt: "desc" },
    select: {
      slug: true,
      title: true,
      summary: true,
      createdAt: true,
      viewCount: true,
      visibility: true,
      author: { select: { id: true, nickname: true } },
      feedTags: { select: { tag: { select: { name: true, slug: true } } } },
    },
    skip,
    take: take + 1,
  });
  const hasMore = rows.length > take;
  return { items: hasMore ? rows.slice(0, take) : rows, hasMore };
}

// 상세: slug로 단건(공개 범위 무관). 접근 제어는 호출부에서 visibility로 판정.
// cache로 감싸 같은 요청 내 중복 호출(generateMetadata + 페이지 본문)을 1회로 dedupe
export const getFeedBySlug = cache(async (slug: string) => {
  return prisma.feed.findUnique({
    where: { slug },
    include: {
      author: { select: { id: true, nickname: true } },
      feedTags: { select: { tag: { select: { name: true, slug: true } } } },
    },
  });
});

export const ADMIN_PAGE_SIZE = 20;

// 관리자용: 초안 포함, 최신순, 페이지 단위(기본 20). 목록 + 전체 개수 반환.
export async function getAdminFeedsPage(
  page: number,
  pageSize = ADMIN_PAGE_SIZE,
) {
  const take = pageSize;
  const skip = (Math.max(1, page) - 1) * take;
  const [items, total] = await Promise.all([
    prisma.feed.findMany({
      where: { authorId: null }, // 관리자 CMS는 관리자 글만(회원 글 제외)
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        slug: true,
        title: true,
        visibility: true,
        createdAt: true,
      },
      skip,
      take,
    }),
    prisma.feed.count({ where: { authorId: null } }),
  ]);
  return { items, total, pageSize: take };
}

// 관리자용: 공개 여부 무관 단건(id). 편집 폼 prefill용 태그 포함.
export async function getFeedById(id: string) {
  return prisma.feed.findUnique({
    where: { id },
    include: { feedTags: { select: { tag: { select: { name: true } } } } },
  });
}

// 관리자 대시보드용: 목록을 다 불러오지 않고 count로 요약.
export async function countFeeds() {
  const [total, pub, members] = await Promise.all([
    prisma.feed.count({ where: { authorId: null } }),
    prisma.feed.count({ where: { authorId: null, visibility: "public" } }),
    prisma.feed.count({ where: { authorId: null, visibility: "members" } }),
  ]);
  return { total, public: pub, members, private: total - pub - members };
}
