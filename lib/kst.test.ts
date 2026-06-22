import { kstDate, kstDateTime, isoInstant, kstWallClockToUtc } from "@/lib/kst";

// 포맷 문자열의 구두점은 ICU 버전 의존이라 단정하지 않고, KST(UTC+9) 경계 동작을 검증.
describe("kstDate", () => {
  test("UTC 15:00은 KST로 익일(경계 넘김)", () => {
    // 2026-06-18 15:00Z + 9h = 2026-06-19 00:00 KST
    const s = kstDate("2026-06-18T15:00:00Z");
    expect(s).toContain("2026");
    expect(s).toContain("19");
  });

  test("UTC 14:59는 아직 같은 날(KST 23:59)", () => {
    const s = kstDate("2026-06-18T14:59:00Z");
    expect(s).toContain("18");
  });

  test("Date 입력과 문자열 입력이 같은 결과", () => {
    const iso = "2026-06-18T15:00:00Z";
    expect(kstDate(new Date(iso))).toBe(kstDate(iso));
  });
});

describe("kstDateTime", () => {
  test("날짜와 시각을 함께 포함(같은 입력에서 kstDate보다 김)", () => {
    const iso = "2026-06-18T15:00:00Z";
    const dt = kstDateTime(iso);
    expect(dt).toContain("2026");
    expect(dt.length).toBeGreaterThan(kstDate(iso).length);
  });
});

describe("kstWallClockToUtc", () => {
  test("KST 벽시계를 UTC로 9시간 당김", () => {
    // 2026-06-22 09:00 KST = 2026-06-22 00:00 UTC
    expect(kstWallClockToUtc("2026-06-22T09:00")?.toISOString()).toBe(
      "2026-06-22T00:00:00.000Z",
    );
    // 2026-06-22 08:30 KST = 2026-06-21 23:30 UTC(자정 경계 넘김)
    expect(kstWallClockToUtc("2026-06-22T08:30")?.toISOString()).toBe(
      "2026-06-21T23:30:00.000Z",
    );
  });

  test("형식 불일치·달력상 불가 값은 null", () => {
    expect(kstWallClockToUtc("")).toBeNull();
    expect(kstWallClockToUtc("2026-06-22 09:00")).toBeNull(); // T 없음
    expect(kstWallClockToUtc("2026-13-01T00:00")).toBeNull(); // 13월
    expect(kstWallClockToUtc("2026-02-30T00:00")).toBeNull(); // 2월 30일
    expect(kstWallClockToUtc("2026-06-22T24:00")).toBeNull(); // 24시
  });
});

describe("isoInstant", () => {
  test("머신리더블 UTC ISO를 반환", () => {
    expect(isoInstant("2026-06-18T15:00:00Z")).toBe("2026-06-18T15:00:00.000Z");
  });

  test("Date 입력과 문자열 입력이 같은 결과", () => {
    const iso = "2026-06-18T15:00:00.000Z";
    expect(isoInstant(new Date(iso))).toBe(isoInstant(iso));
  });
});
