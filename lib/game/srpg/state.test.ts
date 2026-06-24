import { describe, expect, test } from "vitest";
import { createGame, legalAttacks, legalMoves, reduce } from "./state";
import { SKIRMISH_01 } from "./maps/skirmish-01";
import type { GameState } from "./types";
import { game, plainMap, unit } from "./_testkit";

const find = (s: GameState, id: string) => s.units.find((x) => x.id === id)!;
const hp = (s: GameState, id: string) => find(s, id).hp;

describe("reduce: move", () => {
  test("이동 → moved, 재이동/범위밖 throw", () => {
    const s = game(plainMap(5, 5), [unit("a", "dawn", "warrior", 0, 0)]);
    const m = reduce(s, { type: "move", unitId: "a", to: { col: 0, row: 2 } });
    expect(m.units[0].row).toBe(2);
    expect(m.units[0].moved).toBe(true);
    expect(() =>
      reduce(m, { type: "move", unitId: "a", to: { col: 0, row: 3 } }),
    ).toThrow(); // 이미 이동
    expect(() =>
      reduce(s, { type: "move", unitId: "a", to: { col: 4, row: 4 } }),
    ).toThrow(); // cost8 > MOV4
  });
});

describe("reduce: attack", () => {
  const base = () =>
    game(plainMap(5, 1), [
      unit("a", "dawn", "warrior", 0, 0),
      unit("b", "ashen", "warrior", 1, 0),
    ]);

  test("공격 → acted, 재행동 throw", () => {
    const n = reduce(base(), {
      type: "attack",
      unitId: "a",
      target: { col: 1, row: 0 },
    });
    expect(find(n, "a").acted).toBe(true);
    expect(() =>
      reduce(n, { type: "attack", unitId: "a", target: { col: 1, row: 0 } }),
    ).toThrow();
  });

  test("사거리 밖 throw", () => {
    const s = game(plainMap(5, 1), [
      unit("a", "dawn", "warrior", 0, 0),
      unit("b", "ashen", "warrior", 3, 0),
    ]);
    expect(() =>
      reduce(s, { type: "attack", unitId: "a", target: { col: 3, row: 0 } }),
    ).toThrow();
  });

  test("상대 진영 유닛 조작 throw", () => {
    expect(() =>
      reduce(base(), {
        type: "attack",
        unitId: "b",
        target: { col: 0, row: 0 },
      }),
    ).toThrow();
  });
});

describe("reduce: 합성·결과·기타 액션", () => {
  test("이동 → 공격으로 처치 → dawn-win, 이후 액션 throw", () => {
    const s = game(plainMap(5, 1), [
      unit("a", "dawn", "warrior", 0, 0),
      unit("b", "ashen", "archer", 3, 0, { hp: 5 }),
    ]);
    const moved = reduce(s, {
      type: "move",
      unitId: "a",
      to: { col: 2, row: 0 },
    });
    const killed = reduce(moved, {
      type: "attack",
      unitId: "a",
      target: { col: 3, row: 0 },
    }); // physical(9,2,0)=7 ≥ 5
    expect(hp(killed, "b")).toBe(0);
    expect(killed.result).toBe("dawn-win");
    expect(() => reduce(killed, { type: "wait", unitId: "a" })).toThrow();
  });

  test("heal 액션", () => {
    const s = game(plainMap(2, 1), [
      unit("c", "dawn", "cleric", 0, 0),
      unit("w", "dawn", "warrior", 1, 0, { hp: 10 }),
    ]);
    const n = reduce(s, {
      type: "heal",
      unitId: "c",
      target: { col: 1, row: 0 },
    });
    expect(hp(n, "w")).toBe(18);
    expect(find(n, "c").acted).toBe(true);
  });

  test("wait → moved + acted", () => {
    const s = game(plainMap(2, 1), [unit("a", "dawn", "warrior", 0, 0)]);
    const n = reduce(s, { type: "wait", unitId: "a" });
    expect(n.units[0].moved).toBe(true);
    expect(n.units[0].acted).toBe(true);
  });

  test("endPhase → ashen 페이즈", () => {
    const n = reduce(createGame(SKIRMISH_01), { type: "endPhase" });
    expect(n.phase).toBe("ashen");
  });
});

describe("legal helpers", () => {
  test("legalMoves / legalAttacks(현재 진영만)", () => {
    const s = game(plainMap(5, 1), [
      unit("a", "dawn", "warrior", 0, 0),
      unit("b", "ashen", "warrior", 1, 0),
    ]);
    expect(legalAttacks(s, "a")).toHaveLength(1); // 인접 적
    expect(legalMoves(s, "a").length).toBeGreaterThan(0);
    expect(legalMoves(s, "b")).toHaveLength(0); // 상대 진영
    expect(legalAttacks(s, "b")).toHaveLength(0);
  });
});
