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

type DateInput = Date | string | number;

// KST 날짜(표시용, date-only). 예: "2026. 6. 18."
export function kstDate(d: DateInput): string {
  return new Date(d).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" });
}

// KST 날짜+시각(표시용).
export function kstDateTime(d: DateInput): string {
  return new Date(d).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
}

// <time dateTime="…">용 머신리더블 ISO 인스턴트(UTC, 타임존 무관).
export function isoInstant(d: DateInput): string {
  return new Date(d).toISOString();
}
