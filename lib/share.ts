// 공유 URL 빌더(서버/클라 공용, 순수 함수).

// 공유 링크는 항상 운영 도메인 기준 정규 URL을 사용(localhost·미리보기 주소 방지).
export const SITE_ORIGIN = "https://by-jang-blog.xyz";

export function absoluteUrl(path: string): string {
  return SITE_ORIGIN + (path.startsWith("/") ? path : `/${path}`);
}

export function xIntentUrl(url: string, text: string): string {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(text);
  return `https://twitter.com/intent/tweet?url=${u}&text=${t}`;
}
