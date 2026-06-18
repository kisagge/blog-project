import { Fragment, type ReactNode } from "react";

// 정규식 특수문자 무력화(검색어를 데이터로 취급 → 인젝션 방지).
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// 검색어 토큰을 텍스트에서 찾아 <mark>로 감싼 React 노드 반환. 문자열 분할 후 매치 조각만
// 엘리먼트로 감싸므로 HTML 주입이 없다(XSS 안전). 대소문자 무시, 1자 토큰은 제외.
export function highlightText(text: string, query: string): ReactNode {
  const terms = [
    ...new Set(
      query
        .trim()
        .split(/\s+/)
        .filter((t) => t.length >= 2),
    ),
  ];
  if (terms.length === 0) return text;
  // 캡처 그룹으로 split하면 결과 배열의 홀수 인덱스가 매치 조각 → test() lastIndex 부작용 회피.
  const re = new RegExp(`(${terms.map(escapeRegExp).join("|")})`, "gi");
  const parts = text.split(re);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <mark
        key={i}
        className="rounded bg-amber-200/70 text-inherit dark:bg-amber-500/30"
      >
        {part}
      </mark>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}
