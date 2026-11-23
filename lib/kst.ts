// KST(UTC+9) 시간 헬퍼 — 조회수 하루 키, 하루 게시 제한, 통계·아카이브·보존 정리 등에 공용.
// 한국은 서머타임이 없어 고정 오프셋으로 충분하다.

export const KST_OFFSET_MS = 9 * 3600 * 1000;
export const DAY_MS = 86_400_000;

// UTC 시각을 KST 벽시계로 옮긴 Date(getUTC* 로 KST 연·월·일을 읽는다).
const toKst = (d: Date) => new Date(d.getTime() + KST_OFFSET_MS);

// 임의 시각의 KST 날짜 문자열(YYYY-MM-DD). View.day 등 날짜 키 형식.
export function kstDayOf(d: Date): string {
  return toKst(d).toISOString().slice(0, 10);
}

// KST 기준 오늘 날짜 문자열(YYYY-MM-DD).
export function kstDay(): string {
  return kstDayOf(new Date());
}

// 최근 days일의 KST 날짜 문자열 배열, 오래된 → 오늘(통계 추이 윈도우).
export function kstRecentDays(days: number, now: Date = new Date()): string[] {
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i--)
    out.push(kstDayOf(new Date(now.getTime() - i * DAY_MS)));
  return out;
}

// KST 기준 연·월(아카이브 그룹핑).
export function kstYearMonth(d: Date): { year: number; month: number } {
  const k = toKst(d);
  return { year: k.getUTCFullYear(), month: k.getUTCMonth() + 1 };
}

// KST 기준 일(日) — 아카이브 목록의 날짜 칸 표시용.
export function kstDayOfMonth(d: Date): number {
  return toKst(d).getUTCDate();
}

// KST 기준 오늘 0시를 UTC Date로(범위 비교 경계).
export function kstStartOfTodayUtc(): Date {
  const kst = toKst(new Date());
  return new Date(
    Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()) -
      KST_OFFSET_MS,
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
  const utcMs = Date.UTC(y, mo - 1, d, h, mi) - KST_OFFSET_MS;
  // KST로 되돌려 입력과 일치하는지 확인(2월 30일 등 달력상 불가 값 거부).
  const back = toKst(new Date(utcMs));
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

// "YYYY-MM-DDTHH:MM"(KST 벽시계) → 사람이 읽는 KST 표시. 예약 발행 미리보기용. 무효면 "".
export function formatKstWallClock(wallClock: string): string {
  const at = kstWallClockToUtc(wallClock);
  if (!at) return "";
  return at.toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
