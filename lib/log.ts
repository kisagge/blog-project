import "server-only";

// fire-and-forget 실패를 조용히 삼키지 않고 컨테이너 로그에 한 줄 남긴다(스택 미포함 — 512MB 로그 절약).
// 사용: void notify(...).catch(swallow("notify:comment-reply"))
export function swallow(tag: string): (e: unknown) => void {
  return (e: unknown) => {
    console.error(`[${tag}]`, e instanceof Error ? e.message : e);
  };
}
