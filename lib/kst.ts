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

// "YYYY-MM-DDTHH:MM"(KST 벽시계) → UTC Date. 예약 발행 입력 해석용(브라우저 TZ 무관 결정적).
// 형식 불일치·달력상 불가능한 값이면 null.
export function kstWallClockToUtc(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null;
  const utcMs = Date.UTC(y, mo - 1, d, h, mi) - 9 * 3600 * 1000;
  // KST로 되돌려 입력과 일치하는지 확인(2월 30일 등 달력상 불가 값 거부).
  const back = new Date(utcMs + 9 * 3600 * 1000);
  if (
    back.getUTCFullYear() !== y ||
    back.getUTCMonth() !== mo - 1 ||
    back.getUTCDate() !== d ||
    back.getUTCHours() !== h ||
    back.getUTCMinutes() !== mi
  )
    return null;
  return new Date(utcMs);
}
