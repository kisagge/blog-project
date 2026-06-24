import { describe, expect, test } from "vitest";
import { aoeCoords, attackableCoords, enemiesInRange } from "./range";
import { game, plainMap, unit } from "./_testkit";

describe("range", () => {
  test("attackableCoords: 맨해튼 1..rng", () => {
    expect(attackableCoords({ col: 2, row: 2 }, 1)).toHaveLength(4);
    expect(attackableCoords({ col: 5, row: 5 }, 2)).toHaveLength(12); // 4 + 8
  });

  test("aoeCoords: 중심 + 4이웃(경계 처리)", () => {
    const s = game(plainMap(5, 5), []);
    expect(aoeCoords(s, { col: 2, row: 2 })).toHaveLength(5);
    expect(aoeCoords(s, { col: 0, row: 0 })).toHaveLength(3); // 모서리
  });

  test("enemiesInRange: 사거리 내 적만(아군·범위밖 제외)", () => {
    const s = game(plainMap(5, 5), [
      unit("a", "dawn", "archer", 0, 0), // RNG2
      unit("e1", "ashen", "warrior", 2, 0), // 거리2 → 포함
      unit("e2", "ashen", "mage", 3, 0), // 거리3 → 제외
      unit("f", "dawn", "warrior", 1, 0), // 아군 → 제외
    ]);
    expect(
      enemiesInRange(s, s.units[0], { col: 0, row: 0 }).map((u) => u.id),
    ).toEqual(["e1"]);
  });
});
