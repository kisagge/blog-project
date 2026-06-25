import { describe, expect, test } from "vitest";
import {
  ARMORS,
  GREATER_POTION,
  POTION,
  WEAPONS,
  randomItem,
  shopStock,
} from "./items";

describe("items", () => {
  test("randomItem: 결정론·유효 종류", () => {
    expect(randomItem(3, 2)).toEqual(randomItem(3, 2));
    expect(["weapon", "armor", "potion"]).toContain(
      randomItem(3, 2).value.kind,
    );
  });

  test("shopStock: 무기·방어구·물약 3종", () => {
    const st = shopStock(9, 2).value;
    expect(st).toHaveLength(3);
    expect(st[0].kind).toBe("weapon");
    expect(st[1].kind).toBe("armor");
    expect(st[2]).toEqual(POTION); // 얕은 층은 기본 물약
    expect(shopStock(9, 2)).toEqual(shopStock(9, 2));
  });

  test("깊을수록 무기 티어 ≥ 얕은 층 (5티어까지)", () => {
    const shallow = shopStock(1, 1).value[0].power;
    const deep = shopStock(1, 11).value[0].power;
    expect(deep).toBeGreaterThanOrEqual(shallow);
    expect(WEAPONS[WEAPONS.length - 1].power).toBe(21);
    expect(ARMORS[ARMORS.length - 1].power).toBe(16);
  });

  test("깊은 층(≥4)에선 큰 물약이 등장 가능, 얕은 층엔 없음", () => {
    // 얕은 층: 어떤 시드든 기본 물약만.
    for (let s = 0; s < 40; s++) {
      const p = randomItem(s, 1).value;
      if (p.kind === "potion") expect(p.id).toBe(POTION.id);
    }
    // 깊은 층: 일부 시드에서 큰 물약 등장.
    let greater = false;
    for (let s = 0; s < 80 && !greater; s++) {
      const p = shopStock(s, 8).value[2];
      if (p.id === GREATER_POTION.id) greater = true;
    }
    expect(greater).toBe(true);
  });
});
