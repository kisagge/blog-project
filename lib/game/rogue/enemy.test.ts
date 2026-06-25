import { describe, expect, test } from "vitest";
import { makeEnemy } from "./enemy";

describe("enemy", () => {
  test("결정론", () => {
    expect(makeEnemy(7, 3, false)).toEqual(makeEnemy(7, 3, false));
  });

  test("깊이 스케일: 깊을수록 HP·ATK↑ (보스 고정 베이스로 비교)", () => {
    const b1 = makeEnemy(0, 1, true).value;
    const b5 = makeEnemy(0, 5, true).value;
    expect(b1.boss).toBe(true);
    expect(b1.hp).toBe(40); // 깊이1 = 베이스
    expect(b5.hp).toBeGreaterThan(b1.hp);
    expect(b5.atk).toBeGreaterThan(b1.atk);
    expect(b5.maxHp).toBe(b5.hp);
  });

  test("일반 적은 테이블에서, hp=maxHp", () => {
    const e = makeEnemy(3, 2, false).value;
    expect(e.boss).toBe(false);
    expect(e.hp).toBe(e.maxHp);
    expect(e.hp).toBeGreaterThan(0);
  });
});
