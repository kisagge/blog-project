import { describe, expect, test } from "vitest";
import { floorIntro, isBossStep } from "./dungeon";
import { STEPS_PER_FLOOR } from "./types";

describe("dungeon", () => {
  test("isBossStep: 마지막 걸음이 보스", () => {
    expect(isBossStep(STEPS_PER_FLOOR - 1)).toBe(false);
    expect(isBossStep(STEPS_PER_FLOOR)).toBe(true);
  });

  test("floorIntro: 깊이를 포함하고 결정론(같은 깊이=같은 문장)", () => {
    expect(floorIntro(3)).toBe(floorIntro(3));
    expect(floorIntro(3).startsWith("3층.")).toBe(true);
    // 인접 층은 다른 분위기 문장(순환).
    expect(floorIntro(1)).not.toBe(floorIntro(2));
  });
});
