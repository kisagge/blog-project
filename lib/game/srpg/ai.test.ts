import { describe, expect, test } from "vitest";
import { chooseAction, runAshenPhase } from "./ai";
import { createGame, reduce } from "./state";
import { SKIRMISH_01 } from "./maps/skirmish-01";
import { manhattan } from "./grid";
import { game, plainMap, unit } from "./_testkit";

describe("chooseAction", () => {
  test("처치 가능한 대상 우선", () => {
    const s = game(
      plainMap(3, 3),
      [
        unit("a", "ashen", "warrior", 0, 0),
        unit("weak", "dawn", "archer", 1, 0, { hp: 3 }), // 인접, 처치 가능(7≥3)
        unit("tank", "dawn", "warrior", 0, 1), // 인접, 미처치(4)
      ],
      { phase: "ashen" },
    );
    expect(chooseAction(s, "a")).toEqual({
      type: "attack",
      unitId: "a",
      target: { col: 1, row: 0 },
    });
  });

  test("사거리 밖이면 접근(이동으로 거리 감소)", () => {
    const s = game(
      plainMap(6, 1),
      [unit("a", "ashen", "warrior", 0, 0), unit("t", "dawn", "warrior", 5, 0)],
      { phase: "ashen" },
    );
    const act = chooseAction(s, "a");
    expect(act.type).toBe("move");
    if (act.type === "move") {
      expect(manhattan(act.to, { col: 5, row: 0 })).toBeLessThan(5);
    }
  });

  test("치유사: 부상 아군 회복", () => {
    const s = game(
      plainMap(3, 3),
      [
        unit("c", "ashen", "cleric", 0, 0),
        unit("w", "ashen", "warrior", 1, 0, { hp: 10 }),
      ],
      { phase: "ashen" },
    );
    expect(chooseAction(s, "c")).toEqual({
      type: "heal",
      unitId: "c",
      target: { col: 1, row: 0 },
    });
  });
});

describe("runAshenPhase", () => {
  const ashenStart = () =>
    reduce(createGame(SKIRMISH_01), { type: "endPhase" }); // dawn → ashen

  test("결정론: 동일 입력 → 동일 결과", () => {
    const a = runAshenPhase(ashenStart());
    const b = runAshenPhase(ashenStart());
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  test("한 페이즈 후 dawn·라운드2로 종료(원거리라 사망 없음)", () => {
    const after = runAshenPhase(ashenStart());
    expect(after.phase).toBe("dawn");
    expect(after.round).toBe(2);
    expect(after.result).toBe("ongoing");
  });
});
