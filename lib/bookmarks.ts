import "server-only";
import { prisma } from "@/lib/prisma";
import { FEED_LIST_SELECT } from "@/lib/feeds";
import { listableVisibilities } from "@/lib/visibility";

// 북마크 토글. 결과 저장 여부 반환(좋아요와 달리 공개 카운트 없음 — 개인용).
export async function toggleBookmark(
  feedId: string,
  userId: string,
): Promise<{ bookmarked: boolean }> {
  const existing = await prisma.bookmark.findUnique({
    where: { feedId_userId: { feedId, userId } },
    select: { id: true },
  });
  if (existing) {
    await prisma.bookmark.delete({ where: { id: existing.id } });
    return { bookmarked: false };
  }
  await prisma.bookmark.create({ data: { feedId, userId } });
  return { bookmarked: true };
}

// 버튼 초기 상태: 이 글을 뷰어가 저장했는지.
export async function getBookmarkStatus(
  feedId: string,
  userId?: string,
): Promise<boolean> {
  if (!userId) return false;
  const mine = await prisma.bookmark.findUnique({
    where: { feedId_userId: { feedId, userId } },
    select: { id: true },
  });
  return !!mine;
}

export const SAVED_PAGE_SIZE = 20;

// 저장 목록: 회원이 저장한 글을 저장 시각 최신순으로. take+1로 hasMore 판단.
// 저장 후 비공개/초안/숨김된 글은 목록에서 제외(기존 목록 정책과 일관 — 회원 가시 범위).
export async function listSavedFeeds(
  userId: string,
  { skip = 0, take = SAVED_PAGE_SIZE }: { skip?: number; take?: number } = {},
) {
  const rows = await prisma.bookmark.findMany({
    where: {
      userId,
      feed: {
        status: "published",
        hiddenAt: null,
        visibility: { in: listableVisibilities("member") },
      },
    },
    orderBy: { createdAt: "desc" },
    select: { feed: { select: FEED_LIST_SELECT } },
    skip,
    take: take + 1,
  });
  const feeds = rows.map((r) => r.feed);
  const hasMore = feeds.length > take;
  return { items: hasMore ? feeds.slice(0, take) : feeds, hasMore };
}
