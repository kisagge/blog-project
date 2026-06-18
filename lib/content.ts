import GithubSlugger from "github-slugger";

// 마크다운 본문에서 읽는 시간·목차를 뽑는 순수 유틸(클라/서버 공용 — server-only 아님).

export const KOREAN_CHARS_PER_MINUTE = 500;

// 인라인 마크다운 제거(코드·이미지·링크·강조). 제목 텍스트/슬러그 입력에 사용.
function stripInline(s: string): string {
  return s
    .replace(/`([^`]*)`/g, "$1") // 인라인 코드
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "") // 이미지
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // 링크 → 텍스트
    .replace(/[*_~]/g, "") // 강조 기호
    .trim();
}

// 마크다운 본문을 표시용 평문으로(코드블록·기호·목록 마커 제거). 읽는 시간·검색 스니펫 공용.
export function stripMarkdown(content: string): string {
  let s = content;
  s = s.replace(/```[\s\S]*?```/g, ""); // 펜스 코드블록
  s = s.replace(/~~~[\s\S]*?~~~/g, "");
  s = s.replace(/`[^`]*`/g, ""); // 인라인 코드
  s = s.replace(/!\[[^\]]*\]\([^)]*\)/g, ""); // 이미지
  s = s.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1"); // 링크 → 텍스트
  s = s.replace(/^\s{0,3}#{1,6}\s+/gm, ""); // 제목 기호
  s = s.replace(/^\s*>+\s?/gm, ""); // 인용
  s = s.replace(/^\s*[-*+]\s+/gm, ""); // 불릿
  s = s.replace(/^\s*\d+\.\s+/gm, ""); // 번호 목록
  s = s.replace(/[*_~`#>]/g, ""); // 남은 기호
  return s;
}

// 읽는 데 걸리는 예상 분(최소 1). 마크다운 기호는 제외하고 비공백 글자 수로 계산.
export function readingTimeMinutes(content: string): number {
  const chars = stripMarkdown(content).replace(/\s/g, "").length;
  return Math.max(1, Math.ceil(chars / KOREAN_CHARS_PER_MINUTE));
}

// 검색 스니펫: 본문을 평문화 후 첫 매치 토큰을 중심으로 발췌(앞/뒤 생략 시 …).
// 매치가 없으면(제목·요약에만 걸린 경우 등) 본문 앞부분으로 폴백. 표시용이라 완벽 파싱 불필요.
export function makeSnippet(
  content: string,
  terms: string[],
  radius = 60,
): string {
  const text = stripMarkdown(content).replace(/\s+/g, " ").trim();
  if (!text) return "";
  const lower = text.toLowerCase();
  let idx = -1;
  let matchLen = 0;
  for (const t of terms) {
    const at = lower.indexOf(t.toLowerCase());
    if (at !== -1 && (idx === -1 || at < idx)) {
      idx = at;
      matchLen = t.length;
    }
  }
  // 미매치 → 앞부분 발췌.
  if (idx === -1) {
    const head = text.slice(0, radius * 2 + 20);
    return head.length < text.length ? `${head}…` : head;
  }
  const start = Math.max(0, idx - radius);
  const end = Math.min(text.length, idx + matchLen + radius);
  const body = text.slice(start, end);
  return `${start > 0 ? "…" : ""}${body}${end < text.length ? "…" : ""}`;
}

export type TocItem = { depth: number; text: string; slug: string };

// 본문 제목(h2~h3)으로 목차 추출. 펜스 코드블록 안의 '#'은 제외.
// slug는 github-slugger(rehype-slug와 동일)로 만들어 렌더된 헤딩 id와 일치시킨다.
export function extractToc(content: string): TocItem[] {
  const slugger = new GithubSlugger(); // 호출당 새로 → 중복 제목 dedup
  const out: TocItem[] = [];
  let inFence = false;
  for (const line of content.split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (!m) continue;
    const depth = m[1].length;
    if (depth < 2 || depth > 3) continue; // 글 제목은 페이지 h1 → 본문 h2~h3만
    const text = stripInline(m[2]);
    if (!text) continue;
    out.push({ depth, text, slug: slugger.slug(text) });
  }
  return out;
}
