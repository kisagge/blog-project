// KST(UTC+9) 시간 헬퍼 — 조회수 하루 키, 하루 게시 제한 등에 공용.

// KST 기준 오늘 날짜 문자열(YYYY-MM-DD).
export function kstDay(): string {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

// KST 기준 오늘 0시를 UTC Date로(범위 비교 경계).
export function kstStartOfTodayUtc(): Date {
  const kst = new Date(Date.now() + 9 * 3600 * 1000);
  return new Date(
    Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()) -
      9 * 3600 * 1000,
  );
}
