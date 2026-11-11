import { describe, expect, test } from "vitest";
import { formatReadTime, readDepth } from "@/lib/read-depth";

describe("readDepth", () => {
  test("화면 아랫단이 본문 어디까지 닿았는지를 %로", () => {
    // 본문 높이 2000, 화면 800: 본문 시작이 화면 맨 위(0)면 800/2000 = 40%
    expect(readDepth(0, 2000, 800)).toBe(40);
    // 1200 내려감(top=-1200) → 끝까지(100%)
    expect(readDepth(-1200, 2000, 800)).toBe(100);
  });

  test("본문이 아직 화면 아래(헤더만 보임) → 0, 본문 이후까지 내려가도 100에서 멈춤", () => {
    expect(readDepth(900, 2000, 800)).toBe(0);
    expect(readDepth(-5000, 2000, 800)).toBe(100);
  });

  test("한 화면에 다 보이는 짧은 글은 100, 높이 0은 0", () => {
    expect(readDepth(100, 300, 800)).toBe(100);
    expect(readDepth(0, 0, 800)).toBe(0);
  });
});

describe("formatReadTime", () => {
  test.each([
    [0, "0초"],
    [59, "59초"],
    [120, "2분"],
    [125, "2분 5초"],
    [3600, "60분"],
  ])("%i초 → %s", (sec, out) => {
    expect(formatReadTime(sec)).toBe(out);
  });
});
