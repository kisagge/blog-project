import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { listableVisibilities, type ViewerRole } from "@/lib/visibility";
import { makeSnippet } from "@/lib/content";
import { tagSlugVariants } from "@/lib/tags";

export const FEED_PAGE_SIZE = 10;

// 목록 카드(toFeedCard) 호환 select — searchFeeds·저장 목록 등 공용.
export const FEED_LIST_SELECT = {
  id: true, // FTS rank 재정렬·id 매핑용(toFeedCard는 무시 → 카드 출력엔 영향 없음)
  slug: true,
  title: true,
  summary: true,
  createdAt: true,
  viewCount: true,
  visibility: true,
  author: { select: { id: true, nickname: true } },
  feedTags: { select: { tag: { select: { name: true, slug: true } } } },
} as const;

// FTS5 trigram은 3자 이상 토큰만 색인/매치한다. 공백 분리 후 길이 ≥3 토큰만 채택.
// 적격 토큰이 없으면 null → 호출부가 기존 contains 경로로 폴백(2자 등 짧은 검색 보존).
function ftsTokens(term: string): string[] | null {
  const toks = term.split(/\s+/).filter((t) => t.length >= 3);
  return toks.length ? toks : null;
}

// FTS5 MATCH 식: 각 토큰을 큰따옴표 phrase로 감싸(연산자/특수문자를 데이터로 취급)
// 내부 "는 ""로 이중화, 다중 토큰은 AND(모두 포함)로 결합.
function ftsMatchExpr(tokens: string[]): string {
  return tokens.map((t) => `"${t.replace(/"/g, '""')}"`).join(" AND ");
}

// 랭킹 후보 상한(블로그 규모). 매치가 이보다 많으면 BM25 하위(관련도 낮은) 글이 잘림(silent truncation).
const FTS_CANDIDATE_CAP = 500;

// 검색어 토큰 → BM25 관련도순 Feed.id 목록(제목>요약>본문 가중). 접근/author/tag 필터는
// 호출부 Prisma가 적용하므로 여기선 순수 매칭+랭킹만(후보 id는 비민감, 실데이터는 2단계 게이트).
async function ftsRankedIds(tokens: string[]): Promise<string[]> {
  const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT f.id AS id
       FROM feed_fts
       JOIN "Feed" f ON f.rowid = feed_fts.rowid
      WHERE feed_fts MATCH ?
      ORDER BY bm25(feed_fts, 10.0, 5.0, 1.0) ASC, f."createdAt" DESC
      LIMIT ${FTS_CANDIDATE_CAP}`,
    ftsMatchExpr(tokens),
  );
  return rows.map((r) => r.id);
}

// 검색어가 있을 때만 결과 페이지에 본문 스니펫 부착. 본문(content)은 FEED_LIST_SELECT에
// 없으므로 페이지 슬라이스 id로만 별도 조회(최대 take+1건) → 매치 중심 발췌. N+1 아님(1쿼리).
async function withSnippets<T extends { id: string }>(
  items: T[],
  terms: string[],
): Promise<(T & { snippet?: string })[]> {
  if (terms.length === 0 || items.length === 0) return items;
  const bodies = await prisma.feed.findMany({
    where: { id: { in: items.map((i) => i.id) } },
    select: { id: true, content: true },
  });
  const bmap = new Map(bodies.map((b) => [b.id, b.content]));
  return items.map((i) => ({
    ...i,
    snippet: makeSnippet(bmap.get(i.id) ?? "", terms),
  }));
}

// 목록: 뷰어 권한으로 볼 수 있는 글(anon=전체공개, 회원/관리자=전체공개+회원공개).
// 검색어(q)에 3자+ 토큰이 있으면 FTS5(trigram 부분일치 + BM25 관련도순), 그 외(빈 검색·2자)는
// 제목/내용/요약 부분일치 최신순. take+1로 다음 페이지 존재(hasMore)를 추가 쿼리 없이 판단.
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
  const baseWhere = {
    status: "published", // 임시저장(draft)은 공개 목록에서 제외
    hiddenAt: null, // 신고로 가려진 글 제외
    visibility: { in: listableVisibilities(role) },
    ...(author === "admin"
      ? { authorId: null }
      : author === "member"
        ? { authorId: { not: null } }
        : {}),
    ...(tag && { feedTags: { some: { tag: { slug: tag } } } }),
  };

  const tokens = term ? ftsTokens(term) : null;
  // 하이라이트·스니펫 토큰: FTS면 3자+ 토큰, 2자 폴백이면 검색어 전체, 빈 검색이면 없음.
  const terms = term ? (tokens ?? [term]) : [];

  // FTS 경로: 관련도순 id 후보 → 권한/필터는 Prisma가 적용 → rank순 재정렬 → 슬라이스.
  if (tokens) {
    const rankedIds = await ftsRankedIds(tokens);
    if (rankedIds.length === 0) return { items: [], hasMore: false };
    const rows = await prisma.feed.findMany({
      where: { ...baseWhere, id: { in: rankedIds } },
      select: FEED_LIST_SELECT, // orderBy 불필요 — 아래서 rank 순 재정렬
    });
    const order = new Map(rankedIds.map((id, i) => [id, i] as const));
    rows.sort((a, b) => order.get(a.id)! - order.get(b.id)!);
    const page = rows.slice(skip, skip + take + 1);
    const hasMore = page.length > take;
    const items = hasMore ? page.slice(0, take) : page;
    return { items: await withSnippets(items, terms), hasMore };
  }

  // 빈 검색어 또는 2자 폴백: 기존 contains 최신순.
  const rows = await prisma.feed.findMany({
    where: {
      ...baseWhere,
      ...(term && {
        OR: [
          { title: { contains: term } },
          { content: { contains: term } },
          { summary: { contains: term } },
        ],
      }),
    },
    orderBy: { createdAt: "desc" },
    select: FEED_LIST_SELECT,
    skip,
    take: take + 1,
  });
  const hasMore = rows.length > take;
  const items = hasMore ? rows.slice(0, take) : rows;
  return { items: await withSnippets(items, terms), hasMore };
}

// 공개 인기 글: 뷰어가 볼 수 있는 게시·미숨김 글을 누적 조회수순(관리자+회원 글 모두).
// /admin/stats의 getTopFeeds와 달리 visibility를 필터해 공개 발견성 페이지에 안전하게 노출.
export async function getPublicTopFeeds(role: ViewerRole, take = 20) {
  return prisma.feed.findMany({
    where: {
      status: "published",
      hiddenAt: null,
      visibility: { in: listableVisibilities(role) },
    },
    orderBy: [{ viewCount: "desc" }, { createdAt: "desc" }],
    take,
    select: FEED_LIST_SELECT,
  });
}

// 태그 전용 라우트용: 해당 태그가 달린 게시·미숨김·뷰어 가시 글(관리자+회원) 최신순.
// 태그는 전역 사전이고 인덱스(getTagsWithCounts)도 작성자 무관 집계라, 상세도 작성자
// 무관으로 맞춰 인덱스↔상세 불일치(회원 글 태그 클릭 시 404)를 제거. 개인 블로그 규모상 무페이지네이션.
// 슬러그는 NFC·NFD 두 형태로 매칭 — NFD로 저장된 한글 태그도 NFC 요청 경로로 찾는다.
export async function getFeedsByTag(slug: string, role: ViewerRole) {
  return prisma.feed.findMany({
    where: {
      status: "published",
      hiddenAt: null,
      visibility: { in: listableVisibilities(role) },
      feedTags: { some: { tag: { slug: { in: tagSlugVariants(slug) } } } },
    },
    orderBy: { createdAt: "desc" },
    select: FEED_LIST_SELECT,
  });
}

export type AdjacentFeed = { slug: string; title: string };

// 글 상세 이전/다음 내비: 현재 글 기준 시간순 인접 1건씩(이전=더 오래된, 다음=더 최신).
// 뷰어 가시 범위 + 같은 작성자 분류(관리자 글↔관리자 글, 회원 글↔회원 글)로 한정.
export async function getAdjacentFeeds(
  feed: { id: string; createdAt: Date; authorId: string | null },
  role: ViewerRole,
): Promise<{ prev: AdjacentFeed | null; next: AdjacentFeed | null }> {
  const base = {
    status: "published",
    hiddenAt: null,
    visibility: { in: listableVisibilities(role) },
    ...(feed.authorId === null
      ? { authorId: null }
      : { authorId: { not: null } }),
    id: { not: feed.id },
  } as const;
  const select = { slug: true, title: true } as const;
  const [prev, next] = await Promise.all([
    prisma.feed.findFirst({
      where: { ...base, createdAt: { lt: feed.createdAt } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select,
    }),
    prisma.feed.findFirst({
      where: { ...base, createdAt: { gt: feed.createdAt } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select,
    }),
  ]);
  return { prev, next };
}

export type RelatedFeed = { slug: string; title: string; viewCount: number };

// 관련 글: 현재 글과 태그를 공유하는 다른 게시·미숨김 글을 뷰어 가시 범위로 추천.
// 공유 태그 수 desc → 최신 desc 순(관련도 우선). 태그 없으면 빈 배열.
export async function getRelatedFeeds(
  feedId: string,
  tagSlugs: string[],
  role: ViewerRole,
  take = 5,
): Promise<RelatedFeed[]> {
  if (tagSlugs.length === 0) return [];
  const candidates = await prisma.feed.findMany({
    where: {
      id: { not: feedId },
      status: "published",
      hiddenAt: null,
      visibility: { in: listableVisibilities(role) },
      feedTags: { some: { tag: { slug: { in: tagSlugs } } } },
    },
    orderBy: { createdAt: "desc" },
    take: Math.max(take * 4, 20), // 공유 태그 수로 재정렬할 후보 여유
    select: {
      slug: true,
      title: true,
      viewCount: true,
      createdAt: true,
      feedTags: { select: { tag: { select: { slug: true } } } },
    },
  });
  const wanted = new Set(tagSlugs);
  return candidates
    .map((f) => ({
      slug: f.slug,
      title: f.title,
      viewCount: f.viewCount,
      createdAt: f.createdAt,
      shared: f.feedTags.filter((ft) => wanted.has(ft.tag.slug)).length,
    }))
    .sort((a, b) => b.shared - a.shared || +b.createdAt - +a.createdAt)
    .slice(0, take)
    .map(({ slug, title, viewCount }) => ({ slug, title, viewCount }));
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
// q가 있으면 제목·슬러그 부분일치로 필터(관리자 CMS 탐색용 — 초안 포함 유지).
export async function getAdminFeedsPage(
  page: number,
  pageSize = ADMIN_PAGE_SIZE,
  q = "",
) {
  const take = pageSize;
  const skip = (Math.max(1, page) - 1) * take;
  const term = q.trim();
  const where = {
    authorId: null, // 관리자 CMS는 관리자 글만(회원 글 제외)
    ...(term && {
      OR: [{ title: { contains: term } }, { slug: { contains: term } }],
    }),
  };
  const [items, total] = await Promise.all([
    prisma.feed.findMany({
      where,
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
    prisma.feed.count({ where }),
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
