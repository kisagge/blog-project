import { prisma } from "@/lib/prisma";
import { listableVisibilities, type ViewerRole } from "@/lib/visibility";
import { FEED_LIST_SELECT } from "@/lib/feeds";
import { notifyFollow } from "@/lib/notifications";
import { swallow } from "@/lib/log";

export type FollowResult = { ok: true } | { error: string };

// 회원이 다른 회원을 팔로우. 자기 자신·미존재·비승인·관리자 대상은 거부.
// 중복은 무시(idempotent) — 이미 있으면 조기 반환, 동시 생성 충돌(unique)도 삼킨다.
// 알림은 실제로 새 행을 만든 경우에만(fire-and-forget).
export async function followUser(
  followerId: string,
  followingId: string,
): Promise<FollowResult> {
  if (followerId === followingId)
    return { error: "자기 자신은 팔로우할 수 없습니다." };
  const target = await prisma.user.findUnique({
    where: { id: followingId },
    select: { role: true, status: true, nickname: true },
  });
  if (!target || target.role !== "member" || target.status !== "approved")
    return { error: "팔로우할 수 없는 대상입니다." };

  const existing = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId, followingId } },
    select: { id: true },
  });
  if (existing) return { ok: true }; // 이미 팔로우 중

  const follower = await prisma.user.findUnique({
    where: { id: followerId },
    select: { nickname: true },
  });
  try {
    await prisma.follow.create({ data: { followerId, followingId } });
  } catch {
    // 동시 요청으로 그 사이 이미 생성됨(unique 충돌) → 이미 팔로우로 간주(알림 없음).
    return { ok: true };
  }
  if (follower) {
    void notifyFollow({
      followingId,
      fromUserId: followerId,
      fromNickname: follower.nickname,
    }).catch(swallow("notify:follow")); // 알림 실패가 팔로우를 막지 않게.
  }
  return { ok: true };
}

export async function unfollowUser(followerId: string, followingId: string) {
  await prisma.follow.deleteMany({ where: { followerId, followingId } });
}

export async function isFollowing(
  followerId: string,
  followingId: string,
): Promise<boolean> {
  const f = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId, followingId } },
    select: { id: true },
  });
  return f !== null;
}

export async function getFollowCounts(
  userId: string,
): Promise<{ followers: number; following: number }> {
  const [followers, following] = await Promise.all([
    prisma.follow.count({ where: { followingId: userId } }),
    prisma.follow.count({ where: { followerId: userId } }),
  ]);
  return { followers, following };
}

// 내가 팔로우하는 회원 id 목록.
export async function getFollowingIds(followerId: string): Promise<string[]> {
  const rows = await prisma.follow.findMany({
    where: { followerId },
    select: { followingId: true },
  });
  return rows.map((r) => r.followingId);
}

// 활동 피드: 팔로우한 회원들의 게시·미숨김 글을 뷰어 가시 범위로 최신순.
export async function getFollowingFeed(
  followerId: string,
  role: ViewerRole,
  skip = 0,
  take = 10,
) {
  const ids = await getFollowingIds(followerId);
  if (ids.length === 0) return { items: [], hasMore: false };
  const rows = await prisma.feed.findMany({
    where: {
      authorId: { in: ids },
      status: "published",
      hiddenAt: null,
      visibility: { in: listableVisibilities(role) },
    },
    orderBy: { publishedAt: "desc" },
    skip,
    take: take + 1,
    select: FEED_LIST_SELECT,
  });
  const hasMore = rows.length > take;
  return { items: hasMore ? rows.slice(0, take) : rows, hasMore };
}
