// 사용자가 "동작 줄이기"(prefers-reduced-motion: reduce)를 선호하는지.
// JS 스무스 스크롤은 CSS 미디어쿼리로 막을 수 없어 호출부에서 직접 분기해야 한다.
// SSR(window 없음)에선 false(스무스) — 실제 스크롤은 클라에서만 발생.
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
