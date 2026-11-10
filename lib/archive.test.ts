import { describe, expect, test } from "vitest";
import { groupByYearMonth, kstDayOfMonth } from "@/lib/archive";

const post = (slug: string, iso: string) => ({
  slug,
  createdAt: new Date(iso),
});

describe("groupByYearMonth", () => {
  test("연(내림차순) → 월(내림차순)으로 묶고 연도별 글 수를 셈, 입력 순서 유지", () => {
    const years = groupByYearMonth([
      post("c", "2026-11-05T00:00:00Z"),
      post("b", "2026-11-01T00:00:00Z"),
      post("a", "2026-03-01T00:00:00Z"),
      post("z", "2025-12-31T00:00:00Z"),
    ]);
    expect(years.map((y) => [y.year, y.count])).toEqual([
      [2026, 3],
      [2025, 1],
    ]);
    expect(years[0].months.map((m) => m.month)).toEqual([11, 3]);
    expect(years[0].months[0].items.map((i) => i.slug)).toEqual(["c", "b"]);
  });

  test("KST 기준 경계: UTC 12/31 15:00 = KST 1/1 00:00 → 새해로", () => {
    const years = groupByYearMonth([
      post("new-year", "2025-12-31T15:00:00Z"),
      post("old-year", "2025-12-31T14:59:59Z"),
    ]);
    expect(years.map((y) => y.year)).toEqual([2026, 2025]);
    expect(years[0].months[0].month).toBe(1);
    expect(years[1].months[0].month).toBe(12);
  });

  test("빈 입력 → 빈 배열", () => {
    expect(groupByYearMonth([])).toEqual([]);
  });
});

describe("kstDayOfMonth", () => {
  test("UTC 전날 15시 이후는 KST 다음 날", () => {
    expect(kstDayOfMonth(new Date("2026-11-09T14:59:00Z"))).toBe(9);
    expect(kstDayOfMonth(new Date("2026-11-09T15:00:00Z"))).toBe(10);
  });
});
