// 공유 URL 빌더(서버/클라 공용, 순수 함수).

// 공유 링크는 항상 운영 도메인 기준 정규 URL을 사용(localhost·미리보기 주소 방지).
export const SITE_ORIGIN = "https://by-jang-blog.xyz";

// 사이트 식별 상수(구조화 데이터·메타 공용 출처).
export const SITE_NAME = "BY Playground";
export const SITE_DESCRIPTION = "생각과 기록을 남기는 개인 공간";

export function absoluteUrl(path: string): string {
  return SITE_ORIGIN + (path.startsWith("/") ? path : `/${path}`);
}

// 이미 절대 URL이면 그대로, 상대 경로면 운영 도메인 기준 절대화.
export function toAbsolute(url: string): string {
  return /^https?:\/\//i.test(url) ? url : absoluteUrl(url);
}

// 마크다운/HTML 본문에서 첫 이미지 URL 추출(OG·공유 카드 이미지용). 없으면 null.
export function firstContentImage(content: string): string | null {
  const md = content.match(/!\[[^\]]*\]\(\s*([^)\s]+)/);
  if (md) return md[1];
  const html = content.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (html) return html[1];
  return null;
}

export function xIntentUrl(url: string, text: string): string {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(text);
  return `https://twitter.com/intent/tweet?url=${u}&text=${t}`;
}
