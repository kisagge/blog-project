import { describe, expect, test } from "vitest";
import { drawEvent, drawRest, drawTrap } from "./events";

describe("events", () => {
  test("drawEvent: 결정론·유효 종류(보스 제외)", () => {
    expect(drawEvent(11)).toEqual(drawEvent(11));
    for (let s = 0; s < 60; s++) {
      expect(["combat", "treasure", "shop", "rest", "trap"]).toContain(
        drawEvent(s).value,
      );
    }
  });

  test("drawRest/drawTrap: 결정론·유효 종류, 분포에 각 결과 등장", () => {
    expect(drawRest(7)).toEqual(drawRest(7));
    expect(drawTrap(7)).toEqual(drawTrap(7));

    const rests = new Set<string>();
    const traps = new Set<string>();
    for (let s = 0; s < 80; s++) {
      rests.add(drawRest(s).value);
      traps.add(drawTrap(s).value);
    }
    expect([...rests].sort()).toEqual(["campfire", "heal", "herb"]);
    expect([...traps].sort()).toEqual(["damage", "gold"]);
  });
});
