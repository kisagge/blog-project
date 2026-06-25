import { describe, expect, test } from "vitest";
import { attackRoll } from "./combat";

describe("combat attackRoll", () => {
  test("결정론 + 최소 1", () => {
    expect(attackRoll(5, 10, 3, false)).toEqual(attackRoll(5, 10, 3, false));
    expect(attackRoll(5, 1, 100, false).dmg).toBe(1); // atk<def → 1
  });

  test("canCrit=false면 절대 치명타 아님", () => {
    for (let s = 0; s < 100; s++) {
      expect(attackRoll(s, 10, 2, false).crit).toBe(false);
    }
  });

  test("canCrit=true면 일부 seed에서 치명타", () => {
    let any = false;
    for (let s = 0; s < 200; s++) {
      if (attackRoll(s, 10, 2, true).crit) {
        any = true;
        break;
      }
    }
    expect(any).toBe(true);
  });
});
