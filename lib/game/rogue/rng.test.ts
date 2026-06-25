import { describe, expect, test } from "vitest";
import { chance, hashSeed, pick, randInt, rng, weightedPick } from "./rng";

describe("rng", () => {
  test("결정론: 같은 seed → 같은 결과", () => {
    expect(rng(123)).toEqual(rng(123));
    expect(randInt(9, 1, 6)).toEqual(randInt(9, 1, 6));
  });

  test("rng value ∈ [0,1)", () => {
    for (let s = 0; s < 60; s++) {
      const v = rng(s).value;
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  test("randInt: 범위 내 정수", () => {
    for (let s = 0; s < 60; s++) {
      const r = randInt(s, 3, 7);
      expect(Number.isInteger(r.value)).toBe(true);
      expect(r.value).toBeGreaterThanOrEqual(3);
      expect(r.value).toBeLessThanOrEqual(7);
    }
  });

  test("chance: p=0 항상 false, p=1 항상 true", () => {
    for (let s = 0; s < 30; s++) {
      expect(chance(s, 0).value).toBe(false);
      expect(chance(s, 1).value).toBe(true);
    }
  });

  test("pick / weightedPick: 결정론·유효 선택", () => {
    const arr = ["a", "b", "c"] as const;
    expect(pick(4, arr)).toEqual(pick(4, arr));
    expect(arr).toContain(pick(4, arr).value);
    const w = [
      { item: "x", weight: 1 },
      { item: "y", weight: 9 },
    ];
    expect(weightedPick(4, w)).toEqual(weightedPick(4, w));
    expect(["x", "y"]).toContain(weightedPick(4, w).value);
  });

  test("hashSeed: 안정·문자열별 상이", () => {
    expect(hashSeed("hello")).toBe(hashSeed("hello"));
    expect(hashSeed("a")).not.toBe(hashSeed("b"));
  });
});
