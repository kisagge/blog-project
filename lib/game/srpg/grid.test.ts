import { describe, expect, test } from "vitest";
import {
  eq,
  inBounds,
  key,
  manhattan,
  neighbors4,
  terrainAt,
  unitAt,
} from "./grid";
import { game, plainMap, unit } from "./_testkit";

describe("grid", () => {
  const map = plainMap(5, 5);

  test("manhattan", () => {
    expect(manhattan({ col: 0, row: 0 }, { col: 2, row: 3 })).toBe(5);
  });

  test("eq / key", () => {
    expect(eq({ col: 1, row: 2 }, { col: 1, row: 2 })).toBe(true);
    expect(eq({ col: 1, row: 2 }, { col: 2, row: 1 })).toBe(false);
    expect(key({ col: 1, row: 2 })).toBe("1,2");
  });

  test("inBounds", () => {
    expect(inBounds(map, { col: 4, row: 4 })).toBe(true);
    expect(inBounds(map, { col: 5, row: 0 })).toBe(false);
    expect(inBounds(map, { col: -1, row: 0 })).toBe(false);
  });

  test("neighbors4: 모서리=2, 중앙=4", () => {
    expect(neighbors4(map, { col: 0, row: 0 })).toHaveLength(2);
    expect(neighbors4(map, { col: 2, row: 2 })).toHaveLength(4);
  });

  test("terrainAt", () => {
    expect(terrainAt(map, { col: 1, row: 1 })).toBe("plain");
  });

  test("unitAt: 살아있는 유닛만(hp>0)", () => {
    const s = game(map, [
      unit("a", "dawn", "warrior", 2, 2),
      unit("d", "ashen", "mage", 3, 3, { hp: 0 }),
    ]);
    expect(unitAt(s, { col: 2, row: 2 })?.id).toBe("a");
    expect(unitAt(s, { col: 3, row: 3 })).toBeUndefined(); // 사망
    expect(unitAt(s, { col: 0, row: 0 })).toBeUndefined();
  });
});
