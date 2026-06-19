import { prisma } from "@/lib/prisma";
import { listableVisibilities, type ViewerRole } from "@/lib/visibility";
import { FEED_LIST_SELECT } from "@/lib/feeds";

// 시리즈 쿼리 공용: 게시·미숨김 + 뷰어 가시 범위(태그·검색과 동일 게이트).
function visibleFeedWhere(role: ViewerRole) {
  return {
    status: "published",
    hiddenAt: null,
    visibility: { in: listableVisibilities(role) },
  } as const;
}

export type SeriesSummary = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
};

// 관리자용: 전체 시리즈 + 글 수(가시성 무관).
export async function listSeries() {
  return prisma.series.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      _count: { select: { feeds: true } },
    },
  });
}

export async function getSeriesById(id: string): Promise<SeriesSummary | null> {
  return prisma.series.findUnique({
    where: { id },
    select: { id: true, slug: true, title: true, description: true },
  });
}

export async function getSeriesBySlug(
  slug: string,
): Promise<SeriesSummary | null> {
  return prisma.series.findUnique({
    where: { slug },
    select: { id: true, slug: true, title: true, description: true },
  });
}

// 공개 인덱스용: 뷰어가 볼 수 있는 글이 1개 이상인 시리즈만 글 수와 함께(글 수·제목순).
export async function getSeriesWithCounts(
  role: ViewerRole,
): Promise<{ slug: string; title: string; count: number }[]> {
  const grouped = await prisma.feed.groupBy({
    by: ["seriesId"],
    where: { ...visibleFeedWhere(role), seriesId: { not: null } },
    _count: { _all: true },
  });
  const ids = grouped
    .map((g) => g.seriesId)
    .filter((x): x is string => x !== null);
  if (ids.length === 0) return [];
  const series = await prisma.series.findMany({
    where: { id: { in: ids } },
    select: { id: true, slug: true, title: true },
  });
  const countById = new Map(grouped.map((g) => [g.seriesId, g._count._all]));
  return series
    .map((s) => ({
      slug: s.slug,
      title: s.title,
      count: countById.get(s.id) ?? 0,
    }))
    .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title, "ko"));
}

// 시리즈 페이지용: 가시 글을 순서대로(카드 렌더용 FEED_LIST_SELECT).
export async function getSeriesPosts(seriesId: string, role: ViewerRole) {
  return prisma.feed.findMany({
    where: { ...visibleFeedWhere(role), seriesId },
    orderBy: [{ seriesOrder: "asc" }, { createdAt: "asc" }],
    select: FEED_LIST_SELECT,
  });
}

// 관리자 편집용: 시리즈의 모든 글(가시성 무관) 순서대로.
export async function listSeriesPostsAdmin(seriesId: string) {
  return prisma.feed.findMany({
    where: { seriesId },
    orderBy: [{ seriesOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, slug: true, title: true, visibility: true },
  });
}

export type SeriesContext = {
  series: { slug: string; title: string };
  total: number;
  index: number; // 0-based
  prev: { slug: string; title: string } | null;
  next: { slug: string; title: string } | null;
};

// 글 상세용: 현재 글이 속한 시리즈에서의 위치 + 시리즈 내 이전/다음(가시 글 기준).
export async function getSeriesContext(
  feed: { id: string; seriesId: string | null },
  role: ViewerRole,
): Promise<SeriesContext | null> {
  if (!feed.seriesId) return null;
  const series = await prisma.series.findUnique({
    where: { id: feed.seriesId },
    select: { slug: true, title: true },
  });
  if (!series) return null;
  const posts = await prisma.feed.findMany({
    where: { ...visibleFeedWhere(role), seriesId: feed.seriesId },
    orderBy: [{ seriesOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, slug: true, title: true },
  });
  const index = posts.findIndex((p) => p.id === feed.id);
  if (index === -1) return null;
  const at = (i: number) =>
    i >= 0 && i < posts.length
      ? { slug: posts[i].slug, title: posts[i].title }
      : null;
  return {
    series,
    total: posts.length,
    index,
    prev: at(index - 1),
    next: at(index + 1),
  };
}

// ── CRUD / 멤버십(관리자) ──

export async function createSeries(input: {
  slug: string;
  title: string;
  description?: string;
}) {
  return prisma.series.create({
    data: {
      slug: input.slug,
      title: input.title,
      description: input.description?.trim() || null,
    },
  });
}

export async function updateSeries(
  id: string,
  input: { slug: string; title: string; description?: string },
) {
  await prisma.series.update({
    where: { id },
    data: {
      slug: input.slug,
      title: input.title,
      description: input.description?.trim() || null,
    },
  });
}

// 시리즈 삭제: 포함 글은 미배정으로 보존(FK SetNull과 별개로 명시 처리해 결정적).
export async function deleteSeries(id: string) {
  await prisma.$transaction([
    prisma.feed.updateMany({
      where: { seriesId: id },
      data: { seriesId: null },
    }),
    prisma.series.delete({ where: { id } }),
  ]);
}

// 글의 시리즈 배정 변경. 새 시리즈면 맨 뒤(order=max+1), null이면 해제. 변화 없으면 no-op.
export async function assignFeedSeries(
  feedId: string,
  seriesId: string | null,
) {
  const cur = await prisma.feed.findUnique({
    where: { id: feedId },
    select: { seriesId: true },
  });
  const current = cur?.seriesId ?? null;
  if (current === (seriesId || null)) return;
  if (!seriesId) {
    await prisma.feed.update({
      where: { id: feedId },
      data: { seriesId: null },
    });
    return;
  }
  const agg = await prisma.feed.aggregate({
    where: { seriesId, id: { not: feedId } },
    _max: { seriesOrder: true },
  });
  const order = (agg._max.seriesOrder ?? -1) + 1;
  await prisma.feed.update({
    where: { id: feedId },
    data: { seriesId, seriesOrder: order },
  });
}

export async function removeFromSeries(feedId: string) {
  await prisma.feed.update({ where: { id: feedId }, data: { seriesId: null } });
}

// 주어진 순서(id 배열)대로 seriesOrder를 0,1,2…로 갱신. 해당 시리즈 소속 글만
// 갱신(updateMany where {id, seriesId})해 타 시리즈 오염을 방지.
export async function reorderSeries(
  seriesId: string,
  orderedFeedIds: string[],
) {
  await prisma.$transaction(
    orderedFeedIds.map((id, i) =>
      prisma.feed.updateMany({
        where: { id, seriesId },
        data: { seriesOrder: i },
      }),
    ),
  );
}
