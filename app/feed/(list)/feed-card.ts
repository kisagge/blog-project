import type { Visibility } from "@/lib/visibility";
import { postedAt } from "@/lib/feed-dates";

// 목록 카드: 클라이언트로 넘기는 직렬화 형태(Date → ISO 문자열).
export type FeedCard = {
  slug: string;
  title: string;
  summary: string | null;
  snippet: string | null; // 검색 시 매치 중심 본문 발췌(비검색이면 null → summary 표시)
  date: string; // 게시일(postedAt) ISO
  viewCount: number;
  visibility: Visibility;
  authorName: string | null; // 회원 글이면 작성자 닉네임(관리자 글은 null)
  authorId: string | null; // 회원 글이면 작성자 id(프로필 링크), 관리자 글은 null
  tags: { name: string; slug: string }[];
};

// searchFeeds 행 → 직렬화 카드. (관리자 목록·회원 목록·무한스크롤 공용)
export function toFeedCard(f: {
  slug: string;
  title: string;
  summary: string | null;
  snippet?: string;
  createdAt: Date;
  publishedAt?: Date | null;
  viewCount: number;
  visibility: string;
  author: { id: string; nickname: string } | null;
  feedTags?: { tag: { name: string; slug: string } }[];
}): FeedCard {
  return {
    slug: f.slug,
    title: f.title,
    summary: f.summary,
    snippet: f.snippet ?? null,
    date: postedAt(f).toISOString(),
    viewCount: f.viewCount,
    visibility: f.visibility as Visibility,
    authorName: f.author?.nickname ?? null,
    authorId: f.author?.id ?? null,
    tags: (f.feedTags ?? []).map((ft) => ft.tag),
  };
}

// 다음 페이지 덧붙이기: offset 페이지네이션이라 로드 사이에 글이 추가·삭제되면 항목이 밀려
// 같은 글이 다시 올 수 있다 → slug 기준으로 이미 있는 글은 건너뜀(중복 표시·key 충돌 방지).
export function appendUnique<T extends { slug: string }>(
  prev: T[],
  next: T[],
): T[] {
  const seen = new Set(prev.map((c) => c.slug));
  return [...prev, ...next.filter((c) => !seen.has(c.slug))];
}
