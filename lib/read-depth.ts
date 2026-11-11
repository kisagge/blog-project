// 본문(article)을 어디까지 읽어 내려갔는지(0~100%) — 화면 아랫단이 본문의 몇 %까지 닿았나.
// 문서 전체(진행바) 대신 본문 기준이라 아래 댓글 길이에 영향받지 않는다. 짧아서 한 화면에
// 다 보이는 글은 처음부터 100. 순수 함수(클라이언트 트래커·테스트 공용).
export function readDepth(
  articleTop: number, // getBoundingClientRect().top (뷰포트 기준)
  articleHeight: number,
  viewportHeight: number,
): number {
  if (articleHeight <= 0) return 0;
  const seen = (viewportHeight - articleTop) / articleHeight;
  return Math.round(Math.min(1, Math.max(0, seen)) * 100);
}

// 읽은 시간 표시(관리자 통계): 59초 → "59초", 125초 → "2분 5초", 120초 → "2분".
export function formatReadTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}초`;
  return s ? `${m}분 ${s}초` : `${m}분`;
}
