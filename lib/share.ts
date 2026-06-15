// 공유 URL 빌더(서버/클라 공용, 순수 함수).

export function xIntentUrl(url: string, text: string): string {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(text);
  return `https://twitter.com/intent/tweet?url=${u}&text=${t}`;
}
