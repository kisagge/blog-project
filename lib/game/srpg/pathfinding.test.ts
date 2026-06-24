import { describe, expect, test } from "vitest";
import { findPath, reachable } from "./pathfinding";
import { key } from "./grid";
import { game, plainMap, unit } from "./_testkit";

describe("reachable", () => {
  test("이동코스트 ≤ MOV, 시작 칸 포함", () => {
    const s = game(plainMap(7, 7), [unit("a", "dawn", "mage", 3, 3)]); // mage MOV3
    const r = reachable(s, s.units[0]);
    expect(r.has(key({ col: 3, row: 3 }))).toBe(true); // 시작
    expect(r.get(key({ col: 3, row: 0 }))?.cost).toBe(3);
    expect(r.has(key({ col: 0, row: 0 }))).toBe(false); // 맨해튼6 > 3
  });

  test("지형 이동코스트 + 통행불가(벽)", () => {
    const map = plainMap(5, 1);
    map.tiles[0][1] = "forest"; // cost2
    map.tiles[0][3] = "wall"; // 통행불가
    const s = game(map, [unit("a", "dawn", "warrior", 0, 0)]); // MOV4
    const r = reachable(s, s.units[0]);
    expect(r.get(key({ col: 2, row: 0 }))?.cost).toBe(3); // 1 + forest2
    expect(r.has(key({ col: 3, row: 0 }))).toBe(false); // 벽
    expect(r.has(key({ col: 4, row: 0 }))).toBe(false); // 벽 너머(1행이라 우회 불가)
  });

  test("아군은 통과 가능하나 정지 불가", () => {
    const map = plainMap(5, 1);
    const a = unit("a", "dawn", "warrior", 0, 0);
    const ally = unit("b", "dawn", "archer", 1, 0);
    const r = reachable(game(map, [a, ally]), a);
    expect(r.has(key({ col: 1, row: 0 }))).toBe(false); // 아군 점유 → 정지 불가
    expect(r.get(key({ col: 2, row: 0 }))?.cost).toBe(2); // 통과는 됨
  });

  test("적 유닛은 통과 불가", () => {
    const map = plainMap(5, 1);
    const a = unit("a", "dawn", "warrior", 0, 0);
    const enemy = unit("e", "ashen", "warrior", 1, 0);
    const r = reachable(game(map, [a, enemy]), a);
    expect(r.has(key({ col: 1, row: 0 }))).toBe(false);
    expect(r.has(key({ col: 2, row: 0 }))).toBe(false); // 적이 막음
  });
});

describe("findPath", () => {
  test("최단 경로 + 도달 불가 null", () => {
    const s = game(plainMap(5, 5), [unit("a", "dawn", "warrior", 0, 0)]); // MOV4
    const p = findPath(s, s.units[0], { col: 0, row: 3 });
    expect(p?.map((c) => c.row)).toEqual([0, 1, 2, 3]); // cost3
    expect(findPath(s, s.units[0], { col: 4, row: 4 })).toBeNull(); // cost8 > 4
  });
});
