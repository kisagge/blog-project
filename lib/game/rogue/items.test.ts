import { describe, expect, test } from "vitest";
import { POTION, randomItem, shopStock } from "./items";

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
    expect(st[2]).toEqual(POTION);
    expect(shopStock(9, 2)).toEqual(shopStock(9, 2));
  });

  test("깊을수록 무기 티어 ≥ 얕은 층", () => {
    const shallow = shopStock(1, 1).value[0].power;
    const deep = shopStock(1, 9).value[0].power;
    expect(deep).toBeGreaterThanOrEqual(shallow);
  });
});
