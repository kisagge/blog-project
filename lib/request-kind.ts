// 전역 레이트 리밋(proxy)의 요청 분류. 화면 링크 프리페치·앱 내 이동은 페이지 한 번에 수십 건의 RSC 요청을
// 만들어(실측: /feed 한 번에 28건) 문서·액션과 같은 예산을 쓰면 몇 페이지 만에 429가 났다 → 따로 센다.
// Next는 proxy에 RSC 내부 헤더(rsc·next-router-prefetch)와 _rsc를 숨기므로, 브라우저가 붙이는
// Fetch Metadata(sec-fetch-dest)로 구분한다. 위조해도 다른(역시 제한된) 버킷으로 옮겨갈 뿐이다.
export type RequestKind = "document" | "rsc" | "other";

export function requestKind(
  method: string,
  pathname: string,
  headers: Headers,
): RequestKind {
  if (method !== "GET") return "other"; // 서버 액션·폼 POST 등
  if (pathname.startsWith("/api/")) return "other"; // API·SSE·비콘은 기존 예산
  const dest = headers.get("sec-fetch-dest");
  if (dest === "document") return "document";
  if (dest === "empty") return "rsc"; // fetch로 가져오는 페이지 = 프리페치·클라이언트 내비게이션
  return "other";
}

const WINDOW_MS = 10_000;

// 버킷별 한도(10초당). 문서·액션·API 120(기존), RSC 300 — 페이지당 프리페치 ~30건 기준 10쪽 이상 여유.
export const RATE_LIMITS: Record<
  "default" | "rsc",
  { limit: number; windowMs: number }
> = {
  default: { limit: 120, windowMs: WINDOW_MS },
  rsc: { limit: 300, windowMs: WINDOW_MS },
};

export function rateBucket(kind: RequestKind): "default" | "rsc" {
  return kind === "rsc" ? "rsc" : "default";
}
