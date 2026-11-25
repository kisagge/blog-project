import { describe, expect, test } from "vitest";
import {
  buffDesc,
  enchantText,
  neopleDateTime,
} from "@/app/df/[server]/[characterId]/sections/format";

describe("buffDesc", () => {
  test("{valueN} 자리표시를 값으로, 줄바꿈은 가운뎃점으로", () => {
    expect(
      buffDesc({
        desc: "힘 {value1} 증가\n지능 {value2}%",
        values: ["10", "5"],
      }),
    ).toBe("힘 10 증가 · 지능 5%");
  });
  test("설명 없으면 null", () => {
    expect(buffDesc(undefined)).toBeNull();
    expect(buffDesc({ values: ["1"] })).toBeNull();
  });
});

describe("enchantText", () => {
  test("마법부여 능력치를 '이름 +값'으로 나열, 없으면 null", () => {
    expect(
      enchantText({
        status: [
          { name: "힘", value: 30 },
          { name: "지능", value: 30 },
        ],
      }),
    ).toBe("힘 +30, 지능 +30");
    expect(enchantText({ status: [] })).toBeNull();
    expect(enchantText(null)).toBeNull();
  });
});

describe("neopleDateTime", () => {
  test("Neople 타임라인 시각(KST 'YYYY-MM-DD HH:MM')을 오프셋 포함 datetime으로", () => {
    expect(neopleDateTime("2026-11-20 21:05")).toBe("2026-11-20T21:05+09:00");
  });
  test("형식이 다르면 null(일반 텍스트로 표시)", () => {
    expect(neopleDateTime("어제")).toBeNull();
  });
});
