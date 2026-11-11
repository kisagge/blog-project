import { kstDate } from "@/lib/kst";

// 글의 수정 시각 관련 순수 헬퍼.
// Feed.updatedAt(@updatedAt)은 조회수 증가·숨김·시리즈 정렬 등 모든 update에 갱신돼
// "내용이 바뀐 시각"으로 쓸 수 없다 → 게시 후 본문 변경 시에만 기록하는 editedAt을 쓴다.

type Body = { title: string; content: string; summary?: string | null };

// 줄바꿈 정규화: 브라우저는 폼 제출 시 textarea 값을 CRLF로 보내므로, 줄바꿈 방식만 다른 건 같은 내용으로 본다.
export const normalizeEol = (s: string) => s.replace(/\r\n?/g, "\n");

// 제목·본문(·요약)이 실제로 바뀌었는지. 요약은 next에 없으면(회원 글 폼엔 요약 없음) 비교하지 않고,
// null과 빈 문자열은 같은 값으로 본다. 줄바꿈 방식(CRLF/LF) 차이는 변경 아님.
export function bodyChanged(prev: Body, next: Body): boolean {
  if (prev.title !== next.title) return true;
  if (normalizeEol(prev.content) !== normalizeEol(next.content)) return true;
  if (next.summary === undefined) return false;
  return normalizeEol(prev.summary ?? "") !== normalizeEol(next.summary ?? "");
}

// 글 상단에 "수정" 날짜를 보일지. 표시 날짜보다 KST 날짜가 뒤인 수정만 노출
// (같은 날의 오타 정정은 생략, 예약 글의 게시 전 편집처럼 더 이른 시각도 생략).
export function visibleEditedAt(
  editedAt: Date | null | undefined,
  shownDate: Date,
): Date | null {
  if (!editedAt || editedAt <= shownDate) return null;
  return kstDate(editedAt) === kstDate(shownDate) ? null : editedAt;
}

// 검색엔진용 마지막 수정 시각(JSON-LD dateModified·sitemap lastModified).
export function feedLastModified(feed: {
  createdAt: Date;
  publishedAt?: Date | null;
  editedAt?: Date | null;
}): Date {
  return feed.editedAt ?? feed.publishedAt ?? feed.createdAt;
}
