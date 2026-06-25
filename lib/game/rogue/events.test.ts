import { describe, expect, test } from "vitest";
import { drawEvent } from "./events";

describe("events", () => {
  test("drawEvent: 결정론·유효 종류(보스 제외)", () => {
    expect(drawEvent(11)).toEqual(drawEvent(11));
    for (let s = 0; s < 60; s++) {
      expect(["combat", "treasure", "shop", "rest", "trap"]).toContain(
        drawEvent(s).value,
      );
    }
  });
});
