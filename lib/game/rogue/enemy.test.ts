import { describe, expect, test } from "vitest";
import { eligibleEnemies, makeEnemy } from "./enemy";

describe("enemy", () => {
  test("결정론", () => {
    expect(makeEnemy(7, 3, false)).toEqual(makeEnemy(7, 3, false));
  });

  test("깊이 스케일: 깊을수록 HP·ATK↑ (보스 베이스 스케일 비교)", () => {
    const b1 = makeEnemy(0, 1, true).value;
    const b7 = makeEnemy(0, 7, true).value; // 1·7층은 같은 보스(순환 주기 3)
    expect(b1.boss).toBe(true);
    expect(b1.hp).toBe(40); // 깊이1 수문장 = 베이스
    expect(b7.hp).toBeGreaterThan(b1.hp);
    expect(b7.atk).toBeGreaterThan(b1.atk);
    expect(b7.maxHp).toBe(b7.hp);
  });

  test("일반 적은 테이블에서, hp=maxHp", () => {
    const e = makeEnemy(3, 2, false).value;
    expect(e.boss).toBe(false);
    expect(e.hp).toBe(e.maxHp);
    expect(e.hp).toBeGreaterThan(0);
  });

  test("깊이 게이팅: 얕은 층은 적이 적고, 깊을수록 강적이 풀린다", () => {
    const d1 = eligibleEnemies(1);
    const d5 = eligibleEnemies(5);
    expect(d1.length).toBeGreaterThan(0);
    expect(d5.length).toBeGreaterThan(d1.length);
    expect(d1.every((e) => e.minDepth <= 1)).toBe(true);
    expect(d5.some((e) => e.id === "knight")).toBe(true); // minDepth 5
    expect(d1.some((e) => e.id === "knight")).toBe(false);
  });

  test("보스는 층마다 순환(같은 깊이=같은 보스, 무작위 아님)", () => {
    expect(makeEnemy(0, 1, true).value.name).toBe("심연의 수문장");
    expect(makeEnemy(0, 2, true).value.name).toBe("굶주린 아가리");
    expect(makeEnemy(0, 3, true).value.name).toBe("부서진 거상");
    // 시드 무관(보스 선택에 RNG 미사용).
    expect(makeEnemy(999, 2, true).value.name).toBe("굶주린 아가리");
  });
});
