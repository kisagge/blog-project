import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/app/generated/prisma/client";
import type { ReportReason, ReportTargetType } from "@/lib/report-reasons";

type CreateInput = {
  reporterId: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  detail?: string | null;
};
type CreateResult =
  | { ok: true; created: boolean; firstForTarget: boolean }
  | { ok: false; error: string };

// 신고 적재. 대상 존재·본인 아님·미숨김·회원 콘텐츠 확인 후 중복 무시 적재.
// created=false면 같은 회원의 중복 신고, firstForTarget면 이 대상의 첫 신고(알림 판단용).
export async function createReport(input: CreateInput): Promise<CreateResult> {
  const { reporterId, targetType, targetId, reason, detail } = input;

  // 대상별 작성자·숨김 여부 확인(회원 콘텐츠만 신고 가능 — 관리자 콘텐츠 제외).
  let ownerId: string | null;
  let hidden: boolean;
  if (targetType === "comment") {
    const c = await prisma.comment.findUnique({
      where: { id: targetId },
      select: {
        userId: true,
        hiddenAt: true,
        deletedAt: true,
        user: { select: { role: true } },
      },
    });
    if (!c || c.deletedAt)
      return { ok: false, error: "대상을 찾을 수 없습니다." };
    if (c.user.role === "admin")
      return { ok: false, error: "신고할 수 없는 콘텐츠입니다." };
    ownerId = c.userId;
    hidden = c.hiddenAt !== null;
  } else {
    const f = await prisma.feed.findUnique({
      where: { id: targetId },
      select: { authorId: true, hiddenAt: true },
    });
    // 회원 글(authorId 존재)만 신고 대상. 관리자 글은 제외.
    if (!f || !f.authorId)
      return { ok: false, error: "대상을 찾을 수 없습니다." };
    ownerId = f.authorId;
    hidden = f.hiddenAt !== null;
  }

  if (ownerId === reporterId)
    return { ok: false, error: "본인 콘텐츠는 신고할 수 없습니다." };
  if (hidden) return { ok: false, error: "이미 가려진 콘텐츠입니다." };

  // 중복 신고는 unique 제약(targetType,targetId,reporterId) 위반 → 무시(created=false).
  try {
    await prisma.report.create({
      data: {
        reporterId,
        targetType,
        targetId,
        reason,
        detail: detail?.trim() || null,
      },
    });
    // 이 대상의 첫 pending 신고면 관리자 알림 1회만(브리게이딩 스팸 완화).
    const pendingCount = await prisma.report.count({
      where: { targetType, targetId, status: "pending" },
    });
    return { ok: true, created: true, firstForTarget: pendingCount === 1 };
  } catch (e) {
    if ((e as { code?: string }).code === "P2002")
      return { ok: true, created: false, firstForTarget: false };
    throw e;
  }
}

export type ReportQueueItem = {
  targetType: ReportTargetType;
  targetId: string;
  preview: string; // 댓글 내용 / 글 제목
  slug: string; // 연결할 /feed/[slug]
  authorNickname: string;
  authorId: string | null;
  reportCount: number;
  reasons: ReportReason[];
  firstReportedAt: string; // ISO
  hidden: boolean;
};

// ── 신고 대상(댓글·회원 글) 공용 로드·요약 ──
const COMMENT_TARGET_SELECT = {
  id: true,
  content: true,
  hiddenAt: true,
  userId: true,
  user: { select: { nickname: true } },
  feed: { select: { slug: true } },
} as const;
const FEED_TARGET_SELECT = {
  id: true,
  title: true,
  slug: true,
  hiddenAt: true,
  authorId: true,
  author: { select: { nickname: true } },
} as const;

type CommentTarget = Prisma.CommentGetPayload<{
  select: typeof COMMENT_TARGET_SELECT;
}>;
type FeedTarget = Prisma.FeedGetPayload<{ select: typeof FEED_TARGET_SELECT }>;

// 관리자 화면에 보일 대상 요약(미리보기·링크·작성자). 큐·숨김 목록 공용.
function commentTarget(c: CommentTarget) {
  return {
    targetType: "comment" as const,
    targetId: c.id,
    preview: c.content,
    slug: c.feed.slug,
    authorNickname: c.user.nickname,
    authorId: c.userId as string | null,
  };
}
function feedTarget(f: FeedTarget) {
  return {
    targetType: "feed" as const,
    targetId: f.id,
    preview: f.title,
    slug: f.slug,
    authorNickname: f.author?.nickname ?? "알 수 없음",
    authorId: f.authorId,
  };
}

// 대상 숨김 시각 설정/해제(PrismaPromise 반환 — $transaction 안에서도 사용).
function setTargetHidden(
  targetType: ReportTargetType,
  targetId: string,
  hiddenAt: Date | null,
) {
  return targetType === "comment"
    ? prisma.comment.update({ where: { id: targetId }, data: { hiddenAt } })
    : prisma.feed.update({ where: { id: targetId }, data: { hiddenAt } });
}

// 관리자 큐: pending 신고를 대상별로 묶어 미리보기·신고 수·사유와 함께 반환.
export async function listReportQueue(): Promise<ReportQueueItem[]> {
  const pend = await prisma.report.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
    select: { targetType: true, targetId: true, reason: true, createdAt: true },
  });
  if (pend.length === 0) return [];

  // 대상별 집계(신고 수·사유 집합·최초 신고 시각).
  type Agg = {
    targetType: ReportTargetType;
    targetId: string;
    count: number;
    reasons: Set<ReportReason>;
    firstReportedAt: Date;
  };
  const byKey = new Map<string, Agg>();
  for (const r of pend) {
    const key = `${r.targetType}:${r.targetId}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.count += 1;
      existing.reasons.add(r.reason as ReportReason);
    } else {
      byKey.set(key, {
        targetType: r.targetType as ReportTargetType,
        targetId: r.targetId,
        count: 1,
        reasons: new Set([r.reason as ReportReason]),
        firstReportedAt: r.createdAt,
      });
    }
  }

  // 대상 본문/제목·작성자·숨김 여부 일괄 로드.
  const commentIds = [...byKey.values()]
    .filter((a) => a.targetType === "comment")
    .map((a) => a.targetId);
  const feedIds = [...byKey.values()]
    .filter((a) => a.targetType === "feed")
    .map((a) => a.targetId);

  const [comments, feeds] = await Promise.all([
    commentIds.length
      ? prisma.comment.findMany({
          where: { id: { in: commentIds } },
          select: COMMENT_TARGET_SELECT,
        })
      : [],
    feedIds.length
      ? prisma.feed.findMany({
          where: { id: { in: feedIds } },
          select: FEED_TARGET_SELECT,
        })
      : [],
  ]);
  const commentMap = new Map(comments.map((c) => [c.id, c]));
  const feedMap = new Map(feeds.map((f) => [f.id, f]));

  const items: ReportQueueItem[] = [];
  for (const a of byKey.values()) {
    const c = a.targetType === "comment" ? commentMap.get(a.targetId) : null;
    const f = a.targetType === "feed" ? feedMap.get(a.targetId) : null;
    const target = c ? commentTarget(c) : f ? feedTarget(f) : null;
    if (!target) continue; // 대상이 사라짐(하드 삭제 등)
    items.push({
      ...target,
      reportCount: a.count,
      reasons: [...a.reasons],
      firstReportedAt: a.firstReportedAt.toISOString(),
      hidden: (c ?? f)!.hiddenAt !== null,
    });
  }
  // 신고 많은 순 → 오래된 순.
  items.sort(
    (x, y) =>
      y.reportCount - x.reportCount ||
      x.firstReportedAt.localeCompare(y.firstReportedAt),
  );
  return items;
}

// 대상을 숨김 처리하고 해당 대상의 pending 신고를 resolved로.
export async function hideTarget(
  targetType: ReportTargetType,
  targetId: string,
): Promise<void> {
  const now = new Date();
  await prisma.$transaction([
    setTargetHidden(targetType, targetId, now),
    prisma.report.updateMany({
      where: { targetType, targetId, status: "pending" },
      data: { status: "resolved", resolvedAt: now },
    }),
  ]);
}

// 숨김 해제(되돌리기). 신고 상태는 유지(이미 resolved).
export async function unhideTarget(
  targetType: ReportTargetType,
  targetId: string,
): Promise<void> {
  await setTargetHidden(targetType, targetId, null);
}

// 신고 기각(숨김 없이 pending → dismissed).
export async function dismissReports(
  targetType: ReportTargetType,
  targetId: string,
): Promise<void> {
  await prisma.report.updateMany({
    where: { targetType, targetId, status: "pending" },
    data: { status: "dismissed", resolvedAt: new Date() },
  });
}

// 관리자 탭 배지: pending 신고가 걸린 고유 대상 수.
export async function countPendingReportTargets(): Promise<number> {
  const groups = await prisma.report.groupBy({
    by: ["targetType", "targetId"],
    where: { status: "pending" },
  });
  return groups.length;
}

// 가려진(hiddenAt) 댓글 + 회원 글 수(신고 탭 라벨용).
export async function countHiddenTargets(): Promise<number> {
  const [comments, feeds] = await Promise.all([
    prisma.comment.count({ where: { hiddenAt: { not: null } } }),
    prisma.feed.count({
      where: { hiddenAt: { not: null }, authorId: { not: null } },
    }),
  ]);
  return comments + feeds;
}

export type HiddenTargetItem = {
  targetType: ReportTargetType;
  targetId: string;
  preview: string;
  slug: string;
  authorNickname: string;
  authorId: string | null;
  hiddenAt: string; // ISO
};

// 현재 가려진(hiddenAt) 댓글·회원 글 — 관리자가 숨김 해제(복구)하는 목록.
export async function listHiddenTargets(): Promise<HiddenTargetItem[]> {
  const [comments, feeds] = await Promise.all([
    prisma.comment.findMany({
      where: { hiddenAt: { not: null } },
      orderBy: { hiddenAt: "desc" },
      select: COMMENT_TARGET_SELECT,
    }),
    prisma.feed.findMany({
      where: { hiddenAt: { not: null }, authorId: { not: null } },
      orderBy: { hiddenAt: "desc" },
      select: FEED_TARGET_SELECT,
    }),
  ]);
  const items: HiddenTargetItem[] = [
    ...comments.map((c) => ({
      ...commentTarget(c),
      hiddenAt: c.hiddenAt!.toISOString(),
    })),
    ...feeds.map((f) => ({
      ...feedTarget(f),
      hiddenAt: f.hiddenAt!.toISOString(),
    })),
  ];
  items.sort((a, b) => b.hiddenAt.localeCompare(a.hiddenAt));
  return items;
}
