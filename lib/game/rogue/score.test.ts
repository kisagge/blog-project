import { describe, expect, test } from "vitest";
import { computeScore, scoreFromStats } from "./score";
import { newRun } from "./run";

describe("score", () => {
  test("depth·kills·gold 가중", () => {
    const base = newRun(1);
    const s = {
      ...base,
      depth: 3,
      kills: 4,
      player: { ...base.player, gold: 50 },
    };
    expect(computeScore(s)).toBe(3 * 100 + 4 * 25 + 50); // 450
  });

  test("scoreFromStats: 스탯만으로 동일 점수(서버 재계산 공용)", () => {
    expect(scoreFromStats(3, 4, 50)).toBe(450);
    expect(scoreFromStats(1, 0, 0)).toBe(100);
  });
});
