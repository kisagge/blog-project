import { describe, expect, test } from "vitest";
import { endPhase, evaluate } from "./turn";
import { game, plainMap, unit } from "./_testkit";

describe("endPhase", () => {
  test("진영 토글 + 플래그 리셋 + 라운드 증가", () => {
    const s = game(plainMap(2, 1), [
      unit("a", "dawn", "warrior", 0, 0, { moved: true, acted: true }),
    ]);
    const a1 = endPhase(s);
    expect(a1.phase).toBe("ashen");
    expect(a1.round).toBe(1); // dawn→ashen은 라운드 유지
    expect(a1.units[0].moved).toBe(false);
    expect(a1.units[0].acted).toBe(false);

    const a2 = endPhase(a1);
    expect(a2.phase).toBe("dawn");
    expect(a2.round).toBe(2); // ashen→dawn 복귀 시 +1
  });
});

describe("evaluate", () => {
  test("승/패/진행", () => {
    const both = game(plainMap(2, 1), [
      unit("a", "dawn", "warrior", 0, 0),
      unit("b", "ashen", "warrior", 1, 0),
    ]);
    expect(evaluate(both).result).toBe("ongoing");

    const dawnWin = game(plainMap(2, 1), [
      unit("a", "dawn", "warrior", 0, 0),
      unit("b", "ashen", "warrior", 1, 0, { hp: 0 }),
    ]);
    expect(evaluate(dawnWin).result).toBe("dawn-win");

    const ashenWin = game(plainMap(2, 1), [
      unit("a", "dawn", "warrior", 0, 0, { hp: 0 }),
      unit("b", "ashen", "warrior", 1, 0),
    ]);
    expect(evaluate(ashenWin).result).toBe("ashen-win");
  });
});
