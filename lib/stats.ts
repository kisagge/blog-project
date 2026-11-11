import "server-only";
import { prisma } from "@/lib/prisma";
import { countUsersByStatus } from "@/lib/users";
import { COMPLETE_DEPTH } from "@/lib/read-metrics";

export type TrendPoint = { day: string; count: number };

// 최근 days일의 KST(UTC+9) 날짜 문자열(YYYY-MM-DD) 배열, 오래된→오늘.
function recentKstDays(days: number): string[] {
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    out.push(
      new Date(Date.now() + 9 * 3600 * 1000 - i * 86_400_000)
        .toISOString()
        .slice(0, 10),
    );
  }
  return out;
}

// groupBy 결과(빈 날 없음)를 윈도우에 맞춰 0으로 채운다.
function fillTrend(
  window: string[],
  counts: Map<string, number>,
): TrendPoint[] {
  return window.map((day) => ({ day, count: counts.get(day) ?? 0 }));
}

// 일별 피드 조회수 추이. View.day가 이미 KST 문자열이라 groupBy로 바로 집계(raw 불필요).
export async function getViewTrend(days = 14): Promise<TrendPoint[]> {
  const window = recentKstDays(days);
  const rows = await prisma.view.groupBy({
    by: ["day"],
    where: { entityType: "feed", day: { gte: window[0] } },
    _count: { _all: true },
  });
  const counts = new Map(rows.map((r) => [r.day, r._count._all]));
  return fillTrend(window, counts);
}

// 일별 회원 가입 추이. User.createdAt은 DateTime이라 raw date(+9h)로 KST 일자 그룹.
export async function getSignupTrend(days = 14): Promise<TrendPoint[]> {
  const window = recentKstDays(days);
  // getViewTrend와 동일하게 윈도우(최근 N일 KST) 밖은 제외 — date(+9h)가 YYYY-MM-DD라 문자열 비교.
  const rows = await prisma.$queryRaw<{ day: string; c: bigint | number }[]>`
    SELECT date("createdAt", '+9 hours') AS day, COUNT(*) AS c
    FROM "User"
    WHERE role = 'member' AND date("createdAt", '+9 hours') >= ${window[0]}
    GROUP BY day
  `;
  const counts = new Map(rows.map((r) => [r.day, Number(r.c)]));
  return fillTrend(window, counts);
}

// 인기글: 누적 조회수 상위(게시·미숨김, 관리자·회원 글 포함).
export async function getTopFeeds(take = 10) {
  return prisma.feed.findMany({
    where: { status: "published", hiddenAt: null },
    orderBy: { viewCount: "desc" },
    take,
    select: { slug: true, title: true, viewCount: true },
  });
}

export type ReadStat = {
  slug: string;
  title: string;
  views: number; // 기간 내 조회(방문자·일 단위)
  measured: number; // 그중 읽기 지표가 들어온 조회(비콘 수신)
  completionRate: number | null; // 완독(깊이 ≥ COMPLETE_DEPTH) / measured, 0~1
  avgSeconds: number | null; // measured 평균 활성 시간(초)
};

// 글별 읽기 지표: 최근 days일(KST) 조회수 상위 take개 글의 완독률·평균 읽은 시간.
// 지표는 조회 행에 덧붙는 값이라 측정 도입 전 조회·비콘이 오지 않은 조회는 분모(measured)에서 빠진다.
export async function getReadStats(days = 30, take = 10): Promise<ReadStat[]> {
  const since = recentKstDays(days)[0];
  const base = { entityType: "feed", day: { gte: since } } as const;
  const top = await prisma.view.groupBy({
    by: ["entityId"],
    where: base,
    _count: { _all: true },
    orderBy: { _count: { entityId: "desc" } },
    take,
  });
  if (top.length === 0) return [];
  const ids = top.map((t) => t.entityId);
  const [measured, completed, feeds] = await Promise.all([
    prisma.view.groupBy({
      by: ["entityId"],
      where: { ...base, entityId: { in: ids }, activeSeconds: { not: null } },
      _count: { _all: true },
      _avg: { activeSeconds: true },
    }),
    prisma.view.groupBy({
      by: ["entityId"],
      where: {
        ...base,
        entityId: { in: ids },
        activeSeconds: { not: null },
        scrollDepth: { gte: COMPLETE_DEPTH },
      },
      _count: { _all: true },
    }),
    prisma.feed.findMany({
      where: { id: { in: ids } },
      select: { id: true, slug: true, title: true },
    }),
  ]);
  const m = new Map(measured.map((r) => [r.entityId, r]));
  const c = new Map(completed.map((r) => [r.entityId, r._count._all]));
  const f = new Map(feeds.map((r) => [r.id, r]));
  // 삭제된 글의 조회 기록은 제외(제목·링크 없음).
  return top.flatMap((t) => {
    const feed = f.get(t.entityId);
    if (!feed) return [];
    const mm = m.get(t.entityId);
    const n = mm?._count._all ?? 0;
    return [
      {
        slug: feed.slug,
        title: feed.title,
        views: t._count._all,
        measured: n,
        completionRate: n ? (c.get(t.entityId) ?? 0) / n : null,
        avgSeconds:
          n && mm?._avg.activeSeconds != null
            ? Math.round(mm._avg.activeSeconds)
            : null,
      },
    ];
  });
}

// 헤드라인 요약 수치.
export async function getStatsSummary() {
  const [views, members, comments, feeds] = await Promise.all([
    prisma.feed.aggregate({ _sum: { viewCount: true } }),
    countUsersByStatus("approved"),
    prisma.comment.count(),
    prisma.feed.count(),
  ]);
  return {
    totalViews: views._sum.viewCount ?? 0,
    members,
    comments,
    feeds,
  };
}
