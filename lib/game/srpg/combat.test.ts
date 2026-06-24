import { describe, expect, test } from "vitest";
import {
  healAmount,
  magicDamage,
  physicalDamage,
  resolveAttack,
  resolveHeal,
} from "./combat";
import { game, plainMap, unit } from "./_testkit";

const hp = (s: { units: { id: string; hp: number }[] }, id: string) =>
  s.units.find((u) => u.id === id)!.hp;

describe("combat formulas", () => {
  test("physical: 유닛+지형 방어 경감, 최소 1", () => {
    expect(physicalDamage(9, 5, 0)).toBe(4);
    expect(physicalDamage(9, 5, 1)).toBe(3); // 지형 방어 +1
    expect(physicalDamage(2, 5, 0)).toBe(1); // 최소 1
  });
  test("magic: 방어 절반 경감, 최소 1", () => {
    expect(magicDamage(10, 5)).toBe(8); // floor(5/2)=2
    expect(magicDamage(10, 1)).toBe(10);
    expect(magicDamage(1, 10)).toBe(1);
  });
  test("heal = atk + 4", () => {
    expect(healAmount(4)).toBe(8);
  });
});

describe("resolveAttack", () => {
  test("근접 공격 + 반격(둘 다 피해)", () => {
    const s = game(plainMap(3, 1), [
      unit("a", "dawn", "warrior", 0, 0),
      unit("b", "ashen", "warrior", 1, 0),
    ]);
    const n = resolveAttack(s, "a", { col: 1, row: 0 });
    expect(hp(n, "b")).toBe(24); // 28 - 4
    expect(hp(n, "a")).toBe(24); // 반격 4
  });

  test("궁수 2칸 공격 → 무반격", () => {
    const s = game(plainMap(3, 1), [
      unit("a", "dawn", "archer", 0, 0),
      unit("b", "ashen", "warrior", 2, 0),
    ]);
    const n = resolveAttack(s, "a", { col: 2, row: 0 });
    expect(hp(n, "b")).toBe(25); // 28 - 3
    expect(hp(n, "a")).toBe(18); // 반격 없음(거리2 > 전사 사거리1)
  });

  test("법사 AoE: 주 100% + 인접 적 50%, 주 대상 반격", () => {
    const s = game(plainMap(3, 2), [
      unit("m", "dawn", "mage", 0, 0),
      unit("w", "ashen", "warrior", 1, 0), // 주 대상 def5
      unit("ar", "ashen", "archer", 1, 1), // (1,0) 인접 splash def2
    ]);
    const n = resolveAttack(s, "m", { col: 1, row: 0 });
    expect(hp(n, "w")).toBe(20); // 28 - magic(10,5)=8
    expect(hp(n, "ar")).toBe(14); // 18 - floor(magic(10,2)=9 / 2)=4
    expect(hp(n, "m")).toBe(8); // 반격 physical(9, def1, 0)=8 → 16-8
  });

  test("사망 → hp 0(죽은 대상은 반격 불가)", () => {
    const s = game(plainMap(2, 1), [
      unit("a", "dawn", "warrior", 0, 0),
      unit("b", "ashen", "archer", 1, 0, { hp: 3 }),
    ]);
    const n = resolveAttack(s, "a", { col: 1, row: 0 }); // physical(9,2,0)=7 ≥ 3
    expect(hp(n, "b")).toBe(0);
    expect(hp(n, "a")).toBe(28);
  });

  test("적 없는 칸 공격 → throw", () => {
    const s = game(plainMap(2, 1), [unit("a", "dawn", "warrior", 0, 0)]);
    expect(() => resolveAttack(s, "a", { col: 1, row: 0 })).toThrow();
  });
});

describe("resolveHeal", () => {
  test("회복 + 최대치 캡", () => {
    const s = game(plainMap(2, 1), [
      unit("c", "dawn", "cleric", 0, 0),
      unit("w", "dawn", "warrior", 1, 0, { hp: 20 }),
    ]);
    const n = resolveHeal(s, "c", { col: 1, row: 0 });
    expect(hp(n, "w")).toBe(28); // 20 + 8 = 28(cap)
  });

  test("아군 아닌 대상 → throw", () => {
    const s = game(plainMap(2, 1), [
      unit("c", "dawn", "cleric", 0, 0),
      unit("e", "ashen", "warrior", 1, 0),
    ]);
    expect(() => resolveHeal(s, "c", { col: 1, row: 0 })).toThrow();
  });
});
