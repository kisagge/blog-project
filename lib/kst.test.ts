import { kstDate, kstDateTime, isoInstant } from "@/lib/kst";

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

describe("isoInstant", () => {
  test("머신리더블 UTC ISO를 반환", () => {
    expect(isoInstant("2026-06-18T15:00:00Z")).toBe("2026-06-18T15:00:00.000Z");
  });

  test("Date 입력과 문자열 입력이 같은 결과", () => {
    const iso = "2026-06-18T15:00:00.000Z";
    expect(isoInstant(new Date(iso))).toBe(isoInstant(iso));
  });
});
